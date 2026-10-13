// s01e02, sentences 5–12: the traditional path, followed by its bytes — the NIC's DMA writes buffer
// A (blue, no CPU), then the CPU copies the bytes A → CPU → B and B → CPU → the application (red, the
// copy held at the CPU while it works), and sentence 8 shows the cost as the same copies running again
// and again. Built for real, as the film builds it; no browser, no WebGL.
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e02-zero-copy/timeline/words.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '../../..');
const EPISODE = path.join(REPO, 'episodes/s01e02-zero-copy');
const SOURCES = ['stage.js', 'act2.js', 'analogy.js', 'scene.js', 'storyboard.js'].map((f) => fs.readFileSync(path.join(EPISODE, 'three', f), 'utf8')).join('\n');
const RED = new THREE.Color('#ff5c55');
const BLUE = new THREE.Color('#4aa8ff');
const sameHue = (c, hue) => {
  const n = (x) => {
    const s = x.r + x.g + x.b || 1;
    return [x.r / s, x.g / s, x.b / s];
  };
  const [a, b] = [n(c), n(hue)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.03;
};
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

let timeline;
let registry;
let stage;
let story;
let createNIC;
let createCPU;

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
  ({ createCPU } = await import('../src/domains/computing/cpu/CPU.js'));
  timeline = new TimelineParser(words);
  ({ registry, stage, story } = await build());
});

const S = (i) => timeline.sentenceStart(i);
const E = (i) => timeline.sentenceEnd(i);
const at = (t) => {
  stage.update(t, story.lanes);
  stage.root.updateWorldMatrix(true, true);
};
const mid = (w, u = 0.5) => w.from + u * (w.to - w.from);
const cpuTop = () => registry.anchorWorld('cpu.ihs', 'top');
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Whether a point lies over an object's footprint (x–z), at any height: "starts on buffer A", "held
// over the CPU", "lands in the application".
const over = (p, obj) => {
  const b = new THREE.Box3().setFromObject(obj);
  return p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z;
};
const shownBytes = (meshes) => meshes.filter((m) => m.visible && m.position.y < 1e-6).length;

// ----------------------------------------------------------------------------------- sentence 5

describe('sentence 5 — the NIC’s DMA writes buffer A', () => {
  it('1–3. is the DMA, on sentence 5, in the packet’s blue, ending at buffer A’s dma_target', () => {
    const L = story.lanes;
    expect(L.dma.from).toBeGreaterThanOrEqual(S(5));
    expect(L.dma.to).toBeLessThanOrEqual(E(5));
    const trail = stage.trails.dma;
    expect(sameHue(trail.mesh.material.color, BLUE)).toBe(true);
    expect(sameHue(trail.mesh.material.color, RED)).toBe(false); // 2. not a red copy
    expect(trail.curve.getPoint(1).distanceTo(registry.anchorWorld('buffer_a.payload', 'dma_target'))).toBeLessThan(1e-6);
    expect(trail.curve.getPoint(0).distanceTo(registry.anchorWorld('nic-controller', 'dma'))).toBeLessThan(1);
  });

  it('involves no CPU and no second buffer while it runs', () => {
    for (const u of [0.1, 0.5, 0.9]) {
      at(mid(story.lanes.dma, u));
      expect(stage.cpuGlow.visible || stage.cpuPulse.visible).toBe(false);
      expect([stage.carriers.carrier1, stage.carriers.carrier2, ...stage.carriers.loops].some((c) => c.visible)).toBe(false);
      expect(shownBytes(stage.bytes.buffer_b)).toBe(0);
    }
  });

  it('4. puts the bytes in buffer A when it lands — inside the buffer, not beside it', () => {
    at(story.lanes.dma.from - 0.2);
    expect(shownBytes(stage.bytes.buffer_a)).toBe(0);
    at(story.lanes.dma.to + 1.0);
    expect(shownBytes(stage.bytes.buffer_a)).toBe(stage.bytes.buffer_a.length);
    // The packet token is gone once it has landed: no packet left floating beside the buffer.
    expect(stage.carriers.packet.visible).toBe(false);
  });
});

// ----------------------------------------------------------------------------------- sentences 6–7

const route = (carrier, w) => {
  // The carrier's position early, at the middle, and late in its copy.
  // As it rises out of the source, while it is held over the CPU, and as it drops into the destination.
  return [0.02, 0.5, 0.95].map((u) => {
    at(mid(w, u));
    return carrier.position.clone();
  });
};

