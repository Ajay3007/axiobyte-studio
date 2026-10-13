// s01e02, milestone 3 (sentences 13–16): the mbuf is METADATA; buf_addr is a REFERENCE to storage;
// the packet buffer is where the bytes LIVE. The real assets, the film's own camera, and guards that
// are proved to fire (mutation tests) — geometry, not pixels.
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
import { createMbuf } from '../src/domains/memory/mbuf/Mbuf.js';
import { FIELDS } from '../src/domains/memory/mbuf/layout.js';
import { createPacketBuffer } from '../src/domains/memory/packet-buffer/PacketBuffer.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '../../..');
const EPISODE = path.join(REPO, 'episodes/s01e02-zero-copy');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const BLUE = new THREE.Color('#4aa8ff');
const POINTER = new THREE.Color('#f5d14f');
const sameHue = (c, hue) => {
  const n = (x) => {
    const s = x.r + x.g + x.b || 1;
    return [x.r / s, x.g / s, x.b / s];
  };
  const [a, b] = [n(c), n(hue)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.03;
};

let tl;
let world;
let PLACE;
const S = (i) => tl.sentenceStart(i);
const E = (i) => tl.sentenceEnd(i);

async function build() {
  const scene = new THREE.Scene();
  const registry = new ComponentRegistry();
  const { createNicScene } = await import('../src/domains/networking/nic/scene.js');
  createNicScene({ engine: { scene, aspect: 16 / 9 }, registry, camera: { definePreset() {}, addResolver() {} } });
  scene.updateMatrixWorld(true);
  const { createZeroCopyStage } = await import('../../../episodes/s01e02-zero-copy/three/stage.js');
  const stage = createZeroCopyStage({ engine: { scene }, registry });
  const { buildStoryboard } = await import('../../../episodes/s01e02-zero-copy/three/storyboard.js');
  const story = buildStoryboard({ timeline: new TimelineParser(words), registry });
  const at = (t) => {
    stage.update(t, story.lanes);
    stage.root.updateWorldMatrix(true, true);
  };
  return { scene, registry, stage, story, at };
}

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ PLACE } = await import('../../../episodes/s01e02-zero-copy/three/stage.js'));
  tl = new TimelineParser(words);
  world = await build();
});

/** Every sampled moment of sentences 13–16. */
const span = (from, to, step = 0.25) => {
  const out = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(t);
  return out;
};
const M3 = () => span(S(13), E(16));
const shown = (o) => {
  for (let v = o; v; v = v.parent) if (!v.visible) return false;
  return true;
};
const boxOf = (o) => new THREE.Box3().setFromObject(o);

// ------------------------------------------------------------------ the guards (mutation-tested below)

/** Visible meshes in the packet's colour — the bytes, wherever they are. */
function packetBytes(w) {
  const out = [];
  w.stage.root.traverse((o) => {
    if (o.isMesh && o.material?.color && sameHue(o.material.color, BLUE) && shown(o)) out.push(o);
  });
  return out;
}
/** Guard: any packet byte inside the mbuf's record. */
function bytesInMbuf(w) {
  const record = boxOf(w.stage.instances.mbuf.holder).expandByScalar(0.05);
  return packetBytes(w).filter((o) => boxOf(o).intersectsBox(record)).map((o) => o.name);
}
/** Guard: anything other than the reference itself lying ON the reference — a bead, a byte, a packet. */
function thingsOnReference(w) {
  const { from, to, group } = w.stage.reference;
  const pts = [0.15, 0.3, 0.45, 0.6, 0.75, 0.85].map((u) => from.clone().lerp(to, u));
  const hits = [];
  w.stage.root.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    for (let v = o; v; v = v.parent) if (v === group) return;
    const b = boxOf(o);
    if (pts.some((p) => b.distanceToPoint(p) < 0.25)) hits.push(o.name || o.type);
  });
  return hits;
}
/** Guard: the reference runs, in the pointer's yellow, from the buf_addr socket to the buffer's address. */
function referenceProblems(w) {
  const { reference: ref } = w.stage;
  const problems = [];
  const target = w.registry.anchorWorld('buffer_a.header', 'pointer_target');
  // The socket where the mbuf rests (it drops into place on sentence 13; once there, the live anchor).
  const holder = w.stage.instances.mbuf.holder;
  const settled = holder.position.distanceTo(new THREE.Vector3(...PLACE.mbuf.position)) < 1e-6;
  const socket = w.registry.anchorWorld('mbuf.fields', 'buf_addr').sub(holder.position).add(new THREE.Vector3(...PLACE.mbuf.position));
  if (ref.from.distanceTo(socket) > 1e-4) problems.push('does not start at mbuf.fields:buf_addr');
  if (settled && ref.from.distanceTo(w.registry.anchorWorld('mbuf.fields', 'buf_addr')) > 1e-4) problems.push('does not start at the settled mbuf’s socket');
  if (ref.to.distanceTo(target) > 1e-4) problems.push('does not end at buffer_a.header:pointer_target');
  const head = ref.group.getObjectByName('e02-reference-head');
  const tip = head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.16, 0).applyQuaternion(head.quaternion));
  if (head.visible && tip.distanceTo(target) > 0.05) problems.push('arrowhead is not at the buffer’s address');
  for (const name of ['e02-reference-rod', 'e02-reference-head', 'e02-reference-trace']) {
    const m = ref.group.getObjectByName(name);
    if (!sameHue(m.material.color, POINTER)) problems.push(`${name} is not pointer yellow`);
  }
  return problems;
}

