import { C, LAYER, TRACK } from '../../../video/overlay/theme.js';
import { text, panel, roundRect, arrow, line, glow, clamp01, lerp, easeOut, easeOutQuint, easeInOut, ramp, stagger } from '../../../video/overlay/draw.js';

const heading = (ctx, x, y, w, label, color, p) => {
  text(ctx, label, x, y, { size: 18, weight: 700, color, track: TRACK.xwide });
  ctx.fillStyle = C.line;
  ctx.fillRect(x, y + 16, w * easeOut(clamp01(p / 0.8)), 1);
};

/** The NIC's job in one picture: wire on one side, the OS on the other. */
export function duplexDiagram({ start, end, at = [988, 330], color = C.accent }) {
  return {
    id: 'duplex',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.6,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 800;
      const p = k.local;
      heading(ctx, x0, y0, w, 'WHAT IT DOES', color, p);

      const bw = 232;
      const bh = 104;
      const by = y0 + 62;
      const mid = x0 + (w - bw) / 2;
      const right = x0 + w - bw;
      const cells = [
        { x: x0, title: 'THE WIRE', sub: 'copper pairs' },
        { x: mid, title: 'NIC', sub: 'this card' },
        { x: right, title: 'OPERATING SYSTEM', sub: 'host memory', small: true },
      ];
      cells.forEach((c, i) => {
        const a = stagger(p, i === 1 ? 0 : i === 0 ? 1 : 2, 0.35, 0.5);
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        panel(ctx, c.x, by, bw, bh, { fill: i === 1 ? 'rgba(17,26,35,0.95)' : C.panel, stroke: i === 1 ? `${color}99` : C.line, accent: i === 1 ? color : null, accentW: 3 });
        text(ctx, c.title, c.x + bw / 2, by + 44, { size: c.small ? 22 : 30, weight: 700, color: C.ink, align: 'center' });
        text(ctx, c.sub, c.x + bw / 2, by + 74, { size: 17, weight: 500, color: C.muted, align: 'center', track: TRACK.wide });
        ctx.restore();
      });

      const ay = by + bh / 2;
      const draws = [
        { a: x0 + bw + 14, b: mid - 14, lab: 'bits in', up: true, d: 1 },
        { a: mid + bw + 14, b: right - 14, lab: 'to memory', up: true, d: 1 },
        { a: right - 14, b: mid + bw + 14, lab: 'from memory', up: false, d: -1 },
        { a: mid - 14, b: x0 + bw + 14, lab: 'bits out', up: false, d: -1 },
      ];
      draws.forEach((s, i) => {
        const a = ramp(p, 1.1 + (s.up ? 0 : 0.5), 1.7 + (s.up ? 0 : 0.5));
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        const yy = ay + (s.up ? -16 : 16);
        const dash = 14;
        arrow(ctx, s.a, yy, s.b, yy, {
          color: s.up ? color : C.amber,
          width: 1.8,
          head: 8,
          dash: [7, 7],
          dashOffset: -p * 26 * s.d,
        });
        ctx.restore();
      });
      ctx.save();
      ctx.globalAlpha *= ramp(p, 1.7, 2.3);
      text(ctx, 'receive', x0 + w / 2, by - 10, { size: 16, weight: 600, color, track: TRACK.wide, align: 'center' });
      text(ctx, 'transmit', x0 + w / 2, by + bh + 28, { size: 16, weight: 600, color: C.amber, track: TRACK.wide, align: 'center' });
      ctx.restore();
    },
  };
}

