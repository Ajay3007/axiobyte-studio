/**
 * How the wheel turns: pure functions of time, no Three.js, so a frame is the
 * same however it was reached and the landings can be tested without a browser.
 *
 * Angles are clockwise, in radians. The wheel's slices are laid out by
 * cumulative probability, fraction 0..1 clockwise from the bottom, so at
 * rotation 0 the pointer at the top sits over fraction 0.5. A spin is a draw:
 * it ends with fraction u under the pointer, and u picks the token
 * (probability.js pick()).
 */

export const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The wheel fraction under the pointer at rotation `rho`. */
export const underPointer = (rho) => mod(0.5 - rho / TAU, 1);

/** The rotation in [0, 2π) that puts fraction `u` under the pointer. */
export const rotationFor = (u) => mod(TAU * (0.5 - u), TAU);

/**
 * The rotation that rests fraction `f` under the pointer by the shortest turn
 * from rotation 0 (within half a turn either way): how far the wheel turns as
 * it forms, so a boundary near the top comes to rest under the pointer.
 */
export const restRotation = (f) => {
  const r = mod(TAU * (0.5 - f), TAU);
  return r > Math.PI ? r - TAU : r;
};

/** Where a spin from `from` ends: `turns` whole turns, then on to fraction `u`. */
export const spinTarget = (from, u, turns) => from + turns * TAU + mod(rotationFor(u) - from, TAU);

/**
 * Rotation during a spin that starts at t0 and comes to rest on fraction u at
 * exactly t1. A brief push to full speed, then a long, steady slow-down, as a
 * wheel spun by hand; it never turns backwards.
 */
export function spinAngle(t, { t0, t1, from = 0, u, turns = 1 }) {
  const to = spinTarget(from, u, turns);
  if (t <= t0) return from;
  if (t >= t1) return to;
  const x = (t - t0) / (t1 - t0);
  const k = (1 - Math.pow(1 - x, 2.6)) * smoothstep(x / 0.08);
  return from + (to - from) * k;
}

/** The rewind: from `from` back to `to`, easing in and out, between t0 and t1. */
export function rewindAngle(t, { t0, t1, from, to = 0 }) {
  const x = smoothstep((t - t0) / (t1 - t0));
  return from + (to - from) * x;
}