// ------------------------------------------------------------------ the film's camera, in Node

function filmCamera(w) {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 500);
  const controls = { target: new THREE.Vector3(), addEventListener() {} };
  const engine = { camera, controls, size: { width: 1920, height: 1080 } };
  const director = new CameraDirector({ cameraManager: new CameraManager(engine), engine, shots: w.story.shots });
  const P = (v) => {
    camera.updateMatrixWorld();
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * 1920, (-p.y * 0.5 + 0.5) * 1080];
  };
  const project = (id, anchor = 'center') => {
    const p = w.registry.anchorWorld(id, anchor);
    return p ? P(p) : null;
  };
  return { director, P, project };
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
/** Area of a polygon after clipping it to the 1920×1080 frame, as a fraction of the frame. */
function frameShare(P) {
  const edges = [
    [(p) => p[0] >= 0, (a, b) => [0, a[1] + ((0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= 1920, (a, b) => [1920, a[1] + ((1920 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= 0, (a, b) => [a[0] + ((0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), 0]],
    [(p) => p[1] <= 1080, (a, b) => [a[0] + ((1080 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), 1080]],
  ];
  for (const [inside, cut] of edges) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const [a, b] = [P[i], P[(i + 1) % P.length]];
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b));
        out.push(b);
      } else if (inside(a)) out.push(cut(a, b));
    }
    P = out;
    if (!P.length) return 0;
  }
  return Math.abs(P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0)) / 2 / (1920 * 1080);
}
function overlaps(poly, [x0, y0, x1, y1], m = 6) {
  const rect = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]];
  for (const Q of [poly, rect]) {
    for (let i = 0; i < Q.length; i++) {
      const [a, b] = [Q[i], Q[(i + 1) % Q.length]];
      const ax = b[1] - a[1];
      const ay = a[0] - b[0];
      const A = poly.map((p) => p[0] * ax + p[1] * ay);
      const B = rect.map((p) => p[0] * ax + p[1] * ay);
      if (Math.max(...A) < Math.min(...B) || Math.max(...B) < Math.min(...A)) return false;
    }
  }
  return true;
}

// ------------------------------------------------------------------ the tests