/** Eight contacts, four differential pairs — the physical width of the link. */
export function pairsDiagram({ start, end, at = [1080, 300], color = C.gold }) {
  return {
    id: 'pairs',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.55,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 620;
      const p = k.local;
      heading(ctx, x0, y0, w, '8P8C · FOUR PAIRS', color, p);

      const cw = 40;
      const gap = 14;
      const pairGap = 28;
      let x = x0;
      const pos = [];
      for (let i = 0; i < 8; i++) {
        const a = stagger(p, i, 0.09, 0.3);
        pos.push(x);
        if (a > 0.01) {
          ctx.save();
          ctx.globalAlpha *= a;
          roundRect(ctx, x, y0 + 54, cw, 72, 3);
          ctx.fillStyle = 'rgba(240,192,96,0.16)';
          ctx.fill();
          ctx.strokeStyle = `${color}99`;
          ctx.lineWidth = 1;
          ctx.stroke();
          text(ctx, String(i + 1), x + cw / 2, y0 + 96, { size: 20, weight: 700, color, align: 'center', baseline: 'middle' });
          ctx.restore();
        }
        x += cw + (i % 2 === 1 ? pairGap : gap);
      }

      ctx.save();
      ctx.globalAlpha *= ramp(p, 1.0, 1.7);
      for (let q = 0; q < 4; q++) {
        const a0 = pos[q * 2];
        const a1 = pos[q * 2 + 1] + cw;
        const cx = (a0 + a1) / 2;
        line(ctx, [[a0 + 6, y0 + 140], [a0 + 6, y0 + 156], [a1 - 6, y0 + 156], [a1 - 6, y0 + 140]], { color: `${color}88`, width: 1.4 });
        text(ctx, `PAIR ${q}`, cx, y0 + 182, { size: 17, weight: 600, color: C.muted, align: 'center', track: TRACK.wide });
        // Both directions at once: that is what 10GBASE-T does.
        const u = (p * 0.6 + q * 0.25) % 1;
        const px = lerp(a0, a1, easeInOut(u));
        ctx.fillStyle = color;
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.arc(px, y0 + 156, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha /= 0.85;
      }
      text(ctx, 'all four pairs, both directions, simultaneously', x0, y0 + 226, { size: 20, weight: 500, color: C.inkDim, track: TRACK.wide });
      ctx.restore();
    },
  };
}

/** PAM-16: sixteen voltage levels carrying four bits per symbol. */
export function pam16Diagram({ start, end, at = [1080, 300], color = C.accent }) {
  return {
    id: 'pam16',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 620;
      const h = 280;
      const p = k.local;
      heading(ctx, x0, y0, w, 'PAM-16 SIGNALLING', color, p);

      const gy = y0 + 46;
      const levels = 16;
      const step = h / (levels - 1);
      const rev = easeOut(clamp01(p / 0.9));
      ctx.save();
      for (let i = 0; i < levels; i++) {
        const y = gy + i * step;
        ctx.strokeStyle = i === 0 || i === levels - 1 ? 'rgba(236,232,218,0.26)' : 'rgba(236,232,218,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + w * rev, y);
        ctx.stroke();
      }
      text(ctx, '16 levels', x0 + w, gy - 12, { size: 16, weight: 600, color: C.muted, track: TRACK.wide, align: 'right' });
      ctx.restore();

      // A deterministic pseudo-random symbol sequence stepping between levels.
      const nSym = 18;
      const symW = w / nSym;
      const lvl = (i) => {
        const s = Math.sin(i * 12.9898) * 43758.5453;
        return Math.floor((s - Math.floor(s)) * levels);
      };
      const shown = clamp01((p - 0.7) / 2.6) * nSym;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < nSym; i++) {
        if (i > shown) break;
        const y = gy + lvl(i) * step;
        const xa = x0 + i * symW;
        const xb = x0 + Math.min(i + 1, shown) * symW;
        if (!started) {
          ctx.moveTo(xa, y);
          started = true;
        } else ctx.lineTo(xa, y);
        ctx.lineTo(xb, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha *= ramp(p, 2.6, 3.4);
      text(ctx, '4 bits per symbol  ·  800 Mbaud  ·  4 pairs  =  10 Gb/s', x0, gy + h + 44, { size: 21, weight: 600, color: C.inkDim, track: TRACK.wide });
      ctx.restore();
    },
  };
}

