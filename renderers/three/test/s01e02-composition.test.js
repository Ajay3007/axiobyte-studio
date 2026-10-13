// s01e02, sentences 5–12 — the composition contract: PHYSICAL ASSETS OWN THEIR SPACE, EXPLANATORY
// GRAPHICS OWN NEGATIVE SPACE. Annotations live in annotation zones (points on empty floor); the
// film's own camera director is driven here, frame by frame, and every annotation's layout rectangle
// is checked against the projected hardware, paths and bytes. Geometry, not pixels.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e02-zero-copy/timeline/words.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { CameraManager } from '../src/core/CameraManager.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';
import { CameraDirector } from '../src/video/CameraDirector.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '../../..');
const EPISODE = path.join(REPO, 'episodes/s01e02-zero-copy');
const COMPOSITION_SRC = fs.readFileSync(path.join(EPISODE, 'three/composition.js'), 'utf8');
const STAGE_SRC = fs.readFileSync(path.join(EPISODE, 'three/stage.js'), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

let tl;
let registry;
let stage;
let story;
let createNIC;
let ZONE_CLEARANCE;

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
  ({ createNIC } = await import('../src/domains/networking/nic/NIC.js'));
  ({ ZONE_CLEARANCE } = await import('../../../episodes/s01e02-zero-copy/three/composition.js'));
  tl = new TimelineParser(words);
  ({ registry, stage, story } = await build());
});

const S = (i) => tl.sentenceStart(i);
const E = (i) => tl.sentenceEnd(i);
const boxOf = (o) => new THREE.Box3().setFromObject(o);
const ZONED = () => story.cues.filter((c) => c.zone);
const inSection = (c) => c.start >= S(5) - 0.5 && c.start <= E(12);

/** The film's camera, as the video director drives it, on a 1920×1080 frame. */
function filmCamera() {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 500);
  const controls = { target: new THREE.Vector3(), addEventListener() {} };
  const engine = { camera, controls, size: { width: 1920, height: 1080 } };
  const director = new CameraDirector({ cameraManager: new CameraManager(engine), engine, shots: story.shots });
  const P = (v) => {
    camera.updateMatrixWorld(); // what the renderer does before each frame
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * 1920, (-p.y * 0.5 + 0.5) * 1080];
  };
  const project = (id, anchor = 'center') => {
    const p = registry.anchorWorld(id, anchor);
    return p ? P(p) : null;
  };
  return { director, camera, P, project };
}

const corners = (b) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (const p of pts.slice().reverse()) {
    while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** Convex polygon vs rectangle (separating axes), with a margin in pixels. */
function overlaps(poly, [x0, y0, x1, y1], m = 6) {
  const rect = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]];
  for (const P of [poly, rect]) {
    for (let i = 0; i < P.length; i++) {
      const [a, b] = [P[i], P[(i + 1) % P.length]];
      const ax = b[1] - a[1];
      const ay = a[0] - b[0];
      const A = poly.map((p) => p[0] * ax + p[1] * ay);
      const B = rect.map((p) => p[0] * ax + p[1] * ay);
      if (Math.max(...A) < Math.min(...B) || Math.max(...B) < Math.min(...A)) return false;
    }
  }
  return true;
}

