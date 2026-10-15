// s02e02, the B09–B16 slice: every cue is a spoken word of the creator's timeline, the
// distributions come from scores by the real formula, a spin is a weighted draw, and the
// replay changes nothing but the drawn outcome. No browser, no WebGL.
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import timeline from '../../../episodes/s02e02-different-answers/timeline/timeline.json';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';
import { draws, landing, pick, softmax } from '../src/domains/ml/probability.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EPISODE = path.join(HERE, '../../../episodes/s02e02-different-answers');
let story;
let look;
let spin;
let wheel;
let anim;

beforeAll(async () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  look = await import('../../../episodes/s02e02-different-answers/three/look.js');
  spin = await import('../../../episodes/s02e02-different-answers/three/spin.js');
  wheel = await import('../../../episodes/s02e02-different-answers/three/wheel.js');
  anim = await import('../../../episodes/s02e02-different-answers/three/animate.js');
  const { buildStoryboard } = await import('../../../episodes/s02e02-different-answers/three/storyboard.js');
  story = buildStoryboard({ timeline: new TimelineParser(timeline), tail: 1.5 });
});

const sha = (file, lf = false) => {
  const bytes = fs.readFileSync(file);
  return crypto.createHash('sha256').update(lf ? Buffer.from(bytes.toString('binary').replaceAll('\r\n', '\n'), 'binary') : bytes).digest('hex');
};

describe('s02e02 — the supplied inputs are the approved ones', () => {
  it('reads the creator\'s timeline, unchanged, and agrees with episode.yaml', () => {
    const yaml = fs.readFileSync(path.join(EPISODE, 'episode.yaml'), 'utf8');
    const pinned = yaml.match(/^voiceover_sha256: ([0-9a-f]{64})$/m)[1];
    expect(sha(path.join(EPISODE, 'timeline/timeline.json'), true)).toBe(pinned);
    expect(pinned).toBe('57d4b51fb5b1cd697959dddf352c6164453248ab5be89ed7ef90ce71db3a06c7');
    expect(story.audioEnd).toBe(131.004);
  });

  it('pins the recording by its delivered name, unrenamed', () => {
    const yaml = fs.readFileSync(path.join(EPISODE, 'episode.yaml'), 'utf8');
    expect(yaml).toMatch(/path: "audio\/s02ep02\.mpeg"/);
    expect(yaml).toMatch(/sha256: 409b46c6fffed08e7b7460edeb87e30284d6082baa5437c9a54e1d4ae439c38a/);
  });
});

describe('s02e02 — the timeline is the clock', () => {
  it('lands every cue on a spoken word, in the order the narration speaks them', () => {
    const times = Object.values(story.T).flat();
    times.forEach((t) => expect(Number.isFinite(t)).toBe(true));
    for (let k = 1; k < times.length; k++) expect(times[k]).toBeGreaterThanOrEqual(times[k - 1]);
  });

  it('stops each narrated spin on the word that names its outcome', () => {
    const word = (i, text) => {
      expect(timeline.words[i].word).toBe(text); // the transcript's spelling
      return timeline.words[i].start;
    };
    expect(story.T.landThe).toBe(word(112, 'the.'));
    expect(story.T.landSun).toBe(word(127, 'sunlight'));
    expect(story.T.pct30).toBe(word(74, '30%.'));
    expect(story.T.n26).toBe(word(76, '26.'));
  });

  it('moves the camera forward through time', () => {
    story.shots.forEach((s, k) => k && expect(s.at).toBeGreaterThan(story.shots[k - 1].at));
  });

  it('runs to the audio, the hold and the end card', () => {
    expect(story.duration).toBeCloseTo(131.004 + 1.5 + 3.5, 6);
  });
});

