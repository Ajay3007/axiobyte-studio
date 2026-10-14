// s02e01, the whole film: the portrait score is cued from the creator's timeline, the picture
// keeps the promises picture.md makes (causal attention, a weighted pick, both stopping
// conditions), and the shared video director lays its overlay out in the frame it renders
// (1080x1920 for this film, 1920x1080 by default). No browser, no WebGL.
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import timeline from '../../../episodes/s02e01-ask-chatgpt/timeline/timeline.json';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EPISODE = path.join(HERE, '../../../episodes/s02e01-ask-chatgpt');
let story;
let look;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  look = await import('../../../episodes/s02e01-ask-chatgpt/three/look.js');
  const { buildStoryboard } = await import('../../../episodes/s02e01-ask-chatgpt/three/storyboard.js');
  story = buildStoryboard({ timeline: new TimelineParser(timeline), tail: 1.5 });
});

describe('s02e01 — the timeline is the clock', () => {
  it('reads the supplied timeline, unchanged', () => {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(EPISODE, 'timeline/timeline.json'))).digest('hex');
    expect(sha).toBe('1deb6d91919bf79e95df499263c9fc9c1bf1e742f961da5c47e424cc0e589209');
    expect(story.audioEnd).toBe(109.714);
  });

  it('lands every cue on a spoken word, in the order the narration speaks them', () => {
    const times = Object.values(story.T).flat();
    times.forEach((t) => expect(Number.isFinite(t)).toBe(true));
    for (let k = 1; k < times.length; k++) expect(times[k]).toBeGreaterThanOrEqual(times[k - 1]);
    expect(story.T.id).toBeCloseTo(25.434, 2); // "ID" as transcribed
    expect(story.T.blue).toBeCloseTo(51.531, 2); // "Blue draws on sky."
  });

  it('moves the camera forward through time, every shot after the previous one', () => {
    story.shots.forEach((s, k) => k && expect(s.at).toBeGreaterThan(story.shots[k - 1].at));
  });
});

describe('s02e01 — readable on a phone', () => {
  it('sets the opening question in two lines, at most half as wide as one row', () => {
    const { twoLineLayout, rowLayout, DIM } = look;
    const span = (ps) => Math.max(...ps.map((p) => p.x + p.width / 2)) - Math.min(...ps.map((p) => p.x - p.width / 2));
    expect(span(twoLineLayout(DIM.splitGap))).toBeLessThanOrEqual(span(rowLayout(DIM.splitGap)) / 2);
  });

  it('reflows into one row while the camera turns to "sky", before its numbers appear', () => {
    // animate.js: the reflow runs from T.nothing - 0.4 to T.nothing + 0.9
    expect(story.T.nothing + 0.9).toBeLessThan(story.T.unlocks);
  });

  it('keeps bloom subtle: only bright attention links glow', () => {
    expect(look.BLOOM.strength).toBeLessThanOrEqual(0.45);
    expect(look.BLOOM.threshold).toBeGreaterThanOrEqual(0.25);
  });
});

describe('s02e01 — what picture.md promises', () => {
  it('picks by weighted chance: the chosen token is likely, but not the likeliest', () => {
    const { CANDIDATES, CHOSEN } = look;
    const likeliest = CANDIDATES.reduce((best, c, k) => (c.p > CANDIDATES[best].p ? k : best), 0);
    expect(CHOSEN).not.toBe(likeliest);
    expect(CANDIDATES[CHOSEN].p).toBeGreaterThan(0.2);
    expect(CANDIDATES.reduce((a, c) => a + c.p, 0)).toBeLessThan(1); // the rest of the vocabulary shares the remainder
  });

  it('shows both ways generation stops: an END token, and a length limit beyond it', () => {
    const { GEN, END_TOKEN, LIMIT_X } = look;
    expect(GEN.at(-1).text).toBe(END_TOKEN);
    expect(LIMIT_X).toBeGreaterThan(GEN.at(-1).x);
    expect(story.T.done).toBeLessThan(story.T.limit);
  });

  it('grows the answer on the words that speak it: "The sky looks blue because sunlight"', () => {
    const tl = new TimelineParser(timeline);
    const spoken = ['sky', 'looks', 'blue', 'because', 'sunlight'].map((w) => tl.wordTime(w, { after: tl.sentenceStart(26) }));
    expect(story.T.gen.slice(1, 6)).toEqual(spoken);
    expect(look.ANSWER.slice(0, 6)).toEqual(['The', 'sky', 'looks', 'blue', 'because', 'sunlight']);
  });

  it('ends on the portrait brand card, and episode.yaml\'s tail is the hold plus the card', async () => {
    const { END_CARD } = await import('../../../episodes/s02e01-ask-chatgpt/three/storyboard.js');
    const card = story.cues.find((c) => c.role === 'endcard');
    expect(card.target).toBe('9x16');
    expect(card.text.handle).toEqual([]); // one master, two platforms: platform-neutral, no handle
    expect(card.platform).toBeNull();
    expect(card.end - card.start).toBeCloseTo(END_CARD, 6);
    const tail = Number(/^tail:\s*([\d.]+)/m.exec(fs.readFileSync(path.join(EPISODE, 'episode.yaml'), 'utf8'))[1]);
    expect(story.duration).toBeCloseTo(story.audioEnd + tail, 6);
  });
});

