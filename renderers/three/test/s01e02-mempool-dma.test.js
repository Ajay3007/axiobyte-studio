// s01e02, milestone 4 (sentences 17–22): THE POOL PROVIDES REUSABLE STORAGE. The real Mempool,
// prepared before any packet; one representative element — [MBUF | BUFFER] — shown enlarged as the
// mbuf and buffer A; the NIC's DMA writing straight into that BUFFER; the CPU idle. Guards proved to
// fire (mutation tests); geometry and drawn text, never pixels.
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
import { createMempool } from '../src/domains/memory/mempool/Mempool.js';
import { COUNT, FIRST, TRAY, ELEMENT, bufferRect, mbufRect } from '../src/domains/memory/mempool/layout.js';
import { callout } from '../src/video/overlay/widgets/callouts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '../../..');
const EPISODE = path.join(REPO, 'episodes/s01e02-zero-copy');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const BLUE = new THREE.Color('#4aa8ff');
const RED = new THREE.Color('#ff5c55');
const sameHue = (c, hue) => {
  const n = (x) => {
    const s = x.r + x.g + x.b || 1;
    return [x.r / s, x.g / s, x.b / s];
  };
  const [a, b] = [n(c), n(hue)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.03;
};
/** Words that would make the pool a runtime simulator. */
const STATE_WORDS = /\b(free|freed|used|in use|allocated|available|recycled|returned|reserved|busy|idle slot)\b/i;

let tl;
let world;
const S = (i) => tl.sentenceStart(i);
const E = (i) => tl.sentenceEnd(i);
const Wd = (w, i) => tl.wordTime(w, { after: S(i) - 0.01, before: E(i) });

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
  tl = new TimelineParser(words);
  world = await build();
});

const span = (from, to, step = 0.25) => {
  const out = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(t);
  return out;
};
const M4 = () => span(S(17), E(22));
const shown = (o) => {
  for (let v = o; v; v = v.parent) if (!v.visible) return false;
  return true;
};
const boxOf = (o) => new THREE.Box3().setFromObject(o);
/** Whether point p lies over rectangle r (in the pool tray's frame), at any height. */
const overRect = (w, p, r) => {
  const local = w.stage.instances.pool.holder.worldToLocal(p.clone());
  return local.x >= r.x0 - 1e-6 && local.x <= r.x1 + 1e-6 && local.z >= r.z0 - 1e-6 && local.z <= r.z1 + 1e-6;
};

// ------------------------------------------------------------------ the guards (mutation-tested below)

