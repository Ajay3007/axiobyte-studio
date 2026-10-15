import * as THREE from 'three';
import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { canvasTexture, CANVAS_FONT } from '@axiobyte/three/core/textures.js';
import { cumulative, draws, landing, softmax } from '@axiobyte/three/domains/ml/probability.js';
import { BANANA, HUE, TEMP, TEMPS, TEMP_CONTEXT, TEMP_SAMPLES, TL, XC } from './look.js';
import { additive, halo, makeBar, makePanel, makeText, makeTile } from './objects.js';
import { buildWheel, makeDot, makePointer } from './wheel.js';
import { TAU, restRotation, spinAngle } from './spin.js';

/**
 * Temperature (B20–B25), laid out as a pipeline: each token's score, divided
 * by T; its probability, softmax(scores / T); and the wheel those
 * probabilities cut. Moving the control recomputes every bar, label and slice
 * from that formula, every frame — the values are illustrative (look.js TEMP),
 * the arithmetic is not.
 */

const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
const lerp = (a, b, u) => a + (b - a) * u;
const VIS = 0.004;
const PX = 320;
/** Rows: the named tokens, from the likeliest down. */
const ROWS = TEMP.tokens.slice(0, TEMP.named);
/** The wheel rests on the boundary after "air": neither the leader nor the token B25 lands on. */
const REST_AFTER = 2;

/** The temperature at time t: 1, then low (B22–B23), then high (B24–B25). Always positive. */
export function temperatureAt(t, T) {
  const toLow = ramp(t, T.low, T.low + 0.85);
  const toHigh = ramp(t, T.high, T.high + 0.95);
  return lerp(lerp(TEMPS.base, TEMPS.low, toLow), TEMPS.high, toHigh);
}

/** The distribution on screen at time t: softmax(scores / T). */
export const probsAt = (t, T) => softmax(TEMP.scores, temperatureAt(t, T));

/** The wheel's resting rotation for the probabilities shown: the boundary after "air" under the pointer. */
export const tempRest = (probs) => restRotation(cumulative(probs)[REST_AFTER]);

/** The seeded sample spins at each setting (B23 low, B25 high). */
export const tempSamples = (which) => draws(softmax(TEMP.scores, TEMPS[which]), TEMP_SAMPLES[which].seed, TEMP_SAMPLES[which].count);

/** B25's staged spin: from rest at the high setting to the middle of "banana". */
export function bananaSpin(t, T) {
  const probs = softmax(TEMP.scores, TEMPS.high);
  return spinAngle(t, { t0: T.wandering, t1: T.strange, from: tempRest(probs), u: landing(probs, BANANA, 0.5), turns: 1 });
}