describe('s02e02 — illustrative values, exact arithmetic', () => {
  it('derives the first token\'s probabilities from scores at T = 1: 30 % and 26 %, as narrated', () => {
    const { FIRST, SUNLIGHT, THE } = look;
    softmax(FIRST.scores, 1).forEach((p, i) => expect(p).toBeCloseTo(FIRST.probs[i], 12));
    expect(Math.round(FIRST.probs[SUNLIGHT] * 100)).toBe(30);
    expect(Math.round(FIRST.probs[THE] * 100)).toBe(26);
    expect(FIRST.tokens[SUNLIGHT]).toBe('Sunlight');
    expect(FIRST.tokens[THE]).toBe('The');
    expect(FIRST.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('models the rest of the vocabulary as many separate tokens, never one bucket', () => {
    const tail = look.FIRST.probs.slice(look.FIRST.named);
    expect(tail.length).toBeGreaterThanOrEqual(100);
    tail.forEach((p) => expect(p).toBeLessThan(0.01));
  });

  it('labels every value on screen as illustrative or a demonstration', () => {
    // Every kicker shown while values or staged outcomes are on screen (from "As we saw last time"
    // to "Which raises a bigger question") is a disclosure. The opening and the closing kickers sit
    // outside that span and show no values; they are judged by time, not exempted by name.
    const { asWeSaw, which } = story.T;
    const kickers = story.cues.filter((c) => c.id.startsWith('kicker:') && c.start < which && c.end > asWeSaw).map((c) => c.id);
    expect(kickers.length).toBeGreaterThan(0);
    kickers.forEach((k) => expect(k).toMatch(/ILLUSTRATIVE|DEMONSTRATION/));
    // percentages appear from "wide" (B09) until the fork (B15); a kicker covers all of it
    const covered = (t) => story.cues.some((c) => c.id.startsWith('kicker:') && c.start <= t && t <= c.end);
    for (let t = story.T.wide; t < story.T.zoom; t += 0.25) expect(covered(t)).toBe(true);
  });
});

describe('s02e02 — a spin is a weighted draw', () => {
  it('makes every slice exactly as wide as its probability', () => {
    const { FIRST, WHEEL } = look;
    const geo = { ...WHEEL };
    const cdf = FIRST.probs.reduce((acc, p) => [...acc, (acc.at(-1) ?? 0) + p], []);
    for (const i of [0, 1, 5, 120]) {
      const f0 = i ? cdf[i - 1] : 0;
      const [x0, y0] = wheel.bendPoint(f0, 1, 1, geo);
      const [x1, y1] = wheel.bendPoint(cdf[i], 1, 1, geo);
      let swept = Math.atan2(x1, y1) - Math.atan2(x0, y0);
      if (swept < 0) swept += spin.TAU;
      expect(swept / spin.TAU).toBeCloseTo(FIRST.probs[i], 9);
      // and on the strip, its share of the width
      expect(wheel.bendPoint(cdf[i], 0, 0, geo)[0] - wheel.bendPoint(f0, 0, 0, geo)[0]).toBeCloseTo(FIRST.probs[i] * WHEEL.stripW, 9);
    }
  });

  it('curls the strip into the ring: the outer and inner edges reach the wheel\'s radii', () => {
    const { WHEEL } = look;
    for (const f of [0.1, 0.37, 0.8]) {
      expect(Math.hypot(...wheel.bendPoint(f, 1, 1, WHEEL))).toBeCloseTo(WHEEL.rOut, 9);
      expect(Math.hypot(...wheel.bendPoint(f, -1, 1, WHEEL))).toBeCloseTo(WHEEL.rIn, 9);
    }
  });

  it('lands each narrated spin on its token: spin 1 on "The", spin 2 on "Sunlight"', () => {
    const { FIRST, THE, SUNLIGHT } = look;
    const at = (t) => pick(FIRST.probs, spin.underPointer(anim.wheelRotation(t, story.T)));
    expect(at(story.T.landThe)).toBe(THE);
    expect(at(story.T.landSun)).toBe(SUNLIGHT);
  });

  it('turns only forwards during a spin, and stops exactly at the landing word', () => {
    const { T } = story;
    let prev = -Infinity;
    for (let t = T.spin1; t <= T.landThe; t += 1 / 60) {
      const r = anim.wheelRotation(t, T);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(anim.wheelRotation(T.landThe, T)).toBe(anim.wheelRotation(T.landThe + 0.5, T));
  });

  it('draws the sample spins from the same probabilities with a fixed seed, and some land in narrow slices', () => {
    const { FIRST, SAMPLE, SAMPLES, NARROW_SAMPLES } = look;
    expect(SAMPLES).toEqual(draws(FIRST.probs, SAMPLE.seed, SAMPLE.count));
    SAMPLES.forEach((d) => expect(pick(FIRST.probs, d.u)).toBe(d.index));
    expect(NARROW_SAMPLES.length).toBeGreaterThan(0);
    NARROW_SAMPLES.forEach((k) => expect(FIRST.probs[SAMPLES[k].index]).toBeLessThanOrEqual(0.05));
    // most samples land in the wide slices, as the narration says
    const wide = SAMPLES.filter((d) => FIRST.probs[d.index] >= 0.2).length;
    expect(wide).toBeGreaterThan(SAMPLE.count / 2);
  });
});

describe('s02e02 — nothing looks chosen before the draw', () => {
  const inside = (probs, f) => {
    const cdf = probs.reduce((acc, p) => [...acc, (acc.at(-1) ?? 0) + p], []);
    return cdf.every((b) => Math.abs(b - f) > 1e-9); // true when f is strictly inside a slice
  };

  it('rests the first wheel\'s pointer exactly on the boundary between "It" and "Because"', () => {
    const { FIRST, THE, SUNLIGHT } = look;
    const f = spin.underPointer(anim.REST);
    expect(inside(FIRST.probs, f)).toBe(false);
    expect(f).toBeCloseTo(FIRST.probs[0] + FIRST.probs[1] + FIRST.probs[2], 12);
    // neither side of that boundary is a narrated outcome
    expect([2, 3]).not.toContain(THE);
    expect([2, 3]).not.toContain(SUNLIGHT);
  });

  it('is at that rest whenever it waits: formed, before spin 1, after the rewind, before spin 2', () => {
    const { T } = story;
    for (const t of [T.slice + 0.2, T.widely, T.spin1 - 0.01, T.spinAgain, T.sameP]) expect(anim.wheelRotation(t, T)).toBeCloseTo(anim.REST, 12);
    expect(Math.abs(anim.wheelRotation(T.wheel - 0.2, T))).toBe(0); // the flat strip, before it curls
  });

  it('rests every branch wheel on a boundary that does not touch the word it lands on', () => {
    const { AFTER_THE, AFTER_SUNLIGHT, ANSWER_A, stepVocabulary } = look;
    for (const v of [AFTER_THE, AFTER_SUNLIGHT, stepVocabulary(ANSWER_A[2], 2)]) {
      const f = spin.underPointer(anim.branchRest(v));
      expect(inside(v.probs, f)).toBe(false);
      expect(f).toBeGreaterThan(v.probs[0] + 1e-9); // beyond the end of the winner's slice
    }
  });
});

describe('s02e02 — the replay changes nothing but the drawn outcome', () => {
  it('rewinds the wheel to exactly where the first spin started', () => {
    const { T } = story;
    expect(anim.wheelRotation(T.spin1 - 0.01, T)).toBe(anim.REST);
    expect(anim.wheelRotation(T.spinAgain, T)).toBe(anim.REST);
    expect(anim.wheelRotation(T.sameP, T)).toBe(anim.REST);
  });

  it('spins both runs over one distribution; only the landing point differs', () => {
    const { STAGED, FIRST } = look;
    expect(Object.keys(STAGED.run1).sort()).toEqual(['index', 'turns', 'u']);
    expect(STAGED.run1.u).not.toBe(STAGED.run2.u);
    expect(pick(FIRST.probs, STAGED.run1.u)).toBe(STAGED.run1.index);
    expect(pick(FIRST.probs, STAGED.run2.u)).toBe(STAGED.run2.index);
  });

  it('discloses the replay as a demonstration for as long as it runs', () => {
    const demo = story.cues.find((c) => c.id.includes('DEMONSTRATION'));
    expect(demo.start).toBeLessThanOrEqual(story.T.rewind);
    expect(demo.end).toBeGreaterThanOrEqual(story.T.landSun + 1);
  });

  it('marks the constructed branch outcomes as a demonstration while they are on screen', () => {
    const demo = (t) => story.cues.some((c) => c.id.startsWith('kicker:') && c.id.includes('DEMONSTRATION') && c.start <= t && t <= c.end);
    for (let t = story.T.oneDiff; t < story.T.zoom; t += 0.25) expect(demo(t)).toBe(true);
    expect(story.cues.some((c) => c.id === 'kicker:DEMONSTRATION · ILLUSTRATIVE')).toBe(true);
  });
});

describe('s02e02 — one different word changes everything after it', () => {
  it('completes the two answers the opening streams, word for word', () => {
    const script = fs.readFileSync(path.join(EPISODE, 'script.txt'), 'utf8');
    expect(script).toContain(`"${look.ANSWER_A.join(' ')}...`);
    expect(script).toContain(`"${look.ANSWER_B.join(' ')}...`);
  });

  it('gives each step a prediction whose narrated word is its likeliest token, and lands on it', () => {
    const { AFTER_THE, AFTER_SUNLIGHT, ANSWER_A, ANSWER_B, stepVocabulary } = look;
    expect(AFTER_THE.tokens[0]).toBe('sky');
    expect(AFTER_SUNLIGHT.tokens[0]).toBe('is');
    const check = (v, word) => {
      expect(v.tokens[0]).toBe(word);
      expect(v.probs[0]).toBe(Math.max(...v.probs));
      expect(pick(v.probs, landing(v.probs, 0, 0.5))).toBe(0);
    };
    check(AFTER_THE, 'sky');
    check(AFTER_SUNLIGHT, 'is');
    ANSWER_A.slice(2).forEach((w, k) => check(stepVocabulary(w, k + 2), w));
    ANSWER_B.slice(2).forEach((w, k) => check(stepVocabulary(w, k + 2), w));
  });

  it('lands every step on a spoken word, each after the one before', () => {
    const steps = anim.stepTimes(story.T);
    for (const side of [-1, 1]) {
      steps[side].forEach((t, k) => {
        expect(Number.isFinite(t)).toBe(true);
        if (k) expect(t).toBeGreaterThan(steps[side][k - 1]);
        if (k) {
          const sp = anim.spinnerTimes(story.T, k, t);
          expect(sp.grow).toBeLessThan(sp.spin);
          expect(sp.spin).toBeLessThan(sp.land);
        }
      });
    }
    expect(steps[-1].length).toBe(look.ANSWER_A.length);
    expect(steps[1].length).toBe(look.ANSWER_B.length);
    expect(Math.max(...steps[-1], ...steps[1])).toBeLessThan(story.T.zoom);
  });

  it('fans the branches apart with every step', () => {
    const gap = (k) => look.branchAt(1, k).x - look.branchAt(-1, k).x;
    for (let k = 1; k < 6; k++) expect(gap(k)).toBeGreaterThan(gap(k - 1));
  });
});

describe('s02e02 — the opening and the callback stay on the narration', () => {
  it('types the question and streams both answers on the words that speak them', () => {
    const { T } = story;
    const spoken = (i) => timeline.words[i].start;
    expect(T.typed).toEqual([7, 8, 9, 10, 11].map(spoken)); // "Why is the sky blue?"
    expect(T.aWords).toEqual([20, 21, 22, 23, 24].map(spoken)); // "the sky looks blue because…"
    expect(T.bWords).toEqual([28, 29, 30, 31, 32, 33].map(spoken)); // "sunlight is made of every color."
  });

  it('turns scores into probabilities on "turns … probabilities", as s02e01 did', () => {
    expect(story.T.turns).toBe(timeline.words[64].start);
    expect(story.T.probs9).toBe(timeline.words[68].start);
    // raw scores sit closer together than the probabilities they become
    const { FIRST } = look;
    const scoreRatio = FIRST.scores[5] / FIRST.scores[0];
    const probRatio = FIRST.probs[5] / FIRST.probs[0];
    expect(scoreRatio).toBeGreaterThan(probRatio);
  });
});

describe('s02e02 — temperature: softmax(scores ÷ T), honestly shown', () => {
  let temp;
  beforeAll(async () => {
    temp = await import('../../../episodes/s02e02-different-answers/three/temperature.js');
  });

  it('never lets T reach zero, and moves 1 → low → high on the words that name them', () => {
    const { T } = story;
    const { TEMPS } = look;
    for (let t = T.howFar; t < T.chanceIsnt; t += 0.1) expect(temp.temperatureAt(t, T)).toBeGreaterThan(0);
    expect(temp.temperatureAt(T.low - 0.01, T)).toBe(TEMPS.base);
    expect(temp.temperatureAt(T.answers35, T)).toBeCloseTo(TEMPS.low, 9);
    expect(temp.temperatureAt(T.probs37, T)).toBeCloseTo(TEMPS.high, 9);
    expect(TEMPS.low).toBeGreaterThan(0);
  });

  it('shows exactly softmax(scores / T) at every moment', () => {
    const { T } = story;
    const { TEMP } = look;
    for (const t of [T.becomeProbs + 1, T.gaps, T.answers35, T.high + 0.5, T.flatten]) {
      const Tv = temp.temperatureAt(t, T);
      const e = TEMP.scores.map((s) => Math.exp(s / Tv));
      const z = e.reduce((a, b) => a + b, 0);
      temp.probsAt(t, T).forEach((p, i) => expect(p).toBeCloseTo(e[i] / z, 12));
    }
  });

  it('concentrates on the leader when low, and flattens when high, without the tail taking over', () => {
    const { TEMP, TEMPS } = look;
    const at = (T) => softmax(TEMP.scores, T);
    const tail = (p) => p.slice(TEMP.named).reduce((a, b) => a + b, 0);
    expect(at(TEMPS.low)[0]).toBeGreaterThan(0.85); // the top choice dominates
    expect(at(TEMPS.base)[0]).toBeCloseTo(0.48, 9);
    expect(at(TEMPS.high)[0]).toBeLessThan(0.35); // flatter
    // the unlikely named tokens gain at high T: "a real chance"
    for (const i of [4, 5, 6]) expect(at(TEMPS.high)[i]).toBeGreaterThan(at(TEMPS.base)[i]);
    expect(tail(at(TEMPS.high))).toBeLessThan(0.25); // the alternatives widen, not the tail
    expect(at(TEMPS.low)[0]).toBeLessThan(1); // low is not certain
  });

  it('stretches the gap between the leading scores when low and shrinks it when high', () => {
    const { TEMP, TEMPS } = look;
    const gap = (T) => (TEMP.scores[0] - TEMP.scores[1]) / T;
    expect(gap(TEMPS.low)).toBeGreaterThan(gap(TEMPS.base));
    expect(gap(TEMPS.high)).toBeLessThan(gap(TEMPS.base));
    TEMP.scores.slice(0, TEMP.named).forEach((s) => expect(s).toBeGreaterThan(0)); // bars show score ÷ T directly
  });

  it('draws the sample spins at the setting on screen, with seeds, and the low ones are not all identical', () => {
    const { TEMP, TEMPS, TEMP_SAMPLES } = look;
    for (const which of ['low', 'high']) {
      const s = temp.tempSamples(which);
      expect(s).toEqual(draws(softmax(TEMP.scores, TEMPS[which]), TEMP_SAMPLES[which].seed, TEMP_SAMPLES[which].count));
    }
    const low = temp.tempSamples('low');
    expect(low.filter((d) => d.index === 0).length).toBeGreaterThanOrEqual(8);
    expect(low.some((d) => d.index !== 0)).toBe(true); // "though not always identical"
    const high = temp.tempSamples('high');
    expect(new Set(high.map((d) => d.index)).size).toBeGreaterThanOrEqual(6); // "answers vary more"
  });

  it('stages only the spin onto "banana", lands it on "strange", and discloses it', () => {
    const { T } = story;
    const { TEMP, TEMPS, BANANA } = look;
    const probs = softmax(TEMP.scores, TEMPS.high);
    expect(pick(probs, spin.underPointer(temp.bananaSpin(T.strange, T)))).toBe(BANANA);
    const kicker = story.cues.find((c) => c.id.startsWith('kicker:TEMPERATURE · DEMONSTRATION'));
    expect(kicker.start).toBeLessThanOrEqual(T.wandering);
    expect(kicker.end).toBeGreaterThanOrEqual(T.strange + 0.5);
  });

  it('rests the temperature wheel on a boundary between neither the leader nor "banana"', () => {
    const { TEMP, TEMPS, BANANA } = look;
    for (const Tv of [TEMPS.low, TEMPS.base, TEMPS.high]) {
      const p = softmax(TEMP.scores, Tv);
      const f = spin.underPointer(temp.tempRest(p));
      expect(f).toBeCloseTo(p[0] + p[1] + p[2], 9);
      expect([2, 3]).not.toContain(0);
      expect([2, 3]).not.toContain(BANANA);
    }
  });
});

describe('s02e02 — the tree: brightness follows path probability', () => {
  let tree;
  beforeAll(async () => {
    tree = await import('../../../episodes/s02e02-different-answers/three/tree.js');
  });

  it('makes each path\'s probability the product of its steps', () => {
    const nodes = tree.treeData();
    nodes.slice(1).forEach((n) => expect(n.P).toBeCloseTo(nodes[n.parent].P * n.p, 12));
  });

  it('draws the two answers as the brightest paths at every depth', () => {
    const nodes = tree.treeData();
    for (let k = 0; k < look.TREE.levels; k++) {
      const level = nodes.filter((n) => n.k === k);
      const best = level.reduce((a, b) => (b.P > a.P ? b : a));
      expect(best.word).toBeTruthy();
    }
  });

  it('keeps most continuations faint but visible', () => {
    const nodes = tree.treeData().filter((n) => n.k >= 0);
    nodes.forEach((n) => expect(n.b).toBeGreaterThanOrEqual(look.TREE.floor));
    expect(nodes.filter((n) => n.b < 0.3).length).toBeGreaterThan(nodes.length / 2);
  });

  it('walks one whole path per ask, from the same seeds every time', () => {
    const nodes = tree.treeData();
    const w = tree.walks(nodes);
    expect(tree.walks(tree.treeData())).toEqual(w);
    w.forEach((path) => {
      expect(path[0]).toBe(0);
      expect(nodes[path.at(-1)].children.length).toBe(0);
      path.slice(1).forEach((id, i) => expect(nodes[id].parent).toBe(path[i]));
    });
  });
});

describe('s02e02 — the whole film', () => {
  it('cues the ending on its words and leaves the question open', () => {
    const { T } = story;
    expect(T.wrong).toBe(timeline.words.findIndex((w) => w.word === 'wrong?') >= 0 ? timeline.words.find((w) => w.word === 'wrong?').start : NaN);
    expect(T.next46).toBeLessThan(story.filmEnd);
    const card = story.cues.find((c) => c.id.startsWith('brand'));
    expect(card?.start ?? story.filmEnd).toBeCloseTo(story.filmEnd, 6);
  });

  it('keeps a disclosure on screen whenever illustrative values or staged outcomes are', () => {
    const disclosed = (t) => story.cues.some((c) => c.id.startsWith('kicker:') && /ILLUSTRATIVE|DEMONSTRATION/.test(c.id) && c.start <= t && t <= c.end);
    for (let t = story.T.asWeSaw + 0.2; t < story.T.which; t += 0.25) expect(disclosed(t)).toBe(true);
  });
});

describe('s02e02 — branding: the film teaches its subject and never claims how it was made', () => {
  // Explicit production claims only. AI as the subject ("Ask an AI…", "how AI works") is fine.
  const AI = String.raw`(?:an?\s+)?(?:AI|A\.I\.|artificial\s+intelligence)`;
  const VERB = String.raw`(?:made|generated|produced|created|rendered|animated|narrated|voiced|written|powered)`;
  const CLAIMS = [
    new RegExp(String.raw`\b${AI}[\s\-·]*${VERB}\b`, 'i'), // "AI-made", "AI MADE VISUAL", "AI-generated"
    new RegExp(String.raw`\b${VERB}\s+(?:with|by|using|via|in)\s+${AI}\b`, 'i'), // "made with AI", "generated by an AI"
    new RegExp(String.raw`\b(?:with|using)\s+${AI}\s+(?:tools?|assistance)\b`, 'i'), // "using AI tools"
  ];
  const claims = (text) => CLAIMS.some((re) => re.test(text));

  it('recognises production claims, and leaves AI as a subject alone', () => {
    for (const bad of ['AI MADE VISUAL · 02', 'NEXT · AI MADE VISUAL 03', 'AI-made', 'Made with AI', 'made by an AI', 'AI-generated video', 'Generated by AI', 'Narrated by AI', 'created using artificial intelligence', 'Made using AI tools']) {
      expect(claims(bad), bad).toBe(true);
    }
    for (const fine of ['Ask an AI the same question twice.', 'Why does AI give a different answer every time?', 'HOW AI WORKS', 'ONE QUESTION, TWO ANSWERS', 'NEXT QUESTION', 'Each chosen token shapes the next prediction', 'Model version', 'AI models generate text one token at a time']) {
      expect(claims(fine), fine).toBe(false);
    }
  });

  it('puts no production claim in any overlay text: kickers, captions, labels', () => {
    const texts = story.cues.map((c) => c.id.replace(/^[a-z]+:/, ''));
    expect(texts.length).toBeGreaterThan(20);
    texts.forEach((t) => expect(claims(t), t).toBe(false));
  });

  it('puts no production claim in any text the scene draws', () => {
    // Every string literal in the episode's scene code: tiles, answers, chips, headings, labels.
    const dir = path.join(EPISODE, 'three');
    const literals = fs
      .readdirSync(dir)
      .filter((f) => /\.(m?js|html)$/.test(f))
      .flatMap((f) => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]));
    expect(literals.length).toBeGreaterThan(100);
    literals.forEach((t) => expect(claims(t), t).toBe(false));
  });

  it('opens and closes on the subject', () => {
    const top = story.cues.filter((c) => c.id.startsWith('kicker:'));
    expect(top[0].id).toBe('kicker:ONE QUESTION, TWO ANSWERS');
    expect(top[0].start).toBe(0);
    expect(top.at(-1).id).toBe('kicker:NEXT QUESTION');
  });
});
