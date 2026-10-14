import * as THREE from 'three';
import { Ease } from '@axiobyte/three/core/tween.js';
import { C, LAYER, TRACK } from '@axiobyte/three/video/overlay/theme.js';
import { text, measure, rule } from '@axiobyte/three/video/overlay/draw.js';
import { brandEndCard } from '@axiobyte/three/brand/endCard.js';
import { CHOSEN, DIM, GEN, INDEX, LIMIT_X, PANEL, PROMPT, SPLIT, SAFE, twoLineLayout } from './look.js';
import { stripAt } from './prediction.js';

/** The AxioByte end card's length, after the film's hold (seconds); episode.yaml's tail is the hold plus this. */
export const END_CARD = 3.5;

/**
 * The score: the whole film, sentence 0 to 32, then the brand's end card.
 *
 * Every time is a spoken word in timeline/timeline.json, looked up with the
 * transcript's own spelling ("ID", "Y"); nothing is typed in by hand, and a
 * phrase that is not spoken throws. The timeline is never edited to fit.
 */
export function buildStoryboard({ timeline: tl, tail = 1.5 }) {
  const S = (i) => tl.sentenceStart(i);
  const E = (i) => tl.sentenceEnd(i);
  /** A phrase, searched only inside sentence `i`. */
  const W = (phrase, i, occurrence = 1) => tl.wordTime(phrase, { after: S(i) - 0.05, before: E(i) + 0.05, occurrence });

  const T = {
    follow: S(1),
    typed: ['Why', 'is', 'the', 'sky', 'blue'].map((w) => W(w, 2)),
    enter: W('enter', 3),
    appears: W('appears', 3),
    start: S(4) - 0.6,
    butFirst: S(4),
    stop: W('stop', 4),
    split: W('split', 5),
    tokens: W('tokens', 5),
    chunks: W('small chunks', 5),
    whole: W('whole word', 5),
    part: W('part of a word', 5),
    mark: W('single mark', 5),
    qmark: W('question mark', 5),
    each: S(6),
    number: W('number', 6),
    id: W('ID', 7),
    label: W('label', 8),
    locker: W('locker', 8),
    nothing: W('nothing', 9),
    skyMeans: W('sky', 9),
    unlocks: W('unlocks', 10),
    list: W('long list', 10),
    learned: W('learned', 10),
    capture: W('capture', 11),
    skyCloud: W('sky', 12),
    cloud: W('cloud', 12),
    similar: W('similar', 12),
    numbersEnd: E(12),
    flowIn: S(13),
    flow: W('flow', 13),
    layers: W('layer after layer', 13),
    every: W('every token', 14),
    soFar: W('so far', 14),
    pulls: W('pulls', 14),
    lookEnd: E(14),
    blue: S(15),
    blueEnd: E(15),
    why: S(16),
    whyEnd: E(16),
    layerBy: S(17),
    context: W('context', 17),
    last: W('last one', 17),
    question: W('whole question', 17),
    end: E(17),
    predicts: W('predicts', 18),
    scores: W('scores', 19),
    everyToken: W('every token', 19),
    turns: W('turns', 19),
    probabilities: W('probabilities', 19),
    theHigh: S(20),
    sunlightHigh: W('sunlight', 20),
    banana: S(21),
    noChance: W('no chance', 22),
    one: S(23),
    chosen: W('chosen', 23),
    usually: W('usually', 23),
    likeliest: W('likeliest', 23),
    again: S(24),
    joins: W('joins', 25),
    // Each generated token lands on the word that speaks it; "scatters" on the second "token" of
    // "Token by token", END on "done".
    gen: [W('joins', 25), W('sky', 26), W('looks', 26), W('blue', 26), W('because', 26), W('sunlight', 26), W('token', 27, 2), W('done', 27)],
    done: W('done', 27),
    limit: W('hits', 27),
    wholeView: S(28),
    patterns: W('patterns', 29),
    text: W('text', 29),
    confident: W('confident', 30),
    wrongEnd: E(30),
    nextTime: S(31),
    appearsAgain: W('appears', 31),
    predicted: W('predicted', 32),
  };

  const audioEnd = tl.duration;
  const duration = audioEnd + tail; // the film's end: the voiceover and its hold
  const total = duration + END_CARD; // the video's end: the brand card after it
  const x = (word) => SPLIT[INDEX[word]].x;
  const lines = twoLineLayout(DIM.splitGap);
  const [F1, , , , FTOP] = DIM.floors;

  // ---------------------------------------------------------------- camera
  const v = (a, b, c) => new THREE.Vector3(a, b, c);
  /** A view: what we look at, and the offset the camera sits at from it. */
  const view = (target, offset) => ({ target, position: target.clone().add(offset) });
  const shots = [
    { at: 0, view: view(v(0, PROMPT.y + 0.3, 0), v(0, 0.35, 13.8)), transition: 0, motion: { push: [1.04, 0.96] }, label: 'prompt' },
    { at: T.enter - 0.2, view: view(v(0, -0.75, 0), v(0, 0.55, 14.2)), transition: 1.6, label: 'sent' },
    { at: T.butFirst - 0.1, view: view(v(0, 0, 0), v(0, 0.6, 12.8)), transition: 1.5, label: 'sentence' },
    { at: T.split - 0.3, view: view(v(0, -0.1, 0), v(-3.2, 1.5, 13.2)), transition: 2.4, motion: { push: [1, 0.96] }, label: 'tiles' },
    { at: T.part - 0.6, view: view(v(0, 0.75, 0), v(-1.8, 1.3, 14.5)), transition: 1.4, label: 'aside' },
    { at: T.qmark - 0.5, view: view(v(lines[INDEX['?']].x - 0.25, lines[INDEX['?']].y, 0), v(-1.2, 0.8, 8.5)), transition: 1.3, label: 'mark' },
    { at: T.each - 0.4, view: view(v(0.25, -0.45, 0), v(0, 1.0, 14.4)), transition: 1.8, label: 'ids' },
    { at: T.nothing - 0.5, view: view(v(x('sky'), -0.2, 0), v(1.2, 0.8, 9.5)), transition: 2.0, motion: { push: [1, 0.95] }, label: 'sky-tag' },
    { at: T.unlocks - 0.3, view: view(v(x('sky'), 1.5, 0), v(2.2, 0.4, 10.6)), transition: 2.0, motion: { push: [1, 0.96] }, label: 'unlock' },
    { at: T.capture - 0.2, view: view(v(0, 1.8, 0), v(-2.5, 1.0, 27)), transition: 2.4, label: 'columns' },
    { at: T.skyCloud - 0.3, view: view(v(x('sky') + 0.58, 0.95, 0.15), v(0.7, 0.5, 12.2)), transition: 2.0, label: 'similar' },
    { at: T.numbersEnd, view: view(v(0, 2.4, 0), v(-1.4, 1.4, 17)), transition: 2.4, motion: { pan: [0, 2.6, 0] }, label: 'rise' },
    // Settles as the climb ends (the lanes reach the top at T.layers + 1.1), before the caption arrives.
    { at: T.layers + 1.2, view: view(v(0, 1.2, 0), v(-2.2, 2.4, 18.6)), transition: 1.7, motion: { orbit: 0.006 }, label: 'floor-1' },
    { at: T.blue - 0.3, view: view(v((x('sky') + x('blue')) / 2, 1.45, 0.2), v(-0.6, 1.6, 14.4)), transition: 1.6, label: 'blue-sky' },
    { at: T.why - 0.3, view: view(v(x('Why') + 2.0, 1.4, 0.2), v(-1.6, 2.2, 17.4)), transition: 1.4, label: 'why' },
    { at: T.layerBy - 0.1, view: view(v(0, F1 + 0.8, 0), v(-2.5, 3.6, 17)), transition: 1.2, motion: { pan: [0, FTOP - F1 - 1.2, 0] }, label: 'climb' },
    { at: T.last - 0.5, view: view(v(x('?') - 0.4, FTOP, 0.2), v(-1.8, 3.0, 11)), transition: 1.8, motion: { push: [1, 0.92] }, label: 'last' },
    { at: T.predicts - 0.6, view: view(v(PANEL.x + 0.45, 11.9, 0.3), v(-0.6, 0.3, 15.5)), transition: 2.2, label: 'predict' },
    { at: T.one - 0.4, view: view(v(PANEL.x + 0.45, 12.2, 0.3), v(-0.4, 0.2, 13.5)), transition: 1.4, label: 'pick' },
    { at: T.again - 0.1, view: view(v(2.4, 9.5, 0.3), v(-1.2, 0.8, 16)), transition: 1.2, motion: { pan: [1.2, -7.3, 0] }, label: 'fly' },
    { at: T.joins - 0.3, view: view(v(2.6, 3.4, 0), v(-2.4, 2.2, 25)), transition: 1.4, label: 'join' },
    { at: T.gen[1] - 0.5, view: view(v(6.9, 3.4, 0), v(-2.2, 2.0, 25)), transition: 1.0, motion: { pan: [6.9, 0, 0] }, label: 'track' },
    { at: T.done - 0.7, view: view(v((GEN.at(-1).x + LIMIT_X) / 2 + 0.35, 1.4, 0), v(-1.0, 1.0, 17.5)), transition: 1.2, label: 'end' },
    { at: T.wholeView - 0.2, view: view(v(5.5, 2.3, 0), v(-12, 8.5, 11)), transition: 2.4, motion: { orbit: 0.006 }, label: 'whole' },
    { at: T.confident - 0.8, view: view(v(6.6, 0.4, 0), v(-1.2, 0.9, 17)), transition: 1.8, motion: { pan: [2.5, 0, 0] }, label: 'answer' },
    { at: T.nextTime - 0.4, view: view(v(0, PROMPT.y + 0.6, 0), v(0, 0.4, 14.5)), transition: 2.2, label: 'bookend' },
    { at: T.predicted - 0.4, view: view(v(0, PROMPT.y + 0.6, 0), v(0, 0.35, 13.2)), transition: 1.2, label: 'predicted' },
  ].map((s) => ({ ease: Ease.inOutCubic, ...s }));

  // --------------------------------------------------------------- overlay
  const cues = [
    kicker(0, T.enter, 'AI MADE VISUAL · 01'),
    kicker(T.start, T.each - 0.2, 'TOKENS'),
    kicker(T.each, T.unlocks - 0.3, 'TOKEN IDS · ILLUSTRATIVE VALUES'),
    kicker(T.unlocks, T.numbersEnd + 0.6, 'LEARNED NUMBERS · ILLUSTRATIVE'),
    kicker(T.flowIn, T.predicts - 0.6, 'THE LAYERS · ILLUSTRATIVE'),
    kicker(T.predicts - 0.4, T.again, 'NEXT TOKEN · ILLUSTRATIVE VALUES'),
    kicker(T.again, T.wholeView, 'ONE TOKEN AT A TIME · ILLUSTRATIVE'),
    // The ending's per-word probabilities are illustrative too, and say so while they show.
    kicker(T.confident - 0.3, T.wrongEnd + 0.6, 'ILLUSTRATIVE PROBABILITIES'),
    kicker(T.predicted - 0.5, duration, 'ILLUSTRATIVE PROBABILITIES'),
    caption(T.tokens, T.whole - 0.3, [[{ t: 'Tokens', c: C.accent }, { t: ': small chunks of text' }]]),
    caption(T.label, T.nothing + 1.0, [[{ t: 'An ID is just a ' }, { t: 'label', w: 700 }]]),
    caption(T.capture, T.skyCloud - 0.25, [[{ t: 'Learned numbers', c: C.violet }, { t: ' capture' }], [{ t: 'how a token tends to be used' }]]),
    caption(T.cloud, T.numbersEnd + 0.4, [[{ t: 'Similar use, ' }, { t: 'similar numbers', c: C.violet }]]),
    caption(T.every, T.lookEnd, [[{ t: 'Each token ' }, { t: 'looks back', c: C.amber }], [{ t: 'at the tokens so far' }]]),
    caption(T.context, T.end + 0.4, [[{ t: 'Layer by layer, each token' }], [{ t: 'takes on ', c: C.ink }, { t: 'context', c: C.amber }]]),
    label(T.part, T.mark - 0.2, 'EXAMPLE SPLIT · ILLUSTRATIVE', v(0, DIM.asideY + DIM.tileH / 2 + 0.12, 0), 'above'),
    label(T.last + 0.3, T.end + 0.4, 'last token', v(x('?'), FTOP + 0.34, 0), 'above'),
    caption(T.turns - 0.2, T.theHigh + 1.2, [[{ t: 'Scores become ' }, { t: 'probabilities', c: C.green }]]),
    caption(T.usually - 0.2, T.again, [[{ t: 'Usually a ' }, { t: 'likely', c: C.green }, { t: ' one,' }], [{ t: 'not always the likeliest' }]]),
    caption(T.done - 0.5, T.wholeView, [[{ t: 'Until it predicts the end,' }], [{ t: 'or hits a limit' }]]),
    caption(T.wholeView + 0.2, T.patterns - 0.3, [[{ t: 'Predicted', c: C.green }, { t: ', not looked up' }]], { top: true }),
    caption(T.patterns - 0.1, T.text + 0.6, [[{ t: 'Patterns ' }, { t: 'learned', c: C.violet }, { t: ' from text' }]], { top: true }),
    caption(T.confident - 0.3, T.wrongEnd + 0.5, [[{ t: 'Fluent is not the same' }], [{ t: 'as ' }, { t: 'correct', w: 700 }]]),
    label(T.everyToken, T.chosen - 0.6, 'THE REST OF THE VOCABULARY', v(PANEL.x - PANEL.stripW / 2 + PANEL.labelW + 0.6, 10.25, -1.0), 'below'),
    label(T.usually + 0.4, T.again, 'MOST LIKELY', stripAt(0), 'above'),
    label(T.chosen, T.again, 'CHOSEN', stripAt(CHOSEN), 'above'),
    label(T.limit, T.wholeView + 1.5, 'LENGTH LIMIT', v(LIMIT_X, 1.9, 0), 'above'),
    // One master for Reels (@axiobyte) and Shorts (@theaxiobytes): no handle is right for both, so the
    // card is platform-neutral — the logo and the call (docs/brand/AXIOBYTE_BRAND.md, Platform handles).
    brandEndCard({ start: duration, end: total, target: '9x16', handle: false }),
  ];

  const sections = [
    { index: '00', label: 'THE QUESTION', from: 0, to: T.start },
    { index: '04', label: 'TOKENS', from: T.start, to: T.each },
    { index: '06', label: 'TOKEN IDS', from: T.each, to: T.unlocks - 0.3 },
    { index: '10', label: 'LEARNED NUMBERS', from: T.unlocks - 0.3, to: T.flowIn },
    { index: '13', label: 'LAYERS', from: T.flowIn, to: T.predicts - 0.6 },
    { index: '18', label: 'NEXT TOKEN', from: T.predicts - 0.6, to: T.again },
    { index: '24', label: 'GENERATION', from: T.again, to: T.wholeView },
    { index: '28', label: 'ENDING', from: T.wholeView, to: duration },
    { index: '', label: 'AXIOBYTE', from: duration, to: total },
  ];

  return { T, shots, cues, sections, duration: total, filmEnd: duration, audioEnd };
}

