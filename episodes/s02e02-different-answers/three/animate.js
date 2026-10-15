import { ramp } from '@axiobyte/three/video/overlay/draw.js';
import { landing } from '@axiobyte/three/domains/ml/probability.js';
import { BRANCH, DIM, FIRST, FIRST_WORD_SCALE, LIFT, REST_AFTER, boundaryAfter, HUE, LIST, NARROW_SAMPLES, ROW, SAMPLES, STAGED, SUNLIGHT, THE, WHEEL, WHEEL_RC, XC, branchAt } from './look.js';
import { createSafeFade } from './safe.js';
import { bendPoint } from './wheel.js';
import { TAU, restRotation, rewindAngle, spinAngle, spinTarget } from './spin.js';
import { poseOpening } from './opening.js';
import { poseTree } from './tree.js';
import { poseTemperature } from './temperature.js';
import { poseEnding } from './ending.js';

/**
 * Poses every object for time t. A pure function of t and the cue table T: no
 * state carries between frames, so a seek lands on exactly the frame a render
 * that played into it would have produced.
 */

const lerp = (a, b, u) => a + (b - a) * u;
/** 0 before a, up to 1 across [a, a+fade], held, back to 0 across [b-fade, b]. */
const win = (t, a, b, fade = 0.3) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
const VIS = 0.004;

function setTile(tile, opacity, glow = 0.2) {
  tile.materials[0].opacity = 0.96 * opacity;
  tile.materials[1].opacity = opacity;
  tile.body.visible = tile.face.visible = opacity > VIS;
  tile.glow.material.opacity = glow * opacity;
  tile.glow.visible = tile.body.visible;
}
function setPlane(p, opacity) {
  p.mat.opacity = opacity;
  p.mesh.visible = opacity > VIS;
}

/** When each branch step's word is drawn: the spoken word it lands on (look.js ANSWER_A / ANSWER_B). */
export function stepTimes(T) {
  return {
    [-1]: [T.joins, T.word, T.spin3, T.answers, T.apart],
    [1]: [T.joins, T.word, T.spin3, T.two, T.further, T.every2],
  };
}

/** A step's wheel: when it grows, spins and lands. k = 1 is B15's labelled prediction. */
export function spinnerTimes(T, k, land) {
  if (k === 1) return { grow: T.next, spin: T.isEnd + 0.2, land };
  if (k === 2) return { grow: T.word + 0.35, spin: T.another - 0.1, land };
  return { grow: land - 0.65, spin: land - 0.4, land };
}

/** The first wheel's resting boundary, and the rotation that puts it under the pointer. */
export const FIRST_REST = boundaryAfter(FIRST, REST_AFTER.first);
export const REST = restRotation(FIRST_REST);

/** The strip-to-wheel bend at time t (B09): 0 strip, 1 ring. */
export const bendAt = (t, T) => ramp(t, T.wheel - 0.15, T.slice + 0.1);

/**
 * The main wheel's rotation (clockwise radians) at time t. It turns to its
 * resting boundary as it forms, spins from there, rewinds to exactly there, and
 * spins again from there: both runs start from the same rest.
 */
export function wheelRotation(t, T) {
  const s1 = { t0: T.spin1, t1: T.landThe, from: REST, u: STAGED.run1.u, turns: STAGED.run1.turns };
  if (t < T.spin1) return REST * bendAt(t, T);
  if (t < T.rewind) return spinAngle(t, s1);
  const end1 = spinTarget(REST, s1.u, s1.turns);
  if (t < T.spinAgain) return rewindAngle(t, { t0: T.rewind, t1: T.rewind + 0.8, from: end1, to: REST });
  return spinAngle(t, { t0: T.spinAgain, t1: T.landSun, from: REST, u: STAGED.run2.u, turns: STAGED.run2.turns });
}

/** A branch wheel's rest: the boundary after its second token. */
export const branchRest = (vocab) => restRotation(boundaryAfter(vocab, REST_AFTER.branch));

