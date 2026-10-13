// s01e02, milestone 7 (sentences 40–46): THE ENDING. The NIC transmits from the same buffer (a blue
// DMA read: the only byte movement); the buffer goes back to the pool; only the yellow handle was passed;
// a packet is a pointer to its bytes. Framing, scale and typography held to the milestone 6 standard.
// Guards proved to fire (mutation tests).
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

// The film's end: the voiceover plus its hold. (The AxioByte end card follows it; its own tests are
// s01e02-end-card.test.js.)
const FILM_END = (w) => w.story.filmEnd ?? w.story.duration;
const M7 = () => span(S(40), FILM_END(world), 0.25);
const M7_CUES = (w = world) => w.story.cues.filter((c) => c.start >= S(40) - 0.01 && c.id !== 'vignette' && c.role !== 'endcard');
/** Guard: annotations of 40–46 not drawn in the episode typography (an old small widget). */
const oldWidgets = (w) => M7_CUES(w).filter((c) => !c.text).map((c) => c.id);
/** The transmit cluster: the one byte group allowed to move — and only during the transmit DMA read. */
const txToken = (w) => w.stage.act2.txToken;
/** The film's shots of 40–46, each with the subject it is composed around. */
const SUBJECTS7 = (w) => {
  const I = w.stage.instances;
  const stages = w.stage.act2.stages.map((st) => st.group);
  const handle = w.stage.act2.handle.children[0];
  return [
    { name: '40 transmit', at: () => 189.0, objects: [w.stage.nicHolder, I.buffer_a.holder], whole: true },
    { name: '41 back to the pool', at: () => 194.6, objects: [I.pool.holder, I.mbuf.holder, I.buffer_a.holder], whole: true },
    { name: '43 never copied', at: () => 200.8, objects: [I.pool.holder, I.mbuf.holder, I.buffer_a.holder], whole: true },
    { name: '44 only the handle', at: () => 205.5, objects: [I.buffer_a.holder, I.cpu.holder, ...stages, handle] },
    { name: '46 the final frame', at: () => FILM_END(w) - 0.05, objects: [I.mbuf.holder, I.buffer_a.holder, handle], whole: true },
  ];
};
function framingProblems7(w) {
  const cam = filmCamera(w);
  const out = [];
  for (const s of SUBJECTS7(w)) {
    const t = s.at();
    cam.director.update(t);
    w.at(t);
    const f = framing(w, cam, s.objects);
    if (Math.abs(f.centreY - 540) > 80) out.push(`${s.name}: centre y ${f.centreY.toFixed(0)} (frame 540)`);
    if (f.y1 >= 1079 && !s.whole) out.push(`${s.name}: clipped at the bottom`);
    if (s.whole && !f.inside) out.push(`${s.name}: not wholly in frame`);
  }
  return out;
}
/** Buffer A's projected width at every shot change of 39–46, before and after: the scale continuity. */
function scaleJumps(w, limit = 1.6) {
  const cam = filmCamera(w);
  const size = (t) => {
    cam.director.update(t);
    w.at(t);
    const p = corners(boxOf(w.stage.instances.buffer_a.holder)).map(cam.P);
    return Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
  };
  const shots = w.story.shots.filter((x) => x.at >= S(39) - 0.1);
  const out = [];
  for (let i = 1; i < shots.length; i++) {
    const a = size(shots[i].at - 0.05);
    const b = size(Math.min(shots[i].at + (shots[i].transition ?? 1) + 0.2, FILM_END(w)));
    if (Math.max(a, b) / Math.min(a, b) >= limit) out.push(`${shots[i].at.toFixed(1)} s: ${a.toFixed(0)} → ${b.toFixed(0)} px`);
  }
  return out;
}

