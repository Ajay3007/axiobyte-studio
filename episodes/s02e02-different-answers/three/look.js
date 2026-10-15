import * as THREE from 'three';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { cumulative, draws, landing, scoresFor, softmax } from '@axiobyte/three/domains/ml/probability.js';

/**
 * s02e02's visual language and data. The hues keep s02e01's meanings:
 *
 *   tokens         cyan    C.accent   chunks of text, and drawn outcomes
 *   probability    green   C.green    slices of the wheel, bars
 *   paths, ghosts  ink     C.ink      branches, the pointer, a previous run
 *   attention      amber   reserved   (not used in this film's mechanism)
 *
 * Every value here is ILLUSTRATIVE — no model was run — and the overlay says so
 * whenever one is on screen. The arithmetic on those values is exact
 * (domains/ml/probability.js): probabilities are softmax(scores / T).
 */
export const HUE = {
  token: new THREE.Color(C.accent),
  prob: new THREE.Color(C.green),
  ink: new THREE.Color(C.ink),
  ghost: new THREE.Color(C.muted),
};

/** The portrait frame this episode is composed for (design/targets/9x16.yaml). */
export const FRAME = { width: 1080, height: 1920 };

/** The Reels interface zone, the larger of Reels' and Shorts'. Fractions of the frame. */
export const SAFE = { top: 0.05, side: 0.05, bottom: 0.18, right: 0.14 };

/**
 * World x of the safe area's centre line. The interface zone on the right is
 * wider than the side margin, so the readable column sits a little left of the
 * frame's centre: (side + (1 - right)) / 2 = 0.455 of the width, at the
 * camera distances this film uses (12–14 units, 30° vertical field of view).
 */
export const XC = -0.17;

/** A distribution over named tokens plus a long tail of unnamed ones, from scores. */
function vocabulary(named, tailMass, tailCount, seedShape) {
  // The tail: many separate tokens, each with its own small probability, never
  // one pooled bucket — temperature acts on each token, not on a bucket.
  const w = Array.from({ length: tailCount }, (_, k) => 1 / Math.pow(k + seedShape, 1.15));
  const sw = w.reduce((a, b) => a + b, 0);
  const probs = [...named.map((n) => n.p), ...w.map((x) => (x / sw) * tailMass)];
  const scores = scoresFor(probs, 4); // illustrative raw scores; only their gaps matter
  return { tokens: [...named.map((n) => n.text), ...w.map(() => '')], named: named.length, scores, probs: softmax(scores, 1) };
}

/**
 * The first token of the answer to "Why is the sky blue?", as s02e01 showed it:
 * "Sunlight" 30 %, "The" 26 %. The narrated values are recovered from the
 * scores at T = 1 (look.test: rounds to exactly 30 and 26).
 */
export const FIRST = vocabulary(
  [
    { text: 'Sunlight', p: 0.3 },
    { text: 'The', p: 0.26 },
    { text: 'It', p: 0.13 },
    { text: 'Because', p: 0.09 },
    { text: 'Light', p: 0.05 },
    { text: 'Blue', p: 0.03 },
  ],
  0.14,
  200,
  6,
);
export const SUNLIGHT = 0;
export const THE = 1;

/** Slices that carry a label on the wheel: wide enough for their word. */
export const LABELLED = [0, 1, 2, 3];

/**
 * The two narrated spins. They are a DEMONSTRATION, disclosed on screen: each
 * stops on the token the narration names, at the moment it is spoken. Only the
 * landing point differs between them; the question and FIRST.probs are the
 * same object in both runs. Both outcomes are ordinary draws from it (26 % and
 * 30 % likely).
 */
export const STAGED = {
  run1: { index: THE, u: landing(FIRST.probs, THE, 0.62), turns: 1 },
  run2: { index: SUNLIGHT, u: landing(FIRST.probs, SUNLIGHT, 0.42), turns: 1 },
};

/**
 * Where a wheel waits before it spins: the pointer rests exactly on the
 * boundary between two slices, never inside one, so nothing looks chosen
 * before the draw. On the first wheel that is the boundary between "It" and
 * "Because" — neither of the narrated outcomes. A branch wheel rests on the
 * boundary after its second token, away from the word it will land on.
 */
export const REST_AFTER = { first: 2, branch: 1 };
/** The wheel fraction of the boundary after token `i`. */
export const boundaryAfter = (vocab, i) => cumulative(vocab.probs)[i];

/**
 * "Wide slices win more often. But not every time": hypothetical spins drawn
 * from FIRST.probs with a fixed seed, so their proportions are honest and every
 * render shows the same ones. The seed was chosen only so that some draws land
 * in narrow slices (any seed does, ~22 % of the time); none is placed by hand.
 */
