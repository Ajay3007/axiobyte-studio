import * as THREE from 'three';
import { C } from '@axiobyte/three/video/overlay/theme.js';

/**
 * s02e01's visual language: one meaning per hue, the frame, and the sentence.
 *
 *   tokens            cyan    C.accent   chunks of text
 *   ID tags           none    C.muted    a label carries no meaning, so it gets no hue
 *   learned numbers   violet  C.violet   the vector a token's ID unlocks
 *   attention/context amber   C.amber    what one position pulls from another
 *   probability       green   C.green    how likely each next token is
 *
 * Every hue comes from the backend's overlay theme, so the 3D layer and the 2D
 * overlay can never disagree about what a colour means.
 */
export const HUE = {
  token: new THREE.Color(C.accent),
  label: new THREE.Color(C.muted),
  vector: new THREE.Color(C.violet),
  context: new THREE.Color(C.amber),
  prob: new THREE.Color(C.green),
  ink: new THREE.Color(C.ink),
};

/** The portrait frame this episode is composed for (design/targets/9x16.yaml). */
export const FRAME = { width: 1080, height: 1920 };

/**
 * The Reels interface zone is the larger of Reels' and Shorts' (9x16.yaml
 * platform_safe), so one master clears both. Fractions of the frame.
 */
export const SAFE = { top: 0.05, side: 0.05, bottom: 0.18, right: 0.14 };

/**
 * The running example as a tokenizer would cut it. Common English words are
 * single tokens in GPT-style tokenizers and the question mark is its own; the
 * IDs are illustrative (no tokenizer is installed to verify them), and the
 * overlay says so.
 */
export const TOKENS = [
  { text: 'Why', id: 10445 },
  { text: 'is', id: 382 },
  { text: 'the', id: 290 },
  { text: 'sky', id: 17307 },
  { text: 'blue', id: 9861 },
  { text: '?', id: 30 },
];

/** The aside for "sometimes part of a word": an illustrative split, labelled as such. */
export const ASIDE = { word: 'Rayleigh', parts: ['Ray', 'leigh'] };

export const INDEX = Object.fromEntries(TOKENS.map((t, i) => [t.text, i]));

/** Geometry, in world units. Tokens sit on y = 0; the layers stack above them. */
export const DIM = {
  tileH: 0.66,
  tileD: 0.1,
  textSize: 0.37,
  wordGap: 0.17,
  splitGap: 0.3,
  cells: 16,
  cellH: 0.13,
  cellGap: 0.045,
  columnBase: 0.66,
  floors: [4.2, 5.4, 6.6, 7.8, 9.0],
  asideY: 2.1,
};

/** A tile's width from its text: a fixed rule, so layout never depends on font metrics at load. */
export const tileWidth = (text) => 0.32 + 0.18 * text.length;

/**
 * Centre x of each token tile, the row centred on x = 0. `gap` is the space
 * between tiles; the question mark sits tight against its word while the
 * sentence is still one piece (gap = DIM.wordGap), exactly as it is written.
 */
export function rowLayout(gap, texts = TOKENS.map((t) => t.text)) {
  const widths = texts.map(tileWidth);
  const gaps = texts.map((t, i) => (i === 0 ? 0 : t === '?' && gap === DIM.wordGap ? 0 : gap));
  const total = widths.reduce((a, w) => a + w, 0) + gaps.reduce((a, g) => a + g, 0);
  let x = -total / 2;
  return widths.map((w, i) => {
    x += gaps[i];
    const centre = x + w / 2;
    x += w;
    return { x: centre, width: w };
  });
}

/** Where everything lives once the sentence has split: the layout the rest of the film uses. */
export const SPLIT = rowLayout(DIM.splitGap);

/**
 * Causal attention: position j links to itself and to every earlier position
 * i, never to a later one. The scene draws exactly these links on every layer.
 */
export const PAIRS = TOKENS.flatMap((_, j) => TOKENS.slice(0, j + 1).map((__, i) => ({ i, j })));

/**
 * The opening sets the question in two lines, "Why is the" over "sky blue?", so
 * its words read at phone size; one line of six tiles cannot be large in a
 * 1080-wide frame. The sentence reflows into the single row (SPLIT) once the
 * film turns to what each token means. Rows sit far enough apart for the top
 * row's ID tags to hang clear of the bottom row.
 */
export const LINES = { rows: [[0, 1, 2], [3, 4, 5]], y: [0.8, -0.8] };

export function twoLineLayout(gap) {
  const out = [];
  LINES.rows.forEach((row, r) => {
    const texts = row.map((i) => TOKENS[i].text);
    rowLayout(gap, texts).forEach((p, k) => (out[row[k]] = { ...p, y: LINES.y[r] }));
  });
  return out;
}

/**
 * Bloom on the attention links only (bloom.js). Chosen by A/B against the gravity
 * reference: strength 0.55 / threshold 0.05 fused the dense layers into one band;
 * this setting lifts the focused links and leaves every link distinct.
 */
export const BLOOM = { enabled: true, strength: 0.4, radius: 0.22, threshold: 0.3 };

/**
 * The first next-token prediction, illustrative. "Sunlight" is the likeliest
 * and "The" is chosen: the narration's "usually a likely one, but not always
 * the likeliest", made literal. Values sum to under 1; the rest of the
 * vocabulary shares the remainder (the faint tail behind the list).
 */
export const CANDIDATES = [
  { text: 'Sunlight', p: 0.3 },
  { text: 'The', p: 0.26 },
  { text: 'It', p: 0.13 },
  { text: 'Because', p: 0.09 },
  { text: 'Light', p: 0.05 },
  { text: 'Blue', p: 0.03 },
];
export const BANANA = { text: 'banana', p: 0.0001 };
export const CHOSEN = 1; // "The"

/**
 * The answer the film generates, one token at a time, then the end-of-answer
 * token. Each word lands on the spoken word that names it where the narration
 * speaks the answer ("The sky looks blue because sunlight").
 */
export const ANSWER = ['The', 'sky', 'looks', 'blue', 'because', 'sunlight', 'scatters'];
export const END_TOKEN = 'END';

/** Positions after the question's six: the answer, then END, continuing the row to the right. */
export const GEN = (() => {
  const texts = [...ANSWER, END_TOKEN];
  const last = SPLIT.at(-1);
  let x = last.x + last.width / 2;
  return texts.map((text) => {
    const w = tileWidth(text);
    x += DIM.splitGap;
    const centre = x + w / 2;
    x += w;
    return { text, x: centre, width: w };
  });
})();

/** Every position the layers ever hold: the question's, then the generated ones. */
export const ALL = [...SPLIT, ...GEN];

/** Where the length limit would stop generation: a few positions past END. */
export const LIMIT_X = GEN.at(-1).x + 3.0;

/** The prediction panel floats above the top layer, left of the last position, inside the frame. */
export const PANEL = { x: 1.55, top: 13.55, row: 0.44, labelW: 1.25, barMax: 1.85, stripY: 14.3, stripW: 3.4 };

/** The prompt bar the question is typed into, and the answer streams above. */
export const PROMPT = { y: -2.75, width: 3.6, height: 0.78, answerY: -2.0 };

/** Illustrative: how likely each answer token was when it was picked ("The" is CANDIDATES[CHOSEN]). */
export const PICKED = [0.26, 0.81, 0.64, 0.92, 0.71, 0.58, 0.37];