/**
 * How present the question row, the branches and the answer panels are after the
 * approved slice: there through the tree (B17–B19), away for temperature (B20–B25),
 * back for B26–B28, and gone for the closing card (B29). 1 throughout B01–B16.
 */
export function stagePresence(t, T) {
  if (t < T.chanceIsnt) return 1 - ramp(t, T.howFar + 0.9, T.howFar + 1.7);
  if (t < T.which) return ramp(t, T.chanceIsnt + 0.2, T.chanceIsnt + 1.0);
  return 1 - ramp(t, T.which, T.which + 0.8);
}

export function createAnimator(objects, T, camera) {
  const safe = createSafeFade(camera);
  const { rowAt, row, ghostRow, list, listTail, wheel, ghostWheel, hub, pointer, dots, drawn, sides, panels, opening, callback } = objects;
  const g = wheel.geo;
  const stripY = WHEEL.y + WHEEL_RC;
  const steps = stepTimes(T);

  // ------------------------------------------------------------------ the question
  function poseRow(t) {
    const flash = win(t, T.sameQ + 0.6, T.sameQ + 1.05, 0.15);
    const stage = stagePresence(t, T);
    // B06, "as we saw last time": s02e01's token row returns; its last position glows as the scores are made.
    const last = win(t, T.asWeSaw + 0.5, T.scores9 + 0.6, 0.3);
    row.forEach((tile, i) => {
      tile.group.position.set(rowAt[i].x, ROW.y, 0);
      const rowIn = ramp(t, T.asWeSaw + 0.05 * i, T.asWeSaw + 0.45 + 0.05 * i);
      const o = rowIn * stage * safe(tile.group, tile.width, DIM.tileH);
      setTile(tile, o, 0.18 + 0.7 * flash + (i === row.length - 1 ? 0.8 * last : 0));
    });
    const beam = callback.beam;
    const b = win(t, T.asWeSaw + 0.6, T.probs9 + 0.6, 0.3);
    beam.scale.y = Math.max(1e-3, ramp(t, T.asWeSaw + 0.6, T.scores9) * beam.userData.len);
    beam.material.opacity = 0.4 * b;
    beam.visible = b > VIS;
    // The replay's proof: run 1's question slides onto run 2's and matches it exactly. Like the
    // ghost wheel it is drawn as outline and lettering only, with no slab, so it never covers the
    // live row — once aligned, its letters sit exactly on the live ones.
    const align = ramp(t, T.sameQ, T.sameQ + 0.6);
    const o = 0.75 * ramp(t, T.sameQ - 0.05, T.sameQ + 0.25) * (1 - ramp(t, T.sameQ + 1.0, T.sameQ + 1.4));
    ghostRow.forEach((tile, i) => {
      tile.group.position.set(rowAt[i].x + 0.22 * (1 - align), ROW.y + 0.16 * (1 - align), 0.08);
      tile.materials[0].opacity = 0;
      tile.body.visible = false;
      tile.materials[1].opacity = o;
      tile.face.visible = o > VIS;
      tile.glow.visible = false;
    });
  }

  // -------------------------------------------- B07's list, compressing into B08's strip
  const segment = (i) => {
    const s = wheel.slices[i];
    return { x0: XC + (s.f0 - 0.5) * g.stripW, w: (s.f1 - s.f0) * g.stripW };
  };
  function poseList(t) {
    const c = ramp(t, T.then + 0.05, T.drawn + 0.3);
    const handOff = ramp(t, T.drawn + 0.25, T.drawn + 0.45); // the bars become the strip's slices
    const leave = 1 - ramp(t, T.then, T.then + 0.6);
    // B06: a score for every candidate (neutral bars, close together), then probabilities (green, spread apart).
    const toProb = ramp(t, T.turns, T.probs9 + 0.2);
    list.forEach(({ r, tile, bar, pct }) => {
      const y = LIST.top - r * LIST.row;
      const lit = r === SUNLIGHT ? win(t, T.sunlight30 - 0.1, T.the26 - 0.1) : r === THE ? win(t, T.the26 - 0.1, T.then + 0.3) : 0;
      if (r <= THE) {
        // The answers' two first words became these tiles in B04; in B06 they fly to their rows.
        const from = opening.firstAt[r === SUNLIGHT ? 1 : 0];
        const fly = ramp(t, T.asWeSaw + 0.15, T.asWeSaw + 1.0);
        tile.group.position.set(lerp(from.x, LIST.tileX, fly), lerp(from.y, y, fly), 0.05 * (1 - fly));
        tile.group.scale.setScalar(lerp(FIRST_WORD_SCALE, LIST.scale, fly));
        const born = ramp(t, T.changed - 0.05, T.changed + 0.3);
        setTile(tile, born * leave, 0.15 + 0.75 * Math.max(lit, (1 - fly) * born * 0.6));
      } else {
        tile.group.position.set(LIST.tileX, y, 0);
        setTile(tile, ramp(t, T.scores9 + 0.08 * r, T.scores9 + 0.4 + 0.08 * r) * leave, 0.15 + 0.75 * lit);
      }
      const probLen = (FIRST.probs[r] / FIRST.probs[0]) * LIST.barMax;
      const scoreLen = (FIRST.scores[r] / FIRST.scores[0]) * LIST.barMax * 0.95;
      const len = lerp(scoreLen, probLen, toProb);
      const rise = ramp(t, T.scores9 + 0.06 * r, T.scores9 + 0.45 + 0.06 * r);
      const seg = segment(r);
      bar.mat.color.copy(HUE.ink).lerp(HUE.prob, toProb);
      bar.mesh.position.set(lerp(LIST.barX, seg.x0, c), lerp(y, stripY, c), 0);
      bar.mesh.scale.set(Math.max(1e-3, lerp(len * rise, seg.w, c)), lerp(1, g.stripH / 0.17, c), 1);
      bar.mat.opacity = (0.6 + 0.35 * lit) * (1 - handOff) * rise;
      bar.mesh.visible = bar.mat.opacity > VIS;
      pct.mesh.position.set(LIST.barX + probLen + 0.1 + pct.width / 2, y, 0);
      // The two narrated values appear as they are spoken; the rest as the scores become probabilities.
      const said = r === SUNLIGHT ? T.pct30 : r === THE ? T.n26 : T.probs9;
      setPlane(pct, leave * ramp(t, said - 0.05, said + 0.25));
    });
    const tail0 = XC + (wheel.cdf[FIRST.named - 1] - 0.5) * g.stripW;
    const tailW = (1 - wheel.cdf[FIRST.named - 1]) * g.stripW;
    listTail.forEach(({ k, bar }) => {
      const y = LIST.top - (FIRST.named + 0.4) * LIST.row - k * 0.085;
      // The faint rest of the vocabulary stays put and fades; the strip's own tail slivers replace it.
      bar.mesh.position.set(LIST.barX, y, -0.25 - k * 0.1);
      bar.mesh.scale.set(0.05 + 0.1 * Math.abs(Math.sin(k * 2.17)), 1, 1);
      bar.mat.color.copy(HUE.ink).lerp(HUE.prob, ramp(t, T.turns, T.probs9 + 0.2));
      bar.mat.opacity = 0.4 * (1 - k / listTail.length) * (1 - ramp(t, T.then, T.then + 0.5)) * ramp(t, T.everyToken + k * 0.04, T.everyToken + 0.3 + k * 0.04);
      bar.mesh.visible = bar.mat.opacity > VIS;
    });
  }

  // ------------------------------------------------------------------- the wheel
  /** World position of a point in a wheel's frame, given its rotation (clockwise) and scale. */
  const toWorld = (w, [x, y], rho, s = 1) => {
    const c = Math.cos(-rho);
    const sn = Math.sin(-rho);
    return [w.group.position.x + s * (x * c - y * sn), w.group.position.y + s * (x * sn + y * c)];
  };

  function poseWheel(t) {
    const on = ramp(t, T.drawn + 0.25, T.drawn + 0.45);
    const tailOn = ramp(t, T.then + 0.3, T.drawn + 0.3);
    const exit = ramp(t, T.oneDiff, T.oneDiff + 0.75);
    const o = on * (1 - exit);
    const m = bendAt(t, T); // B09: the strip curls into the wheel
    const rho = wheelRotation(t, T);
    const scale = 1 - 0.35 * exit;
    wheel.bend(m);
    wheel.group.rotation.z = -rho;
    wheel.group.scale.setScalar(scale);

    const freeze = win(t, T.fixed, T.fixed + 0.5, 0.2);
    const proof = win(t, T.sameP + 0.65, T.sameP + 1.0, 0.12);
    const landed1 = win(t, T.landThe - 0.05, T.rewind + 0.3, 0.15);
    const landed2 = win(t, T.landSun - 0.05, T.oneDiff + 0.4, 0.15);
    wheel.slices.forEach((s) => {
      let k = s.base;
      if (s.i === SUNLIGHT) k += 0.22 * win(t, T.wide - 0.1, T.its + 0.25, 0.2) + 0.25 * landed2;
      if (s.i === THE) k += 0.22 * win(t, T.its - 0.05, T.wheelEnd + 0.1, 0.2) + 0.25 * landed1;
      if (NARROW_SAMPLES.some((j) => SAMPLES[j].index === s.i)) k += 0.3 * win(t, T.not - 0.05, T.time + 0.4, 0.15);
      k *= 1 + 0.3 * freeze + 0.4 * proof;
      s.mat.opacity = (s.named ? on : Math.max(on, tailOn)) * (1 - exit) * Math.min(1, k);
      s.mesh.visible = s.mat.opacity > VIS;
    });

    // Labels stay upright while they ride the wheel.
    wheel.labels.forEach((l) => {
      const [x, y] = toWorld(wheel, wheel.labelPoint(l, m), rho, scale);
      const strip = l.i === 3 ? ramp(m, 0.4, 0.8) : 1; // "Because" is wider than its strip segment
      const named = o * ramp(t, T.drawn + 0.3, T.drawn + 0.7) * strip;
      l.name.mesh.position.set(x, y + (l.pct ? 0.09 * m : 0), 0.03);
      setPlane(l.name, named);
      if (l.pct) {
        const shown = l.i === SUNLIGHT ? T.wide : l.i === THE ? T.its : T.probability + 0.15;
        l.pct.mesh.position.set(x, y - 0.1 * m - (1 - m) * 0.3, 0.03);
        setPlane(l.pct, o * ramp(t, shown - 0.05, shown + 0.25) * m);
      }
    });

    hub.position.set(XC, WHEEL.y, 0.01);
    hub.material.opacity = 0.5 * o * ramp(m, 0.8, 1);
    hub.visible = hub.material.opacity > VIS;

    // The pointer: s02e01's marker, raised while the wheel waits, lowered onto the rim for a spin.
    // It rides the resting boundary as the strip curls, so it is over a boundary from the start.
    const down = Math.max(win(t, T.spin1 - 0.25, T.rewind + 0.1, 0.2), win(t, T.spinAgain - 0.25, T.oneDiff + 0.4, 0.2));
    const restRho = REST * m;
    const [ox, oy] = toWorld(wheel, bendPoint(FIRST_REST, 1, m, g), restRho);
    const [ix, iy] = toWorld(wheel, bendPoint(FIRST_REST, -1, m, g), restRho);
    const nl = Math.hypot(ox - ix, oy - iy) || 1;
    const [nx, ny] = [(ox - ix) / nl, (oy - iy) / nl];
    const gap = 0.17 + 0.2 * (1 - down);
    pointer.mesh.position.set(ox + nx * gap, oy + ny * gap, 0.04);
    pointer.mesh.rotation.z = Math.atan2(nx, -ny);
    pointer.mesh.material.opacity = o;
    pointer.mesh.visible = o > VIS;
    pointer.glow.position.copy(pointer.mesh.position);
    pointer.glow.material.opacity = o * 0.6 * Math.max(landed1, landed2);
    pointer.glow.visible = pointer.glow.material.opacity > VIS;

    // The replay's proof: run 1's wheel — the same probabilities — slides onto run 2's exactly.
    const align = ramp(t, T.sameP, T.sameP + 0.65);
    const go = 0.85 * ramp(t, T.sameP - 0.05, T.sameP + 0.25) * (1 - ramp(t, T.sameP + 1.0, T.sameP + 1.35));
    ghostWheel.group.position.set(XC - 0.32 * (1 - align), WHEEL.y + 0.22 * (1 - align), -0.02);
    ghostWheel.group.scale.setScalar(1 + 0.07 * (1 - align));
    ghostWheel.group.rotation.z = -rho;
    ghostWheel.group.visible = go > VIS;
    ghostWheel.mats.forEach((mat) => (mat.opacity = go));
    return { m, rho, o };
  }

  // B10: hypothetical spins — seeded draws from the same probabilities — drop onto the rim.
  const bins = new Map();
  const stack = SAMPLES.map((d) => {
    const b = Math.floor(d.u * 48);
    const n = bins.get(b) ?? 0;
    bins.set(b, n + 1);
    return n;
  });
  function poseDots(t) {
    const gone = 1 - ramp(t, T.time + 0.25, T.time + 0.55);
    dots.forEach((d, k) => {
      const s = SAMPLES[k];
      const at = T.widely + 0.05 + k * 0.062;
      const fall = ramp(t, at, at + 0.28);
      const r = WHEEL.rOut + 0.1 + 0.095 * stack[k] + 0.8 * (1 - fall);
      const phi = (s.u - 0.5) * TAU + REST; // the wheel rests at REST throughout B10
      d.mesh.position.set(XC + r * Math.sin(phi), WHEEL.y + r * Math.cos(phi), 0.04);
      const narrow = NARROW_SAMPLES.includes(k) ? win(t, T.not - 0.05, T.time + 0.4, 0.15) : 0;
      const o = ramp(t, at, at + 0.1) * gone;
      d.mesh.material.opacity = o;
      d.mesh.scale.setScalar(1 + 0.5 * narrow);
      d.mesh.visible = o > VIS;
      d.glow.position.copy(d.mesh.position);
      d.glow.material.opacity = o * (0.35 + 0.65 * narrow);
      d.glow.scale.setScalar(0.26 * (1 + 1.4 * narrow));
      d.glow.visible = d.mesh.visible;
    });
  }

  // ------------------------------------------------- the drawn tiles and the replay
  const rimTop = { x: XC, y: WHEEL.y + WHEEL.rOut - 0.25 };
  function poseDrawn(t) {
    const A0 = branchAt(-1, 0);
    const B0 = branchAt(1, 0);
    const fork = ramp(t, T.oneDiff + 0.1, T.oneDiff + 1.1);
    const dock = win(t, T.joins - 0.05, T.joins + 0.6, 0.15);
    const scaleTo = (u) => lerp(LIFT.scale, BRANCH.scale, u);

    // "The": rises out of its slice on "the", flies back on "rewind", returns as branch A's first step.
    const the = drawn.the;
    const rise1 = ramp(t, T.landThe + 0.02, T.landThe + 0.75);
    const back = ramp(t, T.rewind, T.rewind + 0.7);
    if (t < T.oneDiff) {
      const lifted = { x: lerp(rimTop.x, LIFT.centre, rise1), y: lerp(rimTop.y, LIFT.y, rise1) };
      the.group.position.set(lerp(lifted.x, rimTop.x, back), lerp(lifted.y, rimTop.y, back), 0.06);
      the.group.scale.setScalar(lerp(0.3, LIFT.scale, rise1) * (1 - 0.5 * back));
      setTile(the, ramp(t, T.landThe, T.landThe + 0.2) * (1 - back), 0.25 + 0.6 * win(t, T.landThe, T.rewind, 0.2));
    } else {
      the.group.position.set(lerp(LIFT.left, A0.x, fork), lerp(LIFT.y, A0.y, fork), 0.06);
      the.group.scale.setScalar(scaleTo(fork));
      const o = ramp(t, T.oneDiff + 0.1, T.oneDiff + 0.9) * stagePresence(t, T);
      setTile(the, o * safe(the.group, the.width, DIM.tileH), 0.22 + 0.7 * dock - 0.12 * pathB(t));
    }

    // Run 1's ghost: left behind where "The" rose to, then set aside on the left.
    const ghost = drawn.ghostThe;
    const aside = ramp(t, T.rewind + 0.15, T.rewind + 0.85);
    if (t < T.oneDiff) ghost.group.position.set(lerp(LIFT.centre, LIFT.left, aside), LIFT.y, 0.05);
    else ghost.group.position.set(lerp(LIFT.left, A0.x, fork), lerp(LIFT.y, A0.y, fork), 0.05);
    ghost.group.scale.setScalar(scaleTo(t < T.oneDiff ? 0 : fork));
    setTile(ghost, 0.6 * ramp(t, T.rewind, T.rewind + 0.3) * (1 - ramp(t, T.oneDiff + 0.1, T.oneDiff + 0.9)), 0.08);

    // "Sunlight": rises on "sunlight", beside run 1's ghost; becomes branch B's first step.
    const sun = drawn.sunlight;
    const rise2 = ramp(t, T.landSun + 0.02, T.landSun + 0.75);
    const lifted = { x: lerp(rimTop.x, LIFT.right, rise2), y: lerp(rimTop.y, LIFT.y, rise2) };
    sun.group.position.set(lerp(lifted.x, B0.x, fork), lerp(lifted.y, B0.y, fork), 0.06);
    sun.group.scale.setScalar(t < T.oneDiff ? lerp(0.3, LIFT.scale, rise2) : scaleTo(fork));
    setTile(sun, ramp(t, T.landSun, T.landSun + 0.2) * stagePresence(t, T) * safe(sun.group, sun.width, DIM.tileH), 0.25 + 0.6 * win(t, T.landSun, T.oneDiff + 0.3, 0.2) + 0.7 * dock + 0.8 * pathB(t));
  }

  // ------------------------------------------------------------- the branches
  /** B28, "it just took another path": answer B's path lights from the question to its last word. */
  const pathB = (t) => win(t, T.took - 0.15, T.which + 0.3, 0.3);

  function poseBranches(t) {
    const stage = stagePresence(t, T);
    // B18: once brightness means likelihood, the two answers' paths — the likeliest drawn — glow brighter.
    const likely = ramp(t, T.likely - 0.1, T.likely + 0.7);
    for (const { side, steps: list } of sides) {
      const lands = steps[side];
      const lightB = side > 0 ? pathB(t) : -0.5 * pathB(t);
      list.forEach((st) => {
        const land = lands[st.k];
        // The link from the previous step draws as this step's word arrives.
        const drawIn = ramp(t, land, land + 0.35);
        st.edge.mesh.scale.y = Math.max(1e-3, drawIn * st.edge.len);
        st.edge.mesh.material.opacity = Math.max(0, 0.45 + 0.35 * likely + 0.45 * lightB) * drawIn * stage;
        st.edge.mesh.visible = drawIn > VIS;
        if (st.k === 0) return;

        const sp = spinnerTimes(T, st.k, land);
        const slotIn = ramp(t, T.changes + 0.1 * st.k, T.changes + 0.1 * st.k + 0.35);
        setPlane(st.slot, 0.35 * slotIn * (1 - ramp(t, sp.grow, sp.grow + 0.2)));

        // The step's own prediction: a small wheel grows where the word will be, spins, lands, and becomes the tile.
        const w = st.spinner;
        const grow = ramp(t, sp.grow, sp.grow + (st.k === 1 ? 0.6 : 0.25));
        const collapse = ramp(t, land + 0.02, land + 0.3);
        const ws = grow * (1 - collapse);
        const u = landing(w.vocab.probs, 0, 0.5);
        const rho = spinAngle(t, { t0: sp.spin, t1: land, from: branchRest(w.vocab), u, turns: st.k === 1 ? 1 : 0 });
        w.group.rotation.z = -rho;
        w.group.scale.setScalar(Math.max(1e-3, ws));
        const lit = st.k === 1 ? win(t, (side < 0 ? T.sky : T.is) - 0.1, land + 0.2, 0.15) : 0;
        const landed = ramp(t, land - 0.05, land);
        w.slices.forEach((s) => {
          const k = s.base + (s.i === 0 ? 0.25 * Math.max(lit, landed) : 0);
          s.mat.opacity = ws * Math.min(1, k);
          s.mesh.visible = s.mat.opacity > VIS;
        });
        w.labels.forEach((l) => {
          const [x, y] = toWorld(w, w.labelPoint(l, 1), rho, ws);
          l.name.mesh.position.set(x, y, 0.08);
          setPlane(l.name, ws * ramp(t, (side < 0 ? T.sky : T.is) - 0.1, (side < 0 ? T.sky : T.is) + 0.2));
        });

        const r = w.geo.rOut * ws;
        w.pointer.mesh.position.set(st.at.x, st.at.y + r + 0.08, 0.09);
        w.pointer.mesh.material.opacity = ws;
        w.pointer.mesh.visible = ws > VIS;

        const tileIn = ramp(t, land, land + 0.3);
        st.tile.group.scale.setScalar(BRANCH.scale * lerp(0.4, 1, tileIn));
        setTile(st.tile, tileIn * stage * safe(st.tile.group, st.tile.width, DIM.tileH), Math.max(0.05, 0.2 + 0.6 * win(t, land, land + 0.7, 0.15) + 0.8 * lightB));
      });
    }
  }

  // ---------------------------------------------------------- the two answers
  function posePanels(t) {
    // The answers so far, once B15's caption has cleared the top of the frame.
    const shown = ramp(t, T.there + 0.4, T.there + 0.8) * stagePresence(t, T);
    // B28: both answers held steady — nothing broke — and answer B lit as the path it took.
    const steady = win(t, T.so42, T.which + 0.3, 0.4);
    panels.forEach(({ side, card, planes, glow }) => {
      card.mat.opacity = 0.9 * shown;
      card.mesh.visible = shown > VIS;
      glow.material.opacity = shown * (0.1 * steady + (side > 0 ? 0.2 * pathB(t) : 0));
      glow.visible = glow.material.opacity > VIS;
      const lands = steps[side];
      planes.forEach((p, k) => {
        const at = k < lands.length ? lands[k] : lands.at(-1) + 0.35; // the ellipsis follows the last word
        setPlane(p, shown * ramp(t, at, at + 0.25) * safe(p.mesh, p.width, 0.2));
      });
    });
  }

  return {
    update(t) {
      poseRow(t);
      poseList(t);
      poseWheel(t);
      poseDots(t);
      poseDrawn(t);
      poseBranches(t);
      posePanels(t);
      poseOpening(opening, t, T);
      poseTree(objects.tree, t, T);
      poseTemperature(objects.temp, t, T, safe);
      poseEnding(objects.ending, t, T);
    },
    levelsAt: () => ({}),
    dispose() {},
  };
}

