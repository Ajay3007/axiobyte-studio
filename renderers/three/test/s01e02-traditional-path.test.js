// s01e02, milestone 1 (sentences 0–16): the traditional path and the mbuf, built for real — the
// NIC as the film builds it, the episode's stage with the real CPU, packet buffers and mbuf, and the
// storyboard against the immutable voiceover. No browser, no WebGL.
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
const EPISODE = path.join(HERE, '../../../episodes/s01e02-zero-copy');
const SOURCES = ['stage.js', 'act2.js', 'scene.js', 'storyboard.js', 'video-main.js'].map((f) => fs.readFileSync(path.join(EPISODE, 'three', f), 'utf8')).join('\n');

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

let timeline;
let registry;
let stage;
let story;
let createNIC;
let createZeroCopyStage;
let PLACE;

async function build() {
  const scene = new THREE.Scene();
  const reg = new ComponentRegistry();
  const { createNicScene } = await import('../src/domains/networking/nic/scene.js');
  createNicScene({ engine: { scene, aspect: 16 / 9 }, registry: reg, camera: { definePreset() {}, addResolver() {} } });
  scene.updateMatrixWorld(true);
  const st = createZeroCopyStage({ engine: { scene }, registry: reg });
  const { buildStoryboard } = await import('../../../episodes/s01e02-zero-copy/three/storyboard.js');
  const sb = buildStoryboard({ timeline: new TimelineParser(words), registry: reg });
  return { scene, registry: reg, stage: st, story: sb };
}

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  ({ createNIC } = await import('../src/domains/networking/nic/NIC.js'));
  ({ createZeroCopyStage, PLACE } = await import('../../../episodes/s01e02-zero-copy/three/stage.js'));
  timeline = new TimelineParser(words);
  ({ registry, stage, story } = await build());
});

const S = (i) => timeline.sentenceStart(i);
const E = (i) => timeline.sentenceEnd(i);
const near = (a, b, tol = 1e-6) => a.distanceTo(b) < tol;
// Whether a point lies over an object's footprint (x–z), at any height: "starts on buffer A", "held
// over the CPU", "lands in the application".
const over = (p, obj) => {
  const b = new THREE.Box3().setFromObject(obj);
  return p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z;
};


describe('s01e02 milestone 1 — the immutable voiceover is the clock', () => {
  it('reads the episode’s own timing, unchanged: timeline.json is byte-identical to words.json', () => {
    const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(EPISODE, f))).digest('hex');
    expect(hash('timeline/words.json')).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    if (fs.existsSync(path.join(EPISODE, 'timeline.json'))) expect(hash('timeline.json')).toBe(hash('timeline/words.json'));
    expect(words.sentences).toHaveLength(47);
    expect(story.audioEnd).toBeCloseTo(217.809, 3);
  });

  it('puts each action on the sentence that says it — and nothing on sentence 4', () => {
    const { dma, copy1, copy2, mbuf } = story.lanes;
    expect(dma.from).toBeGreaterThanOrEqual(S(5));
    expect(dma.to).toBeLessThanOrEqual(E(5));
    expect(copy1.from).toBeGreaterThanOrEqual(S(6));
    expect(copy1.to).toBeLessThanOrEqual(E(6));
    expect(copy2.from).toBeGreaterThanOrEqual(S(7));
    expect(mbuf.from).toBeGreaterThanOrEqual(S(13) - 0.3);
    expect(mbuf.to).toBeLessThanOrEqual(E(13));
    // Sentence 4 is setup: no transfer of any kind begins inside it.
    for (const lane of [dma, copy1, copy2]) expect(lane.from).toBeGreaterThan(E(4));
  });

  it('finishes the copying path and the mbuf by sentence 16; the zero-copy half starts on 17', () => {
    const end = E(16);
    for (const key of ['arrival', 'dma', 'copy1', 'copy2', 'cost', 'recede', 'reference', 'mbuf', 'pulse']) {
      expect(story.lanes[key].to, key).toBeLessThanOrEqual(end);
    }
    expect(story.lanes.act2).toBe(S(17));
  });
});