/** Guard: the DMA lands in buffer A's bytes (the representative BUFFER) — never the mbuf, never the pool. */
function dmaProblems(w) {
  const end = w.stage.trails.dma.curve.getPoint(1);
  const problems = [];
  if (end.distanceTo(w.registry.anchorWorld('buffer_a.payload', 'dma_target')) > 1e-4) problems.push('does not end at buffer A’s dma_target');
  if (boxOf(w.stage.instances.mbuf.holder).expandByScalar(0.1).containsPoint(end)) problems.push('lands on the mbuf');
  const pool = w.stage.instances.pool.holder;
  const restBox = boxOf(pool).translate(new THREE.Vector3(0, 0, 0));
  if (restBox.expandByScalar(0.1).containsPoint(end)) problems.push('lands on the Mempool');
  return problems;
}
/** Guard: one element is singled out, as an illustration — its tile outlined, and the enlarged pair it is shown as. */
function representativeProblems(w) {
  const problems = [];
  const rep = w.stage.root.getObjectByName('e02-representative');
  if (!rep || !shown(rep)) return ['no representative element on screen'];
  const tile = rep.getObjectByName('e02-representative-tile');
  const enlarged = rep.getObjectByName('e02-representative-enlarged');
  if (!tile || !shown(tile)) problems.push('the tile is not outlined');
  if (!enlarged || !shown(enlarged)) problems.push('the enlarged pair is not outlined');
  if (tile && !boxOf(tile).containsPoint(w.registry.anchorWorld('pool.elements', 'first_slot').setY(boxOf(tile).min.y + 1e-3))) problems.push('the outline is not around one element');
  if (enlarged) {
    const e = boxOf(enlarged).expandByScalar(0.05);
    for (const k of ['mbuf', 'buffer_a']) {
      const b = boxOf(w.stage.instances[k].holder);
      if (!(e.min.x <= b.min.x && e.max.x >= b.max.x && e.min.z <= b.min.z && e.max.z >= b.max.z)) problems.push(`the enlarged outline does not hold the ${k}`);
    }
  }
  return problems;
}
/** Everything the overlay draws as text at time t (a recording canvas: no pixels). */
function drawnText(w, t) {
  const out = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => {
        if (k === 'fillText') return (s) => out.push(String(s));
        if (k === 'measureText') return (s) => ({ width: 10 * String(s).length });
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k === 'canvas') return { width: 1920, height: 1080 };
        return () => {};
      },
      set: () => true,
    },
  );
  for (const c of w.story.cues) {
    if (t < c.start || t > c.end) continue;
    const local = t - c.start;
    try {
      c.draw(ctx, { t, local: Math.max(local, 3), u: 0.5, a: 1, ein: 1, eout: 1, span: c.end - c.start, cue: c, project: () => [900, 500], world: {} });
    } catch {
      /* a widget the recording canvas cannot serve draws nothing here */
    }
  }
  return out;
}
/** Guard: no runtime state is labelled — not on any card, chip or title. */
function stateLabels(w, times) {
  const hits = [];
  for (const t of times) for (const s of drawnText(w, t)) if (STATE_WORDS.test(s)) hits.push(`${s} @${t.toFixed(2)}`);
  return hits;
}
/** Guard: the CPU takes no part — no copy glow, no copy pulse, nothing red on screen. */
function cpuActivity(w) {
  const hits = [];
  if (w.stage.cpuGlow.visible) hits.push('cpu glow');
  if (w.stage.cpuPulse.visible) hits.push('cpu pulse');
  w.stage.root.traverse((o) => {
    if (o.isMesh && shown(o) && o.material?.color && sameHue(o.material.color, RED)) hits.push(o.name || 'red mesh');
  });
  return hits;
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

describe('s01e02 milestone 4 — the real Mempool, prepared before any packet', () => {
  it('1 + 17. uses the real Mempool asset, unchanged: twelve [MBUF | BUFFER] elements, the size a fresh pool builds', () => {
    const fresh = createMempool();
    new THREE.Group().add(fresh.root).updateMatrixWorld(true);
    expect(world.stage.instances.pool.asset.components.map((c) => c.id)).toEqual(fresh.components.map((c) => c.id));
    world.at(E(22));
    const want = boxOf(fresh.components[0].object).getSize(new THREE.Vector3());
    const got = world.registry.worldBox('pool.elements').getSize(new THREE.Vector3());
    for (const k of ['x', 'y', 'z']) expect(got[k], k).toBeCloseTo(want[k], 6);
    expect(world.stage.instances.pool.holder.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('2. reveals the Mempool only after sentence 16 — on "allocates", before any packet — and keeps it', () => {
    for (const t of span(0, E(16), 1)) {
      world.at(t);
      expect(shown(world.stage.instances.pool.holder), `t=${t}`).toBe(false);
    }
    expect(world.story.lanes.pool.from).toBeGreaterThanOrEqual(S(17));
    expect(world.story.lanes.pool.to).toBeLessThan(S(18));
    expect(world.story.lanes.pool.to).toBeLessThan(world.story.lanes.arrival2.from); // prepared before the packet arrives
    for (const t of span(world.story.lanes.pool.to, E(22), 0.5)) {
      world.at(t);
      expect(shown(world.stage.instances.pool.holder), `t=${t}`).toBe(true);
    }
  });

  it('3. shows every element as [MBUF | BUFFER]: an mbuf half and a larger buffer half', () => {
    expect(COUNT).toBe(12);
    expect(ELEMENT.bufferWidth).toBeGreaterThan(ELEMENT.mbufWidth);
    const m = mbufRect(FIRST);
    const b = bufferRect(FIRST);
    expect(m.x1).toBeLessThanOrEqual(b.x0); // side by side: the mbuf half, then the buffer half
    expect(TRAY.h).toBeGreaterThan(0);
  });

  it('5 + 14. shows no runtime state: no element moves or changes once the pool is set up, and no state words are drawn', () => {
    const elements = world.stage.instances.pool.asset.components[0].object;
    const snap = () => {
      const out = [];
      elements.traverse((o) => out.push([o.name, o.visible, ...o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(5)), o.material?.color?.getHexString?.() ?? '']));
      return out;
    };
    world.at(world.story.lanes.pool.to + 0.05);
    const first = snap();
    for (const t of span(world.story.lanes.pool.to + 0.05, E(22), 0.5)) {
      world.at(t);
      expect(snap(), `t=${t}`).toEqual(first);
    }
    expect(stateLabels(world, M4())).toEqual([]);
  });

  it('6–7. has no descriptor ring, no host-memory and no PCIe composition', () => {
    const names = [];
    world.scene.traverse((o) => names.push(o.name));
    expect(names.some((n) => /descriptor|desc-ring|host[-_ ]?memory|pcie-composition|nic[-_]host/i.test(n))).toBe(false);
    for (const id of ['descriptor_ring', 'host_memory']) expect(world.registry.has(id)).toBe(false);
  });
});

describe('s01e02 milestone 4 — one representative element, shown enlarged', () => {
  it('4. singles out ONE element on "ready to be used", says it is illustrative, and holds it through the DMA', () => {
    expect(world.story.lanes.representative.from).toBeGreaterThanOrEqual(Wd('ready', 19) - 0.5);
    for (const t of span(world.story.lanes.representative.from + 0.7, E(22), 0.5)) {
      world.at(t);
      expect(representativeProblems(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
    const text = drawnText(world, world.story.lanes.representative.from + 1.5).join(' ');
    expect(text).toMatch(/ONE REPRESENTATIVE ELEMENT/);
    expect(text).toMatch(/enlarged/i);
  });

  it('8. keeps the mbuf metadata-only: no packet byte inside it, and nothing blue on the tile’s mbuf half', () => {
    const half = world.stage.act2.bufferHalf;
    for (const t of M4()) {
      world.at(t);
      const record = boxOf(world.stage.instances.mbuf.holder).expandByScalar(0.05);
      world.stage.root.traverse((o) => {
        if (o.isMesh && shown(o) && o.material?.color && sameHue(o.material.color, BLUE)) expect(boxOf(o).intersectsBox(record), `${o.name} in the mbuf at t=${t.toFixed(2)}`).toBe(false);
      });
      if (shown(half)) expect(overRect(world, half.getWorldPosition(new THREE.Vector3()), mbufRect(FIRST))).toBe(false);
    }
  });
});

describe('s01e02 milestone 4 — the NIC’s DMA writes straight into the BUFFER', () => {
  it('10–11. lands the DMA on buffer A’s dma_target — the representative BUFFER — not the mbuf, not the pool', () => {
    for (const t of span(world.story.lanes.zdma.from, E(22), 0.5)) {
      world.at(t);
      expect(dmaProblems(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('9 + 15. fills the BUFFER with the bytes as they land, and lights the tile’s BUFFER half at that moment', () => {
    const { zdma, bufferHalf } = world.story.lanes;
    const payload = world.stage.instances.buffer_a.holder.getObjectByName('packet-buffer-payload-bytes');
    world.at(S(20));
    expect(shown(payload)).toBe(false); // the containers are empty before the packet: "empty packet containers"
    world.at(zdma.to + 1);
    expect(shown(payload)).toBe(true);
    expect(boxOf(world.stage.instances.buffer_a.holder).containsBox(boxOf(payload))).toBe(true);
    const half = world.stage.act2.bufferHalf;
    expect(bufferHalf.from).toBeLessThanOrEqual(zdma.to);
    expect(shown(half)).toBe(true);
    expect(overRect(world, half.getWorldPosition(new THREE.Vector3()), bufferRect(FIRST))).toBe(true);
  });

  it('14. keeps the DMA blue — the same trail and colour as sentence 5', () => {
    world.at(world.story.lanes.zdma.to);
    expect(shown(world.stage.trails.dma.mesh)).toBe(true);
    expect(sameHue(world.stage.trails.dma.mesh.material.color, BLUE)).toBe(true);
  });

  it('12–13. keeps the CPU out of it in sentences 21–22: no copy glow, no pulse, no red path', () => {
    for (const t of span(S(21), E(22), 0.25)) {
      world.at(t);
      expect(cpuActivity(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
    // And the CPU is still there, as context.
    expect(shown(world.stage.instances.cpu.holder)).toBe(true);
  });
});

describe('s01e02 milestone 4 — composition', () => {
  it('keeps every card of 17–22 in negative space, and the chapter label clear of the hardware and the pool', () => {
    const { director, P, project } = filmCamera(world);
    const cards = world.story.cues.filter((c) => c.layout && c.role !== 'chapter' && c.start >= S(17) - 0.5 && c.start <= E(22));
    expect(cards.length).toBe(5);
    // The chapter title's own rectangle, from its layout (the episode's typography).
    const LABEL = world.story.cues.find((c) => c.id === 'section-label:THE MEMPOOL').layout();
    for (const t of M4()) {
      director.update(t);
      world.at(t);
      const things = { nic: hull(corners(boxOf(world.stage.nicHolder)).map(P)) };
      for (const k of ['mbuf', 'buffer_a', 'cpu', 'pool']) if (shown(world.stage.instances[k].holder)) things[k] = hull(corners(boxOf(world.stage.instances[k].holder)).map(P));
      if (shown(world.stage.trails.dma.mesh)) for (const [i, q] of world.stage.trails.dma.curve.getSpacedPoints(40).map(P).entries()) things[`dma#${i}`] = [[q[0] - 8, q[1] - 8], [q[0] + 8, q[1] - 8], [q[0] + 8, q[1] + 8], [q[0] - 8, q[1] + 8]];
      for (const c of cards.filter((k) => t >= k.start + 0.2 && t <= k.end - 0.2)) {
        const r = c.layout(project);
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
      }
      if (t >= S(17) + 0.8 && t <= E(22) - 0.8) for (const k of ['nic', 'mbuf', 'buffer_a', 'cpu', 'pool']) if (things[k]) expect(overlaps(things[k], LABEL), `section label ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
    }
  });
});

describe('s01e02 milestone 4 — the guards fire (mutation tests)', () => {
  it('detects a DMA retargeted to the mbuf, or to the Mempool', async () => {
    const w = await build();
    w.at(E(21));
    expect(dmaProblems(w)).toEqual([]);
    const real = w.stage.trails.dma.curve;
    w.stage.trails.dma.curve = new THREE.LineCurve3(real.getPoint(0), w.registry.anchorWorld('mbuf.fields', 'center'));
    expect(dmaProblems(w)).toContain('lands on the mbuf');
    w.stage.trails.dma.curve = new THREE.LineCurve3(real.getPoint(0), w.registry.anchorWorld('pool.elements', 'center'));
    expect(dmaProblems(w)).toContain('lands on the Mempool');
    w.stage.trails.dma.curve = real;
  });

  it('detects the representative element removed', async () => {
    const w = await build();
    w.at(E(21));
    expect(representativeProblems(w)).toEqual([]);
    const rep = w.stage.root.getObjectByName('e02-representative');
    rep.removeFromParent();
    expect(representativeProblems(w)).toEqual(['no representative element on screen']);
  });

  it('detects a runtime-state label introduced', async () => {
    const w = await build();
    expect(stateLabels(w, [S(19) + 2])).toEqual([]);
    w.story.cues.push(callout({ start: S(19), end: E(19), title: 'FREE', subtitle: 'ready for the next packet', at: [118, 150] }));
    expect(stateLabels(w, [S(19) + 2]).length).toBeGreaterThan(0);
  });

  it('detects the CPU taking part, or a red path, during the DMA', async () => {
    const w = await build();
    w.at(E(21));
    expect(cpuActivity(w)).toEqual([]);
    w.stage.cpuGlow.visible = true;
    expect(cpuActivity(w)).toContain('cpu glow');
    w.stage.cpuGlow.visible = false;
    w.stage.trails.copy1.mesh.visible = true;
    expect(cpuActivity(w)).toContain('e02-copy-trail-a-b');
  });
});

describe('s01e02 milestone 4 — deterministic, and nothing protected moved', () => {
  const snapshot = (w, t) => {
    w.at(t);
    const out = [];
    w.stage.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), ...o.scale.toArray().map((v) => v.toFixed(6)), o.material?.opacity?.toFixed?.(6) ?? '']));
    return out;
  };

  it('18. renders the same world for the same moment, build after build', async () => {
    const again = await build();
    for (const t of span(S(17), E(22), 0.9)) expect(snapshot(again, t), `t=${t.toFixed(2)}`).toEqual(snapshot(world, t));
  });

  it('19. is seek-pure: a moment looks the same whether played into or jumped to', () => {
    const times = span(S(17), E(22), 0.6);
    const forward = times.map((t) => snapshot(world, t));
    const shuffled = times.map((t, i) => [t, i]).sort((a, b) => Math.sin(a[0] * 12.9898) - Math.sin(b[0] * 12.9898));
    for (const [t, i] of shuffled) expect(snapshot(world, t), `t=${t.toFixed(2)}`).toEqual(forward[i]);
  });

  it('22. leaves sentences 0–16 as approved: no shot or card of milestone 4 starts before sentence 17', () => {
    for (const s of world.story.shots) if (s.at < S(17)) expect(s.at + (s.transition ?? 0), `shot at ${s.at}`).toBeLessThanOrEqual(S(17) + 1e-6 + (s.at >= S(16) ? 99 : 0));
    const m4 = world.story.cues.filter((c) => c.layout && c.role !== 'chapter' && /BEFORE ANY PACKET|MEMPOOL|REPRESENTATIVE|DMA → BUFFER|ZERO COPY/.test(c.id ?? '') && c.start <= E(22));
    expect(m4.length).toBe(5);
    for (const c of m4) expect(c.start, c.id).toBeGreaterThanOrEqual(S(17));
    for (const k of ['pool', 'representative', 'arrival2', 'zdma', 'bufferHalf']) expect(world.story.lanes[k].from, k).toBeGreaterThanOrEqual(S(17));
  });

  it('16 + 20 + 21. leaves the voiceover, the timeline and the asset registry untouched', () => {
    expect(sha(path.join(EPISODE, 'timeline/words.json'))).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    const timelineJson = path.join(EPISODE, 'timeline.json');
    if (fs.existsSync(timelineJson)) expect(sha(timelineJson)).toBe(sha(path.join(EPISODE, 'timeline/words.json')));
    const voiceover = path.join(EPISODE, 'voiceover.mp3');
    if (fs.existsSync(voiceover)) expect(sha(voiceover)).toBe('b5d66919c8bd45a31c32aaa242ac1d4ceac3e0eaf566b440dc527d4e4024caa1');
    const ids = [...fs.readFileSync(path.join(REPO, 'assets/library.yaml'), 'utf8').matchAll(/^ {2}- id: ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(ids).toEqual(['nic', 'pcie', 'cpu', 'host_memory', 'descriptor_ring', 'mbuf', 'packet_buffer', 'mempool']);
  });
});
