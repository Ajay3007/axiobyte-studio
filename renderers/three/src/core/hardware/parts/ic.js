import * as THREE from 'three';
import { extrudeAlongY, roundedRect } from '../../geometry.js';
import { canvasTexture, CANVAS_FONT } from '../../textures.js';

/**
 * Gull-wing lead pointing along +X, starting at the body edge (x = 0).
 * Side profile: out of the body, bend down, flat foot on the pad.
 */
function gullWingGeometry(len, width, rise) {
  const t = Math.min(0.018, width * 0.55);
  const a = len * 0.28;
  const b = len * 0.58;
  const centre = [
    [-0.02, rise],
    [a, rise],
    [b, t / 2],
    [len, t / 2],
  ];
  const shape = new THREE.Shape();
  centre.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y + t / 2) : shape.lineTo(x, y + t / 2)));
  for (let i = centre.length - 1; i >= 0; i--) shape.lineTo(centre[i][0], centre[i][1] - t / 2);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2);
  return g;
}

function labelTexture(lines, pxW, pxH) {
  return canvasTexture(pxW, pxH, (ctx, w, h) => {
    const n = lines.length;
    const lineH = h / (n + 1.2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const main = i === 1 && n > 2;
      ctx.font = `${main ? 600 : 500} ${Math.round(lineH * (main ? 0.78 : 0.62))}px ${CANVAS_FONT}`;
      ctx.fillStyle = main ? 'rgba(214,212,204,0.78)' : 'rgba(190,190,184,0.55)';
      ctx.fillText(line, w / 2, lineH * (i + 1.1), w * 0.94);
    });
  });
}

/**
 * Generic IC package: QFP/SOIC (gull-wing leads) or QFN (leadLen 0, edge pads).
 * Returns a group whose origin is the package centre on the PCB surface.
 */
export function createIC(kit, opts = {}) {
  const {
    w = 1,
    d = 1,
    h = 0.12,
    standoff = 0.02,
    pins = { x: 0, z: 0 },
    pitch = 0.1,
    leadLen = 0.12,
    leadW = 0.035,
    body = 'mold',
    label = null,
    labelScale = 0.82,
    pin1 = true,
    name = 'ic',
  } = opts;

  const group = new THREE.Group();
  group.name = name;

  const bevel = Math.min(0.018, h * 0.2);
  const bodyGeo = kit.geometry(`ic-body:${w}:${d}:${h}`, () => {
    const s = roundedRect(new THREE.Shape(), -w / 2, -d / 2, w / 2, d / 2, Math.min(w, d) * 0.03);
    return extrudeAlongY(s, h, bevel, 4);
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, kit.material(body));
  bodyMesh.position.y = standoff;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.name = `${name}-body`;
  group.add(bodyMesh);

  const nx = pins.x ?? 0;
  const nz = pins.z ?? 0;
  const total = 2 * nx + 2 * nz;
  if (total > 0) {
    const rise = standoff + h * 0.38;
    const geo =
      leadLen > 0
        ? kit.geometry(`lead:${leadLen}:${leadW}:${rise.toFixed(4)}`, () => gullWingGeometry(leadLen, leadW, rise))
        : kit.geometry(`qfn-pad:${leadW}`, () => {
            const g = new THREE.BoxGeometry(0.07, 0.012, leadW);
            g.translate(-0.03, 0.006, 0);
            return g;
          });
    const leads = new THREE.InstancedMesh(geo, kit.material('tin'), total);
    leads.name = `${name}-leads`;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    let k = 0;
    const put = (x, z, rot) => {
      q.setFromAxisAngle(up, rot);
      m.compose(pos.set(x, 0, z), q, one);
      leads.setMatrixAt(k++, m);
    };
    for (let i = 0; i < nx; i++) {
      const o = (i - (nx - 1) / 2) * pitch;
      put(w / 2, o, 0);
      put(-w / 2, o, Math.PI);
    }
    for (let i = 0; i < nz; i++) {
      const o = (i - (nz - 1) / 2) * pitch;
      put(o, d / 2, -Math.PI / 2);
      put(o, -d / 2, Math.PI / 2);
    }
    leads.instanceMatrix.needsUpdate = true;
    leads.castShadow = true;
    leads.computeBoundingSphere();
    group.add(leads);
  }

  const top = standoff + h;
  if (label) {
    const lw = w * labelScale;
    const ld = d * labelScale * (label.length > 2 ? 0.8 : 0.5);
    const px = 420;
    const tex = kit.texture(labelTexture(label, Math.round(px * Math.max(lw / ld, 1)), Math.round(px * Math.max(ld / lw, 1) * 0.9)));
    const mat = kit.own(
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    mat.userData.noHighlight = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), mat);
    plane.geometry.rotateX(-Math.PI / 2);
    plane.position.set(0, top + 0.001, label.length > 2 ? 0 : d * 0.06);
    plane.name = `${name}-label`;
    plane.userData.decal = true;
    group.add(plane);
  }

  if (pin1) {
    const r = Math.min(w, d) * 0.055;
    const dot = new THREE.Mesh(
      kit.geometry(`dimple:${r.toFixed(3)}`, () => new THREE.CylinderGeometry(r, r, 0.003, 20)),
      kit.material('dimple'),
    );
    dot.position.set(-w / 2 + r * 2.6, top + 0.0005, -d / 2 + r * 2.6);
    group.add(dot);
  }

  group.userData.size = { w, d, h: top };
  return group;
}
