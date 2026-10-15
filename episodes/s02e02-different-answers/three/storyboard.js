import * as THREE from 'three';
import { Ease } from '@axiobyte/three/core/tween.js';
import { C, LAYER, TRACK } from '@axiobyte/three/video/overlay/theme.js';
import { text, measure, rule } from '@axiobyte/three/video/overlay/draw.js';
import { brandEndCard } from '@axiobyte/three/brand/endCard.js';
import { LIFT, ROW, SAFE, WHEEL, XC } from './look.js';

/** The AxioByte end card's length, after the film's hold (seconds); episode.yaml's tail is the hold plus this. */
export const END_CARD = 3.5;

/**
 * The score. Every time is a spoken word in timeline/timeline.json, looked up
 * with the transcript's own spelling ("30%", "26", "the."); nothing is typed in
 * by hand, and a phrase that is not spoken throws. The timeline is never edited
 * to fit.
 *
 * B01–B30, the whole film: B09–B16 is the approved review slice, unchanged;
 * the rest was built around it to the same plan (notes/visual-plan.md).
 */
export function buildStoryboard({ timeline: tl, tail = 1.5 }) {
  const S = (i) => tl.sentenceStart(i);
  const E = (i) => tl.sentenceEnd(i);
  /** A phrase, searched only inside sentence `i`. */
  const W = (phrase, i, occurrence = 1) => tl.wordTime(phrase, { after: S(i) - 0.05, before: E(i) + 0.05, occurrence });

  // In the order the narration speaks them.
  const T = {
    ask: W('Ask', 0),
    ai: W('AI', 0),
    twice: W('twice', 0),
    typed: ['Why', 'is', 'the', 'sky', 'blue'].map((w) => W(w, 1)),
    twoAnswers: W('two', 2),
    different: W('different', 2),
    oneBegins: S(3),
    aWords: ['the', 'sky', 'looks', 'blue', 'because'].map((w) => W(w, 3)),
    otherBegins: S(4),
    bWords: ['sunlight', 'is', 'made', 'of', 'every', 'color'].map((w) => W(w, 4)),
    neither: S(5),
    sameQ0: S(6),
    sameModel: W('same model', 6),
    so7: S(7),
    changed: W('changed', 7),
    look: S(8),
    asWeSaw: S(9),
    scores9: W('scores', 9),
    everyToken: W('every token', 9),
    turns: W('turns', 9),
    probs9: W('probabilities', 9),
    example: W('example', 10),
    sunlight30: W('sunlight', 10),
    pct30: W('30', 10), // "30%." as transcribed
    the26: W('The', 11),
    n26: W('26', 11),
    then: S(12),
    drawn: W('drawn', 12),
    chance: W('chance', 12),
    think: S(13),
    wheel: W('wheel', 13),
    slice: W('slice', 13),
    wide: W('wide', 13),
    its: W('its', 13),
    probability: W('probability', 13),
    wheelEnd: E(13),
    widely: S(14), // "Wide slices win more often."
    often: W('often', 14),
    but: S(15),
    not: W('not', 15),
    time: W('time', 15),
    spin1: S(16) - 0.04, // the spin starts as "This spin" begins…
    landThe: W('the', 16), // …and stops on "the." as it is spoken
    now: S(17),
    rewind: W('rewind', 17),
    hold: W('hold', 17),
    fixed: W('fixed', 17),
    sameQ: S(18),
    sameP: W('same probabilities', 18),
    spinAgain: S(19),
    thisTime: S(20),
    landSun: W('sunlight', 20),
    wins: W('wins', 20),
    oneDiff: S(21),
    changes: W('changes', 21),
    after: W('after', 21),
    chosen: S(22),
    joins: W('joins', 22),
    next: W('next prediction', 22),
    there: W('there', 22),
    afterThe: S(23),
    sky: W('sky', 23),
    afterSun: S(24),
    is: W('is', 24),
    isEnd: E(24),
    each: S(25),
    word: W('word', 25),
    newProbs: W('probabilities', 25),
    another: W('and another', 25),
    spin3: W('spin', 25),
    two: W('two', 26),
    answers: W('answers', 26),
    drift: W('drift', 26),
    further: W('further', 26),
    apart: W('apart', 26),
    every2: W('every', 26),
    step: W('step', 26),
    zoom: S(27),
    becomes: W('becomes', 28),
    tree28: W('tree', 28),
    likely: S(29),
    still: W('still', 30),
    there30: W('there', 30),
    each31: S(31),
    walks: W('walks', 31),
    path31: W('path', 31),
    howFar: S(32),
    setting: W('setting', 32),
    called: W('called', 32),
    temperature32: W('temperature', 32),
    before33: S(33),
    scores33: W('scores', 33),
    becomeProbs: W('probabilities', 33),
    divided: W('divided', 33),
    temperature33: W('temperature', 33),
    low: W('low', 34),
    stretches: W('stretches', 34),
    gaps: W('gaps', 34),
    so34: W('so', 34),
    top: W('top', 34),
    dominate: W('dominate', 34),
    answers35: S(35),
    repeatable: W('repeatable', 35),
    notAlways: W('not always', 35),
    high: W('high', 36),
    gaps36: W('gaps', 36),
    probs37: W('probabilities', 37),
    flatten: W('flatten', 37),
    unlikely: S(38),
    chance38: W('chance', 38),
    vary: W('vary', 38),
    wandering: W('wandering', 38),
    strange: W('strange', 38),
    chanceIsnt: S(39),
    conversation: W('conversation', 40),
    version: W('version', 40),
    but41: S(41),
    starts: W('starts', 41),
    here41: W('here', 41),
    so42: S(42),
    broke: W('broke', 42),
    took: W('took', 43),
    which: S(44),
    answer45: W('answer', 45),
    completely: W('completely', 45),
    sure: W('sure', 45),
    wrong: W('wrong', 45),
    next46: W('next', 46),
  };

  const audioEnd = tl.duration;
  const duration = audioEnd + tail;
  const total = duration + END_CARD;

  // ---------------------------------------------------------------- camera
  // The camera looks at x = 0; the subject column sits at XC, centred in the safe area.
  const v = (a, b, c) => new THREE.Vector3(a, b, c);
  const view = (target, offset) => ({ target, position: target.clone().add(offset) });
  const shots = [
    // B01–B04: the two chats.
    { at: 0, view: view(v(0, 1.15, 0), v(0, 0.15, 12.6)), transition: 0, motion: { push: [1.02, 0.99] }, label: 'chats' },
    // B05: "Look at the first word" — into the column where both first words sit.
    { at: T.look - 0.1, view: view(v(XC - 0.85, 1.05, 0), v(0, 0.1, 9.4)), transition: 1.4, label: 'first word' },
    // B06: s02e01's world returns around them; this is the approved slice's opening framing.
    { at: T.asWeSaw - 0.1, view: view(v(0, 0.3, 0), v(0, 0.15, 12.6)), transition: 2.0, label: 'list' },
    { at: T.think - 0.3, view: view(v(0, 0.32, 0), v(0, 0.2, 12.0)), transition: 1.6, motion: { push: [1, 0.985] }, label: 'wheel' },
    { at: T.now - 0.2, view: view(v(0, 0.42, 0), v(0, 0.2, 12.5)), transition: 1.4, label: 'replay' },
    { at: T.oneDiff - 0.1, view: view(v(0, 0.5, 0), v(0, 0.3, 13.4)), transition: 1.8, label: 'fork' },
    { at: T.two - 0.2, view: view(v(0, 0.55, 0), v(0, 0.3, 14.0)), transition: 2.2, label: 'drift' },
    // B17: "Zoom out" — the whole tree, the question at its root, the two answers above.
    { at: T.zoom - 0.05, view: view(v(0, 0.7, 0), v(0, 0.3, 19.0)), transition: 1.8, motion: { push: [1, 0.98] }, label: 'tree' },
    // B20: back in close, to the temperature pipeline.
    { at: T.howFar + 0.9, view: view(v(0, 0.65, 0), v(0, 0.2, 13.2)), transition: 2.0, label: 'temperature' },
    // B26: pull back — the draw is one input among several.
    { at: T.chanceIsnt, view: view(v(0, 0.25, 0), v(0, 0.3, 19.5)), transition: 2.0, label: 'inputs' },
    // B28: the two answers, intact.
    { at: T.so42 - 0.1, view: view(v(0, 0.75, 0), v(0, 0.3, 17.6)), transition: 1.6, label: 'answers' },
    // B29–B30: the next question.
    { at: T.which, view: view(v(0, 0.95, 0), v(0, 0.15, 12.6)), transition: 2.0, motion: { push: [1, 0.97] }, label: 'next' },
  ].map((s) => ({ ease: Ease.inOutCubic, ...s }));

  // --------------------------------------------------------------- overlay
  const cues = [
    kicker(0, T.asWeSaw, 'ONE QUESTION, TWO ANSWERS'),
    kicker(T.asWeSaw, T.example - 0.3, 'NEXT TOKEN · ILLUSTRATIVE VALUES'),
    caption(T.turns - 0.2, T.example - 0.4, [[{ t: 'Scores become ' }, { t: 'probabilities', c: C.green }]], { top: true }),
    kicker(T.example - 0.3, T.now, 'A WEIGHTED DRAW · ILLUSTRATIVE VALUES'),
    // The replay is staged to land on the narrated tokens, and says so while it runs.
    kicker(T.now, T.oneDiff, 'SAME PROBABILITIES · DEMONSTRATION'),
    // B15–B16's outcomes are constructed to complete the opening's two answers; the caption states
    // the general mechanism, the kicker marks the example as a constructed one.
    kicker(T.oneDiff, T.zoom, 'DEMONSTRATION · ILLUSTRATIVE'),
    kicker(T.zoom, T.howFar, 'A TREE OF ANSWERS · ILLUSTRATIVE'),
    caption(T.likely - 0.1, T.each31 - 0.1, [[{ t: 'Brighter path' }, { t: ' = ', c: C.inkDim }, { t: 'more likely', c: C.green }]], { top: true }),
    // Temperature: illustrative values, exact arithmetic. B25's spin onto "banana" is staged, and says so.
    kicker(T.howFar, T.unlikely, 'TEMPERATURE · ILLUSTRATIVE VALUES'),
    kicker(T.unlikely, T.chanceIsnt, 'TEMPERATURE · DEMONSTRATION · ILLUSTRATIVE'),
    caption(T.divided - 0.2, T.low - 0.1, [[{ t: 'Scores ' }, { t: '÷ T', w: 700 }, { t: ', then ' }, { t: 'probabilities', c: C.green }]], { top: true }),
    caption(T.top - 0.2, T.answers35 + 0.6, [[{ t: 'Low temperature: ' }, { t: 'sharper', c: C.green }]], { top: true }),
    caption(T.notAlways - 0.2, T.high - 0.1, [[{ t: 'More repeatable,' }], [{ t: 'not always identical' }]], { top: true }),
    caption(T.probs37 - 0.2, T.unlikely + 1.4, [[{ t: 'High temperature: ' }, { t: 'flatter', c: C.green }]], { top: true }),
    // The one staged outcome in this section, disclosed at caption size where it happens.
    caption(T.wandering - 0.15, T.chanceIsnt - 0.05, [[{ t: 'A staged spin: ' }, { t: 'an unlikely token', c: C.accent }]], { top: true }),
    kicker(T.chanceIsnt, T.so42, 'WHY ANSWERS DIFFER · ILLUSTRATIVE'),
    kicker(T.so42, T.which, 'DEMONSTRATION · ILLUSTRATIVE'),
    kicker(T.which, duration, 'NEXT QUESTION'),
    caption(T.wide - 0.2, T.often + 0.3, [[{ t: 'Slice width' }, { t: ' = ', c: C.inkDim }, { t: 'probability', c: C.green }]], { top: true }),
    caption(T.joins - 0.1, T.there + 0.35, [[{ t: 'Each chosen ' }, { t: 'token', c: C.accent }], [{ t: 'shapes the next prediction' }]], { top: true }),
    label(T.widely + 0.1, T.time + 0.5, `${24} SAMPLE SPINS`, v(XC, WHEEL.y + WHEEL.rOut + 0.95, 0), 'above'),
    label(T.rewind + 0.6, T.oneDiff + 0.1, 'RUN 1', v(LIFT.left, LIFT.y + 0.26, 0), 'above'),
    label(T.landSun + 0.5, T.oneDiff + 0.1, 'RUN 2', v(LIFT.right, LIFT.y + 0.26, 0), 'above'),
    brackets(T.hold, T.oneDiff, [v(XC - 1.48, ROW.y - 0.26, 0), v(XC + 1.48, WHEEL.y + WHEEL.rOut + 0.42, 0)]),
    brandEndCard({ start: duration, end: total, target: '9x16', handle: false }),
  ];

  const sections = [
    { index: '00', label: 'THE SAME QUESTION', from: 0, to: T.asWeSaw },
    { index: '09', label: 'THE NEXT TOKEN', from: T.asWeSaw, to: T.example - 0.3 },
    { index: '10', label: 'EXAMPLE', from: T.example - 0.3, to: T.then },
    { index: '12', label: 'A DRAW', from: T.then, to: T.think },
    { index: '13', label: 'THE WHEEL', from: T.think, to: T.now },
    { index: '17', label: 'THE REPLAY', from: T.now, to: T.oneDiff },
    { index: '21', label: 'THE FORK', from: T.oneDiff, to: T.zoom },
    { index: '27', label: 'THE TREE', from: T.zoom, to: T.howFar },
    { index: '32', label: 'TEMPERATURE', from: T.howFar, to: T.chanceIsnt },
    { index: '39', label: 'OTHER REASONS', from: T.chanceIsnt, to: T.so42 },
    { index: '42', label: 'NOTHING BROKE', from: T.so42, to: T.which },
    { index: '44', label: 'NEXT', from: T.which, to: duration },
    { index: '', label: 'AXIOBYTE', from: duration, to: total },
  ];

  return { T, shots, cues, sections, duration: total, filmEnd: duration, audioEnd };
}

