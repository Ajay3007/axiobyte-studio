// The probability arithmetic behind AI Made Visual's next-token pictures: softmax with a
// temperature, the weighted draw a wheel spin stands for, and seeded draws. Pure functions.
import { describe, expect, it } from 'vitest';
import { cumulative, draws, entropy, landing, pick, scoresFor, softmax } from '../src/domains/ml/probability.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const SCORES = [2.0, 1.86, 1.2, 0.8, 0.3, -0.2, -1.5, -1.5, -2.4];

describe('softmax with temperature', () => {
  it('gives a distribution: positive, summing to 1, in the order of the scores', () => {
    for (const T of [0.3, 0.7, 1, 1.5, 2]) {
      const p = softmax(SCORES, T);
      expect(sum(p)).toBeCloseTo(1, 12);
      p.forEach((v) => expect(v).toBeGreaterThan(0));
      for (let i = 1; i < p.length; i++) expect(p[i]).toBeLessThanOrEqual(p[i - 1]);
    }
  });

  it('is exactly exp(score / T) normalised', () => {
    const T = 0.8;
    const e = SCORES.map((s) => Math.exp(s / T));
    const z = sum(e);
    softmax(SCORES, T).forEach((v, i) => expect(v).toBeCloseTo(e[i] / z, 14));
  });

  it('divides the scores by T: the odds of two tokens are exp((a - b) / T)', () => {
    for (const T of [0.4, 1, 1.7]) {
      const p = softmax(SCORES, T);
      expect(p[0] / p[1]).toBeCloseTo(Math.exp((SCORES[0] - SCORES[1]) / T), 10);
    }
  });

  it('ignores a shift of every score (only the gaps matter)', () => {
    const a = softmax(SCORES, 0.9);
    const b = softmax(SCORES.map((s) => s + 40), 0.9);
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 12));
  });

  it('sharpens below T = 1 and flattens above it', () => {
    const at = (T) => softmax(SCORES, T);
    expect(at(0.3)[0]).toBeGreaterThan(at(1)[0]);
    expect(at(2)[0]).toBeLessThan(at(1)[0]);
    expect(at(0.3).at(-1)).toBeLessThan(at(1).at(-1));
    expect(at(2).at(-1)).toBeGreaterThan(at(1).at(-1));
    const H = [0.3, 0.6, 1, 1.4, 2].map((T) => entropy(at(T)));
    for (let i = 1; i < H.length; i++) expect(H[i]).toBeGreaterThan(H[i - 1]);
  });

  it('never makes the top choice certain at a positive temperature, however low', () => {
    const p = softmax([2.0, 1.86], 0.3);
    expect(p[0]).toBeLessThan(1);
    expect(p[1]).toBeGreaterThan(0.3); // two close scores stay close contenders even when cold
  });

  it('refuses a temperature of zero, a negative one, or none at all', () => {
    expect(() => softmax(SCORES, 0)).toThrow(RangeError);
    expect(() => softmax(SCORES, -1)).toThrow(RangeError);
    expect(() => softmax(SCORES, Number.NaN)).toThrow(RangeError);
    expect(() => softmax(SCORES, Infinity)).toThrow(RangeError);
  });

  it('stays finite for extreme scores', () => {
    const p = softmax([1000, 999, -1000], 0.3);
    p.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    expect(sum(p)).toBeCloseTo(1, 12);
  });
});

describe('scores that reproduce a stated distribution', () => {
  it('round-trips through softmax at T = 1', () => {
    const probs = [0.3, 0.26, 0.13, 0.09, 0.05, 0.03, 0.14];
    const back = softmax(scoresFor(probs, 4), 1);
    back.forEach((v, i) => expect(v).toBeCloseTo(probs[i], 12));
  });
});

describe('the weighted draw', () => {
  const probs = [0.3, 0.26, 0.13, 0.09, 0.05, 0.03, 0.14];

  it('gives each token exactly its share of [0, 1)', () => {
    const cdf = cumulative(probs);
    expect(pick(probs, 0)).toBe(0);
    expect(pick(probs, 0.2999)).toBe(0);
    expect(pick(probs, 0.3)).toBe(1);
    expect(pick(probs, cdf[1] - 1e-9)).toBe(1);
    expect(pick(probs, 0.9999)).toBe(probs.length - 1);
    expect(() => pick(probs, 1)).toThrow(RangeError);
  });

  it('lands a demonstration on the token it names, without touching the distribution', () => {
    const before = probs.slice();
    for (let i = 0; i < probs.length; i++) {
      for (const w of [0, 0.25, 0.5, 0.99]) expect(pick(probs, landing(probs, i, w))).toBe(i);
    }
    expect(probs).toEqual(before);
  });

  it('draws the same outcomes from the same seed, and different ones from another', () => {
    expect(draws(probs, 7, 50)).toEqual(draws(probs, 7, 50));
    expect(draws(probs, 7, 50).map((d) => d.index)).not.toEqual(draws(probs, 8, 50).map((d) => d.index));
  });

  it('chooses tokens as often as their probabilities say', () => {
    const n = 40000;
    const counts = probs.map(() => 0);
    draws(probs, 2026, n).forEach((d) => counts[d.index]++);
    // within 4 standard errors of the expected frequency, for every token
    probs.forEach((p, i) => expect(Math.abs(counts[i] / n - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / n)));
  });
});
