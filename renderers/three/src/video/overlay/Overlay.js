import { W, H, LAYER } from './theme.js';
import { clamp01, smooth } from './draw.js';

/**
 * The 2D graphics layer that sits on top of the rendered NIC.
 *
 * It is a pure function of time: `cues` is a static list, and drawing a frame
 * means selecting the cues whose window contains `t` and calling their draw()
 * with a locally-normalised progress. No state carries between frames, so a
 * seek to 07:42 looks identical whether it was played into or jumped to.
 *
 * cue = {
 *   start, end,                 seconds on the voiceover clock
 *   layer,                      paint order (see LAYER)
 *   fadeIn, fadeOut,            seconds
 *   draw(ctx, k)                k = { t, local, u, a, ein, eout, project, ... }
 * }
 */
export class Overlay {
  constructor({ width = W, height = H } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: false });
    this.ctx.textRendering = 'geometricPrecision';
    this.width = width;
    this.height = height;
    this.cues = [];
  }

  setCues(cues) {
    this.cues = cues
      .filter(Boolean)
      .map((c, i) => ({ layer: LAYER.diagram, fadeIn: 0.42, fadeOut: 0.42, order: i, ...c }))
      .sort((a, b) => a.layer - b.layer || a.order - b.order);
  }

  activeAt(t) {
    return this.cues.filter((c) => t >= c.start - 0.001 && t <= c.end + 0.001);
  }

  draw(t, shared = {}) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    for (const c of this.cues) {
      if (t < c.start || t > c.end) continue;
      const span = Math.max(1e-6, c.end - c.start);
      const local = t - c.start;
      const ein = smooth(clamp01(local / Math.max(1e-6, c.fadeIn)));
      const eout = smooth(clamp01((c.end - t) / Math.max(1e-6, c.fadeOut)));
      const a = Math.min(ein, eout);
      if (a <= 0.002) continue;
      ctx.save();
      ctx.globalAlpha = a;
      try {
        c.draw(ctx, { ...shared, t, local, u: local / span, a, ein, eout, span, cue: c });
      } catch (err) {
        // A broken widget must not take the whole render down.
        console.error(`[overlay] cue "${c.id ?? c.order}" failed`, err);
      }
      ctx.restore();
    }
  }
}
