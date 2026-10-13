// s01e02 — the annotation typography (typography.js): every explanatory overlay of sentences 0–22,
// held to mobile-safe sizes and contrast, and kept in negative space frame by frame with the film's
// own camera. What is checked is what the overlay DRAWS (a recording canvas captures every string,
// its font and its ink) and where (each annotation's layout rectangle) — never pixels or OCR.
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

describe('s01e02 typography — mobile-safe sizes', () => {
  it('holds the hierarchy to its minimums: primary ≥ 48 px, secondary ≥ 34 px, support and chapter ≥ 26 px (on the 1920×1080 frame)', () => {
    expect(T.TYPE.primary.size).toBeGreaterThanOrEqual(T.MIN.primary);
    expect(T.TYPE.secondary.size).toBeGreaterThanOrEqual(T.MIN.secondary);
    expect(T.TYPE.support.size).toBeGreaterThanOrEqual(T.MIN.support);
    expect(T.TYPE.chapter.size).toBeGreaterThanOrEqual(26);
    expect(T.MIN).toEqual({ primary: 48, secondary: 34, support: 26 });
  });

  it('draws every string of every annotation in sentences 0–22 at its role’s size — nothing below 26 px', () => {
    const cues = typoCues(world);
    expect(cues.length).toBeGreaterThanOrEqual(20);
    for (const c of cues) {
      const drawn = recordCue(c, c.start + 1);
      const roleOf = new Map();
      for (const [role, strs] of Object.entries(c.text)) for (const s of strs) roleOf.set(s, role);
      expect(drawn.length, c.id).toBeGreaterThan(0);
      for (const d of drawn) {
        const role = roleOf.get(d.text);
        expect(role, `${c.id}: "${d.text}" is not declared`).toBeDefined();
        const min = role === 'chapter' ? 26 : T.MIN[role];
        expect(d.size, `${c.id}: "${d.text}" (${role})`).toBeGreaterThanOrEqual(min);
      }
      // Every declared string is drawn.
      for (const s of roleOf.keys()) expect(drawn.some((d) => d.text === s), `${c.id}: "${s}" not drawn`).toBe(true);
    }
  });

  it('leaves no sentence 0–22 annotation on the film’s old 16–22 px widgets', () => {
    const old = world.story.cues.filter((c) => !c.text && c.id !== 'vignette' && c.start <= E(22) && c.end >= S(0));
    expect(old.map((c) => c.id)).toEqual([]);
  });

  it('keeps the readable ink light — near-white or light — with the colour on the accents: contrast ≥ 7:1 on the plate', () => {
    for (const c of typoCues(world)) {
      for (const d of recordCue(c, c.start + 1)) {
        const isIndex = c.role === 'chapter' && /^\d+$/.test(d.text);
        const onPlate = c.role !== 'chapter';
        const bg = onPlate ? PLATE : FLOOR;
        const min = isIndex ? 3 : onPlate ? 7 : 4.5;
        expect(contrast(srgb(d.ink), bg), `${c.id}: "${d.text}" ink ${d.ink}`).toBeGreaterThanOrEqual(min);
      }
    }
    // The plate itself: dark and nearly opaque, with a real accent edge and border.
    const alpha = Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(T.CARD.fill)[1]);
    expect(alpha).toBeGreaterThanOrEqual(0.85);
    expect(T.CARD.accentW).toBeGreaterThanOrEqual(6);
    expect(T.CARD.border).toBeGreaterThanOrEqual(2);
    expect(T.CARD.padX).toBeGreaterThanOrEqual(24);
  });
});