describe('s01e02 milestone 1 — real AxioByte assets', () => {
  it('1. films the actual NIC asset, as its own scene places it', () => {
    const ids = createNIC().components.map((c) => c.id);
    for (const id of ids) expect(registry.has(id), id).toBe(true);
    expect(SOURCES).toMatch(/from '@axiobyte\/three\/domains\/networking\/nic\/world\.js'/);
  });

  it('2–3. instantiates the packet_buffer asset twice: buffer A and buffer B, distinct and apart', () => {
    const { buffer_a: a, buffer_b: b } = stage.instances;
    expect(a.asset.root.name).toBe('packet-buffer');
    expect(b.asset.root.name).toBe('packet-buffer');
    expect(a.asset).not.toBe(b.asset);
    for (const p of ['header', 'payload']) {
      expect(registry.has(`buffer_a.${p}`)).toBe(true);
      expect(registry.has(`buffer_b.${p}`)).toBe(true);
    }
    expect(registry.anchorWorld('buffer_a.header', 'center').distanceTo(registry.anchorWorld('buffer_b.header', 'center'))).toBeGreaterThan(6);
    expect(SOURCES).toMatch(/from '@axiobyte\/three\/domains\/memory\/packet-buffer\/PacketBuffer\.js'/);
  });

  it('9. uses the actual reusable mbuf asset, inspectable as its one part', () => {
    expect(stage.instances.mbuf.asset.root.name).toBe('mbuf');
    expect(registry.has('mbuf.fields')).toBe(true);
    expect(SOURCES).toMatch(/from '@axiobyte\/three\/domains\/memory\/mbuf\/Mbuf\.js'/);
  });

  it('uses the actual CPU asset for the copies; the film imports only these asset domains', () => {
    expect(registry.has('cpu.die')).toBe(true);
    const domains = [...SOURCES.matchAll(/@axiobyte\/three\/domains\/([a-z-]+\/[a-z-]+)\//g)].map((m) => m[1]);
    expect(new Set(domains)).toEqual(new Set(['networking/nic', 'computing/cpu', 'memory/packet-buffer', 'memory/mbuf', 'memory/mempool']));
  });
});

describe('s01e02 milestone 1 — DMA, then two CPU copies', () => {
  it('4. ends the DMA exactly at buffer A’s dma_target', () => {
    const end = stage.trails.dma.curve.getPoint(1);
    expect(near(end, registry.anchorWorld('buffer_a.payload', 'dma_target'))).toBe(true);
    const start = stage.trails.dma.curve.getPoint(0);
    expect(start.distanceTo(registry.anchorWorld('nic-controller', 'dma'))).toBeLessThan(1);
  });

  it('5. draws the DMA in the packet’s colour, never red, and moves no copy while it runs', () => {
    expect(sameHue(stage.trails.dma.mesh.material.color, BLUE)).toBe(true);
    expect(sameHue(stage.trails.dma.mesh.material.color, RED)).toBe(false);
    const mid = (story.lanes.dma.from + story.lanes.dma.to) / 2;
    stage.update(mid, story.lanes);
    expect(stage.carriers.carrier1.visible || stage.carriers.carrier2.visible).toBe(false);
    expect(stage.cpuPulse.visible).toBe(false);
    expect(stage.trails.copy1.mesh.visible || stage.trails.copy2.mesh.visible).toBe(false);
  });

  it('6. makes the first CPU copy buffer A → buffer B, through the CPU', () => {
    const c = stage.trails.copy1.curve;
    // Starts on buffer A's payload (at its far end, away from the DMA), passes over the CPU, ends on buffer B.
    expect(over(c.getPoint(0), stage.instances.buffer_a.holder)).toBe(true);
    const payload = registry.worldBox('buffer_a.payload');
    const p0 = c.getPoint(0);
    expect(p0.x >= payload.min.x && p0.x <= payload.max.x && p0.z >= payload.min.z && p0.z <= payload.max.z).toBe(true);
    expect(Math.abs(p0.y - registry.anchorWorld('buffer_a.payload', 'read').y)).toBeLessThan(1e-6);
    expect(over(c.getPoint(1), stage.instances.buffer_b.holder)).toBe(true);
    expect(c.getSpacedPoints(400).some((p) => over(p, stage.instances.cpu.holder))).toBe(true);
  });

  it('7. makes the second CPU copy buffer B → the application', () => {
    const c = stage.trails.copy2.curve;
    expect(over(c.getPoint(0), stage.instances.buffer_b.holder)).toBe(true);
    expect(c.getSpacedPoints(400).some((p) => over(p, stage.instances.cpu.holder))).toBe(true);
    const app = new THREE.Box3().setFromObject(stage.app.group);
    expect(app.containsPoint(c.getPoint(1))).toBe(true);
  });

  it('8. reserves red for the CPU copies: only the copy routes, carriers and the CPU’s copy glow are red', () => {
    const red = [];
    stage.root.traverse((o) => {
      const m = o.material;
      if (!m) return;
      const colours = [m.color, m.emissive].filter((x) => x && x.r + x.g + x.b > 0.05);
      if (colours.some((x) => sameHue(x, RED))) red.push(o.name || o.parent?.name);
    });
    expect(red.length).toBeGreaterThan(0);
    for (const name of red) expect(name, name).toMatch(/^e02-(copy-trail|copy-carrier|cpu-copy-(pulse|glow))/);
  });

  it('fills each buffer only when its transfer lands, and never moves a buffer', () => {
    const at = (name) => stage.instances[name].holder.position.clone();
    const before = { a: at('buffer_a'), b: at('buffer_b') };
    const shown = (meshes) => meshes.filter((m) => m.visible).length;
    stage.update(E(4), story.lanes);
    expect(shown(stage.bytes.buffer_a)).toBe(0);
    stage.update(story.lanes.dma.to + 1, story.lanes);
    expect(shown(stage.bytes.buffer_a)).toBe(stage.bytes.buffer_a.length);
    expect(shown(stage.bytes.buffer_b)).toBe(0);
    stage.update(story.lanes.copy1.to + 1, story.lanes);
    expect(shown(stage.bytes.buffer_b)).toBe(stage.bytes.buffer_b.length);
    expect(shown(stage.bytes.app)).toBe(0);
    stage.update(story.lanes.copy2.to + 1, story.lanes);
    expect(shown(stage.bytes.app)).toBe(stage.bytes.app.length);
    expect(at('buffer_a').equals(before.a) && at('buffer_b').equals(before.b)).toBe(true);
  });
});

describe('s01e02 milestone 1 — the mbuf is metadata; buf_addr points at the buffer', () => {
  it('10. holds no packet bytes: nothing in the mbuf is the packet’s colour', () => {
    stage.instances.mbuf.asset.root.traverse((o) => {
      if (o.material?.color) expect(sameHue(o.material.color, BLUE), o.name).toBe(false);
    });
  });

  it('11. runs buf_addr’s reference from the mbuf’s socket to buffer A’s pointer_target', () => {
    stage.update(E(16), story.lanes);
    expect(near(stage.reference.from, registry.anchorWorld('mbuf.fields', 'buf_addr'), 1e-4)).toBe(true);
    expect(near(stage.reference.to, registry.anchorWorld('buffer_a.header', 'pointer_target'), 1e-4)).toBe(true);
    // Straight, as a pointer is: the socket faces the address on one line.
    expect(Math.abs(stage.reference.from.z - stage.reference.to.z)).toBeLessThan(0.05);
  });

  it('brings the mbuf in on sentence 13, where the reference starts', () => {
    stage.update(S(12), story.lanes);
    expect(stage.instances.mbuf.holder.visible).toBe(false);
    stage.update(E(13), story.lanes);
    expect(stage.instances.mbuf.holder.visible).toBe(true);
    expect(stage.instances.mbuf.holder.position.toArray()).toEqual(PLACE.mbuf.position);
  });
});

describe('s01e02 milestone 1 — what is not in it', () => {
  it('12–13. no descriptor ring and no host memory (the Mempool arrives in the zero-copy half)', () => {
    const ids = registry.all().map((e) => e.id);
    expect(ids.some((id) => /ring|descriptor|memory\.|host/.test(id))).toBe(false);
    expect(SOURCES).not.toMatch(/descriptor-ring|host-memory|compositions\/nic_host/);
  });

  it('14. no SmartNIC anywhere — in the code or on screen', () => {
    expect(SOURCES).not.toMatch(/smart\s*nic/i);
    const titles = story.cues.map((c) => `${c.id}`).join(' ');
    expect(titles).not.toMatch(/smart\s*nic/i);
  });

  it('introduces no global asset: everything new is episode-local and named e02', () => {
    stage.root.traverse((o) => {
      if (o === stage.root || !o.name) return;
      const inAsset = Object.values(stage.instances).some(({ holder }) => {
        let p = o;
        while (p) {
          if (p === holder) return true;
          p = p.parent;
        }
        return false;
      });
      if (!inAsset) expect(o.name, o.name).toMatch(/^e02[-.]/);
    });
  });
});

describe('s01e02 milestone 1 — deterministic', () => {
  it('15. builds the same world and the same score every time, and a frame is a function of t', async () => {
    const again = await build();
    const pose = (st) => Object.fromEntries(Object.entries(st.instances).map(([k, v]) => [k, v.holder.position.toArray()]));
    // Compared at the same moment: a pose is a function of t.
    again.stage.update(100, story.lanes);
    stage.update(100, story.lanes);
    expect(pose(again.stage)).toEqual(pose(stage));
    expect(again.story.shots.map((s) => s.at)).toEqual(story.shots.map((s) => s.at));
    expect(again.story.cues.map((c) => [c.id, c.start, c.end])).toEqual(story.cues.map((c) => [c.id, c.start, c.end]));
    const snapshot = (st, t) => {
      st.update(t, story.lanes);
      const out = [];
      st.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6))]));
      return out;
    };
    for (const t of [3, 29, 33, 37, 41, 50, 57, 66, 70]) expect(snapshot(again.stage, t)).toEqual(snapshot(stage, t));
    // Seeking backwards gives the same frame as arriving forwards.
    const forward = snapshot(stage, 33);
    snapshot(stage, 66);
    expect(snapshot(stage, 33)).toEqual(forward);
  });
});