describe('s01e02 composition — the NIC stays the shared asset, placed and scaled as it always was', () => {
  it('1. leaves the NIC instance’s transform untouched: the episode composes with the camera, not by resizing the card', () => {
    for (const t of [S(5), S(6) + 1, S(8) + 2, S(12)]) {
      stage.update(t, story.lanes);
      expect(stage.nicHolder.scale.toArray()).toEqual([1, 1, 1]);
      expect(stage.nicHolder.position.toArray().map((v) => +v.toFixed(9))).toEqual([0, 0, 0]);
      expect(stage.nicHolder.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
    expect(STAGE_SRC).not.toMatch(/nicHolder\.scale\.|nicHolder\.position\.(set|copy|x\s*=|z\s*=)/);
  });

  it('2. keeps the global NIC asset’s geometry: every component the size a fresh NIC builds', () => {
    const fresh = createNIC();
    const group = new THREE.Group();
    group.add(fresh.group ?? fresh.root ?? fresh.object);
    group.updateMatrixWorld(true);
    for (const c of fresh.components) {
      const want = boxOf(c.boundsObject ?? c.object).getSize(new THREE.Vector3());
      const got = registry.worldBox(c.id).getSize(new THREE.Vector3());
      for (const k of ['x', 'y', 'z']) expect(got[k], `${c.id}.${k}`).toBeCloseTo(want[k], 6);
    }
  });
});

describe('s01e02 composition — annotations own negative space', () => {
  it('3. gives every annotation of sentences 5–12 a defined zone (or the chapter label’s own corner)', () => {
    // Every annotation on screen in sentences 5–12 (started there, or carried into them).
    const cues = story.cues.filter((c) => c.end >= S(5) && c.start <= E(12) && c.id !== 'vignette' && !/^section-label/.test(c.id ?? ''));
    expect(cues.length).toBeGreaterThanOrEqual(6);
    for (const c of cues) {
      if (/^chapter-label/.test(c.id)) {
        expect(c.corner).toBe('bottom-left');
        continue;
      }
      expect(c.zone, c.id).toMatch(/^e02\.zone\./);
      expect(registry.get(c.zone).meta.presentation, c.zone).toBe(true);
      expect(typeof c.layout, c.id).toBe('function');
    }
  });

  it('4. places every zone on empty floor — clear of the NIC, the CPU, the buffers, the application and the mbuf', () => {
    const assets = {
      nic: boxOf(stage.nicHolder),
      cpu: boxOf(stage.instances.cpu.holder),
      buffer_a: boxOf(stage.instances.buffer_a.holder),
      buffer_b: boxOf(stage.instances.buffer_b.holder),
      app: boxOf(stage.app.group),
      mbuf: registry.worldBox('mbuf.fields'),
    };
    const zones = [...new Set(ZONED().map((c) => c.zone))];
    for (const z of zones) {
      const p = registry.anchorWorld(z, 'center');
      for (const [k, b] of Object.entries(assets)) {
        const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
        const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
        expect(Math.hypot(dx, dz), `${z} vs ${k}`).toBeGreaterThanOrEqual(ZONE_CLEARANCE);
      }
    }
    // The cost group in particular names consequences, not hardware: no leader to any part.
    const cost = story.cues.find((c) => /^cost-group/.test(c.id));
    expect(cost.anchorTo).toBeUndefined();
    expect(cost.zone).not.toMatch(/nic/);
  });

  it('5 + 13. never puts an annotation over the hardware, the data-flow paths or the moving bytes — at any frame of sentences 5–12', () => {
    const { director, P, project } = filmCamera();
    const nicPoly = () => hull(corners(boxOf(stage.nicHolder)).map(P));
    const polyOf = (o) => hull(corners(boxOf(o)).map(P));
    const curves = { dma: stage.trails.dma.curve, copy1: stage.trails.copy1.curve, copy2: stage.trails.copy2.curve };
    const shown = (o) => {
      for (let v = o; v; v = v.parent) if (!v.visible) return false;
      return true;
    };
    let checked = 0;
    for (let t = S(5); t <= E(12); t += 0.25) {
      director.update(t);
      stage.update(t, story.lanes);
      stage.root.updateWorldMatrix(true, true);
      const active = story.cues.filter((c) => c.layout && t >= c.start + 0.2 && t <= c.end - 0.2);
      if (!active.length) continue;
      const things = { NIC: nicPoly() };
      for (const k of ['cpu', 'buffer_a', 'buffer_b']) if (shown(stage.instances[k].holder)) things[k] = polyOf(stage.instances[k].holder);
      if (shown(stage.app.group)) things.app = polyOf(stage.app.group);
      for (const [k, c] of Object.entries(curves)) {
        const mesh = stage.trails[k].mesh;
        if (!shown(mesh)) continue;
        // The path as a band: each sampled point a small square, so a card may not sit on the line.
        for (const [i, q] of c.getSpacedPoints(60).map(P).entries()) things[`${k}#${i}`] = [[q[0] - 8, q[1] - 8], [q[0] + 8, q[1] - 8], [q[0] + 8, q[1] + 8], [q[0] - 8, q[1] + 8]];
      }
      stage.root.traverse((o) => {
        if (!/^e02-(packet-token|copy-carrier)/.test(o.name) || !shown(o)) return;
        const q = P(o.getWorldPosition(new THREE.Vector3()));
        things[`bytes:${o.name}`] = [[q[0] - 40, q[1] - 30], [q[0] + 40, q[1] - 30], [q[0] + 40, q[1] + 30], [q[0] - 40, q[1] + 30]];
      });
      for (const c of active) {
        const r = c.layout(project);
        if (!r) continue;
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('5. keeps the chapter title off the NIC in every shot of the traditional path', () => {
    const { director, P } = filmCamera();
    const label = story.cues.find((c) => /^chapter-label:TRADITIONAL/.test(c.id));
    // From its first appearance (sentence 4) to its last (sentence 9).
    expect(label.start).toBeLessThan(S(5));
    for (let t = label.start + 0.3; t <= label.end; t += 0.25) {
      director.update(t);
      stage.update(t, story.lanes);
      expect(overlaps(hull(corners(boxOf(stage.nicHolder)).map(P)), label.layout()), `t=${t.toFixed(2)}`).toBe(false);
    }
  });
});

describe('s01e02 composition — sentence 6 frames the whole copy, and where it goes next', () => {
  it('keeps the application, buffers A and B, the CPU, the copy path and the moving bytes inside the title-safe frame', () => {
    const { director, P } = filmCamera();
    const SAFE = { x0: 112, y0: 76, x1: 1808, y1: 1004 };
    const inside = (pts, what, t) => {
      for (const [x, y] of pts) expect(x >= SAFE.x0 && x <= SAFE.x1 && y >= SAFE.y0 && y <= SAFE.y1, `${what} (${x.toFixed(0)}, ${y.toFixed(0)}) at t=${t.toFixed(2)}`).toBe(true);
    };
    const settled = story.shots.find((s) => s.at <= story.lanes.copy1.from && s.at + s.transition > S(6) - 1).at + 1.6;
    for (let t = Math.max(settled, story.lanes.copy1.from); t <= E(6); t += 0.25) {
      director.update(t);
      stage.update(t, story.lanes);
      stage.root.updateWorldMatrix(true, true);
      inside(corners(boxOf(stage.app.group)).map(P), 'application', t);
      for (const k of ['buffer_a', 'buffer_b', 'cpu']) inside(corners(boxOf(stage.instances[k].holder)).map(P), k, t);
      inside(stage.trails.copy1.curve.getSpacedPoints(60).map(P), 'copy path', t);
      const bytes = stage.carriers.carrier1;
      if (bytes.visible) inside([P(bytes.getWorldPosition(new THREE.Vector3()))], 'moving bytes', t);
    }
  });
});

describe('s01e02 composition — deterministic, and nothing protected moved', () => {
  it('6 + 7. lays annotations out deterministically: fixed zones, no randomness, the same rectangle for the same frame', async () => {
    const again = await build();
    for (const z of [...new Set(ZONED().map((c) => c.zone))]) expect(again.registry.anchorWorld(z, 'center').toArray()).toEqual(registry.anchorWorld(z, 'center').toArray());
    expect(COMPOSITION_SRC).not.toMatch(/Math\.random|crypto\.|performance\.now|Date\.now/);
    const { director, project } = filmCamera();
    const card = ZONED().find((c) => /CPU COPY/.test(c.id));
    director.update(story.lanes.copy1.from + 1.5);
    const first = card.layout(project);
    director.update(S(12));
    director.update(story.lanes.copy1.from + 1.5);
    expect(card.layout(project)).toEqual(first);
  });

  it('10–12. leaves the voiceover, the timeline and the asset registry untouched', () => {
    expect(sha(path.join(EPISODE, 'timeline/words.json'))).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    const timelineJson = path.join(EPISODE, 'timeline.json');
    if (fs.existsSync(timelineJson)) expect(sha(timelineJson)).toBe(sha(path.join(EPISODE, 'timeline/words.json')));
    const voiceover = path.join(EPISODE, 'voiceover.mp3');
    if (fs.existsSync(voiceover)) expect(sha(voiceover)).toBe('b5d66919c8bd45a31c32aaa242ac1d4ceac3e0eaf566b440dc527d4e4024caa1');
    const ids = [...fs.readFileSync(path.join(REPO, 'assets/library.yaml'), 'utf8').matchAll(/^ {2}- id: ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(ids).toEqual(['nic', 'pcie', 'cpu', 'host_memory', 'descriptor_ring', 'mbuf', 'packet_buffer', 'mempool']);
    // The zones are presentation markers only: none is an asset.
    for (const z of [...new Set(ZONED().map((c) => c.zone))]) expect(ids).not.toContain(z.replace(/^e02\.zone\./, ''));
  });
});