describe('s01e02 typography — composition', () => {
  it('keeps every annotation of sentences 4–22 inside the title-safe frame and off the hardware, the DMA/copy/reference paths and the moving bytes', () => {
    const { director, P, project } = filmCamera(world);
    const band = (q, r = 8) => [[q[0] - r, q[1] - r], [q[0] + r, q[1] - r], [q[0] + r, q[1] + r], [q[0] - r, q[1] + r]];
    let checked = 0;
    for (const t of span(S(4), E(22), 0.25)) {
      director.update(t);
      world.at(t);
      const things = { nic: hull(corners(boxOf(world.stage.nicHolder)).map(P)) };
      for (const k of ['mbuf', 'buffer_a', 'buffer_b', 'cpu', 'pool']) if (shown(world.stage.instances[k].holder)) things[k] = hull(corners(boxOf(world.stage.instances[k].holder)).map(P));
      if (shown(world.stage.app.group)) things.app = hull(corners(boxOf(world.stage.app.group)).map(P));
      for (const [n, tr] of Object.entries(world.stage.trails)) if (shown(tr.mesh)) tr.curve.getSpacedPoints(40).forEach((q, i) => (things[`${n}#${i}`] = band(P(q))));
      if (shown(world.stage.reference.group.children[0])) for (let i = 1; i < 10; i++) things[`reference#${i}`] = band(P(world.stage.reference.from.clone().lerp(world.stage.reference.to, i / 10)));
      world.stage.root.traverse((o) => {
        if (/^e02-(packet-token|copy-carrier)/.test(o.name) && shown(o)) things[`bytes:${o.name}`] = band(P(o.getWorldPosition(new THREE.Vector3())), 36);
      });
      for (const c of typoCues(world).filter((k) => t >= k.start + 0.2 && t <= k.end - 0.2)) {
        const r = c.layout(project);
        expect(r[0] >= 112 - 1 && r[2] <= 1808 + 1 && r[1] >= 76 - 1 && r[3] <= 1004 + 1, `${c.id} outside the safe frame at t=${t.toFixed(2)}: ${r.map((v) => v.toFixed(0))}`).toBe(true);
        for (const [k, poly] of Object.entries(things)) expect(overlaps(poly, r), `${c.id} ∩ ${k} at t=${t.toFixed(2)}`).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('keeps sentence 8’s COST OF COPYING and sentence 22’s ZERO COPY in their zones — beside the hardware, at their size', () => {
    const { director, project } = filmCamera(world);
    for (const [heading, zone] of [['COST OF COPYING', 'e02.zone.upstage_right'], ['ZERO COPY', 'e02.zone.cpu_right']]) {
      const g = world.story.cues.find((c) => c.id === `cost-group:${heading}`);
      expect(g.zone).toBe(zone);
      const { w, h } = T.groupSize(g.text.primary[0], g.text.secondary);
      for (const t of span(g.start + 0.3, g.end - 0.3, 0.5)) {
        director.update(t);
        const r = g.layout(project);
        expect(r[2] - r[0]).toBeCloseTo(w, 6);
        expect(r[3] - r[1]).toBeCloseTo(h, 6);
        // Anchored to its zone: the zone's projection is on the group's edge (left, or right for a
        // right-aligned group) — or, where the zone lies past the title-safe edge, the group is pressed
        // against that edge, as close to its zone as the safe frame allows.
        const z = project(zone);
        const onEdge = Math.min(Math.abs(r[0] - z[0]), Math.abs(r[2] - z[0])) < 2;
        const atRight = Math.abs(r[2] - 1808) < 1 && z[0] >= r[0] - 1; // pressed against the right safe edge; zone inside the span or past that edge
        const atLeft = Math.abs(r[0] - 112) < 1 && z[0] <= r[2] + 1; // pressed against the left safe edge; zone inside the span or past that edge
        const clamped = atRight || atLeft;
        expect(onEdge || clamped, `${heading} at t=${t.toFixed(2)}: zone x ${z[0].toFixed(0)}, group ${r.map((v) => v.toFixed(0))}`).toBe(true);
      }
      // About 1.5–2× its old prominence: the old group was a 17 px heading over 20 px chips.
      expect(T.TYPE.primary.size / 17).toBeGreaterThan(2.5);
      expect(T.TYPE.secondary.size / 20).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('is deterministic: the same layout and the same drawn text for the same moment, build after build', async () => {
    const again = await build();
    const a = filmCamera(world);
    const b = filmCamera(again);
    for (const t of span(S(4), E(22), 3)) {
      a.director.update(t);
      b.director.update(t);
      const ca = typoCues(world).filter((c) => t >= c.start && t <= c.end);
      const cb = typoCues(again).filter((c) => t >= c.start && t <= c.end);
      expect(cb.map((c) => c.id)).toEqual(ca.map((c) => c.id));
      ca.forEach((c, i) => {
        expect(cb[i].layout(b.project)).toEqual(c.layout(a.project));
        expect(recordCue(cb[i], t)).toEqual(recordCue(c, t));
      });
    }
  });
});