/** Galvanic isolation: cable side and card side, separated by the transformer. */
export function isolationDiagram({ start, end, at = [988, 300], color = C.accent }) {
  return {
    id: 'isolation',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.6,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 800;
      const p = k.local;
      heading(ctx, x0, y0, w, 'GALVANIC ISOLATION', color, p);

      const bw = 226;
      const bh = 104;
      const by = y0 + 68;
      const mid = x0 + (w - bw) / 2;
      const right = x0 + w - bw;
      const cells = [
        { x: x0, title: 'CABLE', sub: 'outside world', on: 0 },
        { x: mid, title: 'MAGNETICS', sub: 'transformer + choke', on: 1 },
        { x: right, title: 'PHY', sub: 'card side', on: 2 },
      ];
      cells.forEach((c, i) => {
        const a = stagger(p, i, 0.4, 0.5);
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        panel(ctx, c.x, by, bw, bh, { fill: i === 1 ? 'rgba(17,26,35,0.95)' : C.panel, stroke: i === 1 ? `${color}99` : C.line, accent: i === 1 ? color : null, accentW: 3 });
        text(ctx, c.title, c.x + bw / 2, by + 46, { size: 27, weight: 700, color: C.ink, align: 'center' });
        text(ctx, c.sub, c.x + bw / 2, by + 76, { size: 16, weight: 500, color: C.muted, align: 'center', track: TRACK.wide });
        ctx.restore();
      });

      ctx.save();
      ctx.globalAlpha *= ramp(p, 1.0, 1.6);
      arrow(ctx, x0 + bw + 12, by + bh / 2, mid - 12, by + bh / 2, { color: `${color}AA`, width: 1.8, head: 8 });
      arrow(ctx, mid + bw + 12, by + bh / 2, right - 12, by + bh / 2, { color: `${color}AA`, width: 1.8, head: 8 });
      ctx.restore();

      // The barrier itself: no metallic path crosses it.
      ctx.save();
      const bar = ramp(p, 1.8, 2.6);
      ctx.globalAlpha *= bar;
      const bx = mid + bw / 2;
      line(ctx, [[bx, by - 34], [bx, by + bh + 46]], { color: C.red, width: 1.6, dash: [8, 7] });
      text(ctx, 'NO DC PATH', bx, by - 46, { size: 16, weight: 700, color: C.red, align: 'center', track: TRACK.wide });
      text(ctx, '1500 Vrms isolation  ·  common-mode rejection', x0, by + bh + 88, { size: 21, weight: 600, color: C.inkDim, track: TRACK.wide });
      ctx.restore();
    },
  };
}

/** The PHY's receive chain, one stage at a time. */
export function dspChain({ start, end, at = [988, 250], color = C.accent, stages, title = 'PHY RECEIVE CHAIN', footer = null }) {
  return {
    id: `dsp:${title}`,
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 800;
      const p = k.local;
      heading(ctx, x0, y0, w, title, color, p);

      const bh = 66;
      const gap = 22;
      stages.forEach((s, i) => {
        const a = stagger(p, i, 0.62, 0.5);
        if (a <= 0.01) return;
        const y = y0 + 50 + i * (bh + gap);
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate((1 - easeOutQuint(a)) * 18, 0);
        const soft = s.soft;
        panel(ctx, x0, y, w, bh, { fill: soft ? 'rgba(10,12,15,0.7)' : C.panel, stroke: soft ? C.line : `${color}55`, accent: soft ? 'rgba(236,232,218,0.2)' : color, accentW: 3 });
        text(ctx, s.title, x0 + 22, y + bh / 2 + 1, { size: 26, weight: 700, color: soft ? C.inkDim : C.ink, baseline: 'middle', track: '0.3px' });
        if (s.sub) text(ctx, s.sub, x0 + w - 22, y + bh / 2 + 1, { size: 17, weight: 500, color: C.muted, baseline: 'middle', align: 'right', track: TRACK.wide });
        ctx.restore();
        if (i < stages.length - 1) {
          const a2 = stagger(p, i + 1, 0.62, 0.5);
          ctx.save();
          ctx.globalAlpha *= a2 * 0.85;
          arrow(ctx, x0 + 36, y + bh + 3, x0 + 36, y + bh + gap - 3, { color: `${color}88`, width: 1.6, head: 7 });
          ctx.restore();
        }
      });
      if (footer) {
        ctx.save();
        ctx.globalAlpha *= ramp(p, stages.length * 0.62 + 0.3, stages.length * 0.62 + 1.0);
        text(ctx, footer, x0, y0 + 50 + stages.length * (bh + gap) + 18, { size: 20, weight: 500, color: C.inkDim, track: TRACK.wide });
        ctx.restore();
      }
    },
  };
}