describe('sentence 6 — the CPU copies buffer A into buffer B', () => {
  it('5. runs buffer A → CPU → buffer B: it leaves A, is held at the CPU, and lands in B', () => {
    const w = story.lanes.copy1;
    expect(w.from).toBeGreaterThanOrEqual(S(6));
    expect(w.to).toBeLessThanOrEqual(E(6));
    const [early, middle, late] = route(stage.carriers.carrier1, w);
    expect(over(early, stage.instances.buffer_a.holder)).toBe(true); // rising out of A
    expect(over(middle, stage.instances.cpu.holder)).toBe(true); // held over the CPU
    expect(over(late, stage.instances.buffer_b.holder)).toBe(true); // dropping into B
  });

  it('6. involves the CPU: it glows while the copy is held at it, and only then', () => {
    at(mid(story.lanes.copy1, 0.5));
    expect(stage.cpuGlow.visible).toBe(true);
    expect(stage.cpuGlow.material.opacity).toBeGreaterThan(0.5);
    at(mid(story.lanes.copy1, 0.1));
    expect(stage.cpuGlow.material.opacity).toBeLessThan(0.05);
  });

  it('7. is a red copy: a red trail, and the bytes wrapped in the copy’s red glow', () => {
    expect(sameHue(stage.trails.copy1.mesh.material.color, RED)).toBe(true);
    const cells = stage.carriers.carrier1.children.filter((c) => c.isMesh);
    const glows = stage.carriers.carrier1.children.filter((c) => c.isSprite);
    expect(cells.every((c) => sameHue(c.material.color, BLUE))).toBe(true); // the bytes themselves
    expect(glows.length).toBe(1);
    expect(sameHue(glows[0].material.color, RED)).toBe(true); // being copied
  });

  it('11. leaves the original bytes in buffer A: copying creates, it does not move', () => {
    at(story.lanes.copy1.to + 1.0);
    expect(shownBytes(stage.bytes.buffer_a)).toBe(stage.bytes.buffer_a.length);
    expect(shownBytes(stage.bytes.buffer_b)).toBe(stage.bytes.buffer_b.length);
  });
});

describe('sentence 7 — the CPU copies again, buffer B into the application', () => {
  it('8 + 12. runs buffer B → CPU → the application, starting from B', () => {
    const w = story.lanes.copy2;
    expect(w.from).toBeGreaterThanOrEqual(S(7));
    const c = stage.trails.copy2.curve;
    expect(over(c.getPoint(0), stage.instances.buffer_b.holder)).toBe(true);
    const [, middle, late] = route(stage.carriers.carrier2, w);
    expect(over(middle, stage.instances.cpu.holder)).toBe(true);
    expect(new THREE.Box3().setFromObject(stage.app.group).expandByScalar(1).containsPoint(late)).toBe(true);
  });

  it('9–10. involves the CPU again, in red, and the application receives the bytes', () => {
    at(mid(story.lanes.copy2, 0.5));
    expect(stage.cpuGlow.visible).toBe(true);
    expect(sameHue(stage.trails.copy2.mesh.material.color, RED)).toBe(true);
    at(story.lanes.copy2.to + 1.0);
    expect(stage.app.bytes.every((m) => m.visible)).toBe(true);
    expect(shownBytes(stage.bytes.buffer_b)).toBe(stage.bytes.buffer_b.length); // B keeps its copy
  });

  it('gives the application a real form: a slab with its own bytes, not a floating label', () => {
    const meshes = [];
    stage.app.group.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes.length).toBeGreaterThanOrEqual(12 + 2);
    expect(new THREE.Box3().setFromObject(stage.app.group).getSize(new THREE.Vector3()).y).toBeGreaterThan(0.2);
  });
});

// ----------------------------------------------------------------------------------- sentence 8