export const SAMPLE = { seed: 20261014, count: 24 };
export const SAMPLES = draws(FIRST.probs, SAMPLE.seed, SAMPLE.count);
/** A narrow slice: 5 % or less. "Not every time" points at the samples that landed in one. */
export const NARROW = 0.05;
export const NARROW_SAMPLES = SAMPLES.flatMap((d, k) => (FIRST.probs[d.index] <= NARROW ? [k] : []));

/**
 * The next prediction after each first token (B15), and the steps after it
 * (B16). Each step's narrated word is its likeliest token; the spins that pick
 * them continue the demonstration and complete the two answers from the
 * opening. Illustrative, as everything else.
 */
export const AFTER_THE = vocabulary(
  [
    { text: 'sky', p: 0.46 },
    { text: 'light', p: 0.12 },
    { text: 'color', p: 0.08 },
    { text: 'blue', p: 0.06 },
    { text: 'reason', p: 0.05 },
  ],
  0.23,
  60,
  5,
);
export const AFTER_SUNLIGHT = vocabulary(
  [
    { text: 'is', p: 0.52 },
    { text: 'scatters', p: 0.11 },
    { text: 'contains', p: 0.08 },
    { text: 'hits', p: 0.06 },
    { text: 'travels', p: 0.04 },
  ],
  0.19,
  60,
  7,
);

/** The two answers the opening streams, as the branches complete them (script.txt). */
export const ANSWER_A = ['The', 'sky', 'looks', 'blue', 'because'];
export const ANSWER_B = ['Sunlight', 'is', 'made', 'of', 'every', 'color'];

/** Small per-step distributions for the later spins: the narrated word leads, the rest trail off. */
export function stepVocabulary(word, k) {
  return vocabulary([{ text: word, p: 0.38 + 0.05 * (k % 3) }], 0.62 - 0.05 * (k % 3), 30, 3 + k);
}

/** The running example, as a tokenizer would cut it (s02e01's split). */
export const QUESTION = ['Why', 'is', 'the', 'sky', 'blue', '?'];

/** Geometry, in world units. */
export const DIM = {
  tileH: 0.66,
  tileD: 0.1,
  textSize: 0.37,
  rowGap: 0.17,
};
/** A tile's width from its text: a fixed rule, so layout never depends on font metrics at load (s02e01). */
export const tileWidth = (text) => 0.32 + 0.18 * text.length;

/** The question row: small tiles near the bottom of the frame, above the interface zone. */
export const ROW = { y: -1.5, scale: 0.45 };
export function rowLayout(texts = QUESTION, scale = ROW.scale, gap = DIM.rowGap) {
  const widths = texts.map((t) => tileWidth(t) * scale);
  const gaps = texts.map((t, i) => (i === 0 ? 0 : t === '?' ? gap * 0.4 * scale : gap * scale));
  const total = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  let x = XC - total / 2;
  return widths.map((w, i) => {
    x += gaps[i];
    const c = x + w / 2;
    x += w;
    return { x: c, width: w };
  });
}

/**
 * The wheel: an annulus of slices, its centre at (XC, WHEEL.y). Before it is a
 * wheel it is s02e01's pick strip — `stripW` wide, `stripH` tall, lying along
 * the wheel's top — and it curls into the ring (wheel.js bend()).
 */
export const WHEEL = { y: 0.35, rIn: 0.3, rOut: 1.3, stripW: 2.9, stripH: 0.3, gap: 0.006 };
export const WHEEL_RC = (WHEEL.rIn + WHEEL.rOut) / 2;

/** The candidate list the film arrives with (B07), before it compresses into the strip. */
export const LIST = { top: 1.75, row: 0.4, tileX: XC - 1.02, barX: XC - 0.5, barMax: 1.45, scale: 0.5 };

/** Where drawn tiles rise to above the wheel: centre for a fresh draw; left and right for the two runs. */
export const LIFT = { y: 2.38, centre: XC, left: XC - 0.62, right: XC + 0.62, scale: 0.55 };

/** The branches (B15–B16): step k of each answer, fanning out as it climbs. */
export const BRANCH = {
  y0: -0.92,
  dy: 0.5,
  spread0: 0.45,
  spread: 0.17,
  scale: 0.5,
  miniR: 0.5,
  stepR: 0.26,
};
export const branchAt = (side, k) => ({
  x: XC + side * (BRANCH.spread0 + BRANCH.spread * k),
  y: BRANCH.y0 + BRANCH.dy * k,
});

/** The two answer panels the branches complete, at the top of the frame. */
export const PANELS = { y: 2.62, w: 1.55, h: 0.86, dx: 0.82, textH: 0.21 };

// =====================================================================================
// B01–B08 and B17–B30. Everything below is laid out around the same column (XC) as the
// approved B09–B16 slice, and every value is as ILLUSTRATIVE as the ones above.
// =====================================================================================