describe('s01e02 milestone 7 — transmit from the same buffer', () => {
  it('1 + 6. transmits as the narration says: a blue DMA read from buffer A to the NIC’s port — the only byte movement, and only during it', () => {
    const { transmit } = world.story.lanes;
    expect(transmit.from).toBeCloseTo(W_(world, 'transmits', 40), 6);
    const tx = world.stage.act2.tx;
    expect(sameHue(tx.mesh.material.color, BLUE)).toBe(true);
    expect(tx.curve.getPoint(0).distanceTo(world.registry.anchorWorld('buffer_a.payload', 'read'))).toBeLessThan(1e-4);
    expect(boxOf(world.stage.nicHolder).expandByScalar(1).containsPoint(tx.curve.getPoint(1))).toBe(true);
    // The buffer's own bytes never move; the transmit cluster moves only inside the transmit lane.
    world.at(S(40));
    const home = new Map(packetBytes(world).filter((o) => o !== txToken(world) && !txToken(world).children.includes(o)).map((o) => [o.uuid, o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6)).join()]));
    for (const t of M7()) {
      world.at(t);
      for (const o of packetBytes(world)) {
        let inToken = false;
        for (let v = o; v; v = v.parent) if (v === txToken(world)) inToken = true;
        if (inToken) {
          expect(t >= transmit.from && t <= transmit.to, `transmit bytes outside the transmit at t=${t.toFixed(2)}`).toBe(true);
          continue;
        }
        expect(o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(6)).join(), `${o.name} moved at t=${t.toFixed(2)}`).toBe(home.get(o.uuid));
      }
    }
    // The buffer keeps its bytes after the transmit: the DMA read does not empty it.
    world.at(E(40) + 0.5);
    expect(shown(world.stage.instances.buffer_a.holder.getObjectByName('packet-buffer-payload-bytes'))).toBe(true);
  });

  it('2. shows no copying at all: no red path, no CPU copy glow', () => {
    for (const t of M7()) {
      world.at(t);
      expect(copying(world), `t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('3 + 16. keeps one physical buffer, one Mempool, one NIC — no duplicate resource for transmit or reuse', () => {
    for (const t of M7()) {
      world.at(t);
      expect(packetBuffers(world).map((o) => o.uuid), `t=${t.toFixed(2)}`).toEqual([world.stage.instances.buffer_a.asset.root.uuid]);
    }
    const count = (name) => {
      let n = 0;
      world.scene.traverse((o) => o.name === name && n++);
      return n;
    };
    expect(count('packet-buffer')).toBe(2); // buffer A and buffer B — B long gone from the screen (sentence 17)
    expect(count('mempool')).toBe(1);
  });
});

describe('s01e02 milestone 7 — only the handle was passed', () => {
  it('4–5 + 7. keeps the handle yellow, never blue, its line on buffer A — with no bead on it, to the last frame', () => {
    const bead = world.stage.root.getObjectByName('e02-handle-line-bead');
    for (const t of M7()) {
      world.at(t);
      expect(handleProblems(world), `t=${t.toFixed(2)}`).toEqual([]);
      expect(bead.visible, `bead at t=${t.toFixed(2)}`).toBe(false);
    }
  });

  it('runs the handle through the stages on "passed" — the stages lighting in turn — and traces its line on "pointer"', () => {
    const visited = new Set();
    for (const t of span(W_(world, 'passed', 44) - 1.3, E(44), 0.05)) {
      world.at(t);
      world.stage.act2.stages.forEach((st, i) => st.lit.visible && visited.add(i));
    }
    expect([...visited].sort()).toEqual([0, 1, 2, 3]);
    world.at(W_(world, 'pointer', 45) + 1);
    expect(world.stage.act2.lineTrace.visible).toBe(true);
  });

  it('8. keeps the slabs’ tiny printed names hidden to the end; the stages are named only by the episode’s tags (sentence 44)', () => {
    for (const t of M7()) {
      world.at(t);
      for (const st of world.stage.act2.stages) expect(st.print.visible && st.print.material.opacity > 0.01, `${st.name} print at t=${t.toFixed(2)}`).toBe(false);
    }
    for (const label of ['PARSER', 'CLASSIFIER', 'FIREWALL', 'ROUTING']) {
      const tag = M7_CUES().find((c) => c.id === `tag:${label}`);
      expect(tag?.role, label).toBe('tag');
      expect(tag.start).toBeGreaterThanOrEqual(S(44));
      expect(tag.end).toBeLessThanOrEqual(S(45) + 0.5);
    }
  });
});

describe('s01e02 milestone 7 — typography, framing, composition', () => {
  it('9–10. draws every annotation of 40–46 in the episode typography, at mobile-safe sizes', () => {
    expect(oldWidgets(world)).toEqual([]);
    const cues = M7_CUES();
    expect(cues.length).toBe(12); // 2 chapter labels, 5 cards, 4 stage tags, the payoff
    for (const c of cues) {
      const roleOf = new Map();
      for (const [role, strs] of Object.entries(c.text)) for (const x of strs) roleOf.set(x, role);
      for (const d of recordCue(c, c.start + 1)) expect(d.size, `${c.id}: "${d.text}"`).toBeGreaterThanOrEqual(roleOf.get(d.text) === 'chapter' ? 26 : T.MIN[roleOf.get(d.text)]);
    }
  });

  it('11. composes every shot of 40–46 around its subject: centred within ±80 px, nothing clipped, the subject wholly in frame where it must be', () => {
    expect(framingProblems7(world)).toEqual([]);
  });

  it('12. keeps buffer A’s apparent scale continuous across every shot change of 39–46 (no jump of 1.6× or more)', () => {
    expect(scaleJumps(world)).toEqual([]);
  });

  it('13. keeps every annotation of 40–46 in the safe frame and off the NIC, the buffer, the mbuf, the CPU, the pool, the stages, the handle and its line, the transmit path and its bytes, the chapter label and each other', () => {
    const { director, P, project } = filmCamera(world);
    const band = (q, r = 8) => [[q[0] - r, q[1] - r], [q[0] + r, q[1] - r], [q[0] + r, q[1] + r], [q[0] - r, q[1] + r]];
    let checked = 0;
    for (const t of span(E(39) - 0.5, FILM_END(world), 0.2)) {
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
      const tx = world.stage.act2.tx;
      if (shown(tx.mesh)) tx.curve.getSpacedPoints(40).forEach((q, i) => (things[`transmit#${i}`] = band(P(q))));
      if (shown(txToken(world))) things.transmitBytes = band(P(txToken(world).getWorldPosition(new THREE.Vector3())), 40);
      const active = world.story.cues.filter((c) => c.text && t >= c.start + 0.2 && t <= c.end - 0.2).map((c) => [c, c.layout(project)]).filter(([, r]) => r);
      for (const [c, r] of active.filter(([c]) => c.start >= S(40) - 0.01)) {
        expect(r[0] >= 111 && r[2] <= 1809 && r[1] >= 75 && r[3] <= 1005, `${c.id} outside the safe frame at t=${t.toFixed(2)}`).toBe(true);
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
        for (const [o, q] of active) if (o !== c && o.id !== c.id) expect(r[2] < q[0] || q[2] < r[0] || r[3] < q[1] || q[3] < r[1], `${c.id} ∩ ${o.id} at t=${t.toFixed(2)}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('14. hands over cleanly from sentence 39: nothing of 40–46 starts before sentence 40; milestone 6’s cards have gone by 40’s first shot settling; buffer A’s scale is continuous', () => {
    for (const c of M7_CUES()) expect(c.start, c.id).toBeGreaterThanOrEqual(S(40) - 0.01);
    for (const c of world.story.cues.filter((k) => k.text && k.start >= E(30) && k.start < S(40) - 0.01)) expect(c.end, c.id).toBeLessThanOrEqual(S(40) + 0.5);
    const first = world.story.shots.find((x) => x.at > E(39) - 1 && x.at < E(40));
    expect(first.at).toBeGreaterThanOrEqual(S(40));
    expect(scaleJumps(world).filter((j) => j.startsWith(first.at.toFixed(1)))).toEqual([]);
  });

  it('15. ends on a clean, deterministic final frame: one buffer with its bytes, the mbuf, the handle and its traced line — the pool and stages settled away, the payoff card up', async () => {
    const tEnd = FILM_END(world) - 0.05;
    world.at(tEnd);
    expect(shown(world.stage.instances.pool.holder)).toBe(false);
    for (const st of world.stage.act2.stages) expect(shown(st.group), st.name).toBe(false);
    expect(shown(world.stage.instances.mbuf.holder)).toBe(true);
    expect(shown(world.stage.instances.buffer_a.holder.getObjectByName('packet-buffer-payload-bytes'))).toBe(true);
    expect(shown(world.stage.act2.handle)).toBe(true);
    expect(world.stage.act2.lineTrace.visible).toBe(true);
    expect(world.story.cues.find((c) => c.id === 'callout:A PACKET IS A POINTER TO ITS BYTES').end).toBeGreaterThanOrEqual(world.story.audioEnd);
    const snap = (w) => {
      w.at(tEnd);
      const out = [];
      w.stage.root.traverse((o) => out.push([o.name, o.visible, ...o.position.toArray().map((v) => v.toFixed(6)), o.material?.opacity?.toFixed?.(6) ?? '']));
      return out;
    };
    const again = await build();
    expect(snap(again)).toEqual(snap(world));
    const a = filmCamera(world);
    const b = filmCamera(again);
    a.director.update(tEnd);
    b.director.update(tEnd);
    const c1 = world.story.cues.filter((c) => c.text && tEnd >= c.start && tEnd <= c.end);
    const c2 = again.story.cues.filter((c) => c.text && tEnd >= c.start && tEnd <= c.end);
    c1.forEach((c, i) => expect(c2[i].layout(b.project)).toEqual(c.layout(a.project)));
  });
});

describe('s01e02 milestone 7 — the guards fire (mutation tests)', () => {
  it('detects a blue handle, a red copy path and a duplicate buffer', async () => {
    const w = await build();
    w.at(S(44) + 3);
    expect(handleProblems(w)).toEqual([]);
    w.stage.root.getObjectByName('e02-handle-chip').material.color.set('#4aa8ff');
    expect(handleProblems(w)).toContain('the handle wears the bytes’ blue');
    w.stage.trails.copy1.mesh.visible = true;
    expect(copying(w)).toContain('e02-copy-trail-a-b');
    const { createPacketBuffer } = await import('../src/domains/memory/packet-buffer/PacketBuffer.js');
    w.stage.root.add(createPacketBuffer().root);
    w.stage.root.updateWorldMatrix(true, true);
    expect(packetBuffers(w).length).toBe(2);
  });

  it('detects the bead restored', async () => {
    const w = await build();
    w.story.lanes.quietHandle = { from: S(23), to: E(39) };
    w.at(S(43));
    expect(w.stage.root.getObjectByName('e02-handle-line-bead').visible).toBe(true);
  });

  it('detects a tiny old annotation', async () => {
    const { callout } = await import('../src/video/overlay/widgets/callouts.js');
    const w = await build();
    expect(oldWidgets(w)).toEqual([]);
    w.story.cues.push(callout({ start: S(43), end: E(43), title: 'NEVER COPIED', at: [118, 150] }));
    expect(oldWidgets(w)).toEqual(['callout:NEVER COPIED']);
  });

  it('detects bottom-heavy framing and an oversized scale jump', async () => {
    const w = await build();
    const last = w.story.shots.find((x) => Math.abs(x.at - S(46)) < 1e-6);
    last.frame = [0, -0.25];
    expect(framingProblems7(w).some((p) => p.startsWith('46 the final frame'))).toBe(true);
    const w2 = await build();
    const s44 = w2.story.shots.find((x) => Math.abs(x.at - S(44)) < 1e-6);
    s44.view = { ...s44.view, padding: 0.45 };
    expect(scaleJumps(w2).length).toBeGreaterThan(0);
  });
});

function W_(w, word, i) {
  return tl.wordTime(word, { after: S(i) - 0.01, before: E(i) });
}
