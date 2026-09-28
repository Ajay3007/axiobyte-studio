import { C, W, H, LAYER } from '../theme.js';
import { text, measure, panel, wrap, ramp } from '../draw.js';

/**
 * Optional burned-in subtitles. Off by default — YouTube gets the sidecar
 * .srt instead — but useful when checking sync, and available with
 * `?captions=1` / `npm run render -- --captions`.
 */
export function captionTrack({ timeline, start, end, y = H - 168 }) {
  return {
    id: 'captions',
    start,
    end,
    layer: LAYER.caption,
    fadeIn: 0.2,
    fadeOut: 0.2,
    draw(ctx, k) {
      const i = timeline.sentenceIndexAt(k.t);
      const s = timeline.sentence(i);
      if (!s || k.t < s.start - 0.15 || k.t > s.end + 0.35) return;
      const opts = { size: 30, weight: 500, track: '0.2px' };
      const lines = wrap(ctx, s.text, 1180, opts);
      const lh = 40;
      const bh = lines.length * lh + 28;
      const bw = Math.max(...lines.map((l) => measure(ctx, l, opts))) + 52;
      const x = (W - bw) / 2;
      const yy = y - bh;
      ctx.globalAlpha *= Math.min(1, ramp(k.t, s.start - 0.15, s.start + 0.1)) * Math.min(1, ramp(s.end + 0.35 - k.t, 0, 0.25));
      panel(ctx, x, yy, bw, bh, { fill: 'rgba(6,8,11,0.82)', stroke: 'rgba(236,232,218,0.10)', r: 4 });
      lines.forEach((l, li) => {
        text(ctx, l, W / 2, yy + 22 + li * lh + 20, { ...opts, color: C.ink, align: 'center', baseline: 'middle' });
      });
    },
  };
}