/** A text plane whose words can change: redrawn only when they do (still a pure function of time). */
function liveText(w, h, { color = C.ink, weight = 600, align = 'left' } = {}) {
  const tex = canvasTexture(w * PX, h * PX, () => {});
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.safe = { w, h, label: 'live text', face: mesh };
  let shown = null;
  return {
    mesh,
    mat,
    set(str) {
      if (str === shown) return;
      shown = str;
      const cv = tex.image;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.font = `${weight} ${Math.round(h * PX * 0.78)}px ${CANVAS_FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(str, align === 'left' ? 2 : align === 'right' ? cv.width - 2 : cv.width / 2, cv.height * 0.54);
      tex.needsUpdate = true;
      mesh.userData.safe.label = str;
    },
  };
}

const pct = (p) => (p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

export function buildTemperature(scene) {
  const header = makeText(`…${TEMP_CONTEXT.split(' ').slice(2).join(' ')}`, { h: 0.2, color: C.ink, weight: 500 });
  const slot = makePanel(0.62, 0.26, C.accent, { round: 0.2 });
  const total = header.width + 0.08 + 0.62;
  header.mesh.position.set(XC - total / 2 + header.width / 2, TL.header, 0);
  slot.mesh.position.set(XC + total / 2 - 0.31, TL.header, 0);
  scene.add(header.mesh, slot.mesh);

  const headScore = makeText('SCORE ÷ T', { h: 0.19, color: C.ink, weight: 600 });
  headScore.mesh.position.set(TL.scoreX + headScore.width / 2, TL.heads, 0);
  const headProb = makeText('PROBABILITY', { h: 0.19, color: C.ink, weight: 600 });
  headProb.mesh.position.set(TL.probX + headProb.width / 2, TL.heads, 0);
  const divGlow = halo(HUE.ink, 1.3, 0.6);
  divGlow.position.set(TL.scoreX + headScore.width / 2, TL.heads, -0.02);
  scene.add(headScore.mesh, headProb.mesh, divGlow);

  const rows = ROWS.map((text, r) => {
    const y = TL.row0 - r * TL.row;
    const tile = makeTile(text);
    tile.group.scale.setScalar(TL.tileScale);
    tile.group.position.set(TL.tileX, y, 0);
    const score = makeBar(HUE.ink, 0.12);
    score.mesh.position.set(TL.scoreX, y, 0);
    const prob = makeBar(HUE.prob, 0.12);
    prob.mesh.position.set(TL.probX, y, 0);
    const label = liveText(0.5, 0.21, { color: C.ink, weight: 600 });
    scene.add(tile.group, score.mesh, prob.mesh, label.mesh);
    return { r, y, tile, score, prob, label };
  });

  // The gap between the two leading scores, marked so its stretching and shrinking can be seen.
  const gap = {
    line: new THREE.Mesh(new THREE.PlaneGeometry(1, 0.018), additive(HUE.ink, 0)),
    ticks: [0, 1].map(() => new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.07), additive(HUE.ink, 0))),
  };
  scene.add(gap.line, ...gap.ticks);

  // The control.
  const S = TL.slider;
  const track = new THREE.Mesh(new THREE.PlaneGeometry(S.x1 - S.x0, 0.03), additive(HUE.ink, 0));
  track.position.set((S.x0 + S.x1) / 2, S.y, 0);
  const knob = new THREE.Mesh(new THREE.CircleGeometry(0.075, 28), new THREE.MeshBasicMaterial({ color: HUE.ink, transparent: true, opacity: 0, toneMapped: false }));
  const knobGlow = halo(HUE.ink, 0.5, 0.5);
  const name = makeText('TEMPERATURE', { h: 0.17, color: C.ink, weight: 600 });
  name.mesh.position.set(S.x0 - 0.12 - name.width / 2, S.y, 0);
  const value = liveText(0.8, 0.24, { color: C.ink, weight: 700 });
  value.mesh.position.set(S.x1 + 0.12 + 0.4, S.y, 0);
  scene.add(track, knob, knobGlow, name.mesh, value.mesh);

  // The wheel: every slice re-proportioned to the current probabilities.
  const wheel = buildWheel(scene, TEMP, { rIn: TL.wheel.rIn, rOut: TL.wheel.rOut, labels: [0, 1], labelH: 0.2, gap: 0.004, minSegments: 24 });
  wheel.group.position.set(XC, TL.wheel.y, 0);
  const pointer = makePointer();
  pointer.mesh.scale.setScalar(0.8);
  scene.add(pointer.mesh, pointer.glow);

  const samples = { low: tempSamples('low'), high: tempSamples('high') };
  const dots = {
    low: samples.low.map(() => makeDot()),
    high: samples.high.map(() => makeDot()),
  };
  Object.values(dots).flat().forEach((d) => scene.add(d.mesh, d.glow));

  const banana = makeTile(TEMP.tokens[BANANA]);
  banana.group.scale.setScalar(0.5);
  scene.add(banana.group);

  return { header, slot, headScore, headProb, divGlow, rows, gap, track, knob, knobGlow, name, value, wheel, pointer, samples, dots, banana };
}

/** How present the temperature pipeline is: in as the camera returns (B20), out on "Chance" (B26). */
export const tempShown = (t, T) => ramp(t, T.howFar + 1.3, T.howFar + 2.0) * (1 - ramp(t, T.chanceIsnt, T.chanceIsnt + 0.8));

export function poseTemperature(o, t, T, safe) {
  const shown = tempShown(t, T);
  const Tv = temperatureAt(t, T);
  const probs = softmax(TEMP.scores, Tv);
  const set = (m, v) => {
    m.material.opacity = v;
    m.visible = v > VIS;
  };
  const setP = (p, v) => {
    p.mat.opacity = v;
    p.mesh.visible = v > VIS;
  };

  // The context: the decision this wheel is for. It leaves before the formula's caption arrives.
  const head = shown * (1 - ramp(t, T.divided - 0.6, T.divided - 0.3));
  setP(o.header, head);
  set(o.slot.mesh, head);

  // B21: the pipeline assembles — scores on "scores", probabilities on "probabilities".
  const scoresIn = (r) => ramp(t, T.scores33 + r * 0.06, T.scores33 + 0.35 + r * 0.06) * shown;
  const probsIn = (r) => ramp(t, T.becomeProbs + r * 0.06, T.becomeProbs + 0.35 + r * 0.06) * shown;
  setP(o.headScore, scoresIn(0));
  setP(o.headProb, probsIn(0));
  o.divGlow.material.opacity = 0.35 * shown * win(t, T.divided - 0.1, T.temperature33 + 0.5, 0.2);
  o.divGlow.visible = o.divGlow.material.opacity > VIS;

  const dominate = win(t, T.top - 0.2, T.answers35 + 0.2, 0.25);
  const flatten = win(t, T.probs37 - 0.2, T.unlikely - 0.1, 0.25);
  const chance = win(t, T.unlikely - 0.05, T.vary - 0.1, 0.2);
  o.rows.forEach(({ r, tile, score, prob, label }) => {
    const unlikely = r >= 4 ? chance : 0;
    const lit = (r === 0 ? dominate : 0) + flatten * 0.5 + unlikely;
    const si = scoresIn(r);
    tile.materials[0].opacity = 0.96 * si;
    tile.materials[1].opacity = si;
    tile.body.visible = tile.face.visible = si > VIS;
    tile.glow.material.opacity = si * (0.15 + 0.6 * Math.min(1, lit));
    const len = (TEMP.scores[r] / Tv) * TL.scoreScale;
    score.mesh.scale.x = Math.max(1e-3, len * si);
    score.mat.opacity = 0.55 * si;
    score.mesh.visible = si > VIS;
    const pi = probsIn(r);
    const pl = probs[r] * TL.probMax;
    prob.mesh.scale.x = Math.max(1e-3, pl * pi);
    prob.mat.opacity = pi * (0.6 + 0.4 * Math.min(1, lit));
    prob.mesh.visible = pi > VIS;
    label.set(pct(probs[r]));
    label.mesh.position.set(TL.probX + pl + 0.08 + 0.25, TL.row0 - r * TL.row, 0);
    setP(label, pi * safe(label.mesh, 0.5, 0.21));
  });

  // "Stretches the gaps" / "shrinks the gaps": a bracket between the two leading score bars.
  const g = shown * Math.max(win(t, T.gaps - 0.15, T.so34 + 0.6, 0.25), win(t, T.gaps36 - 0.15, T.gaps36 + 1.0, 0.25));
  const e0 = TL.scoreX + (TEMP.scores[0] / Tv) * TL.scoreScale;
  const e1 = TL.scoreX + (TEMP.scores[1] / Tv) * TL.scoreScale;
  const gy = TL.row0 - TL.row / 2;
  o.gap.line.position.set((e0 + e1) / 2, gy, 0.02);
  o.gap.line.scale.x = Math.max(1e-3, e0 - e1);
  set(o.gap.line, 0.9 * g);
  o.gap.ticks.forEach((m, k) => {
    m.position.set(k ? e0 : e1, gy, 0.02);
    set(m, 0.9 * g);
  });

  // The control: on "setting" it appears; its knob sits at the current T.
  const ctrl = shown * ramp(t, T.setting - 0.1, T.setting + 0.4);
  set(o.track, 0.4 * ctrl);
  const S = TL.slider;
  const kx = S.x0 + ((Tv - TEMPS.min) / (TEMPS.max - TEMPS.min)) * (S.x1 - S.x0);
  o.knob.position.set(kx, S.y, 0.02);
  o.knobGlow.position.set(kx, S.y, 0.01);
  set(o.knob, ctrl);
  const moving = Math.max(win(t, T.called - 0.1, T.temperature32 + 0.6, 0.2), win(t, T.temperature33 - 0.1, T.temperature33 + 0.6, 0.2), win(t, T.low - 0.1, T.low + 1.0, 0.2), win(t, T.high - 0.1, T.high + 1.1, 0.2));
  o.knobGlow.material.opacity = 0.6 * ctrl * moving;
  o.knobGlow.visible = o.knobGlow.material.opacity > VIS;
  setP(o.name, ctrl);
  o.value.set(`T = ${Tv.toFixed(1)}`);
  setP(o.value, ctrl);

  // The wheel: grows on "setting", cut by the current probabilities, resting on a boundary.
  const w = o.wheel;
  const grow = shown * ramp(t, T.howFar + 1.3, T.howFar + 1.9); // after the tree has mostly gone
  w.setProbs(probs);
  const banana = win(t, T.wandering - 0.6, T.chanceIsnt + 0.1, 0.2);
  const rho = banana > 0 && t >= T.wandering ? bananaSpin(t, T) : tempRest(probs);
  w.group.rotation.z = -rho;
  w.group.scale.setScalar(Math.max(1e-3, grow));
  const landed = ramp(t, T.strange - 0.05, T.strange);
  w.slices.forEach((s) => {
    let k = s.base;
    if (s.i === 0) k += 0.25 * dominate;
    if (s.i >= 4) k += 0.25 * chance;
    if (s.i === BANANA) k += 0.35 * landed;
    k += 0.15 * flatten;
    s.mat.opacity = grow * Math.min(1, k);
    s.mesh.visible = s.mat.opacity > VIS;
  });
  w.labels.forEach((l) => {
    const [x, y] = w.labelPoint(l, 1);
    const c = Math.cos(-rho);
    const sn = Math.sin(-rho);
    l.name.mesh.position.set(XC + grow * (x * c - y * sn), TL.wheel.y + grow * (x * sn + y * c), 0.03);
    // A label only while its slice is wide enough to hold it.
    const room = ramp(probs[l.i], 0.06, 0.1);
    setP(l.name, grow * room);
  });
  const down = win(t, T.wandering - 0.25, T.chanceIsnt + 0.2, 0.2);
  const ptop = TL.wheel.y + TL.wheel.rOut * grow + 0.14 + 0.06 * (1 - down);
  o.pointer.mesh.position.set(XC, ptop, 0.04);
  set(o.pointer.mesh, grow);
  o.pointer.glow.position.copy(o.pointer.mesh.position);
  o.pointer.glow.material.opacity = 0.6 * grow * landed;
  o.pointer.glow.visible = o.pointer.glow.material.opacity > VIS;

  // B23 and B25: seeded sample spins as dots on the rim, at the setting on screen.
  const dropDots = (list, samples, start, step, until, highlight) => {
    const restNow = tempRest(probs);
    const bins = new Map();
    list.forEach((d, k) => {
      const s = samples[k];
      const b = Math.floor(s.u * 40);
      const n = bins.get(b) ?? 0;
      bins.set(b, n + 1);
      const at = start + k * step;
      const fall = ramp(t, at, at + 0.25);
      const r = TL.wheel.rOut + 0.08 + 0.075 * n + 0.6 * (1 - fall);
      // Drawn at the setting on screen (T holds still while the dots show), so u lands in its slice.
      const phi = (s.u - 0.5) * TAU + restNow;
      d.mesh.position.set(XC + r * Math.sin(phi), TL.wheel.y + r * Math.cos(phi), 0.05);
      const v = shown * ramp(t, at, at + 0.08) * (1 - ramp(t, until, until + 0.3));
      const hl = highlight(s) ? win(t, highlight.at - 0.05, until, 0.15) : 0;
      d.mesh.material.opacity = v;
      d.mesh.scale.setScalar(1 + 0.5 * hl);
      d.mesh.visible = v > VIS;
      d.glow.position.copy(d.mesh.position);
      d.glow.material.opacity = v * (0.3 + 0.7 * hl);
      d.glow.scale.setScalar(0.26 * (1 + 1.4 * hl));
      d.glow.visible = d.mesh.visible;
    });
  };
  const offTop = (s) => s.index !== 0;
  offTop.at = T.notAlways;
  dropDots(o.dots.low, o.samples.low, T.answers35 + 0.1, 0.12, T.high - 0.25, offTop);
  const never = () => false;
  dropDots(o.dots.high, o.samples.high, T.chance38, 0.07, T.wandering - 0.35, never); // all 12 land by "vary"

  // B25's staged outcome: the spin stops on "banana" on "strange", and the tile rises beside the wheel.
  const rise = ramp(t, T.strange + 0.02, T.strange + 0.7);
  const b = o.banana;
  b.group.position.set(lerp(XC, TL.bananaAt.x, rise), lerp(TL.wheel.y + TL.wheel.rOut - 0.1, TL.bananaAt.y, rise), 0.07);
  b.group.scale.setScalar(lerp(0.25, 0.5, rise));
  const bo = shown * ramp(t, T.strange, T.strange + 0.2);
  b.materials[0].opacity = 0.96 * bo;
  b.materials[1].opacity = bo;
  b.body.visible = b.face.visible = bo > VIS;
  b.glow.material.opacity = bo * 0.7;
}
