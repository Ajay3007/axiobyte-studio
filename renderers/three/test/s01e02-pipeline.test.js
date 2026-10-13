// s01e02, milestone 5 (sentences 23–30): ONE BUFFER, EVERY STAGE. The bytes stay in buffer A; the
// parser, classifier, firewall and routing stages each receive the HANDLE — a yellow reference to that
// buffer — never a copy; the router edits the header in place. Guards proved to fire (mutation tests);
// geometry, colour roles and drawn text, never pixels.
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

describe('s01e02 milestone 5 — one buffer: the bytes never leave it', () => {
  it('1 + 12. keeps exactly one physical packet buffer on screen — buffer A — from sentence 23 to the end of 30', () => {
    for (const t of M5()) {
      world.at(t);
      const bufs = packetBuffers(world);
      expect(bufs.length, `t=${t.toFixed(2)}`).toBe(1);
      expect(bufs[0]).toBe(world.stage.instances.buffer_a.asset.root);
    }
  });

  it('2. keeps every byte inside buffer A — the bytes stay where the NIC wrote them', () => {
    for (const t of M5()) {
      world.at(t);
      expect(strayBytes(world), `t=${t.toFixed(2)}`).toEqual([]);
      expect(packetBytes(world).length, `t=${t.toFixed(2)}`).toBeGreaterThan(0);
    }
  });

  it('3–7. gives no stage a copy: no byte group at the parser, the classifier, the firewall or the routing stage', () => {
    const names = world.stage.act2.stages.map((s) => s.name);
    expect(names).toEqual(['parser', 'classifier', 'firewall', 'routing']);
    for (const t of M5()) {
      world.at(t);
      expect(bytesAtStages(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('8. shows no copying at all: no red path, no CPU copy glow', () => {
    for (const t of M5()) {
      world.at(t);
      expect(copying(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('11. holds buffer A — and every byte in it — perfectly still through "never moves" (sentence 29), with a camera that holds too', () => {
    world.at(S(29));
    const snap = () => {
      const out = [world.stage.instances.buffer_a.holder.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6))];
      for (const o of packetBytes(world)) out.push(o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6)));
      return out;
    };
    const first = snap();
    for (const t of span(S(29), E(29), 0.2)) {
      world.at(t);
      expect(snap(), `t=${t.toFixed(2)}`).toEqual(first);
    }
    const shot = world.story.shots.find((s) => Math.abs(s.at - S(29)) < 1e-6);
    expect(shot.motion ?? {}).toEqual({});
    // …while the handle runs the pipeline around it.
    const visited = new Set();
    for (const t of span(S(29), E(29) + 0.6, 0.05)) {
      world.at(t);
      world.stage.act2.stages.forEach((s, i) => s.lit.visible && visited.add(i));
    }
    expect([...visited].sort()).toEqual([0, 1, 2, 3]);
  });

  it('12. edits the header in place (sentence 30): buffer A’s own header bytes change colour where they lie', () => {
    const cells = world.stage.instances.buffer_a.asset.header.cells;
    world.at(world.story.lanes.edit.from - 0.2);
    const before = cells.map((c) => [c.material.color.getHex(), c.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6))]);
    world.at(E(30));
    const after = cells.map((c) => [c.material.color.getHex(), c.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6))]);
    expect(after.filter((a, i) => a[0] !== before[i][0]).length).toBeGreaterThan(0); // rewritten…
    expect(after.map((a) => a[1])).toEqual(before.map((b) => b[1])); // …where they lie
    expect(packetBuffers(world)).toEqual([world.stage.instances.buffer_a.asset.root]);
  });
});

describe('s01e02 milestone 5 — the handle is the reference', () => {
  it('9–10. passes a yellow handle, its line always on buffer A — never blue, never a byte group', () => {
    for (const t of span(world.story.lanes.stage[0] + 0.5, E(30), 0.25)) {
      world.at(t);
      expect(handleProblems(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('brings the handle to each stage on its name, and lights a stage only while the handle is there', () => {
    const { stage } = world.story.lanes;
    world.stage.act2.stages.forEach((st, i) => {
      world.at(stage[i] + 0.6);
      expect(st.lit.visible, st.name).toBe(true);
      world.stage.act2.stages.forEach((o, j) => j !== i && expect(o.lit.visible, `${o.name} while at ${st.name}`).toBe(false));
    });
  });

  it('lets nothing travel along the handle’s line through sentence 30', () => {
    const bead = world.stage.root.getObjectByName('e02-handle-line-bead');
    for (const t of M5()) {
      world.at(t);
      expect(bead.visible, `t=${t.toFixed(2)}`).toBe(false);
    }
  });
});

describe('s01e02 milestone 5 — stages, labels, composition', () => {
  it('13. keeps the stages episode-local presentation: registered only as e02 markers, never as assets', () => {
    for (const st of world.stage.act2.stages) {
      const c = world.registry.get(`e02.stage.${st.name}`);
      expect(c.meta.presentation, st.name).toBe(true);
      expect(st.group.name).toMatch(/^e02-stage-/);
    }
    const ids = [...fs.readFileSync(path.join(REPO, 'assets/library.yaml'), 'utf8').matchAll(/^ {2}- id: ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(ids).toEqual(['nic', 'pcie', 'cpu', 'host_memory', 'descriptor_ring', 'mbuf', 'packet_buffer', 'mempool']);
  });

  it('14. draws every annotation of sentences 23–30 in the episode typography, at its role’s size', () => {
    const cues = world.story.cues.filter((c) => c.start >= S(23) - 0.5 && c.start <= E(30) && c.id !== 'vignette');
    expect(cues.length).toBeGreaterThanOrEqual(9); // 4 cards, 4 stage tags, the chapter label
    for (const c of cues) {
      expect(c.text, `${c.id} is not in the episode typography`).toBeDefined();
      const roleOf = new Map();
      for (const [role, strs] of Object.entries(c.text)) for (const s of strs) roleOf.set(s, role);
      for (const d of recordCue(c, c.start + 1)) {
        const role = roleOf.get(d.text);
        expect(d.size, `${c.id}: "${d.text}"`).toBeGreaterThanOrEqual(role === 'chapter' ? 26 : T.MIN[role]);
      }
    }
    for (const label of ['PARSER', 'CLASSIFIER', 'FIREWALL', 'ROUTING']) expect(cues.some((c) => c.id === `tag:${label}`), label).toBe(true);
  });

  it('15–16. keeps every annotation of 23–30 in the safe frame and off the buffer, the mbuf, the stages, the handle and its line, the reference, the bytes, the chapter label and each other', () => {
    const { director, P, project } = filmCamera(world);
    const band = (q, r = 8) => [[q[0] - r, q[1] - r], [q[0] + r, q[1] - r], [q[0] + r, q[1] + r], [q[0] - r, q[1] + r]];
    let checked = 0;
    for (const t of span(S(23), E(30) + 0.4, 0.2)) {
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
      if (shown(world.stage.reference.group.children[0])) for (let i = 1; i < 10; i++) things[`reference#${i}`] = band(P(world.stage.reference.from.clone().lerp(world.stage.reference.to, i / 10)));
      for (const o of packetBytes(world)) things[`bytes:${o.name}`] = hull(corners(boxOf(o)).map(P));
      const active = world.story.cues.filter((c) => c.text && c.start >= S(23) - 0.5 && t >= c.start + 0.2 && t <= c.end - 0.2);
      for (const c of active) {
        const r = c.layout(project);
        expect(r[0] >= 111 && r[2] <= 1809 && r[1] >= 75 && r[3] <= 1005, `${c.id} outside the safe frame at t=${t.toFixed(2)}`).toBe(true);
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
        for (const o of active) {
          if (o === c) continue;
          const q = o.layout(project);
          expect(r[2] < q[0] || q[2] < r[0] || r[3] < q[1] || q[3] < r[1], `${c.id} ∩ ${o.id} at t=${t.toFixed(2)}`).toBe(true);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
});

describe('s01e02 milestone 5 — the guards fire (mutation tests)', () => {
  it('detects a second packet buffer', async () => {
    const { createPacketBuffer } = await import('../src/domains/memory/packet-buffer/PacketBuffer.js');
    const w = await build();
    w.at(S(25));
    expect(packetBuffers(w).length).toBe(1);
    const second = createPacketBuffer();
    second.root.position.set(4.8, 0.5, 18);
    w.stage.root.add(second.root);
    w.stage.root.updateWorldMatrix(true, true);
    expect(packetBuffers(w).length).toBe(2);
  });

  it('detects a byte group moved to a processing stage', async () => {
    const w = await build();
    w.at(S(26));
    expect(bytesAtStages(w)).toEqual([]);
    const bytes = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: '#4aa8ff' }));
    bytes.name = 'mutant-bytes';
    bytes.position.copy(w.stage.act2.stages[2].group.position).add(new THREE.Vector3(0, 0.6, 0));
    w.stage.root.add(bytes);
    w.stage.root.updateWorldMatrix(true, true);
    expect(bytesAtStages(w)).toContain('firewall:mutant-bytes');
    expect(strayBytes(w)).toContain('mutant-bytes');
  });

  it('detects a red copy path', async () => {
    const w = await build();
    w.at(S(27));
    expect(copying(w)).toEqual([]);
    w.stage.trails.copy1.mesh.visible = true;
    expect(copying(w)).toContain('e02-copy-trail-a-b');
  });

  it('detects the handle drawn in the bytes’ blue', async () => {
    const w = await build();
    w.at(S(28) + 1);
    expect(handleProblems(w)).toEqual([]);
    w.stage.root.getObjectByName('e02-handle-chip').material.color.set('#4aa8ff');
    expect(handleProblems(w)).toContain('the handle wears the bytes’ blue');
  });
});

describe('s01e02 milestone 5 — deterministic', () => {
  const snapshot = (w, t) => {
    w.at(t);
    const out = [];
    w.stage.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), ...o.scale.toArray().map((v) => v.toFixed(6)), o.material?.opacity?.toFixed?.(6) ?? '', o.material?.color?.getHexString?.() ?? '']));
    return out;
  };

  it('17. renders the same world and the same overlay for the same moment, build after build — and in any order', async () => {
    const again = await build();
    const times = span(S(23), E(30), 0.9);
    for (const t of times) expect(snapshot(again, t), `t=${t.toFixed(2)}`).toEqual(snapshot(world, t));
    const forward = times.map((t) => snapshot(world, t));
    const shuffled = times.map((t, i) => [t, i]).sort((a, b) => Math.sin(a[0] * 12.9898) - Math.sin(b[0] * 12.9898));
    for (const [t, i] of shuffled) expect(snapshot(world, t), `seek to t=${t.toFixed(2)}`).toEqual(forward[i]);
    const a = filmCamera(world);
    const b = filmCamera(again);
    for (const t of span(S(23), E(30), 2)) {
      a.director.update(t);
      b.director.update(t);
      const ca = world.story.cues.filter((c) => c.text && t >= c.start && t <= c.end);
      const cb = again.story.cues.filter((c) => c.text && t >= c.start && t <= c.end);
      expect(cb.map((c) => c.id)).toEqual(ca.map((c) => c.id));
      ca.forEach((c, i) => expect(cb[i].layout(b.project)).toEqual(c.layout(a.project)));
    }
  });
});
