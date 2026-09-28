import { C, LAYER, TRACK } from '../theme.js';
import { text, measure, panel, leader, chip, clamp01, easeOut, easeOutQuint, ramp, stagger, wipe } from '../draw.js';

/**
 * The educational callout. A short technical label, optionally tethered to a
 * real component by a leader line that tracks the 3D position every frame.
 *
 *   callout({ start, end, title: 'DMA', subtitle: 'Direct Memory Access',
 *             anchorTo: { id: 'nic-controller', name: 'dma' }, at: [1180, 300] })
 *
 * Titles stay short on purpose: the voiceover carries the sentence, the
 * overlay only names the thing being looked at.
 */
export function callout({ start, end, title, subtitle = null, at, anchorTo = null, align = 'left', color = C.accent, fadeIn = 0.42, fadeOut = 0.42, width = null }) {
  return {
    id: `callout:${title}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn,
    fadeOut,
    draw(ctx, k) {
      const p = easeOutQuint(clamp01(k.local / 0.55));
      const tSize = 36;
      const sSize = 20;
      const tw = measure(ctx, title, { size: tSize, weight: 700, track: '0.4px' });
      const sw = subtitle ? measure(ctx, subtitle, { size: sSize, weight: 500, track: TRACK.wide }) : 0;
      const bw = width ?? Math.max(tw, sw) + 44;
      const bh = subtitle ? 96 : 66;
      const x = align === 'right' ? at[0] - bw : at[0];
      const y = at[1];

      // Tether first so the card paints over its own elbow.
      if (anchorTo) {
        const src = k.project(anchorTo.id, anchorTo.name ?? 'center');
        if (src) {
          const tx = align === 'right' ? x + bw : x;
          leader(ctx, src, [tx, y + bh / 2], { color, progress: p });
        }
      }

      ctx.save();
      ctx.globalAlpha *= ramp(k.local, 0.06, 0.4);
      panel(ctx, x, y, bw, bh, { accent: color, accentW: 3, fill: C.panel });
      wipe(ctx, x, y, bw, bh, easeOut(clamp01((k.local - 0.08) / 0.5)), () => {
        text(ctx, title, x + 22, y + (subtitle ? 44 : 42), { size: tSize, weight: 700, color: C.ink, track: '0.4px' });
        if (subtitle) text(ctx, subtitle, x + 22, y + 74, { size: sSize, weight: 500, color: C.muted, track: TRACK.wide });
      });
      ctx.restore();
    },
  };
}

/** A column (or row) of small tags that appear one after another. */
export function chipRow({ start, end, at, items, color = C.accent, dir = 'down', gap = 14, size = 20, step = 0.3, align = 'left', mono = false }) {
  return {
    id: `chips:${items.join('/')}`,
    start,
    end,
    layer: LAYER.callout,
    draw(ctx, k) {
      let cursor = 0;
      items.forEach((label, i) => {
        const a = stagger(k.local, i, step, 0.45);
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        const dx = dir === 'down' ? (1 - a) * -14 : 0;
        const dy = dir === 'down' ? 0 : (1 - a) * 10;
        const x = at[0] + dx;
        const y = at[1] + (dir === 'down' ? cursor : dy);
        const box = chip(ctx, label, dir === 'down' ? x : x + cursor, y, {
          size,
          color,
          bg: 'rgba(110,193,255,0.09)',
          border: `${color}66`,
          mono,
          align,
        });
        cursor += (dir === 'down' ? box.h : box.w) + gap;
        ctx.restore();
      });
    },
  };
}

/** Big numbers. Used once or twice — they lose their weight if repeated. */
export function statBlock({ start, end, at, items, align = 'left', color = C.accent }) {
  return {
    id: `stats:${items.map((i) => i.value).join('/')}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.5,
    fadeOut: 0.5,
    draw(ctx, k) {
      let y = at[1];
      items.forEach((it, i) => {
        const a = stagger(k.local, i, 0.42, 0.6);
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        const rise = (1 - easeOutQuint(a)) * 16;
        const vSize = it.small ? 54 : 76;
        const vw = measure(ctx, it.value, { size: vSize, weight: 700, track: '-0.5px' });
        const uw = it.unit ? measure(ctx, it.unit, { size: 26, weight: 600, track: TRACK.wide }) + 12 : 0;
        // Value first, unit after it, whichever edge the block is anchored to.
        const vx = align === 'right' ? at[0] - uw : at[0];
        text(ctx, it.value, vx, y + rise, { size: vSize, weight: 700, color: C.ink, track: '-0.5px', align });
        if (it.unit) {
          const ux = align === 'right' ? at[0] : at[0] + vw + 12;
          text(ctx, it.unit, ux, y + rise - 6, { size: 26, weight: 600, color, track: TRACK.wide, align });
        }
        text(ctx, it.label, at[0], y + rise + 30, { size: 20, weight: 500, color: C.muted, track: TRACK.wide, align });
        ctx.restore();
        y += vSize + 54;
      });
    },
  };
}

/**
 * The "no interrupt / no context switch / no extra copy" beat: three short
 * phrases stacked, each struck through by an accent rule as it lands.
 */
