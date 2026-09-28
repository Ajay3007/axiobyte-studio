import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv'];

/**
 * Merge heterogeneous geometries (Box, Extrude, Cylinder, Tube...) into one.
 * Everything is normalised to non-indexed position/normal/uv so any mix merges,
 * which lets a whole sub-assembly render as a single draw call.
 */
export function mergeAll(geometries) {
  const prepared = geometries.map((source) => {
    const geo = source.index ? source.toNonIndexed() : source;
    if (geo !== source) source.dispose();
    for (const name of Object.keys(geo.attributes)) {
      if (!KEEP_ATTRIBUTES.includes(name)) geo.deleteAttribute(name);
    }
    geo.morphAttributes = {};
    geo.clearGroups();
    return geo;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((g) => g.dispose());
  if (!merged) throw new Error('mergeAll: incompatible geometries');
  return merged;
}

export function boxAt(w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

/** Draws a rounded rectangle onto a Shape or Path. */
export function roundedRect(target, x0, y0, x1, y1, r) {
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  target.moveTo(x0 + rr, y0);
  target.lineTo(x1 - rr, y0);
  target.quadraticCurveTo(x1, y0, x1, y0 + rr);
  target.lineTo(x1, y1 - rr);
  target.quadraticCurveTo(x1, y1, x1 - rr, y1);
  target.lineTo(x0 + rr, y1);
  target.quadraticCurveTo(x0, y1, x0, y1 - rr);
  target.lineTo(x0, y0 + rr);
  target.quadraticCurveTo(x0, y0, x0 + rr, y0);
  return target;
}

export function polygon(target, points) {
  target.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) target.lineTo(points[i][0], points[i][1]);
  target.closePath();
  return target;
}

export function circlePath(x, y, r) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

function extrude(shape, depth, bevel, curveSegments) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * bevel, 1e-4),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, bevel); // extrusion now spans exactly [0, depth]
  return g;
}

/**
 * Profile drawn in (u, v) and extruded along +X.
 * Mapping after rotation: u -> -Z, v -> +Y, extrusion -> +X over [0, depth].
 */
export function extrudeAlongX(shape, depth, bevel = 0, curveSegments = 12) {
  const g = extrude(shape, depth, bevel, curveSegments);
  g.rotateY(Math.PI / 2);
  return g;
}

/**
 * Board-plane profile drawn in (x, -z) and extruded upward along +Y over [0, depth].
 * Author points with the xz() helper so they read in board coordinates.
 */
export function extrudeAlongY(shape, depth, bevel = 0, curveSegments = 16) {
  const g = extrude(shape, depth, bevel, curveSegments);
  g.rotateX(-Math.PI / 2);
  return g;
}

export const xz = (x, z) => [x, -z];

/** Offset a 2D polyline sideways with mitred joints (used for differential pairs). */
export function offsetPolyline(points, d) {
  const n = points.length;
  const normal = (a, b) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  };
  return points.map((p, i) => {
    let nx;
    let nz;
    if (i === 0) [nx, nz] = normal(points[0], points[1]);
    else if (i === n - 1) [nx, nz] = normal(points[n - 2], points[n - 1]);
    else {
      const a = normal(points[i - 1], p);
      const b = normal(p, points[i + 1]);
      let mx = a[0] + b[0];
      let mz = a[1] + b[1];
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml;
      mz /= ml;
      const s = 1 / Math.max(0.3, mx * a[0] + mz * a[1]);
      nx = mx * s;
      nz = mz * s;
    }
    return [p[0] + nx * d, p[1] + nz * d];
  });
}

export class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, t * this.height, Math.sin(a) * this.radius);
  }
}
