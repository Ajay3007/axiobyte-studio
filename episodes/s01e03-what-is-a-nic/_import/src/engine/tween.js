export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
  // Gentle overshoot, used for graphics that "settle" into place.
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

/**
 * Minimal frame-driven tween runner. It has no clock of its own: the host
 * pushes the current time into update(), and new tweens start from that same
 * value. Realtime hosts pass performance.now(); the offline video renderer
 * passes videoTime * 1000, which is what makes tweened state deterministic.
 */
export class Tweens {
  constructor(now = 0) {
    this.active = new Set();
    this.now = now;
  }

  add({ duration, delay = 0, ease = Ease.inOutCubic, onUpdate, onComplete }) {
    const tween = {
      start: this.now + Math.max(0, delay),
      duration: Math.max(0, duration),
      ease,
      onUpdate,
      onComplete,
      done: false,
      cancel() {
        this.done = true;
      },
    };
    if (tween.duration === 0 && delay === 0) {
      onUpdate?.(1);
      onComplete?.();
      tween.done = true;
      return tween;
    }
    this.active.add(tween);
    return tween;
  }

  update(now) {
    this.now = now;
    for (const tw of this.active) {
      if (tw.done) {
        this.active.delete(tw);
        continue;
      }
      if (now < tw.start) continue;
      const t = tw.duration === 0 ? 1 : Math.min((now - tw.start) / tw.duration, 1);
      tw.onUpdate?.(tw.ease(t));
      if (t >= 1) {
        tw.done = true;
        this.active.delete(tw);
        tw.onComplete?.();
      }
    }
  }

  clear() {
    this.active.clear();
  }
}
