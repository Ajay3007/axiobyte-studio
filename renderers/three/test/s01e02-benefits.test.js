// s01e02, milestone 6 (sentences 31–39): WHY ZERO COPY MATTERS. The bytes stay where the NIC put
// them; only the pointer — the yellow handle — moves; it is cheap (8 bytes against the packet's
// hundreds–thousands); millions of packets a second are illustrated by a handful of handles, never
// buffers; the payoff is exactly what the narration names. Guards proved to fire (mutation tests).
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


let T; // typography.js
beforeAll(async () => {
  T = await import('../../../episodes/s01e02-zero-copy/three/typography.js');
});

/** The episode's typography cues (every card, group and chapter title) on screen at some moment of 0–22. */
const typoCues = (w) => w.story.cues.filter((c) => c.text && c.start <= E(22));

/** Draw a cue at time t on a recording canvas: every string, with its font size and ink. */
function recordCue(c, t, project = () => [900, 500]) {
  const out = [];
  const state = { font: '', fillStyle: '' };
  const stack = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => {
        if (k === 'fillText') return (s) => out.push({ text: String(s), size: Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 0), ink: state.fillStyle });
        if (k === 'measureText') return (s) => ({ width: 10 * String(s).length });
        if (k === 'save') return () => stack.push({ ...state });
        if (k === 'restore') return () => Object.assign(state, stack.pop() ?? {});
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k in state) return state[k];
        return () => {};
      },
      set: (_, k, v) => {
        if (k in state) state[k] = v;
        return true;
      },
    },
  );
  const local = Math.max(t - c.start, 6); // fully revealed, every list item on
  c.draw(ctx, { t, local, u: 0.5, a: 1, ein: 1, eout: 1, span: c.end - c.start, cue: c, project, world: {} });
  return out;
}

