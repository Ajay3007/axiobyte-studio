import { C, W, H, SAFE, LAYER, TRACK } from '../theme.js';
import { text, measure, rule, roundRect, clamp01, smooth, easeOut, easeOutQuint, ramp, wipe } from '../draw.js';

/** Persistent corner wordmark. Deliberately quiet. */
export function brandMark({ start, end }) {
  return {
    id: 'brand',
    start,
    end,
    layer: LAYER.brand,
    fadeIn: 1.2,
    fadeOut: 1.2,
    draw(ctx) {
      const g = ctx.createRadialGradient(SAFE.x + 60, SAFE.y + 20, 0, SAFE.x + 60, SAFE.y + 20, 420);
      g.addColorStop(0, 'rgba(6,8,11,0.72)');
      g.addColorStop(1, 'rgba(6,8,11,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 300);
      ctx.globalAlpha *= 0.62;
      text(ctx, 'AXIOBYTE', SAFE.x, SAFE.y + 14, { size: 21, weight: 700, color: C.ink, track: TRACK.xwide, baseline: 'middle' });
      const w = measure(ctx, 'AXIOBYTE', { size: 21, weight: 700, track: TRACK.xwide });
      ctx.fillStyle = C.accent;
      ctx.fillRect(SAFE.x + w + 12, SAFE.y + 9, 4, 11);
    },
  };
}

/** Section read-out under the wordmark: "04 · HOW A PACKET IS RECEIVED". */
export function sectionLabel({ start, end, index, label }) {
  return {
    id: `section-label:${label}`,
    start,
    end,
    layer: LAYER.brand,
    fadeIn: 0.7,
    fadeOut: 0.7,
    draw(ctx, k) {
      const y = SAFE.y + 44;
      ctx.save();
      ctx.translate((1 - easeOut(k.local / 0.7)) * -10, 0);
      ctx.globalAlpha *= 0.85;
      text(ctx, index, SAFE.x, y, { size: 17, weight: 700, color: C.accent, track: TRACK.wide, baseline: 'middle' });
      const iw = measure(ctx, index, { size: 17, weight: 700, track: TRACK.wide });
      ctx.fillStyle = C.line;
      ctx.fillRect(SAFE.x + iw + 10, y - 6, 1, 12);
      text(ctx, label, SAFE.x + iw + 21, y, { size: 17, weight: 600, color: C.muted, track: TRACK.wide, baseline: 'middle' });
      ctx.restore();
    },
  };
}

/** Directional gradient so type stays readable over the model. */
export function scrim({ start, end, side = 'left', strength = 0.78, fadeIn = 0.8, fadeOut = 0.8 }) {
  return {
    id: `scrim:${side}:${start.toFixed(1)}`,
    start,
    end,
    layer: LAYER.scrim,
    fadeIn,
    fadeOut,
    draw(ctx) {
      const g =
        side === 'left'
          ? ctx.createLinearGradient(0, 0, W * 0.72, 0)
          : side === 'right'
            ? ctx.createLinearGradient(W, 0, W * 0.28, 0)
            : ctx.createLinearGradient(0, H, 0, H * 0.35);
      g.addColorStop(0, `rgba(8,10,13,${strength})`);
      g.addColorStop(0.55, `rgba(8,10,13,${strength * 0.38})`);
      g.addColorStop(1, 'rgba(8,10,13,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
  };
}

/** The opening title. Rule wipes, the word rises, everything is left-aligned. */
export function titleCard({ start, end, kicker, title, sub }) {
  return {
    id: 'title-card',
    start,
    end,
    layer: LAYER.title,
    fadeIn: 0.5,
    fadeOut: 0.9,
    draw(ctx, k) {
      const x = SAFE.x + 24;
      const cy = H * 0.5;
      const p = k.local;

      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.0, 0.5);
      text(ctx, kicker, x, cy - 132, { size: 23, weight: 600, color: C.accent, track: TRACK.xwide });
      ctx.restore();

      rule(ctx, x, cy - 108, 430, easeOutQuint(p / 0.9), { color: C.accent, thickness: 2 });

      const rise = (1 - easeOutQuint(clamp01((p - 0.22) / 1.0))) * 78;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, cy - 104, W, 190);
      ctx.clip();
      ctx.globalAlpha *= ramp(p, 0.2, 0.7);
      text(ctx, title, x - 6, cy + 42 + rise, { size: 132, weight: 700, color: C.ink, track: '-1px' });
      ctx.restore();

      if (sub) {
        ctx.save();
        ctx.globalAlpha *= ramp(p, 0.85, 1.5);
        text(ctx, sub, x, cy + 96, { size: 27, weight: 500, color: C.muted, track: TRACK.wide });
        ctx.restore();
      }
    },
  };
}

/**
 * Chapter marker: an accent stroke, an index and a title that wipes in — on
 * screen for a couple of seconds, never dominating the frame.
 */
export function sectionTitle({ start, end, index, title }) {
  return {
    id: `section-title:${title}`,
    start,
    end,
    layer: LAYER.title,
    fadeIn: 0.35,
    fadeOut: 0.6,
    draw(ctx, k) {
      const x = SAFE.x + 24;
      const y = H * 0.63;
      const p = easeOutQuint(clamp01(k.local / 0.85));
      const size = 60;

      ctx.fillStyle = C.accent;
      ctx.fillRect(x - 24, y - 44, 4, 88 * p);

      ctx.save();
      ctx.globalAlpha *= ramp(k.local, 0.08, 0.45);
      text(ctx, index, x, y - 26, { size: 19, weight: 700, color: C.accent, track: TRACK.xwide });
      ctx.restore();

      const tw = measure(ctx, title, { size, weight: 700, track: '0.6px' });
      wipe(ctx, x - 4, y - 8, tw + 16, size + 22, p, () => {
        text(ctx, title, x, y + 34, { size, weight: 700, color: C.ink, track: '0.6px' });
      });
    },
  };
}

/** Closing card: wordmark, rule, and where to find the interactive model. */
export function endCard({ start, end, title, kicker = null, lines = [] }) {
  return {
    id: 'end-card',
    start,
    end,
    layer: LAYER.title,
    fadeIn: 0.9,
    fadeOut: 0.7,
    draw(ctx, k) {
      const cx = W / 2;
      const cy = H * 0.42;
      const p = k.local;

      if (kicker) {
        ctx.save();
        ctx.globalAlpha *= ramp(p, 0, 0.6);
        text(ctx, kicker, cx, cy - 104, { size: 24, weight: 600, color: C.accent, track: TRACK.xwide, align: 'center' });
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.15, 0.95);
      text(ctx, title, cx, cy, { size: 86, weight: 700, color: C.ink, track: '3px', align: 'center' });
      ctx.restore();

      const rw = 340 * easeOutQuint(clamp01((p - 0.3) / 1.1));
      ctx.fillStyle = C.accent;
      ctx.fillRect(cx - rw / 2, cy + 36, rw, 2);

      lines.forEach((l, i) => {
        ctx.save();
        ctx.globalAlpha *= ramp(p, 0.7 + i * 0.28, 1.3 + i * 0.28);
        text(ctx, l, cx, cy + 86 + i * 40, { size: 25, weight: 500, color: i === 0 ? C.muted : C.inkDim, track: TRACK.wide, align: 'center' });
        ctx.restore();
      });
    },
  };
}

/** Full-frame black, used for the open and the close. */
export function fade({ start, end, hold = 'in' }) {
  return {
    id: `fade:${hold}:${start.toFixed(1)}`,
    start,
    end,
    layer: LAYER.fade,
    fadeIn: 0,
    fadeOut: 0,
    draw(ctx, k) {
      ctx.globalAlpha = hold === 'in' ? 1 - smooth(k.u) : smooth(k.u);
      ctx.fillStyle = '#05070A';
      ctx.fillRect(0, 0, W, H);
    },
  };
}

/** Very soft corner darkening; keeps the eye on the card. */
export function vignette({ start, end, strength = 0.42 }) {
  return {
    id: 'vignette',
    start,
    end,
    layer: LAYER.scrim,
    fadeIn: 0.6,
    fadeOut: 0.6,
    draw(ctx) {
      const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.48, H * 0.96);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${strength})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
  };
}