// ------------------------------------------------------------- overlay cues
// Sizes are fractions of the frame, so the overlay is laid out for the frame it
// is drawn into (1080x1920 here) rather than a fixed 16:9 canvas.

/** The small spaced capitals at the top: where we are, and whether it is an illustration. */
function kicker(start, end, str) {
  return {
    id: `kicker:${str}`,
    start,
    end,
    layer: LAYER.title,
    draw(ctx) {
      const { width: w, height: h } = ctx.canvas;
      const x0 = w * (SAFE.side + 0.02);
      const y0 = h * (SAFE.top + 0.035);
      rule(ctx, x0, y0 - h * 0.018, w * 0.05, 1, { color: C.lineStrong, thickness: 2 });
      text(ctx, str, x0, y0, { size: Math.round(h * 0.0135), weight: 600, color: C.inkDim, track: TRACK.xwide });
    },
  };
}

/**
 * Up to two centred lines, one keyword in its concept's hue, sitting above the
 * Reels interface zone (the bottom 18% of the frame).
 */
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
      // Normally above the Reels interface zone; `top` sits it under the kicker instead, for a
      // shot whose subject fills the lower frame.
      const bottom = top ? h * (SAFE.top + 0.1) + (lines.length - 1) * size * 1.28 : h * (1 - SAFE.bottom) - size * 0.9;
      const rise = (1 - k.ein) * size * 0.3;
      // A soft dark band behind the words, so they read over whatever the 3D layer puts there.
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
      const cam = k.world.engine.camera;
      const p = at.clone().project(cam);
      if (p.z > 1) return;
      const { width: w, height: h } = ctx.canvas;
      const px = (p.x * 0.5 + 0.5) * w;
      const py = (-p.y * 0.5 + 0.5) * h;
      const upper = str === str.toUpperCase();
      const size = Math.round(h * (upper ? 0.0115 : 0.0165));
      const dy = side === 'above' ? -size * 0.6 : size * 1.4;
      text(ctx, str, px, py + dy, {
        size,
        weight: 600,
        color: upper ? C.muted : C.ink,
        align: 'center',
        track: upper ? TRACK.wide : TRACK.normal,
      });
    },
  };
}