// ------------------------------------------------------------- overlay cues
// Sizes are fractions of the frame (1080x1920), as s02e01's.

/** The small spaced capitals at the top: where we are, and whether it is an illustration. */
function kicker(start, end, str) {
  return {
    id: `kicker:${str}`,
    start,
    end,
    layer: LAYER.title,
    fadeIn: 0.3,
    fadeOut: 0.3,
    draw(ctx) {
      const { width: w, height: h } = ctx.canvas;
      const x0 = w * (SAFE.side + 0.02);
      const y0 = h * (SAFE.top + 0.035);
      rule(ctx, x0, y0 - h * 0.018, w * 0.05, 1, { color: C.lineStrong, thickness: 2 });
      text(ctx, str, x0, y0, { size: Math.round(h * 0.0135), weight: 600, color: C.inkDim, track: TRACK.xwide });
    },
  };
}

/** Up to two centred lines, one keyword in its concept's hue; `top` sits it under the kicker. */
function caption(start, end, lines, { top = false } = {}) {
  return {
    id: `caption:${lines.flat().map((s) => s.t).join('')}`,
    start,
    end,
    layer: LAYER.caption,
    fadeIn: 0.35,
    fadeOut: 0.35,
    draw(ctx, k) {
      const { width: w, height: h } = ctx.canvas;
      const size = Math.round(h * 0.026);
      const lead = size * 1.28;
      const bottom = top ? h * (SAFE.top + 0.1) + (lines.length - 1) * lead : h * (1 - SAFE.bottom) - size * 0.9;
      const rise = (1 - k.ein) * size * 0.3;
      const bandTop = bottom - (lines.length - 1) * lead - size * 1.6;
      const band = ctx.createLinearGradient(0, bandTop - size, 0, bottom + size * 1.1);
      band.addColorStop(0, 'rgba(8,10,14,0)');
      band.addColorStop(0.35, 'rgba(8,10,14,0.62)');
      band.addColorStop(0.75, 'rgba(8,10,14,0.62)');
      band.addColorStop(1, 'rgba(8,10,14,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, bandTop - size, w, bottom - bandTop + size * 2.1);
      lines.forEach((segs, li) => {
        const y = bottom - (lines.length - 1 - li) * lead + rise;
        const widths = segs.map((s) => measure(ctx, s.t, { size, weight: s.w ?? 500 }));
        let cx = w * (0.5 - SAFE.right / 2 + SAFE.side / 2) - widths.reduce((a, b) => a + b, 0) / 2;
        segs.forEach((s, i) => {
          text(ctx, s.t, cx, y, { size, weight: s.w ?? 500, color: s.c ?? C.ink, track: TRACK.tight });
          cx += widths[i];
        });
      });
    },
  };
}

/** A small label tied to a point in the 3D world, projected every frame so it follows the camera. */
function label(start, end, str, at, side) {
  return {
    id: `label:${str}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.3,
    fadeOut: 0.3,
    draw(ctx, k) {
      const p = at.clone().project(k.world.engine.camera);
      if (p.z > 1) return;
      const { width: w, height: h } = ctx.canvas;
      const size = Math.round(h * 0.0145); // ~28 px: legible at phone size
      const dy = side === 'above' ? -size * 0.6 : size * 1.4;
      text(ctx, str, (p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h + dy, { size, weight: 600, color: C.muted, align: 'center', track: TRACK.wide });
    },
  };
}

/**
 * "Hold everything fixed": four thin corner marks around the question and the
 * wheel, held while the replay runs — the frame that says nothing inside it changes.
 */
function brackets(start, end, [lo, hi]) {
  return {
    id: 'brackets:fixed',
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.35,
    fadeOut: 0.35,
    draw(ctx, k) {
      const cam = k.world.engine.camera;
      const { width: w, height: h } = ctx.canvas;
      const px = (q) => {
        const p = q.clone().project(cam);
        return [(p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h];
      };
      const [x0, y1] = px(lo);
      const [x1, y0] = px(hi);
      const arm = w * 0.045;
      ctx.save();
      ctx.strokeStyle = C.lineStrong;
      ctx.lineWidth = Math.max(2, w * 0.0022);
      ctx.beginPath();
      for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        ctx.moveTo(x + dx * arm, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * arm);
      }
      ctx.stroke();
      ctx.restore();
    },
  };
}