/**
 * The opening (B01–B05): two chats with the same question, one above the other.
 * Each is a prompt bar with the answer card directly under it, so which answer
 * belongs to which ask is read from proximity alone.
 */
export const OPEN = {
  w: 2.8,
  promptH: 0.5,
  cardH: 0.95,
  chats: [
    { prompt: 2.95, card: 2.05 },
    { prompt: 0.95, card: 0.05 },
  ],
  textH: 0.25,
  promptTextH: 0.24,
  /** The faint model silhouette behind both chats: a stack of thin plates. */
  model: { y: 1.5, z: -2.6, plates: 5, w: 2.2, d: 1.1, gap: 0.32 },
};

/** The two first words become the list's tiles at this scale before they fly to their rows (B05 → B06). */
export const FIRST_WORD_SCALE = 0.62;

/**
 * The temperature demonstration (B20–B25). Its own decision, not the first
 * wheel's: the token after "The sky looks blue because", branch A's next step.
 * The first wheel's two narrated candidates (30 %, 26 %) are too close to show
 * what a low temperature does; this one has a clear leader, so the contrast is
 * honest, and a short tail, so at the high setting the alternatives — not the
 * tail — are what widen. Scores are illustrative and all positive among the
 * named tokens, so the bars can show them divided by T directly.
 *
 *   T     sunlight  light  air   the   it    blue  banana  tail (12 tokens)
 *   0.4   90.3      6.7    1.8   0.7   0.3   0.1   0.0     0.1
 *   1.0   48.0      17.0   10.0  7.0   5.0   3.0   0.8     9.2
 *   1.5   30.2      15.1   10.6  8.4   6.7   4.8   2.0     22.4
 */
export const TEMP_CONTEXT = 'The sky looks blue because';
export const TEMP = vocabulary(
  [
    { text: 'sunlight', p: 0.48 },
    { text: 'light', p: 0.17 },
    { text: 'air', p: 0.1 },
    { text: 'the', p: 0.07 },
    { text: 'it', p: 0.05 },
    { text: 'blue', p: 0.03 },
    { text: 'banana', p: 0.008 },
  ],
  0.092,
  12,
  4,
);
// Shift the scores so the named ones are positive (softmax ignores a shift); the bars show score / T.
{
  const shift = 0.6 - TEMP.scores[TEMP.named - 1];
  TEMP.scores = TEMP.scores.map((s) => s + shift);
}
export const BANANA = 6;
/** The settings the control moves between. T is always strictly positive. */
export const TEMPS = { base: 1.0, low: 0.4, high: 1.5, min: 0.3, max: 1.7 };

/**
 * Seeded draws shown as dots at each setting (B23, B25), the same on every
 * render. Each seed is the first whose counts come closest to what the
 * distribution predicts (low: 9 of 10 on the leader, expected 9.0; high: 3 / 2 /
 * 4 / 3 for leader / second / other named / banana and tail, expected
 * 3.6 / 1.8 / 3.6 / 2.9), so the dots show typical outcomes, not chosen ones.
 */
export const TEMP_SAMPLES = { low: { seed: 5, count: 10 }, high: { seed: 2, count: 12 } };

/** The temperature layout, in world units. */
export const TL = {
  header: 3.05,
  heads: 2.6,
  row0: 2.3,
  row: 0.29,
  tileX: XC - 1.2,
  tileScale: 0.43,
  scoreX: XC - 0.78,
  scoreScale: 0.087, // world units per unit of score / T
  probX: XC + 0.42,
  probMax: 0.62, // a probability of 1 would be this long
  slider: { y: 0.3, x0: XC - 0.35, x1: XC + 0.62 },
  wheel: { y: -0.85, rIn: 0.2, rOut: 0.8 },
  bananaAt: { x: XC + 1.12, y: -0.9 },
};

/**
 * The tree of possible answers (B17–B19, B26–B28). Branches A and B are the two
 * answers already drawn; every other node is a possible continuation, a dot.
 * Probabilities are illustrative and seeded; a path's brightness follows the
 * product of its step probabilities.
 */
export const TREE = { seed: 72, levels: 6, nodeR: 0.035, floor: 0.1 };

/** The other inputs an answer depends on (B26), set out under the question. */
export const INPUTS = {
  y: -2.05,
  items: [
    { text: 'Conversation so far', x: XC - 1.02, row: 0 },
    { text: 'Model version', x: XC + 1.08, row: 0 },
    { text: 'Chance: the draw', x: XC, row: 1 },
  ],
  rowGap: 0.58,
  h: 0.46,
  textH: 0.26,
};

/** The closing card (B29): a fresh, confident answer — and the question it leaves open. */
export const CLOSE = { y: 1.25, w: 2.8, h: 1.6, lines: [0.92, 0.78, 0.86, 0.6, 0.83, 0.45], q: { y: -0.35, h: 1.0 } };