describe('sentence 8 — the cost, shown as the same bytes moving again and again', () => {
  it('runs the copies again on both paths, through a busy CPU, while the three copies are on screen', () => {
    const w = story.lanes.cost;
    at(mid(w, 0.5));
    const loops = stage.carriers.loops;
    expect(loops.every((c) => c.visible)).toBe(true);
    // On both copy paths: two on A → CPU → B, two on B → CPU → the application.
    const onPath = (c, trail) => trail.curve.getSpacedPoints(800).some((p) => p.distanceTo(c.position) < 0.05);
    expect(loops.filter((c) => onPath(c, stage.trails.copy1))).toHaveLength(2);
    expect(loops.filter((c) => onPath(c, stage.trails.copy2))).toHaveLength(2);
    expect(stage.cpuGlow.visible && stage.cpuPulse.visible).toBe(true);
    expect(shownBytes(stage.bytes.buffer_a) + shownBytes(stage.bytes.buffer_b)).toBe(2 * stage.bytes.buffer_a.length);
    // And they keep moving: the same copies, again.
    const before = loops.map((c) => c.position.clone());
    at(mid(w, 0.5) + 0.4);
    expect(loops.some((c, i) => c.position.distanceTo(before[i]) > 0.1)).toBe(true);
  });

  it('lets the copying recede on sentences 9–10, back to the one buffer', () => {
    at(S(10) + 0.5);
    expect([...stage.carriers.loops, stage.carriers.carrier1, stage.carriers.carrier2].some((c) => c.visible)).toBe(false);
    expect(stage.trails.copy1.mesh.visible || stage.trails.copy2.mesh.visible).toBe(false);
    expect(stage.cpuGlow.visible || stage.cpuPulse.visible).toBe(false);
  });
});

// ----------------------------------------------------------------------------------- scope and purity

describe('sentences 5–12 — scope, assets and purity', () => {
  it('13–16. shows no mempool, no mbuf, no descriptor ring and no host memory through sentence 12', () => {
    for (const t of [S(5) + 1, S(6) + 1, S(7) + 1, S(8) + 1, S(9) + 1, S(10) + 1, S(11) + 0.5, E(12)]) {
      at(t);
      expect(stage.instances.pool.holder.visible, `pool at ${t}`).toBe(false);
      expect(stage.instances.mbuf.holder.visible, `mbuf at ${t}`).toBe(false);
    }
    const ids = registry.all().map((e) => e.id);
    expect(ids.some((id) => /ring|descriptor|memory\.|host/.test(id))).toBe(false);
    expect(SOURCES).not.toMatch(/descriptor-ring|host-memory|compositions\/nic_host/);
  });

  it('17–19. reuses the real NIC, CPU and packet buffer assets', () => {
    for (const id of createNIC().components.map((c) => c.id)) expect(registry.has(id), id).toBe(true);
    for (const id of createCPU().components.map((c) => c.id)) expect(registry.has(`cpu.${id}`), id).toBe(true);
    for (const k of ['buffer_a', 'buffer_b']) expect(stage.instances[k].asset.root.name).toBe('packet-buffer');
  });

  it('20. creates no global asset: the registry still lists the same eight', () => {
    const ids = [...fs.readFileSync(path.join(REPO, 'assets/library.yaml'), 'utf8').matchAll(/^ {2}- id: ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(ids).toEqual(['nic', 'pcie', 'cpu', 'host_memory', 'descriptor_ring', 'mbuf', 'packet_buffer', 'mempool']);
  });

  it('21–22. is seek-pure and deterministic across a rebuilt world', async () => {
    const again = await build();
    const snap = (st, t) => {
      st.update(t, story.lanes);
      const out = [];
      st.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), o.material?.opacity?.toFixed?.(6) ?? '']));
      return out;
    };
    const times = [27.5, 29.5, 31, 32.5, 33.3, 34.5, 36, 36.8, 37.6, 39, 40.5, 42, 45, 50];
    for (const t of times) expect(snap(again.stage, t)).toEqual(snap(stage, t));
    const forward = snap(stage, 33.3);
    snap(stage, 40.5);
    snap(stage, 29.5);
    expect(snap(stage, 33.3)).toEqual(forward);
  });

  it('23–24. leaves the voiceover and the timeline untouched', () => {
    expect(sha(path.join(EPISODE, 'timeline/words.json'))).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    const timelineJson = path.join(EPISODE, 'timeline.json');
    if (fs.existsSync(timelineJson)) expect(sha(timelineJson)).toBe(sha(path.join(EPISODE, 'timeline/words.json')));
    const voiceover = path.join(EPISODE, 'voiceover.mp3');
    if (fs.existsSync(voiceover)) expect(sha(voiceover)).toBe('b5d66919c8bd45a31c32aaa242ac1d4ceac3e0eaf566b440dc527d4e4024caa1');
  });
});