export function phraseStack({ start, end, at, items, step = 0.95, color = C.accent, size = 58 }) {
  return {
    id: `phrases:${items[0]}`,
    start,
    end,
    layer: LAYER.title,
    fadeIn: 0.4,
    fadeOut: 0.7,
    draw(ctx, k) {
      items.forEach((label, i) => {
        const a = stagger(k.local, i, step, 0.5);
        if (a <= 0.01) return;
        const y = at[1] + i * (size + 30);
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate((1 - easeOutQuint(a)) * -24, 0);
        ctx.fillStyle = color;
        ctx.fillRect(at[0] - 22, y - size * 0.62, 3, size * 0.82);
        text(ctx, label, at[0], y, { size, weight: 700, color: C.ink, track: '0.5px' });
        ctx.restore();
      });
    },
  };
}

/** Monospace code tag, e.g. rte_eth_rx_burst(). */
export function codeChip({ start, end, at, code, color = C.accent, size = 26, align = 'left', caption = null }) {
  return {
    id: `code:${code}`,
    start,
    end,
    layer: LAYER.callout,
    draw(ctx, k) {
      const p = easeOutQuint(clamp01(k.local / 0.5));
      const tw = measure(ctx, code, { size, weight: 500, track: '0px', mono: true });
      const bw = tw + 36;
      const bh = size + 26;
      const x = align === 'right' ? at[0] - bw : at[0];
      ctx.save();
      ctx.globalAlpha *= p;
      panel(ctx, x, at[1], bw, bh, { fill: 'rgba(8,11,15,0.92)', stroke: `${color}55`, r: 4 });
      wipe(ctx, x, at[1], bw, bh, p, () => {
        text(ctx, code, x + 18, at[1] + bh / 2 + 1, { size, weight: 500, color, track: '0px', mono: true, baseline: 'middle' });
      });
      if (caption) text(ctx, caption, x, at[1] + bh + 24, { size: 18, weight: 500, color: C.muted, track: TRACK.wide });
      ctx.restore();
    },
  };
}

/** Titled list of short technical points; one line each, never a paragraph. */
export function noteList({ start, end, at, title = null, items, color = C.accent, step = 0.5, size = 25, width = 420 }) {
  return {
    id: `notes:${title ?? items[0]}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.45,
    fadeOut: 0.5,
    draw(ctx, k) {
      let y = at[1];
      if (title) {
        ctx.save();
        ctx.globalAlpha *= ramp(k.local, 0, 0.4);
        text(ctx, title, at[0], y, { size: 19, weight: 700, color, track: TRACK.xwide });
        ctx.fillStyle = C.line;
        ctx.fillRect(at[0], y + 16, width * easeOut(clamp01(k.local / 0.7)), 1);
        ctx.restore();
        y += 52;
      }
      items.forEach((it, i) => {
        const a = stagger(k.local, i, step, 0.45);
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate((1 - easeOutQuint(a)) * -12, 0);
        ctx.fillStyle = color;
        ctx.fillRect(at[0], y - 8, 7, 2);
        text(ctx, it, at[0] + 20, y, { size, weight: 500, color: C.ink, track: '0.3px' });
        ctx.restore();
        y += size + 20;
      });
    },
  };
}

/** Three-up concept cards (throughput / offload / control, recap items …). */
export function cardRow({ start, end, at, cards, cardW = 372, cardH = 178, gap = 26, color = C.accent, step = 0.55, activeAt = null }) {
  return {
    id: `cards:${cards.map((c) => c.title).join('/')}`,
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.45,
    fadeOut: 0.55,
    draw(ctx, k) {
      cards.forEach((card, i) => {
        const a = stagger(k.local, i, step, 0.55);
        if (a <= 0.01) return;
        const x = at[0] + i * (cardW + gap);
        const y = at[1] + (1 - easeOutQuint(a)) * 18;
        const active = activeAt ? activeAt(k.t) === i : false;
        ctx.save();
        ctx.globalAlpha *= a;
        panel(ctx, x, y, cardW, cardH, {
          fill: active ? 'rgba(18,26,34,0.94)' : C.panel,
          stroke: active ? `${color}88` : C.line,
          accent: active ? color : 'rgba(236,232,218,0.14)',
          accentW: 3,
        });
        text(ctx, String(i + 1).padStart(2, '0'), x + 24, y + 40, { size: 17, weight: 700, color: active ? color : C.muted, track: TRACK.xwide });
        text(ctx, card.title, x + 24, y + 86, { size: 34, weight: 700, color: C.ink, track: '0.3px' });
        if (card.sub) text(ctx, card.sub, x + 24, y + 124, { size: 20, weight: 500, color: C.muted, track: '0.3px', maxWidth: cardW - 48 });
        if (card.sub2) text(ctx, card.sub2, x + 24, y + 150, { size: 20, weight: 500, color: C.muted, track: '0.3px', maxWidth: cardW - 48 });
        ctx.restore();
      });
    },
  };
}

/** A framed reticle over a projected component — a macro "look here" marker. */
export function reticle({ start, end, target, label = null, color = C.accent, size = 96 }) {
  return {
    id: `reticle:${target.id}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.4,
    fadeOut: 0.4,
    draw(ctx, k) {
      const p = k.project(target.id, target.name ?? 'center');
      if (!p) return;
      const s = size * (1 + (1 - easeOutQuint(clamp01(k.local / 0.6))) * 0.35);
      const h = s / 2;
      const arm = s * 0.26;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(p[0] + sx * h - sx * arm, p[1] + sy * h);
        ctx.lineTo(p[0] + sx * h, p[1] + sy * h);
        ctx.lineTo(p[0] + sx * h, p[1] + sy * h - sy * arm);
        ctx.stroke();
      }
      if (label) text(ctx, label, p[0], p[1] + h + 26, { size: 18, weight: 600, color, track: TRACK.wide, align: 'center' });
      ctx.restore();
    },
  };
}