/** Hardware offloads: work that leaves the CPU and lands in silicon. */
export function offloadDiagram({ start, end, at = [988, 300], items, color = C.accent }) {
  return {
    id: 'offloads',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 800;
      const p = k.local;
      heading(ctx, x0, y0, w, 'HARDWARE OFFLOAD', color, p);

      const cpuY = y0 + 54;
      const nicY = y0 + 292;
      const bw = w;
      ctx.save();
      ctx.globalAlpha *= ramp(p, 0, 0.5);
      panel(ctx, x0, cpuY, bw, 62, { fill: 'rgba(10,12,15,0.72)', stroke: C.line });
      text(ctx, 'CPU', x0 + 22, cpuY + 32, { size: 24, weight: 700, color: 'rgba(152,161,171,0.8)', baseline: 'middle' });
      text(ctx, 'general-purpose cores', x0 + bw - 22, cpuY + 32, { size: 17, weight: 500, color: C.muted, align: 'right', baseline: 'middle', track: TRACK.wide });
      panel(ctx, x0, nicY, bw, 62, { fill: 'rgba(17,26,35,0.95)', stroke: `${color}88`, accent: color, accentW: 3 });
      text(ctx, 'NIC SILICON', x0 + 22, nicY + 32, { size: 24, weight: 700, color: C.ink, baseline: 'middle' });
      text(ctx, 'fixed-function, line rate', x0 + bw - 22, nicY + 32, { size: 17, weight: 500, color: C.muted, align: 'right', baseline: 'middle', track: TRACK.wide });
      ctx.restore();

      // Each task slides down out of the CPU into the NIC.
      const tw = (w - 2 * 20) / items.length;
      items.forEach((it, i) => {
        const a = stagger(p, i, 0.95, 0.5);
        if (a <= 0.01) return;
        const drop = easeInOut(clamp01((p - 0.6 - i * 0.95) / 1.25));
        const x = x0 + i * (tw + 20);
        const y = lerp(cpuY + 74, nicY - 74, drop);
        ctx.save();
        ctx.globalAlpha *= a;
        panel(ctx, x, y, tw, 58, { fill: 'rgba(14,20,27,0.94)', stroke: drop > 0.9 ? `${color}99` : C.lineStrong, accent: drop > 0.9 ? color : null, accentW: 2 });
        text(ctx, it, x + tw / 2, y + 30, { size: 21, weight: 600, color: drop > 0.9 ? C.ink : C.inkDim, align: 'center', baseline: 'middle', track: TRACK.wide });
        if (drop < 0.98) {
          arrow(ctx, x + tw / 2, y + 62, x + tw / 2, y + 86, { color: `${color}66`, width: 1.4, head: 6 });
        }
        ctx.restore();
      });
    },
  };
}