describe('s01e02 milestone 3 — the real assets', () => {
  it('1 + 16. uses the real mbuf asset, unchanged: its one part, the same size a fresh mbuf builds', () => {
    const fresh = createMbuf();
    const group = new THREE.Group().add(fresh.root);
    group.updateMatrixWorld(true);
    expect(world.stage.instances.mbuf.asset.components.map((c) => c.id)).toEqual(fresh.components.map((c) => c.id));
    world.at(E(14));
    const want = boxOf(fresh.components[0].object).getSize(new THREE.Vector3());
    const got = world.registry.worldBox('mbuf.fields').getSize(new THREE.Vector3());
    for (const k of ['x', 'y', 'z']) expect(got[k], k).toBeCloseTo(want[k], 6);
    expect(world.stage.instances.mbuf.holder.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('2 + 16. uses the real packet buffer asset, unchanged: buffer A’s header and payload as a fresh one builds them', () => {
    const fresh = createPacketBuffer();
    new THREE.Group().add(fresh.root).updateMatrixWorld(true);
    for (const c of fresh.components) {
      const want = boxOf(c.object).getSize(new THREE.Vector3());
      const got = world.registry.worldBox(`buffer_a.${c.id}`).getSize(new THREE.Vector3());
      for (const k of ['x', 'y', 'z']) expect(got[k], `${c.id}.${k}`).toBeCloseTo(want[k], 6);
    }
    expect(world.stage.instances.buffer_a.holder.scale.toArray()).toEqual([1, 1, 1]);
  });
});

describe('s01e02 milestone 3 — the mbuf is metadata; the bytes live in the buffer', () => {
  it('3. shows metadata fields only: data_len, refcount, buf_addr — and nothing in the packet’s colour', () => {
    expect(FIELDS).toEqual(['data_len', 'refcount', 'buf_addr']);
    world.stage.instances.mbuf.asset.root.traverse((o) => {
      if (o.material?.color) expect(sameHue(o.material.color, BLUE), o.name).toBe(false);
    });
  });

  it('4. never places packet bytes inside the mbuf, at any moment of sentences 13–16', () => {
    for (const t of M3()) {
      world.at(t);
      expect(bytesInMbuf(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('9 + 10. keeps the bytes in the buffers they already occupy — none moves, none travels from the mbuf', () => {
    world.at(S(13));
    const homes = ['buffer_a', 'buffer_b'].map((k) => boxOf(world.stage.instances[k].holder).expandByScalar(0.05)).concat([boxOf(world.stage.app.group).expandByScalar(0.05)]);
    const first = new Map();
    for (const t of M3()) {
      world.at(t);
      for (const o of packetBytes(world)) {
        const b = boxOf(o);
        expect(homes.some((h) => h.containsBox(b)), `${o.name} outside every buffer at t=${t.toFixed(2)}`).toBe(true);
        const p = o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6)).join();
        if (!first.has(o)) first.set(o, p);
        expect(p, `${o.name} moved at t=${t.toFixed(2)}`).toBe(first.get(o));
      }
      expect(thingsOnReference(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
    // The payload's bytes are drawn throughout, in buffer A.
    world.at(E(16) - 0.1);
    const payload = world.stage.instances.buffer_a.holder.getObjectByName('packet-buffer-payload-bytes');
    expect(shown(payload)).toBe(true);
    expect(boxOf(world.stage.instances.buffer_a.holder).containsBox(boxOf(payload))).toBe(true);
  });

  it('12–14. has no Mempool, no descriptor ring and no host-memory composition in sentences 13–16', () => {
    for (const t of M3()) {
      world.at(t);
      expect(shown(world.stage.instances.pool.holder), `pool at t=${t.toFixed(2)}`).toBe(false);
    }
    const names = [];
    world.scene.traverse((o) => names.push(o.name));
    expect(names.some((n) => /descriptor|desc-ring|host[-_ ]?memory/i.test(n))).toBe(false);
    expect(world.registry.has('descriptor_ring') || world.registry.has('host_memory')).toBe(false);
  });
});

describe('s01e02 milestone 3 — buf_addr is the reference to storage', () => {
  it('5. lights buf_addr on "most importantly", and keeps it lit to the end of sentence 16 — not before', () => {
    const mark = world.stage.root.getObjectByName('e02-mark-buf-addr');
    world.at(tl.wordTime('importantly', { after: S(15) - 0.01, before: E(15) }) - 0.6);
    expect(mark.visible).toBe(false);
    for (const t of [tl.wordTime('address', { after: S(15) - 0.01, before: E(15) }), E(15), S(16) + 1]) {
      world.at(t);
      expect(mark.visible, `t=${t}`).toBe(true);
      expect(mark.material.opacity, `t=${t}`).toBeGreaterThan(0.5);
    }
  });

  it('6–8. runs from the mbuf’s buf_addr socket to buffer A’s pointer_target, in pointer yellow, throughout 13–16', () => {
    for (const t of M3()) {
      world.at(t);
      expect(referenceProblems(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
    // The mbuf settles exactly where the reference starts.
    world.at(E(13));
    expect(world.registry.anchorWorld('mbuf.fields', 'buf_addr').distanceTo(world.stage.reference.from)).toBeLessThan(1e-4);
  });

  it('traces the reference on "address" — lit from the socket, reaching the buffer on "begins" — and nothing travels it', () => {
    const trace = world.stage.reference.trace;
    const address = tl.wordTime('address', { after: S(15) - 0.01, before: E(15) });
    const begins = tl.wordTime('begins', { after: S(15) - 0.01, before: E(15) });
    world.at(address - 0.2);
    expect(trace.visible).toBe(false);
    world.at((address + begins) / 2);
    const half = trace.scale.y;
    world.at(begins + 0.2);
    expect(trace.visible).toBe(true);
    expect(trace.scale.y).toBeGreaterThan(half);
    // Lit from the socket: the trace's near end stays at the mbuf.
    const dir = world.stage.reference.to.clone().sub(world.stage.reference.from).normalize();
    const nearEnd = trace.position.clone().addScaledVector(dir, -trace.scale.y / 2);
    expect(nearEnd.distanceTo(world.stage.reference.from)).toBeLessThan(1e-3);
    expect(world.stage.root.getObjectByName('e02-reference-bead')).toBeUndefined();
  });
});

describe('s01e02 milestone 3 — the camera follows the relationship', () => {
  it('13. keeps the mbuf small — never a hero: under 16 % of the frame at every moment of 13–16', () => {
    const { director, P } = filmCamera(world);
    for (const t of M3()) {
      director.update(t);
      world.at(t);
      if (!shown(world.stage.instances.mbuf.holder)) continue;
      expect(frameShare(hull(corners(world.registry.worldBox('mbuf.fields')).map(P))), `t=${t.toFixed(2)}`).toBeLessThan(0.16);
    }
  });

  it('11 + 16. ends sentence 16 on the packet buffer — the largest thing in frame, fully in shot — with the mbuf → buf_addr chain still in view', () => {
    const { director, P, project } = filmCamera(world);
    for (const t of [S(16) + 1.2, E(16) - 0.05]) {
      director.update(t);
      world.at(t);
      const a = frameShare(hull(corners(boxOf(world.stage.instances.buffer_a.holder)).map(P)));
      const m = frameShare(hull(corners(world.registry.worldBox('mbuf.fields')).map(P)));
      expect(a, `t=${t}`).toBeGreaterThan(2 * m);
      for (const [x, y] of corners(boxOf(world.stage.instances.buffer_a.holder)).map(P)) expect(x >= 112 && x <= 1808 && y >= 76 && y <= 1004, `buffer A corner (${x.toFixed(0)}, ${y.toFixed(0)}) in the title-safe frame at t=${t}`).toBe(true);
      const [sx, sy] = project('mbuf.fields', 'buf_addr');
      expect(sx >= 0 && sx <= 1920 && sy >= 0 && sy <= 1080, `buf_addr socket in frame at t=${t}`).toBe(true);
    }
  });

  it('keeps every card of 13–16 in negative space: off the mbuf, the buffer, the NIC and the reference — and the chapter label clear of them too', () => {
    const { director, P, project } = filmCamera(world);
    const cards = world.story.cues.filter((c) => c.layout && c.role !== 'chapter' && c.start >= S(13) - 0.5 && c.start <= E(16));
    expect(cards.length).toBe(3);
    const nicBox = boxOf(world.stage.nicHolder);
    // The chapter title's own rectangle, from its layout (the episode's typography).
    const LABEL = world.story.cues.find((c) => c.id === 'section-label:ZERO COPY · THE MBUF').layout();
    for (const t of M3()) {
      director.update(t);
      world.at(t);
      const things = { nic: hull(corners(nicBox).map(P)), buffer_a: hull(corners(boxOf(world.stage.instances.buffer_a.holder)).map(P)) };
      if (shown(world.stage.instances.mbuf.holder)) things.mbuf = hull(corners(boxOf(world.stage.instances.mbuf.holder)).map(P));
      const { from, to } = world.stage.reference;
      for (let i = 1; i < 10; i++) {
        const q = P(from.clone().lerp(to, i / 10));
        things[`reference#${i}`] = [[q[0] - 8, q[1] - 8], [q[0] + 8, q[1] - 8], [q[0] + 8, q[1] + 8], [q[0] - 8, q[1] + 8]];
      }
      for (const c of cards.filter((k) => t >= k.start + 0.2 && t <= k.end - 0.2)) {
        const r = c.layout(project);
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
      }
      if (t <= E(16) - 0.7) for (const k of ['mbuf', 'buffer_a', 'nic']) if (things[k]) expect(overlaps(things[k], LABEL), `section label ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
    }
  });
});

describe('s01e02 milestone 3 — the guards fire (mutation tests)', () => {
  it('detects bytes placed inside the mbuf', async () => {
    const w = await build();
    w.at(S(15));
    expect(bytesInMbuf(w)).toEqual([]);
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: '#4aa8ff' }));
    cell.name = 'mutant-byte';
    cell.position.copy(w.stage.instances.mbuf.holder.position).add(new THREE.Vector3(0, 0.3, 0));
    w.stage.root.add(cell);
    w.stage.root.updateWorldMatrix(true, true);
    expect(bytesInMbuf(w)).toContain('mutant-byte');
  });

  it('detects anything travelling along the reference — a bead, or bytes', async () => {
    const w = await build();
    w.at(S(16));
    expect(thingsOnReference(w)).toEqual([]);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#fff3b0' }));
    bead.name = 'mutant-bead';
    bead.position.copy(w.stage.reference.from.clone().lerp(w.stage.reference.to, 0.5));
    w.stage.root.add(bead);
    w.stage.root.updateWorldMatrix(true, true);
    expect(thingsOnReference(w)).toContain('mutant-bead');
  });

  it('detects a reference that misses the buffer’s address, or loses the pointer’s yellow', async () => {
    const w = await build();
    w.at(E(15));
    expect(referenceProblems(w)).toEqual([]);
    const head = w.stage.reference.group.getObjectByName('e02-reference-head');
    head.position.x += 1;
    w.stage.root.updateWorldMatrix(true, true);
    expect(referenceProblems(w)).toContain('arrowhead is not at the buffer’s address');
    w.stage.reference.group.getObjectByName('e02-reference-rod').material.color.set('#ff5c55');
    expect(referenceProblems(w)).toContain('e02-reference-rod is not pointer yellow');
  });
});

describe('s01e02 milestone 3 — deterministic, and nothing protected moved', () => {
  const snapshot = (w, t) => {
    w.at(t);
    const out = [];
    w.stage.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), ...o.scale.toArray().map((v) => v.toFixed(6)), o.material?.opacity?.toFixed?.(6) ?? '']));
    return out;
  };

  it('17. renders the same world for the same moment, build after build', async () => {
    const again = await build();
    for (const t of span(S(13), E(16), 0.75)) expect(snapshot(again, t), `t=${t.toFixed(2)}`).toEqual(snapshot(world, t));
  });

  it('18. is seek-pure: a moment looks the same whether played into or jumped to', () => {
    const times = span(S(13), E(16), 0.5);
    const forward = times.map((t) => snapshot(world, t));
    const shuffled = times.map((t, i) => [t, i]).sort((a, b) => Math.sin(a[0] * 12.9898) - Math.sin(b[0] * 12.9898));
    for (const [t, i] of shuffled) expect(snapshot(world, t), `t=${t.toFixed(2)}`).toEqual(forward[i]);
  });

  it('15 + 19 + 20. leaves the voiceover, the timeline and the asset registry untouched', () => {
    expect(sha(path.join(EPISODE, 'timeline/words.json'))).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    const timelineJson = path.join(EPISODE, 'timeline.json');
    if (fs.existsSync(timelineJson)) expect(sha(timelineJson)).toBe(sha(path.join(EPISODE, 'timeline/words.json')));
    const voiceover = path.join(EPISODE, 'voiceover.mp3');
    if (fs.existsSync(voiceover)) expect(sha(voiceover)).toBe('b5d66919c8bd45a31c32aaa242ac1d4ceac3e0eaf566b440dc527d4e4024caa1');
    const ids = [...fs.readFileSync(path.join(REPO, 'assets/library.yaml'), 'utf8').matchAll(/^ {2}- id: ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(ids).toEqual(['nic', 'pcie', 'cpu', 'host_memory', 'descriptor_ring', 'mbuf', 'packet_buffer', 'mempool']);
    // Everything new is episode-local presentation, named e02.
    const names = [];
    world.stage.root.traverse((o) => names.push(o.name));
    for (const n of names.filter((x) => /reference|mark-|zone/.test(x))) expect(n).toMatch(/^e02[-.]/);
  });
});