describe('s02e01 — illustrative values say so', () => {
  it('shows an ILLUSTRATIVE kicker whenever invented IDs, weights or probabilities are on screen', () => {
    const T = story.T;
    const kickers = story.cues.filter((c) => String(c.id).startsWith('kicker:') && /ILLUSTRATIVE/.test(c.id));
    const covered = (t) => kickers.some((c) => t >= c.start && t <= c.end);
    const windows = [
      [T.each + 0.5, T.unlocks - 0.5], // token IDs
      [T.unlocks + 0.5, T.numbersEnd], // learned numbers
      [T.every, T.end], // attention weights
      [T.predicts, T.again - 0.2], // the first prediction's probabilities
      [T.again + 0.2, T.wholeView - 0.2], // the generated picks
      [T.confident, T.wrongEnd], // per-word probabilities over the answer
      [T.predicted, story.filmEnd - 0.1], // per-word probabilities under the stream
    ];
    for (const [a, b] of windows) for (let t = a; t <= b; t += 0.25) expect(covered(t), `t = ${t.toFixed(2)}`).toBe(true);
  });
});

describe('s02e01 — mobile-safe zones', () => {
  it('measures how far a box reaches into the Reels/Shorts zones (right 14%, bottom 18%)', async () => {
    const { intrusion, ZONE } = await import('../../../episodes/s02e01-ask-chatgpt/three/safe.js');
    expect(ZONE.right).toBeCloseTo(0.86, 9);
    expect(ZONE.bottom).toBeCloseTo(0.82, 9);
    expect(intrusion({ x0: 0.3, x1: 0.5, y0: 0.4, y1: 0.45 })).toBe(0); // clear
    expect(intrusion({ x0: 0.8, x1: 0.9, y0: 0.4, y1: 0.45 })).toBeCloseTo(0.4, 6); // 40% of its width inside the right zone
    expect(intrusion({ x0: 0.3, x1: 0.5, y0: 0.8, y1: 0.84 })).toBeCloseTo(0.5, 6); // half inside the bottom zone
    expect(intrusion({ x0: 1.1, x1: 1.3, y0: 0.4, y1: 0.45 })).toBe(0); // off the frame: the edge hides it
  });
});

describe('s02e01 — every overlay cue draws', () => {
  it('draws each cue at its midpoint without throwing (the overlay would swallow the error)', async () => {
    const THREE = await import('three');
    const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 400);
    camera.position.set(0, 2, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const sink = () => new Proxy(function () {}, { get: (t, k) => (k in t ? t[k] : sink()), set: () => true, apply: () => sink() });
    const ctx = new Proxy(
      { canvas: { width: 1080, height: 1920 }, measureText: () => ({ width: 100 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
      { get: (t, k) => (k in t ? t[k] : sink()), set: () => true },
    );
    const k = { world: { engine: { camera } }, project: () => null, a: 1, ein: 1, eout: 1 };
    const overlayCues = story.cues.filter((c) => c.role !== 'endcard'); // the brand card needs its loaded logo
    expect(overlayCues.length).toBeGreaterThan(20);
    for (const c of overlayCues) {
      const t = (c.start + c.end) / 2;
      expect(() => c.draw(ctx, { ...k, t, local: t - c.start, u: 0.5, span: c.end - c.start, cue: c })).not.toThrow();
    }
  });
});

describe('s02e01 — attention is causal', () => {
  it('links each position only to itself and to earlier positions', () => {
    const { PAIRS, TOKENS } = look;
    PAIRS.forEach(({ i, j }) => expect(i).toBeLessThanOrEqual(j));
    TOKENS.forEach((_, j) => {
      const from = PAIRS.filter((p) => p.j === j).map((p) => p.i);
      expect(from).toEqual([...Array(j + 1).keys()]);
    });
  });
});

describe('VideoDirector — the overlay is the frame it renders', () => {
  const fakeWorld = (fixedSize) => ({
    engine: { fixedSize, camera: {}, controls: { target: { copy() {} } } },
    camera: { describe: () => null, solve: (v) => v },
    registry: { anchorWorld: () => null },
  });

  it('lays a portrait film out at 1080x1920', async () => {
    const { VideoDirector } = await import('../src/video/VideoDirector.js');
    const d = new VideoDirector({ world: fakeWorld({ width: 1080, height: 1920 }), story: { shots: [], cues: [] }, animation: {} });
    expect([d.overlay.width, d.overlay.height]).toEqual([1080, 1920]);
  });

  it('keeps 1920x1080 for a 16:9 film and when no frame is fixed', async () => {
    const { VideoDirector } = await import('../src/video/VideoDirector.js');
    const wide = new VideoDirector({ world: fakeWorld({ width: 1920, height: 1080 }), story: { shots: [], cues: [] }, animation: {} });
    const none = new VideoDirector({ world: fakeWorld(null), story: { shots: [], cues: [] }, animation: {} });
    expect([wide.overlay.width, wide.overlay.height]).toEqual([1920, 1080]);
    expect([none.overlay.width, none.overlay.height]).toEqual([1920, 1080]);
  });
});
