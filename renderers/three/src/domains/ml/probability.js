import { mulberry32 } from '../../core/rng.js';

/**
 * The arithmetic of next-token choice, as AI Made Visual draws it. Pure
 * functions, no Three.js: a film's distributions, sampled outcomes and wheel
 * landings are computed here, so the shapes on screen follow the real formulas
 * even when the numbers fed in are illustrative.
 *
 *   probabilities = softmax(scores / T)        T > 0, the temperature
 *   a draw        = u ~ Uniform[0, 1), mapped through the cumulative distribution
 */

/**
 * Turns raw scores (logits) into probabilities at temperature T.
 *
 * The scores are divided by T, then exponentiated and normalised. Subtracting
 * the largest scaled score first changes nothing mathematically and keeps
 * exp() finite for any score or temperature.
 *
 * @param {number[]} scores raw scores, one per token
 * @param {number} [T=1] the temperature, strictly positive
 * @returns {number[]} probabilities in the same order, summing to 1
 */
export function softmax(scores, T = 1) {
  if (!(T > 0) || !Number.isFinite(T)) throw new RangeError(`softmax: temperature must be a positive number, got ${T}`);
  if (!scores.length) throw new RangeError('softmax: no scores');
  const scaled = scores.map((s) => s / T);
  const top = Math.max(...scaled);
  const e = scaled.map((s) => Math.exp(s - top));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}

/**
 * Scores that reproduce a given distribution at T = 1: log(p), shifted so the
 * largest is `top`. Lets a film state the probabilities it narrates ("30 %")
 * and still derive every other temperature from scores, as a model does.
 *
 * @param {number[]} probs strictly positive probabilities
 * @param {number} [top=0] the largest score
 */
export function scoresFor(probs, top = 0) {
  if (probs.some((p) => !(p > 0))) throw new RangeError('scoresFor: every probability must be positive');
  const logs = probs.map(Math.log);
  const max = Math.max(...logs);
  return logs.map((l) => l - max + top);
}

/** Running totals: cdf[i] is the probability of tokens 0..i; the last is 1 (up to rounding). */
export function cumulative(probs) {
  let acc = 0;
  return probs.map((p) => (acc += p));
}

/**
 * The weighted draw: the token whose share of [0, 1) contains u. Token i owns
 * [cdf[i-1], cdf[i]), so each is chosen with exactly its probability when u is
 * uniform. This is what a spin of the wheel is: u is where the pointer stops.
 *
 * @param {number[]} probs
 * @param {number} u in [0, 1)
 * @returns {number} the chosen index
 */
export function pick(probs, u) {
  if (!(u >= 0 && u < 1)) throw new RangeError(`pick: u must be in [0, 1), got ${u}`);
  const cdf = cumulative(probs);
  const total = cdf.at(-1);
  const x = u * total; // tolerate a distribution that sums to 1 only up to rounding
  for (let i = 0; i < cdf.length; i++) if (x < cdf[i]) return i;
  return cdf.length - 1;
}

/**
 * The u that lands a given fraction of the way through token i's share. For a
 * demonstration that must stop on a narrated token: the outcome is fixed, the
 * distribution is not touched, and pick(probs, landing(...)) === i.
 *
 * @param {number[]} probs
 * @param {number} i the token to land on
 * @param {number} [within=0.5] 0 = the start of its share, 1 = the end (exclusive)
 */
export function landing(probs, i, within = 0.5) {
  if (!(within >= 0 && within < 1)) throw new RangeError(`landing: within must be in [0, 1), got ${within}`);
  const cdf = cumulative(probs);
  const total = cdf.at(-1);
  const lo = i === 0 ? 0 : cdf[i - 1];
  return (lo + probs[i] * within) / total;
}

/**
 * Seeded weighted draws: the same seed gives the same outcomes on every
 * machine and every render, and the outcomes follow the distribution.
 *
 * @param {number[]} probs
 * @param {number} seed
 * @param {number} n how many draws
 * @returns {{ u: number, index: number }[]}
 */
export function draws(probs, seed, n) {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const u = rand();
    return { u, index: pick(probs, u) };
  });
}

/** Shannon entropy in bits: how spread out a distribution is (0 = one certain token). */
export function entropy(probs) {
  return -probs.reduce((a, p) => (p > 0 ? a + p * Math.log2(p) : a), 0);
}
