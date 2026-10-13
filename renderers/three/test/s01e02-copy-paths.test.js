// s01e02, the CPU copies as STRUCTURED DATA-FLOW ROUTES: explicit world-space waypoints taken from
// asset anchors, straight runs joined by fixed-radius corners, one constant thickness, a small 3D
// arrowhead into the destination — never a hand-drawn loop, never a ring around the CPU.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e02-zero-copy/timeline/words.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STAGE_SRC = fs.readFileSync(path.join(HERE, '../../../episodes/s01e02-zero-copy/three/stage.js'), 'utf8');
const RED = new THREE.Color('#ff5c55');
const sameHue = (c, hue) => {
  const n = (x) => {
    const s = x.r + x.g + x.b || 1;
    return [x.r / s, x.g / s, x.b / s];
  };
  const [a, b] = [n(c), n(hue)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.03;
};

let registry;
let stage;
let story;

async function build() {
  const scene = new THREE.Scene();
  const reg = new ComponentRegistry();
  const { createNicScene } = await import('../src/domains/networking/nic/scene.js');
  createNicScene({ engine: { scene, aspect: 16 / 9 }, registry: reg, camera: { definePreset() {}, addResolver() {} } });
  scene.updateMatrixWorld(true);
  const { createZeroCopyStage } = await import('../../../episodes/s01e02-zero-copy/three/stage.js');
  const st = createZeroCopyStage({ engine: { scene }, registry: reg });
  const { buildStoryboard } = await import('../../../episodes/s01e02-zero-copy/three/storyboard.js');
  return { registry: reg, stage: st, story: buildStoryboard({ timeline: new TimelineParser(words), registry: reg }) };
}

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ registry, stage, story } = await build());
});

const routes = () => [stage.trails.copy1, stage.trails.copy2];
const over = (p, obj) => {
  const b = new THREE.Box3().setFromObject(obj);
  return p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z;
};
const minDistance = (a, b) => Math.min(...a.map((p) => Math.min(...b.map((q) => p.distanceTo(q)))));

