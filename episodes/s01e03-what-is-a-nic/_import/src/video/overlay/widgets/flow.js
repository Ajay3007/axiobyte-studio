import { C, H, SAFE, LAYER, TRACK } from '../theme.js';
import { text, measure, roundRect, clamp01, lerp, easeOut, glow, panel } from '../draw.js';

/**
 * The packet-path rail: a chain of stage pills pinned along the bottom of the
 * frame that tracks where the packet currently is. It is the spine of the
 * receive and transmit sections — the viewer can always see how far through
 * the path the narration has got without any extra explanation.
 *
 * `positionAt(t)` returns a float index into `stages`; the pill under it lights
 * and a travelling dot rides the connector between pills.
 */
export function flowRail({ start, end, stages, positionAt, color = C.accent, y = H - 118, label = null }) {
  return {
    id: `rail:${label ?? stages[0]}`,
    start,
    end,
    layer: LAYER.rail,
    fadeIn: 0.7,
    fadeOut: 0.7,
    draw(ctx, k) {
      const size = 17;
      const padX = 13;
      const h = 34;
      const widths = stages.map((s) => measure(ctx, s, { size, weight: 600, track: TRACK.wide }) + padX * 2);
      const total = widths.reduce((a, b) => a + b, 0);
      const avail = SAFE.w;
      const gap = Math.max(10, (avail - total) / (stages.length - 1));
      const scale = total + gap * (stages.length - 1) > avail ? avail / (total + gap * (stages.length - 1)) : 1;

      const pos = positionAt(k.t);
      const active = Math.floor(pos);
      const frac = pos - active;

      ctx.save();
      if (label) {
        ctx.globalAlpha *= 0.9;
        text(ctx, label, SAFE.x, y - 26, { size: 15, weight: 700, color, track: TRACK.xwide });
        ctx.globalAlpha /= 0.9;
      }

      let x = SAFE.x;
      const centers = [];
      stages.forEach((s, i) => {
        const bw = widths[i] * scale;
        const done = i < pos - 0.001;
        const isActive = i === active && pos >= 0;
        const appear = easeOut(clamp01((k.local - i * 0.035) / 0.4));

        ctx.save();
        ctx.globalAlpha *= appear;
        if (isActive) {
          glow(ctx, x + bw / 2, y + h / 2, 70, color, 0.3);
          roundRect(ctx, x, y, bw, h, 3);
          ctx.fillStyle = `${color}26`;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        } else {
          roundRect(ctx, x, y, bw, h, 3);
          ctx.fillStyle = done ? 'rgba(110,193,255,0.07)' : 'rgba(12,15,19,0.66)';
          ctx.fill();
          ctx.strokeStyle = done ? `${color}44` : C.line;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        text(ctx, s, x + bw / 2, y + h / 2 + 1, {
          size: size * scale,
          weight: isActive ? 700 : 600,
          color: isActive ? C.ink : done ? `${color}CC` : C.muted,
          track: TRACK.wide,
          align: 'center',
          baseline: 'middle',
        });
        ctx.restore();

        centers.push([x + bw / 2, y + h / 2, bw]);
        x += bw + gap;
      });

      // Connectors, drawn behind the pills conceptually but after is fine at this weight.
      for (let i = 0; i < centers.length - 1; i++) {
        const x0 = centers[i][0] + centers[i][2] / 2 + 3;
        const x1 = centers[i + 1][0] - centers[i + 1][2] / 2 - 3;
        const done = i < pos - 1 + 0.001;
        ctx.strokeStyle = done ? `${color}66` : C.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y + h / 2);
        ctx.lineTo(x1, y + h / 2);
        ctx.stroke();
        if (i === active && frac > 0.02 && frac < 0.98) {
          const px = lerp(x0, x1, frac);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, y + h / 2, 3.2, 0, Math.PI * 2);
          ctx.fill();
          glow(ctx, px, y + h / 2, 22, color, 0.5);
        }
      }
      ctx.restore();
    },
  };
}

/** Eight PCIe lanes with traffic running along them. */
export function laneActivity({ start, end, at, lanes = 8, color = C.gold, width = 380, dir = 1, title = 'PCIe x8' }) {
  return {
    id: `lanes:${at[0]}`,
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.5,
    fadeOut: 0.5,
    draw(ctx, k) {
      const rowH = 17;
      const p = easeOut(clamp01(k.local / 0.6));
      ctx.save();
      text(ctx, title, at[0], at[1] - 16, { size: 17, weight: 700, color, track: TRACK.xwide });
      for (let i = 0; i < lanes; i++) {
        const y = at[1] + i * rowH;
        ctx.strokeStyle = 'rgba(236,232,218,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(at[0], y);
        ctx.lineTo(at[0] + width * p, y);
        ctx.stroke();

        // Two packets per lane, phase-offset so the group reads as traffic.
        for (let j = 0; j < 2; j++) {
          const u = ((k.local * 0.55 + i * 0.11 + j * 0.5) % 1);
          const x = at[0] + (dir > 0 ? u : 1 - u) * width * p;
          const g = ctx.createLinearGradient(x - 34, 0, x + 6, 0);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, color);
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 34, y);
          ctx.lineTo(x + 4, y);
          ctx.stroke();
        }
        text(ctx, `L${i}`, at[0] - 12, y + 1, { size: 13, weight: 600, color: C.muted, align: 'right', baseline: 'middle' });
      }
      ctx.restore();
    },
  };
}

/** Doorbell register write: a labelled box that pulses when software rings it. */
export function doorbell({ start, end, at, ringAt, color = C.amber }) {
  return {
    id: 'doorbell',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.4,
    fadeOut: 0.5,
    draw(ctx, k) {
      const bw = 260;
      const bh = 92;
      const since = k.t - ringAt;
      const pulse = since >= 0 ? Math.exp(-since * 2.1) : 0;
      ctx.save();
      if (pulse > 0.01) {
        glow(ctx, at[0] + bw / 2, at[1] + bh / 2, 150 * pulse + 60, color, 0.4 * pulse);
        ctx.strokeStyle = color;
        ctx.globalAlpha *= pulse * 0.8;
        for (const r of [1, 2]) {
          const rr = 60 + (1 - pulse) * 90 * r;
          ctx.beginPath();
          ctx.ellipse(at[0] + bw / 2, at[1] + bh / 2, rr * 1.5, rr * 0.55, 0, 0, Math.PI * 2);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.globalAlpha /= pulse * 0.8;
      }
      panel(ctx, at[0], at[1], bw, bh, { accent: color, accentW: 3, fill: pulse > 0.2 ? 'rgba(30,22,12,0.92)' : C.panel });
      text(ctx, 'DOORBELL', at[0] + 22, at[1] + 38, { size: 28, weight: 700, color: C.ink, track: '0.4px' });
      text(ctx, 'tail register write', at[0] + 22, at[1] + 68, { size: 18, weight: 500, color: C.muted, track: TRACK.wide });
      ctx.restore();
    },
  };
}