/** Hairline progress bar pinned to the very bottom edge. */
export function progressBar({ start, end, duration }) {
  return {
    id: 'progress',
    start,
    end,
    layer: LAYER.brand,
    fadeIn: 1.5,
    fadeOut: 1.0,
    draw(ctx, k) {
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = 'rgba(236,232,218,0.13)';
      ctx.fillRect(0, H - 3, W, 2);
      ctx.fillStyle = C.accent;
      ctx.fillRect(0, H - 3, W * clamp01(k.t / duration), 2);
    },
  };
}

/** Full-frame dim, for settling the 3D back while type takes over. */
export function dim({ start, end, alpha = 0.55, fadeIn = 1.0, fadeOut = 1.0 }) {
  return {
    id: `dim:${start.toFixed(1)}`,
    start,
    end,
    layer: LAYER.title - 1,
    fadeIn,
    fadeOut,
    draw(ctx) {
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = '#05070A';
      ctx.fillRect(0, 0, W, H);
    },
  };
}

/**
 * The surface diagrams sit on. Right-column graphics have to stay readable
 * over a brightly lit PCB, so each block gets an explicit card rather than
 * relying on the model being dark behind it.
 */
export function backdrop({ start, end, rect, radius = 6, fadeIn = 0.5, fadeOut = 0.55, fill = 'rgba(9,12,16,0.90)', stroke = 'rgba(236,232,218,0.10)' }) {
  const [x, y, w, h] = rect;
  return {
    id: `backdrop:${Math.round(x)}x${Math.round(y)}:${start.toFixed(1)}`,
    start,
    end,
    layer: LAYER.diagram - 1,
    fadeIn,
    fadeOut,
    draw(ctx, k) {
      const grow = easeOutQuint(clamp01(k.local / 0.6));
      const hh = h * (0.94 + 0.06 * grow);
      const yy = y + (h - hh) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 42;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, x, yy, w, hh, radius);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
      roundRect(ctx, x, yy, w, hh, radius);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    },
  };
}