/** Recap figures: one small drawing per idea, four in a row. */
export function recapFigure({ start, end, at, kind, title, sub, color = C.accent, width = 372, height = 300 }) {
  return {
    id: `recap:${kind}`,
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.5,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const p = k.local;
      const rise = (1 - easeOutQuint(clamp01(p / 0.8))) * 18;
      ctx.save();
      ctx.translate(0, rise);
      panel(ctx, x0, y0, width, height, { fill: C.panel, stroke: `${color}44`, accent: color, accentW: 3 });
      text(ctx, title, x0 + 24, y0 + 48, { size: 34, weight: 700, color: C.ink, track: '0.3px' });
      text(ctx, sub, x0 + 24, y0 + 78, { size: 18, weight: 500, color: C.muted, track: TRACK.wide, maxWidth: width - 48 });

      const fx = x0 + 24;
      const fy = y0 + 118;
      const fw = width - 48;
      const fh = height - 142;
      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.5, 1.2);
      if (kind === 'rss') {
        // one NIC → N queues → N cores
        panel(ctx, fx, fy + fh / 2 - 20, 74, 40, { fill: 'rgba(17,26,35,0.95)', stroke: `${color}88` });
        text(ctx, 'NIC', fx + 37, fy + fh / 2 + 1, { size: 17, weight: 700, color: C.ink, align: 'center', baseline: 'middle' });
        for (let i = 0; i < 4; i++) {
          const qy = fy + 12 + i * ((fh - 24) / 3);
          line(ctx, [[fx + 74, fy + fh / 2], [fx + 104, qy]], { color: `${color}77`, width: 1.2 });
          panel(ctx, fx + 108, qy - 14, 62, 28, { fill: 'rgba(12,16,21,0.9)', stroke: `${color}55` });
          text(ctx, `Q${i}`, fx + 139, qy + 1, { size: 14, weight: 600, color, align: 'center', baseline: 'middle' });
          arrow(ctx, fx + 174, qy, fx + 204, qy, { color: `${color}88`, width: 1.2, head: 6 });
          panel(ctx, fx + 208, qy - 14, 82, 28, { fill: 'rgba(12,16,21,0.9)', stroke: C.line });
          text(ctx, `core ${i}`, fx + 249, qy + 1, { size: 14, weight: 600, color: C.muted, align: 'center', baseline: 'middle' });
        }
      } else if (kind === 'dma') {
        const by = fy + fh / 2 - 26;
        panel(ctx, fx, by, 128, 52, { fill: 'rgba(17,26,35,0.95)', stroke: `${color}88` });
        text(ctx, 'NIC', fx + 64, by + 27, { size: 18, weight: 700, color: C.ink, align: 'center', baseline: 'middle' });
        panel(ctx, fx + fw - 128, by, 128, 52, { fill: 'rgba(17,26,35,0.95)', stroke: `${color}88` });
        text(ctx, 'RAM', fx + fw - 64, by + 27, { size: 18, weight: 700, color: C.ink, align: 'center', baseline: 'middle' });
        arrow(ctx, fx + 136, by + 26, fx + fw - 136, by + 26, { color, width: 2.2, head: 10 });
        const u = (p * 0.55) % 1;
        const px = lerp(fx + 136, fx + fw - 136, easeInOut(u));
        glow(ctx, px, by + 26, 22, color, 0.7);
        ctx.fillStyle = C.ink;
        roundRect(ctx, px - 8, by + 21, 16, 10, 2);
        ctx.fill();
        text(ctx, 'CPU not involved', fx + fw / 2, by + 88, { size: 16, weight: 500, color: C.muted, align: 'center', track: TRACK.wide });
      } else if (kind === 'polling') {
        const cy = fy + fh / 2;
        panel(ctx, fx, cy - 30, 140, 60, { fill: 'rgba(17,26,35,0.95)', stroke: `${color}88` });
        text(ctx, 'WORKER', fx + 70, cy + 1, { size: 17, weight: 700, color: C.ink, align: 'center', baseline: 'middle' });
        const rr = 46;
        const rcx = fx + fw - 62;
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(rcx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        const ang = p * 1.8;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(rcx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 4.5, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, 'RING', rcx, cy + 1, { size: 14, weight: 600, color: C.muted, align: 'center', baseline: 'middle' });
        arrow(ctx, fx + 146, cy, rcx - rr - 10, cy, { color: `${color}88`, width: 1.4, head: 7 });
        text(ctx, 'no interrupt, no context switch', fx, cy + 82, { size: 16, weight: 500, color: C.muted, track: TRACK.wide });
      } else if (kind === 'offload') {
        const rows = ['checksum', 'segmentation', 'VLAN'];
        rows.forEach((r, i) => {
          const ry = fy + 16 + i * 46;
          const drop = easeInOut(clamp01((p - 0.9 - i * 0.35) / 1.0));
          text(ctx, 'CPU', fx, ry + 1, { size: 15, weight: 600, color: 'rgba(152,161,171,0.6)', baseline: 'middle' });
          text(ctx, 'NIC', fx + fw, ry + 1, { size: 15, weight: 600, color: drop > 0.9 ? color : 'rgba(152,161,171,0.6)', align: 'right', baseline: 'middle' });
          line(ctx, [[fx + 42, ry], [fx + fw - 42, ry]], { color: 'rgba(236,232,218,0.12)', width: 1, dash: [4, 5] });
          const px = lerp(fx + 52, fx + fw - 52, drop);
          panel(ctx, px - 56, ry - 13, 112, 26, { fill: 'rgba(14,20,27,0.96)', stroke: drop > 0.9 ? `${color}99` : C.lineStrong, r: 3 });
          text(ctx, r, px, ry + 1, { size: 14, weight: 600, color: drop > 0.9 ? C.ink : C.inkDim, align: 'center', baseline: 'middle' });
        });
      }
      ctx.restore();
      ctx.restore();
    },
  };
}
