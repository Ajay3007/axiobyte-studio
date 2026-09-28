/** Stable 0..1 hash; keeps the blink pattern a pure function of time. */
function hash01(x) {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Drives indicator LEDs. Patterns are deliberately calm:
 *   link      steady with a slow breath
 *   activity  irregular soft blinks, like light traffic
 *   heartbeat double pulse roughly once a second
 *   steady    constant
 */
export class LedController {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.leds = [];
  }

  add({ material, halo = null, pattern = 'steady', phase = 0, peak = 2.2, base = 0.15 }) {
    material.userData.noHighlight = true;
    this.leds.push({ material, halo, pattern, phase, peak, base, level: 0 });
  }

  target(led, t) {
    const p = this.reducedMotion && led.pattern !== 'steady' ? 'steady' : led.pattern;
    switch (p) {
      case 'link':
        return 0.82 + 0.18 * Math.sin(t * 1.1 + led.phase);
      case 'activity': {
        // Irregular but addressable: the blink train is a hash of the slot
        // index rather than accumulated state, so any time t gives the same
        // pattern. The offline video renderer depends on that.
        const u = t * 1.45 + led.phase;
        const slot = Math.floor(u);
        const r = hash01(slot * 1.37 + led.phase);
        const r2 = hash01(slot * 2.71 + led.phase + 11);
        const on = r > 0.42;
        return on && u - slot < 0.12 + r2 * 0.55 ? 0.6 + r2 * 0.4 : 0.04;
      }
      case 'heartbeat': {
        const c = (t + led.phase) % 1.25;
        const pulse = (x) => Math.exp(-((c - x) ** 2) / 0.0025);
        return 0.08 + pulse(0.1) + 0.6 * pulse(0.32);
      }
      default:
        return 1;
    }
  }

  update(dt, t) {
    const k = 1 - Math.exp(-dt * 18);
    for (const led of this.leds) {
      const target = this.target(led, t);
      led.level += (target - led.level) * k;
      led.material.emissiveIntensity = led.base + led.level * led.peak;
      if (led.halo) led.halo.material.opacity = led.level * 0.55;
    }
  }
}