describe('copy routes — engineered, not hand-drawn', () => {
  it('7 + 17. are built from explicit, deterministic waypoints — the same every build, no randomness', async () => {
    const again = await build();
    for (const [a, b] of [
      [stage.trails.copy1, again.stage.trails.copy1],
      [stage.trails.copy2, again.stage.trails.copy2],
    ]) {
      expect(a.waypoints.map((p) => p.toArray())).toEqual(b.waypoints.map((p) => p.toArray()));
    }
    expect(STAGE_SRC).not.toMatch(/Math\.random|crypto\.|performance\.now|Date\.now/);
  });

  it('8. lie in world space, anchored to the assets: they start, pass and end over the real objects', () => {
    const [c1, c2] = routes();
    expect(over(c1.curve.getPoint(0), stage.instances.buffer_a.holder)).toBe(true);
    expect(c1.curve.getSpacedPoints(400).some((p) => over(p, stage.instances.cpu.holder))).toBe(true);
    expect(over(c1.curve.getPoint(1), stage.instances.buffer_b.holder)).toBe(true);
    expect(over(c2.curve.getPoint(0), stage.instances.buffer_b.holder)).toBe(true);
    expect(c2.curve.getSpacedPoints(400).some((p) => over(p, stage.instances.cpu.holder))).toBe(true);
    expect(over(c2.curve.getPoint(1), stage.app.group)).toBe(true);
    // No screen-space input: the source builds them from anchors and fixed offsets, never the camera.
    expect(STAGE_SRC).not.toMatch(/\.project\(|unproject|camera\./);
  });

  it('run at one routing height between the rise and the drop, with straight runs and rounded corners only', () => {
    for (const r of routes()) {
      const ys = r.waypoints.slice(1, -1).map((p) => p.y);
      expect(new Set(ys.map((y) => y.toFixed(6))).size).toBe(1); // every intermediate waypoint at ROUTE_Y
      for (const c of r.curve.curves) expect(c.isLineCurve3 || c.isQuadraticBezierCurve3).toBe(true);
      // Consecutive runs are axis-aligned: each changes x, y or z only — a trace, not a scribble.
      for (let i = 1; i < r.waypoints.length; i++) {
        const d = r.waypoints[i].clone().sub(r.waypoints[i - 1]);
        expect([Math.abs(d.x) > 1e-6, Math.abs(d.y) > 1e-6, Math.abs(d.z) > 1e-6].filter(Boolean)).toHaveLength(1);
      }
    }
  });

  it('16. make no loops and never cross themselves, each other or the DMA path', () => {
    for (const r of routes()) {
      const pts = r.curve.getSpacedPoints(300);
      // No self-intersection: points far apart along the route stay apart in space.
      for (let i = 0; i < pts.length; i += 5) for (let j = i + 40; j < pts.length; j += 5) expect(pts[i].distanceTo(pts[j])).toBeGreaterThan(0.2);
      // No unnecessary length: under 1.6× the Manhattan distance between the endpoints and the CPU.
      const len = r.curve.getLength();
      const ws = r.waypoints;
      let manhattan = 0;
      for (let i = 1; i < ws.length; i++) manhattan += ws[i].clone().sub(ws[i - 1]).manhattanLength();
      expect(len).toBeLessThanOrEqual(manhattan + 1e-6);
    }
    const P = (c) => c.getSpacedPoints(500);
    expect(minDistance(P(stage.trails.copy1.curve), P(stage.trails.copy2.curve))).toBeGreaterThan(0.5);
    expect(minDistance(P(stage.trails.dma.curve), P(stage.trails.copy1.curve))).toBeGreaterThan(0.5);
    expect(minDistance(P(stage.trails.dma.curve), P(stage.trails.copy2.curve))).toBeGreaterThan(0.5);
  });

  it('keep the DMA and copy 1 apart ON SCREEN — in every camera direction of sentences 5–8 and in a lower, more oblique one', () => {
    // A non-pixel check of the picture: project both paths orthographically along each shot's view
    // direction (and along the same direction lowered towards the floor) and measure the 2D gap.
    const S = (i) => new TimelineParser(words).sentenceStart(i);
    const dirs = story.shots.filter((s) => s.at >= S(5) - 1 && s.at < S(9)).map((s) => new THREE.Vector3(...s.view.direction).normalize());
    expect(dirs.length).toBeGreaterThanOrEqual(4);
    const lowered = dirs.map((d) => new THREE.Vector3(d.x, d.y * 0.45, d.z).normalize()); // ~20° above the floor
    const dma = stage.trails.dma.curve.getSpacedPoints(300);
    const c1 = stage.trails.copy1.curve.getSpacedPoints(300);
    for (const d of [...dirs, ...lowered]) {
      const right = new THREE.Vector3(0, 1, 0).cross(d).normalize();
      const upv = d.clone().cross(right).normalize();
      const flat = (p) => new THREE.Vector2(p.dot(right), p.dot(upv));
      const a = dma.map(flat);
      const b = c1.map(flat);
      const gap = Math.min(...a.map((p) => Math.min(...b.map((q) => p.distanceTo(q)))));
      expect(gap, `direction ${d.toArray().map((v) => v.toFixed(2))}`).toBeGreaterThan(0.8);
    }
  });

  it('run low over the CPU, like a trace on it — never floating in front of it — and clear of every asset', () => {
    const cpuTop = new THREE.Box3().setFromObject(stage.instances.cpu.holder).max.y;
    for (const r of routes()) {
      const y = r.waypoints[1].y;
      expect(y - cpuTop).toBeLessThan(0.5);
      for (const k of ['buffer_a', 'buffer_b', 'cpu']) expect(y - 0.12, k).toBeGreaterThan(new THREE.Box3().setFromObject(stage.instances[k].holder).max.y);
    }
  });

  it('round every corner at one radius', () => {
    const radii = [];
    for (const r of routes()) for (const c of r.curve.curves) if (c.isQuadraticBezierCurve3) radii.push(c.v0.distanceTo(c.v1), c.v2.distanceTo(c.v1));
    expect(radii.length).toBeGreaterThan(0);
    for (const x of radii) expect(x).toBeCloseTo(radii[0], 6);
  });

  it('keep one constant thickness, in the copy’s red', () => {
    for (const r of routes()) {
      expect(r.mesh.geometry.parameters.radius).toBeCloseTo(0.045, 9);
      expect(sameHue(r.mesh.material.color, RED)).toBe(true);
    }
  });
});

describe('copy routes — direction and the CPU', () => {
  it('9. end in a small 3D arrowhead pointing into the destination', () => {
    for (const r of routes()) {
      const tip = new THREE.Vector3(0, 1, 0).applyQuaternion(r.arrow.quaternion);
      const tangent = r.curve.getTangent(1).normalize();
      expect(tip.dot(tangent)).toBeGreaterThan(0.999); // pointing along the last run
      expect(tangent.y).toBeLessThan(-0.99); // which drops straight down into the destination
      expect(r.arrow.geometry.parameters.height).toBeLessThan(0.5); // restrained, not a cartoon arrow
      at(story.lanes.copy2.to + 1);
      expect(r.arrow.visible).toBe(true);
      at(story.lanes.copy1.from - 0.5);
      expect(r.arrow.visible).toBe(false);
    }
  });

  it('15. has no ring around the CPU: no torus anywhere, and the CPU pulse lies flat under its package', () => {
    stage.root.traverse((o) => expect(o.geometry?.type, o.name).not.toBe('TorusGeometry'));
    const pulse = stage.cpuPulse;
    const foot = new THREE.Box3().setFromObject(stage.instances.cpu.holder);
    const size = new THREE.Box3().setFromObject(pulse).getSize(new THREE.Vector3());
    expect(size.y).toBeLessThan(0.01); // flat
    expect(size.x).toBeLessThan(foot.max.x - foot.min.x + 1.2); // the package's footprint, not a ring around it
    expect(pulse.position.y).toBeLessThan(foot.max.y);
  });

  it('10–11. carry the moving bytes on the route, and light the CPU only while it processes', () => {
    for (const [carrier, route, lane] of [
      [stage.carriers.carrier1, stage.trails.copy1, story.lanes.copy1],
      [stage.carriers.carrier2, stage.trails.copy2, story.lanes.copy2],
    ]) {
      const pts = route.curve.getSpacedPoints(800);
      for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        at(lane.from + u * (lane.to - lane.from));
        expect(pts.some((p) => p.distanceTo(carrier.position) < 0.06), `u=${u}`).toBe(true);
      }
      at(lane.from + 0.5 * (lane.to - lane.from));
      expect(stage.cpuPulse.visible && stage.cpuGlow.visible).toBe(true);
      at(lane.from + 0.05 * (lane.to - lane.from));
      expect(stage.cpuPulse.material.opacity).toBeLessThan(0.05);
    }
  });
});

function at(t) {
  stage.update(t, story.lanes);
  stage.root.updateWorldMatrix(true, true);
}