/** WCAG relative luminance and contrast. */
const lum = (css) => {
  const c = new THREE.Color(css.startsWith('rgba') ? css.replace(/rgba\((\d+),(\d+),(\d+),[^)]+\)/, 'rgb($1,$2,$3)') : css);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [c.r, c.g, c.b].map((v) => f(THREE.ColorManagement.enabled ? new THREE.Color().copy(c).convertLinearToSRGB()[['r', 'g', 'b'][[c.r, c.g, c.b].indexOf(v)]] : v));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const srgb = (css) => {
  const m = /#([0-9a-f]{6})/i.exec(css);
  const n = parseInt(m[1], 16);
  const f = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** What text sits on: the card's plate (rgba(8,10,14,0.9)) over the film's darkest floor tone. */
const PLATE = 0.2126 * ((8 / 255) / 12.92) + 0.7152 * ((10 / 255) / 12.92) + 0.0722 * ((14 / 255) / 12.92);
/** The brightest floor a chapter title (no plate) can sit on: the stage floor's lit grid tone. */
const FLOOR = srgb('#2a3038');


const M5 = () => span(S(23) + 1, E(30), 0.25);
const PAYLOAD_BLUE = BLUE;
const POINTER = new THREE.Color('#f5d14f');

// ------------------------------------------------------------------ the guards (mutation-tested below)

/** Visible packet buffers — the physical byte storage — anywhere on the stage. */
function packetBuffers(w) {
  const out = [];
  w.stage.root.traverse((o) => {
    if (o.name === 'packet-buffer' && shown(o)) out.push(o);
  });
  return out;
}
/** Visible meshes in the packet's colour that are BYTES — not a highlight plane, not a DMA path (a trail). */
function packetBytes(w) {
  const out = [];
  w.stage.root.traverse((o) => {
    if (o.isMesh && shown(o) && !/trail/.test(o.name) && o.material?.color && sameHue(o.material.color, PAYLOAD_BLUE) && o.material.blending !== THREE.AdditiveBlending) out.push(o);
  });
  return out;
}
/** Guard: bytes anywhere but buffer A — at a stage, or anywhere else. */
function strayBytes(w) {
  const a = boxOf(w.stage.instances.buffer_a.holder).expandByScalar(0.05);
  return packetBytes(w).filter((o) => !a.containsBox(boxOf(o))).map((o) => o.name || 'bytes');
}
/** Guard: bytes at a processing stage (a stage given a copy). */
function bytesAtStages(w) {
  const hits = [];
  for (const st of w.stage.act2.stages) {
    const b = boxOf(st.group).expandByScalar(0.6);
    for (const o of packetBytes(w)) if (b.intersectsBox(boxOf(o))) hits.push(`${st.name}:${o.name || 'bytes'}`);
  }
  return hits;
}
/** Guard: any copying — the CPU's copy glow or pulse, or anything red on screen. */
function copying(w) {
  const hits = [];
  if (w.stage.cpuGlow.visible) hits.push('cpu glow');
  if (w.stage.cpuPulse.visible) hits.push('cpu pulse');
  w.stage.root.traverse((o) => {
    if (o.isMesh && shown(o) && o.material?.color && sameHue(o.material.color, RED)) hits.push(o.name || 'red mesh');
  });
  return hits;
}
/** Guard: the handle is a yellow reference to buffer A — never blue, never byte-like, its line on the buffer. */
function handleProblems(w) {
  const problems = [];
  const chip = w.stage.root.getObjectByName('e02-handle-chip');
  const line = w.stage.root.getObjectByName('e02-handle-line');
  const tip = w.stage.root.getObjectByName('e02-handle-line-tip');
  if (sameHue(chip.material.color, PAYLOAD_BLUE) || sameHue(chip.material.emissive, PAYLOAD_BLUE)) problems.push('the handle wears the bytes’ blue');
  if (!sameHue(chip.material.color, POINTER)) problems.push('the handle is not pointer yellow');
  if (!sameHue(line.material.color, POINTER) || !sameHue(tip.material.color, POINTER)) problems.push('the handle’s line is not pointer yellow');
  if (shown(line)) {
    const tipAt = tip.getWorldPosition(new THREE.Vector3());
    const header = boxOf(w.stage.instances.buffer_a.holder).expandByScalar(0.8);
    if (!header.containsPoint(tipAt)) problems.push('the handle’s line does not point at buffer A');
  }
  return problems;
}

const M6 = () => span(S(31), E(39), 0.25);
// Milestone 6's cues: those that start after sentence 30 ends and before sentence 40 begins (39 ends
// at the very instant 40 starts, so a cue starting there is milestone 7's).
const M6_CUES = () => world.story.cues.filter((c) => c.start >= E(30) - 0.01 && c.start < S(40) - 0.01 && c.id !== 'vignette');

describe('s01e02 milestone 6 — the bytes stay; one buffer', () => {
  it('4–5. keeps buffer A as the one physical packet buffer, holding every byte, through sentences 31–39', () => {
    for (const t of M6()) {
      world.at(t);
      expect(packetBuffers(world).map((o) => o.uuid), `t=${t.toFixed(2)}`).toEqual([world.stage.instances.buffer_a.asset.root.uuid]);
      expect(strayBytes(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('6. never moves a byte: every byte sits where it sat at the start of sentence 31', () => {
    world.at(S(31));
    const at = () => packetBytes(world).map((o) => [o.uuid, o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6)).join()]);
    const first = new Map(at());
    for (const t of M6()) {
      world.at(t);
      for (const [id, p] of at()) expect(p, `byte ${id} at t=${t.toFixed(2)}`).toBe(first.get(id));
    }
  });

  it('9. shows no copying: no red path, no CPU copy glow — sentence 38’s "if every packet required copies" is told, not animated', () => {
    for (const t of M6()) {
      world.at(t);
      expect(copying(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });
});

describe('s01e02 milestone 6 — only the pointer moves', () => {
  it('7–8. keeps the handle yellow, never the bytes’ blue, its line on buffer A — and lets nothing travel along that line', () => {
    const bead = world.stage.root.getObjectByName('e02-handle-line-bead');
    for (const t of M6()) {
      world.at(t);
      expect(handleProblems(world), `t=${t.toFixed(2)}`).toEqual([]);
      expect(bead.visible, `bead at t=${t.toFixed(2)}`).toBe(false);
    }
  });

  it('traces the handle’s line on "key idea" — a static glow along the whole line, in pointer yellow — through "cheap" and the 8 bytes', () => {
    const trace = world.stage.act2.lineTrace;
    world.at(S(31) + 1);
    expect(trace.visible).toBe(false);
    const line = world.stage.root.getObjectByName('e02-handle-line');
    for (const t of [W_(world, 'key', 32) + 1, S(34) + 0.5, S(35) + 1, E(36) - 0.5]) {
      world.at(t);
      expect(trace.visible, `t=${t}`).toBe(true);
      expect(sameHue(trace.material.color, POINTER)).toBe(true);
      // Laid along the line, the whole of it: the same position, direction and length — nothing travelling.
      expect(trace.position.distanceTo(line.position)).toBeLessThan(1e-6);
      expect(trace.scale.y).toBeCloseTo(line.scale.y, 6);
    }
  });

  it('runs the handle through the stages on "Only the pointer is" — and the stages light as it passes', () => {
    const visited = new Set();
    for (const t of span(W_(world, 'pointer', 34), W_(world, 'pointer', 34) + 2.6, 0.05)) {
      world.at(t);
      world.stage.act2.stages.forEach((s, i) => s.lit.visible && visited.add(i));
    }
    expect([...visited].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('s01e02 milestone 6 — scale, illustrated', () => {
  it('10–11. illustrates "millions of packets a second" with a handful of yellow handles — never buffers, never bytes, never a crowd of objects', () => {
    const count = () => {
      let n = 0;
      world.stage.root.traverse((o) => o.isMesh && shown(o) && n++);
      return n;
    };
    world.at(E(36) - 0.2);
    const before = count();
    for (const t of span(S(37) + 0.6, E(39) - 0.5, 0.5)) {
      world.at(t);
      const stream = world.stage.act2.stream.filter(shown);
      expect(stream.length, `t=${t}`).toBeGreaterThan(0);
      expect(stream.length).toBeLessThanOrEqual(12);
      expect(count() - before, `added meshes at t=${t}`).toBeLessThanOrEqual(12);
      for (const s of stream) {
        expect(sameHue(s.material.color, POINTER), 'a streamed item is a handle (yellow)').toBe(true);
        expect(sameHue(s.material.color, BLUE)).toBe(false);
        expect(s.geometry).toBe(world.stage.root.getObjectByName('e02-handle-chip').geometry); // the handle's own shape
      }
      expect(packetBuffers(world).length).toBe(1); // still one buffer
    }
    // …and the picture says it is illustrative.
    const card = world.story.cues.find((c) => c.id === 'callout:MILLIONS OF PACKETS A SECOND');
    expect(card.text.support.join(' ')).toMatch(/illustrat/i);
  });
});

describe('s01e02 milestone 6 — labels, typography, composition', () => {
  it('2–3. draws every annotation of 31–39 — stage tags included — in the episode typography, at its role’s size; no old widget', () => {
    const cues = M6_CUES();
    expect(cues.length).toBe(13); // the chapter label, 4 stage tags, 7 cards, the payoff group
    for (const c of cues) {
      expect(c.text, `${c.id} is an old widget`).toBeDefined();
      const roleOf = new Map();
      for (const [role, strs] of Object.entries(c.text)) for (const s of strs) roleOf.set(s, role);
      for (const d of recordCue(c, c.start + 1)) expect(d.size, `${c.id}: "${d.text}"`).toBeGreaterThanOrEqual(roleOf.get(d.text) === 'chapter' ? 26 : T.MIN[roleOf.get(d.text)]);
    }
    for (const label of ['PARSER', 'CLASSIFIER', 'FIREWALL', 'ROUTING']) expect(cues.some((c) => c.id === `tag:${label}` && c.role === 'tag'), label).toBe(true);
    // The slabs' own tiny printed names never come back as the labels in 31–39.
    for (const t of span(E(30), E(39), 0.5)) {
      world.at(t);
      for (const st of world.stage.act2.stages) expect(st.print.visible && st.print.material.opacity > 0.01, `${st.name} print at t=${t}`).toBe(false);
    }
    // The benefits are exactly the narrated four.
    const pay = cues.find((c) => c.id === 'cost-group:THE PAYOFF');
    expect(pay.text.secondary).toEqual(['LESS CPU OVERHEAD', 'LESS MEMORY BANDWIDTH', 'BETTER CACHE EFFICIENCY', 'TENS–HUNDREDS OF GBIT/S']);
  });

  it('1 + 12–13. keeps every annotation of 31–39 in the safe frame and off the buffer, the mbuf, the NIC, the CPU, the stages, the handle and its line, the streaming handles, the chapter label and each other — the "04" label included', () => {
    const { director, P, project } = filmCamera(world);
    const band = (q, r = 8) => [[q[0] - r, q[1] - r], [q[0] + r, q[1] - r], [q[0] + r, q[1] + r], [q[0] - r, q[1] + r]];
    let checked = 0;
    for (const t of span(E(30), S(40) + 0.6, 0.2)) {
      director.update(t);
      world.at(t);
      const things = { nic: hull(corners(boxOf(world.stage.nicHolder)).map(P)) };
      for (const n of ['mbuf', 'buffer_a', 'cpu', 'pool']) if (shown(world.stage.instances[n].holder)) things[n] = hull(corners(boxOf(world.stage.instances[n].holder)).map(P));
      for (const st of world.stage.act2.stages) if (shown(st.group)) things[`stage:${st.name}`] = hull(corners(boxOf(st.group)).map(P));
      const h = world.stage.act2.handle;
      if (shown(h)) {
        things.handle = hull(corners(boxOf(h.children[0])).map(P));
        const a = h.getWorldPosition(new THREE.Vector3());
        const tip = world.stage.root.getObjectByName('e02-handle-line-tip').getWorldPosition(new THREE.Vector3());
        for (let i = 1; i < 12; i++) things[`handle-line#${i}`] = band(P(a.clone().lerp(tip, i / 12)));
      }
      world.stage.act2.stream.forEach((s, i) => shown(s) && (things[`stream#${i}`] = hull(corners(boxOf(s)).map(P))));
      for (const o of packetBytes(world)) things[`bytes:${o.name}`] = hull(corners(boxOf(o)).map(P));
      const active = world.story.cues.filter((c) => c.text && t >= c.start + 0.2 && t <= c.end - 0.2).map((c) => [c, c.layout(project)]).filter(([, r]) => r);
      const mine = active.filter(([c]) => c.start >= S(23) - 0.5); // milestone 5's late cues and every milestone 6 cue
      for (const [c, r] of mine) {
        expect(r[0] >= 111 && r[2] <= 1809 && r[1] >= 75 && r[3] <= 1005, `${c.id} outside the safe frame at t=${t.toFixed(2)}`).toBe(true);
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
        for (const [o, q] of active) if (o !== c && o.id !== c.id) expect(r[2] < q[0] || q[2] < r[0] || r[3] < q[1] || q[3] < r[1], `${c.id} ∩ ${o.id} at t=${t.toFixed(2)}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(250);
  });

  it('15. hands over cleanly from sentence 30: nothing of milestone 6 starts before sentence 30 ends, the stage names never flash back, the "04" label stays clear', () => {
    for (const c of M6_CUES()) expect(c.start, c.id).toBeGreaterThanOrEqual(E(30) - 1e-6);
    for (const k of ['stageTags2', 'handleTrace']) expect(world.story.lanes[k].from, k).toBeGreaterThanOrEqual(E(30));
    for (const s of world.story.shots.filter((x) => x.at > E(30) && x.at < S(40))) expect(s.at, 'shot').toBeGreaterThanOrEqual(E(30));
    // Milestone 5's own windows are untouched: its tags still end where they did.
    expect(world.story.lanes.stageTags.to).toBeCloseTo(E(30) + 0.4, 6);
  });

  it('16. hands over cleanly to sentence 40: every milestone 6 annotation has faded by the time sentence 40 is under way', () => {
    for (const c of M6_CUES()) expect(c.end, c.id).toBeLessThanOrEqual(S(40) + 0.5);
    expect(world.story.lanes.stageTags2.to).toBeLessThan(S(40));
  });
});

describe('s01e02 milestone 6 — the guards fire (mutation tests)', () => {
  it('detects the bead restored on the handle’s line', async () => {
    const w = await build();
    w.story.lanes.quietHandle = { from: S(23), to: E(30) };
    w.at(S(35) + 1);
    expect(w.stage.root.getObjectByName('e02-handle-line-bead').visible).toBe(true);
  });

  it('detects a handle drawn as bytes, a red copy path, a second buffer, and a crowd of streamed objects', async () => {
    const w = await build();
    w.at(S(38) + 1);
    expect(handleProblems(w)).toEqual([]);
    w.stage.root.getObjectByName('e02-handle-chip').material.color.set('#4aa8ff');
    expect(handleProblems(w)).toContain('the handle wears the bytes’ blue');
    w.stage.trails.copy2.mesh.visible = true;
    expect(copying(w)).toContain('e02-copy-trail-b-app');
    const { createPacketBuffer } = await import('../src/domains/memory/packet-buffer/PacketBuffer.js');
    w.stage.root.add(createPacketBuffer().root);
    w.stage.root.updateWorldMatrix(true, true);
    expect(packetBuffers(w).length).toBe(2);
    let before = 0;
    w.stage.root.traverse((o) => o.isMesh && shown(o) && before++);
    for (let i = 0; i < 200; i++) w.stage.root.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()));
    let after = 0;
    w.stage.root.traverse((o) => o.isMesh && shown(o) && after++);
    expect(after - before).toBeGreaterThan(12);
  });
});

describe('s01e02 milestone 6 — deterministic', () => {
  const snapshot = (w, t) => {
    w.at(t);
    const out = [];
    w.stage.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), ...o.scale.toArray().map((v) => v.toFixed(6)), o.material?.opacity?.toFixed?.(6) ?? '']));
    return out;
  };
  it('14. renders the same world for the same moment, build after build and in any order — and the same overlay layout', async () => {
    const again = await build();
    const times = span(S(31), E(39), 1.3);
    for (const t of times) expect(snapshot(again, t), `t=${t.toFixed(2)}`).toEqual(snapshot(world, t));
    const forward = times.map((t) => snapshot(world, t));
    const shuffled = times.map((t, i) => [t, i]).sort((a, b) => Math.sin(a[0] * 12.9898) - Math.sin(b[0] * 12.9898));
    for (const [t, i] of shuffled) expect(snapshot(world, t), `seek t=${t.toFixed(2)}`).toEqual(forward[i]);
    const a = filmCamera(world);
    const b = filmCamera(again);
    for (const t of span(S(31), E(39), 3)) {
      a.director.update(t);
      b.director.update(t);
      const ca = world.story.cues.filter((c) => c.text && t >= c.start && t <= c.end);
      const cb = again.story.cues.filter((c) => c.text && t >= c.start && t <= c.end);
      ca.forEach((c, i) => expect(cb[i].layout(b.project)).toEqual(c.layout(a.project)));
    }
  });
});

/**
 * Framing QA (reusable): the projected box of a shot's PRIMARY subject group — the objects the shot is
 * about, not every object in frame (context such as the NIC cropped at the top edge, or a chapter label,
 * does not set the centre). Returns the box clipped to the frame, its vertical centre, the empty space
 * above and below, and whether the whole group is inside the frame.
 */
function framing(w, camera, objects) {
  const pts = [];
  for (const o of objects) if (o && shown(o)) pts.push(...corners(boxOf(o)).map(camera.P));
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const [y0, y1] = [Math.max(0, Math.min(...ys)), Math.min(1080, Math.max(...ys))];
  return { y0, y1, centreY: (y0 + y1) / 2, above: y0, below: 1080 - y1, inside: Math.min(...xs) >= 0 && Math.max(...xs) <= 1920 && Math.min(...ys) >= 0 && Math.max(...ys) <= 1080 };
}
/** Milestone 6's shots and the subject each is composed around. */
const SUBJECTS = (w) => {
  const I = w.stage.instances;
  const stages = w.stage.act2.stages.map((st) => st.group);
  const handle = w.stage.act2.handle.children[0];
  return [
    // 31: "…where the NIC originally placed them" — the NIC and the buffer, with the stages.
    { name: '31 the NIC and the buffer', at: () => S(31) + 2.6, objects: [w.stage.nicHolder, I.buffer_a.holder, ...stages] },
    // 32–37: the buffer, its handle, the stages and the CPU (the NIC is cropped context, upstage).
    { name: '32 key idea', at: () => S(32) + 2.4, objects: [I.buffer_a.holder, I.cpu.holder, ...stages, handle] },
    { name: '34 only the pointer', at: () => S(34) + 0.6, objects: [I.buffer_a.holder, I.cpu.holder, ...stages, handle] },
    { name: '36 8 bytes', at: () => S(36) + 4, objects: [I.buffer_a.holder, I.cpu.holder, ...stages, handle] },
    { name: '37 millions', at: () => S(37) + 2.0, objects: [I.buffer_a.holder, I.cpu.holder, ...stages, handle] },
    // 38: the CPU deciding, with the stages.
    { name: '38 the CPU decides', at: () => S(38) + 3, objects: [I.cpu.holder, ...stages, handle] },
    // 39: the whole system — NIC included, and wholly in frame.
    { name: '39 the payoff', at: () => S(39) + 6, objects: [w.stage.nicHolder, I.buffer_a.holder, I.mbuf.holder, I.cpu.holder, ...stages, handle], whole: true },
  ];
};
/** Cinematic tolerance: the subject's centre within ±110 px of the frame's (540), and neither margin more than twice the other plus 120 px. */
function framingProblems(w) {
  const cam = filmCamera(w);
  const out = [];
  for (const s of SUBJECTS(w)) {
    const t = s.at();
    cam.director.update(t);
    w.at(t);
    const f = framing(w, cam, s.objects);
    if (Math.abs(f.centreY - 540) > 110) out.push(`${s.name}: centre y ${f.centreY.toFixed(0)} (frame 540)`);
    if (f.y1 >= 1079 && !s.whole) out.push(`${s.name}: clipped at the bottom`);
    if (s.whole && !f.inside) out.push(`${s.name}: not wholly in frame`);
    if (s.whole && (f.above > 2 * f.below + 120 || f.below > 2 * f.above + 120)) out.push(`${s.name}: unbalanced — ${f.above.toFixed(0)} px above, ${f.below.toFixed(0)} px below`);
  }
  return out;
}

describe('s01e02 milestone 6 — framing', () => {
  it('composes every shot of 31–39 around its subject: centred within tolerance, not bottom-heavy, the wide shot wholly in frame', () => {
    expect(framingProblems(world)).toEqual([]);
  });

  it('catches a bottom-heavy frame (mutation: sentence 39 pushed to the bottom of the frame)', async () => {
    const w = await build();
    const s39 = w.story.shots.find((x) => Math.abs(x.at - S(39)) < 1e-6);
    s39.frame = [0, -0.2];
    expect(framingProblems(w).some((p) => p.startsWith('39 the payoff'))).toBe(true);
  });

  it('keeps the recurring assets’ apparent scale steady across the cuts of 31–39 — no jump of more than 1.6×', () => {
    const cam = filmCamera(world);
    const size = (t) => {
      cam.director.update(t);
      world.at(t);
      const p = corners(boxOf(world.stage.instances.buffer_a.holder)).map(cam.P);
      return Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
    };
    const shots = world.story.shots.filter((x) => x.at >= S(31) - 0.1 && x.at < S(40));
    for (let i = 1; i < shots.length; i++) {
      const a = size(shots[i].at - 0.05);
      const b = size(shots[i].at + (shots[i].transition ?? 1) + 0.2);
      expect(Math.max(a, b) / Math.min(a, b), `buffer A's width across the cut at ${shots[i].at.toFixed(1)} s: ${a.toFixed(0)} → ${b.toFixed(0)} px`).toBeLessThan(1.6);
    }
  });
});

function W_(w, word, i) {
  return tl.wordTime(word, { after: S(i) - 0.01, before: E(i) });
}
