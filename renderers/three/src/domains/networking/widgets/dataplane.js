import { C, LAYER, TRACK } from '../../../video/overlay/theme.js';
import { text, measure, panel, roundRect, arrow, line, glow, leader, clamp01, lerp, easeOut, easeOutQuint, easeInOut, ramp, stagger, smooth } from '../../../video/overlay/draw.js';

/** Reveal factor for an element scheduled `delay` seconds into a cue. */
const smoothAt = (local, delay, dur = 0.5) => smooth((local - delay) / dur);

const box = (ctx, x, y, w, h, { title, sub = null, color = C.accent, active = false, titleSize = 26, mono = false }) => {
  panel(ctx, x, y, w, h, {
    fill: active ? 'rgba(17,26,35,0.95)' : C.panel,
    stroke: active ? `${color}99` : C.line,
    accent: active ? color : null,
    accentW: 3,
  });
  text(ctx, title, x + w / 2, y + (sub ? h / 2 - 9 : h / 2 + 1), {
    size: titleSize,
    weight: 700,
    color: active ? C.ink : C.inkDim,
    align: 'center',
    baseline: 'middle',
    track: '0.3px',
    mono,
  });
  if (sub) text(ctx, sub, x + w / 2, y + h / 2 + 20, { size: 17, weight: 500, color: C.muted, align: 'center', baseline: 'middle', track: TRACK.wide });
};

/**
 * Receive-side scaling, shown as it actually works: header fields feed a hash,
 * the hash picks one of N queues, and the same flow lands in the same queue
 * every time.
 */
export function rssDiagram({ start, end, at = [988, 168], queues = 8, selected = 3, color = C.accent, footerAt = 4.2 }) {
  const fields = ['SRC IP', 'DST IP', 'SRC PORT', 'DST PORT'];
  return {
    id: 'rss',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 800;
      const p = k.local;

      text(ctx, 'RSS · RECEIVE-SIDE SCALING', x0, y0, { size: 18, weight: 700, color, track: TRACK.xwide });
      ctx.fillStyle = C.line;
      ctx.fillRect(x0, y0 + 16, w * easeOut(clamp01(p / 0.8)), 1);

      // Packet header fields.
      const fy = y0 + 54;
      const fw = (w - 3 * 14) / 4;
      fields.forEach((f, i) => {
        const a = stagger(p, i, 0.22, 0.4);
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalAlpha *= a;
        box(ctx, x0 + i * (fw + 14), fy, fw, 58, { title: f, color, active: p > 1.3, titleSize: 19 });
        ctx.restore();
      });
      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.1, 0.5);
      text(ctx, 'PACKET HEADER', x0 + w, y0 + 40, { size: 15, weight: 600, color: C.muted, track: TRACK.wide, align: 'right' });
      ctx.restore();

      // Hash engine.
      const hy = fy + 118;
      const hw = 300;
      const hx = x0 + (w - hw) / 2;
      const hashIn = ramp(p, 1.1, 1.9);
      ctx.save();
      ctx.globalAlpha *= hashIn;
      for (let i = 0; i < 4; i++) {
        const sx = x0 + i * (fw + 14) + fw / 2;
        line(ctx, [[sx, fy + 58], [sx, fy + 82], [hx + hw / 2, fy + 82], [hx + hw / 2, hy]], { color: `${color}66`, width: 1.2 });
      }
      box(ctx, hx, hy, hw, 74, { title: 'HASH', sub: 'over the IP + port 4-tuple', color, active: p > 1.9 });
      ctx.restore();

      // Rolling hash value, frozen once the "same flow, same hash" beat lands.
      if (p > 2.0) {
        const frozen = p > 3.2;
        const seed = frozen ? 0x7c3a : Math.floor(p * 37) * 2654435761;
        const hex = frozen ? '0x7C3A91D5' : `0x${((seed >>> 0) % 0xffffffff).toString(16).toUpperCase().padStart(8, '0').slice(0, 8)}`;
        ctx.save();
        ctx.globalAlpha *= ramp(p, 2.0, 2.4);
        text(ctx, hex, hx + hw + 22, hy + 42, { size: 24, weight: 500, color: frozen ? color : C.muted, mono: true });
        ctx.restore();
      }

      // Queue fan-out.
      const qy = hy + 150;
      const qw = (w - (queues - 1) * 12) / queues;
      const qIn = ramp(p, 2.4, 3.2);
      ctx.save();
      ctx.globalAlpha *= qIn;
      for (let i = 0; i < queues; i++) {
        const qx = x0 + i * (qw + 12);
        line(ctx, [[hx + hw / 2, hy + 74], [hx + hw / 2, hy + 104], [qx + qw / 2, hy + 104], [qx + qw / 2, qy]], {
          color: i === selected ? `${color}AA` : 'rgba(236,232,218,0.10)',
          width: i === selected ? 1.6 : 1,
        });
      }
      // The chosen queue re-flashes on every repeat, showing determinism.
      const cyclePhase = p > 3.4 ? ((p - 3.4) % 3.1) / 3.1 : -1;
      for (let i = 0; i < queues; i++) {
        const qx = x0 + i * (qw + 12);
        const hit = i === selected && (p > 3.4 ? cyclePhase > 0.32 : p > 3.0);
        const depth = hit ? 1 : 0;
        panel(ctx, qx, qy, qw, 84, { fill: hit ? 'rgba(20,34,46,0.95)' : C.panel, stroke: hit ? color : C.line, accent: null });
        if (hit) {
          ctx.fillStyle = `${color}33`;
          ctx.fillRect(qx + 1, qy + 84 - 40 * depth, qw - 2, 40 * depth);
          glow(ctx, qx + qw / 2, qy + 42, 64, color, 0.35);
        }
        text(ctx, `Q${i}`, qx + qw / 2, qy + 34, { size: 22, weight: 700, color: hit ? C.ink : C.muted, align: 'center' });
        text(ctx, hit ? 'core ' + i : '—', qx + qw / 2, qy + 62, { size: 14, weight: 500, color: hit ? color : 'rgba(152,161,171,0.5)', align: 'center' });
      }
      ctx.restore();

      // The travelling packet that makes the path legible.
      if (p > 3.4) {
        const u = ((p - 3.4) % 3.1) / 3.1;
        const sx = x0 + 1.5 * (fw + 14) + fw / 2;
        const qx = x0 + selected * (qw + 12) + qw / 2;
        let px;
        let py;
        if (u < 0.32) {
          const t = easeInOut(u / 0.32);
          px = lerp(sx, hx + hw / 2, t);
          py = lerp(fy + 58, hy, t);
        } else if (u < 0.44) {
          px = hx + hw / 2;
          py = hy + 37;
        } else {
          const t = easeInOut(clamp01((u - 0.44) / 0.34));
          px = lerp(hx + hw / 2, qx, t);
          py = lerp(hy + 74, qy, t);
        }
        if (u < 0.86) {
          glow(ctx, px, py, 26, color, 0.75);
          ctx.fillStyle = C.ink;
          roundRect(ctx, px - 9, py - 5, 18, 10, 2);
          ctx.fill();
        }
      }

      ctx.save();
      ctx.globalAlpha *= ramp(p, footerAt, footerAt + 0.8);
      text(ctx, 'same flow  →  same hash  →  same queue', x0, qy + 122, { size: 21, weight: 600, color: C.inkDim, track: TRACK.wide });
      ctx.restore();
    },
  };
}

/** DMA: the controller writes host memory itself. The CPU is explicitly out of the path. */
export function dmaDiagram({ start, end, at = [988, 262], color = C.accent }) {
  return {
    id: 'dma',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 800;
      const p = k.local;
      const bw = 290;
      const bh = 116;
      const rx = x0 + w - bw;

      text(ctx, 'DIRECT MEMORY ACCESS', x0, y0, { size: 18, weight: 700, color, track: TRACK.xwide });
      ctx.fillStyle = C.line;
      ctx.fillRect(x0, y0 + 16, w * easeOut(clamp01(p / 0.8)), 1);

      const by = y0 + 54;
      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.1, 0.55);
      box(ctx, x0, by, bw, bh, { title: 'NIC CONTROLLER', sub: 'bus master', color, active: true, titleSize: 24 });
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.35, 0.85);
      box(ctx, rx, by, bw, bh, { title: 'HOST RAM', sub: 'rx packet buffer', color, active: p > 1.4, titleSize: 24 });
      ctx.restore();

      // The DMA write itself.
      ctx.save();
      ctx.globalAlpha *= ramp(p, 0.8, 1.3);
      const ay = by + bh / 2;
      arrow(ctx, x0 + bw + 16, ay, rx - 16, ay, { color, width: 2.5, head: 12 });
      text(ctx, 'DMA WRITE', (x0 + bw + rx) / 2, ay - 22, { size: 20, weight: 700, color, track: TRACK.wide, align: 'center' });
      text(ctx, 'over PCIe · no CPU copy', (x0 + bw + rx) / 2, ay + 34, { size: 16, weight: 500, color: C.muted, track: TRACK.wide, align: 'center' });
      if (p > 1.3) {
        const u = ((p - 1.3) % 1.9) / 1.9;
        const px = lerp(x0 + bw + 16, rx - 16, easeInOut(u));
        glow(ctx, px, ay, 30, color, 0.8);
        ctx.fillStyle = C.ink;
        roundRect(ctx, px - 11, ay - 6, 22, 12, 2);
        ctx.fill();
      }
      ctx.restore();

      // The CPU: it does not copy the bytes (the struck-out tie) — it processes the packet after.
      ctx.save();
      ctx.globalAlpha *= ramp(p, 2.0, 2.7);
      const cw = 300;
      const cx = x0 + (w - cw) / 2;
      const cy = by + bh + 92;
      panel(ctx, cx, cy, cw, 78, { fill: 'rgba(10,12,15,0.72)', stroke: 'rgba(236,232,218,0.14)' });
      text(ctx, 'CPU', cx + cw / 2, cy + 32, { size: 26, weight: 700, color: 'rgba(152,161,171,0.72)', align: 'center' });
      text(ctx, 'no byte copy · processes after', cx + cw / 2, cy + 58, { size: 16, weight: 500, color: 'rgba(152,161,171,0.55)', align: 'center', track: TRACK.wide });
      line(ctx, [[cx + cw / 2, cy], [cx + cw / 2, ay + bh / 2 - 8]], { color: 'rgba(236,232,218,0.16)', width: 1, dash: [5, 6] });
      const strike = easeOut(clamp01((p - 2.6) / 0.6));
      if (strike > 0) {
        const mx = cx + cw / 2;
        const my = (cy + ay + bh / 2) / 2 - 6;
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx - 13 * strike, my - 13 * strike);
        ctx.lineTo(mx + 13 * strike, my + 13 * strike);
        ctx.moveTo(mx + 13 * strike, my - 13 * strike);
        ctx.lineTo(mx - 13 * strike, my + 13 * strike);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}

/**
 * The descriptor ring as a real ring: slots advance through
 * FREE → DMA WRITING → DONE → CONSUMED behind two moving pointers.
 */
export function descriptorRing({ start, end, at = [1400, 520], radius = 188, slots = 16, color = C.accent, rate = 0.9 }) {
  const STATE = [
    { key: 'FREE', fill: 'rgba(12,15,19,0.85)', stroke: 'rgba(236,232,218,0.20)', ink: C.muted },
    { key: 'DMA WRITING', fill: 'rgba(110,193,255,0.30)', stroke: '#6EC1FF', ink: C.ink },
    { key: 'DONE', fill: 'rgba(92,255,138,0.22)', stroke: '#5CFF8A', ink: C.ink },
    { key: 'CONSUMED', fill: 'rgba(236,232,218,0.05)', stroke: 'rgba(236,232,218,0.14)', ink: 'rgba(152,161,171,0.6)' },
  ];
  return {
    id: 'descriptor-ring',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.6,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [cx, cy] = at;
      const p = k.local;
      const head = p * rate; // NIC write pointer, in slots
      const tail = Math.max(0, head - 4.2); // software consume pointer

      const appear = easeOutQuint(clamp01(p / 0.9));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.86 + 0.14 * appear, 0.86 + 0.14 * appear);

      ctx.strokeStyle = 'rgba(236,232,218,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < slots; i++) {
        const reveal = stagger(p, i, 0.035, 0.35);
        if (reveal <= 0.01) continue;
        const ang = (i / slots) * Math.PI * 2 - Math.PI / 2;
        const sx = Math.cos(ang) * radius;
        const sy = Math.sin(ang) * radius;

        // Where this slot is in the cycle relative to the moving head.
        const d = ((i - head) % slots + slots) % slots;
        let st = 0;
        if (d < 0.001 || d > slots - 0.6) st = 1;
        else if (d > slots - 4.4) st = 2;
        else if (d > slots - 6.2) st = 3;
        const S = STATE[st];

        ctx.save();
        ctx.globalAlpha *= reveal;
        ctx.translate(sx, sy);
        ctx.rotate(ang + Math.PI / 2);
        roundRect(ctx, -25, -15, 50, 30, 3);
        ctx.fillStyle = S.fill;
        ctx.fill();
        ctx.strokeStyle = S.stroke;
        ctx.lineWidth = st === 1 ? 1.8 : 1;
        ctx.stroke();
        if (st === 1) {
          ctx.rotate(-(ang + Math.PI / 2));
          glow(ctx, 0, 0, 52, color, 0.5);
          ctx.rotate(ang + Math.PI / 2);
        }
        text(ctx, String(i).padStart(2, '0'), 0, 1, { size: 14, weight: 600, color: S.ink, align: 'center', baseline: 'middle' });
        ctx.restore();
      }

      // Pointers.
      const drawPtr = (slot, label, col) => {
        const ang = (slot / slots) * Math.PI * 2 - Math.PI / 2;
        const r0 = radius - 46;
        const r1 = radius - 26;
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
        ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.stroke();
        text(ctx, label, Math.cos(ang) * (r0 - 20), Math.sin(ang) * (r0 - 20), { size: 14, weight: 700, color: col, align: 'center', baseline: 'middle', track: TRACK.wide });
        ctx.restore();
      };
      ctx.save();
      ctx.globalAlpha *= ramp(p, 1.1, 1.8);
      drawPtr(head, 'NIC', color);
      drawPtr(tail, 'SW', C.green);
      ctx.restore();

      text(ctx, 'DESCRIPTOR', 0, -12, { size: 24, weight: 700, color: C.ink, align: 'center', baseline: 'middle', track: TRACK.wide });
      text(ctx, 'RING', 0, 16, { size: 24, weight: 700, color: C.ink, align: 'center', baseline: 'middle', track: TRACK.wide });
      text(ctx, `${slots} slots`, 0, 44, { size: 15, weight: 500, color: C.muted, align: 'center', baseline: 'middle', track: TRACK.wide });
      ctx.restore();

      // Legend.
      ctx.save();
      ctx.globalAlpha *= ramp(p, 1.6, 2.3);
      STATE.forEach((S, i) => {
        const ly = cy + radius + 46 + i * 26;
        const lx = cx - radius + 8;
        roundRect(ctx, lx, ly - 9, 16, 16, 2);
        ctx.fillStyle = S.fill;
        ctx.fill();
        ctx.strokeStyle = S.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
        text(ctx, S.key, lx + 26, ly, { size: 16, weight: 600, color: C.muted, track: TRACK.wide, baseline: 'middle' });
      });
      ctx.restore();
    },
  };
}

/**
 * Where the hardware ring meets the DPDK poll-mode driver.
 *
 * `timing` (optional, seconds after `start`, like rssDiagram's `footerAt` and archStack's
 * `delays`) lets each part arrive on the word that names it rather than all at once:
 *   { nodes: [t0, t1, t2, t3], poll, mbufs, mempool }
 * Any field left out keeps its default; without `timing` the diagram builds exactly as before.
 */
export function dpdkDiagram({ start, end, at = [980, 210], color = C.accent, width = 810, timing = null }) {
  const nodes = [
    { title: 'NIC · DMA', sub: 'writes the buffer, marks it done' },
    { title: 'DESCRIPTOR RING', sub: 'host memory' },
    { title: 'DPDK WORKER', sub: 'CPU core · polls the ring' },
    { title: 'APPLICATION', sub: 'your packet logic' },
  ];
  return {
    id: 'dpdk',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.55,
    fadeOut: 0.6,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = width;
      const p = k.local;
      const bw = w;
      const bh = 82;
      const gap = 40;

      text(ctx, 'USER-SPACE DATAPLANE', x0, y0, { size: 18, weight: 700, color, track: TRACK.xwide });
      ctx.fillStyle = C.line;
      ctx.fillRect(x0, y0 + 16, w * easeOut(clamp01(p / 0.8)), 1);

      const nodeAlpha = (i) => (timing?.nodes ? smoothAt(p, timing.nodes[i], 0.5) : stagger(p, i, 0.55, 0.5));
      nodes.forEach((n, i) => {
        const a = nodeAlpha(i);
        if (a <= 0.01) return;
        const y = y0 + 52 + i * (bh + gap);
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(0, (1 - easeOutQuint(a)) * 14);
        box(ctx, x0, y, bw, bh, { title: n.title, sub: n.sub, color, active: true, titleSize: 27 });
        ctx.restore();
        if (i < nodes.length - 1) {
          const a2 = nodeAlpha(i + 1);
          ctx.save();
          ctx.globalAlpha *= a2;
          arrow(ctx, x0 + bw / 2, y + bh + 6, x0 + bw / 2, y + bh + gap - 6, { color: `${color}AA`, width: 2, head: 9 });
          ctx.restore();
        }
      });

      // The poll loop drawn as a returning arc on the worker box.
      const workerY = y0 + 52 + 2 * (bh + gap);
      ctx.save();
      const pollAt = timing?.poll ?? 2.0;
      ctx.globalAlpha *= ramp(p, pollAt, pollAt + 0.7);
      ctx.strokeStyle = `${color}88`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0 + bw - 8, workerY + 20);
      ctx.bezierCurveTo(x0 + bw + 46, workerY + 6, x0 + bw + 46, y0 + 52 + bh + gap + 20, x0 + bw - 8, y0 + 52 + bh + 26);
      ctx.stroke();
      text(ctx, 'poll', x0 + bw + 14, (workerY + y0 + 52 + bh) / 2 + 12, { size: 15, weight: 600, color, track: TRACK.wide });
      ctx.restore();

      // Mempool feeding mbufs into the worker. The mbufs and the pool they come from can
      // arrive separately (timing.mbufs, timing.mempool); by default they arrive together.
      ctx.save();
      const base = ctx.globalAlpha;
      const mempoolAt = timing?.mempool ?? 3.0;
      const mbufsAt = timing?.mbufs ?? 3.0;
      ctx.globalAlpha = base * ramp(p, mempoolAt, mempoolAt + 0.8);
      const mx = x0 - 236;
      const my = workerY - 12;
      panel(ctx, mx, my, 210, 104, { fill: C.panel, stroke: C.line, accent: C.violet, accentW: 3 });
      text(ctx, 'MEMPOOL', mx + 20, my + 36, { size: 24, weight: 700, color: C.ink });
      text(ctx, 'pre-allocated mbufs', mx + 20, my + 64, { size: 16, weight: 500, color: C.muted, track: TRACK.wide });
      ctx.globalAlpha = base * ramp(p, mbufsAt, mbufsAt + 0.8);
      for (let i = 0; i < 5; i++) {
        const u = ((p * 0.5 + i * 0.2) % 1);
        const bx = lerp(mx + 210, x0, easeInOut(u));
        ctx.globalAlpha *= 0.9;
        ctx.fillStyle = C.violet;
        roundRect(ctx, bx - 7, my + 86 - 4, 14, 8, 2);
        ctx.fill();
        ctx.globalAlpha /= 0.9;
      }
      text(ctx, 'mbuf', mx + 234, my + 104, { size: 15, weight: 600, color: C.violet, track: TRACK.wide });
      ctx.restore();
    },
  };
}

/** RX and TX side by side: the same pipeline, mirrored. */
export function comparison({ start, end, at = [200, 360], rows, width = 1520 }) {
  return {
    id: 'rx-tx-comparison',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.6,
    fadeOut: 0.7,
    draw(ctx, k) {
      const [x0, y0] = at;
      const p = k.local;
      rows.forEach((row, r) => {
        const y = y0 + r * 150;
        const rowIn = ramp(p, r * 1.1, r * 1.1 + 0.6);
        ctx.save();
        ctx.globalAlpha *= rowIn;
        text(ctx, row.label, x0, y + 6, { size: 42, weight: 700, color: row.color, track: TRACK.wide });
        ctx.fillStyle = row.color;
        ctx.fillRect(x0, y + 22, 78, 2);

        const sx = x0 + 132;
        const n = row.stages.length;
        const cellW = (width - 132) / n;
        row.stages.forEach((s, i) => {
          const a = stagger(p - r * 1.1, i, 0.13, 0.4);
          if (a <= 0.01) return;
          ctx.save();
          ctx.globalAlpha *= a;
          const cx = sx + i * cellW;
          text(ctx, s, cx, y, { size: 24, weight: 600, color: C.ink, track: '0.3px' });
          if (i < n - 1) {
            const tw = measure(ctx, s, { size: 24, weight: 600, track: '0.3px' });
            arrow(ctx, cx + tw + 14, y - 8, cx + cellW - 14, y - 8, { color: `${row.color}99`, width: 1.6, head: 8 });
          }
          ctx.restore();
        });
        ctx.restore();
      });
    },
  };
}

/** The whole system, top to bottom, as the outro names each layer. */
export function archStack({ start, end, at = [1240, 132], layers, color = C.accent, step = 1.05, delays = null }) {
  return {
    id: 'arch-stack',
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.6,
    fadeOut: 0.9,
    draw(ctx, k) {
      const [x0, y0] = at;
      const w = 500;
      const h = 74;
      const gap = 21;
      const p = k.local;

      text(ctx, 'THE WHOLE PATH', x0, y0 - 24, { size: 18, weight: 700, color, track: TRACK.xwide });

      const delayOf = (i) => (delays ? delays[i] : i * step);
      layers.forEach((l, i) => {
        const a = smoothAt(p, delayOf(i), 0.6);
        if (a <= 0.01) return;
        const y = y0 + i * (h + gap);
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate((1 - easeOutQuint(a)) * 24, 0);
        const soft = l.kind === 'sw';
        panel(ctx, x0, y, w, h, {
          fill: soft ? 'rgba(20,18,30,0.86)' : C.panel,
          stroke: soft ? 'rgba(176,155,255,0.34)' : `${color}44`,
          accent: soft ? C.violet : color,
          accentW: 3,
        });
        text(ctx, l.title, x0 + 22, y + (l.sub ? 32 : h / 2 + 1), { size: 27, weight: 700, color: C.ink, track: '0.3px', baseline: l.sub ? 'alphabetic' : 'middle' });
        if (l.sub) text(ctx, l.sub, x0 + 22, y + 58, { size: 17, weight: 500, color: C.muted, track: TRACK.wide });
        ctx.restore();
        if (i < layers.length - 1) {
          const a2 = Math.min(a, smoothAt(p, delayOf(i + 1), 0.6));
          ctx.save();
          ctx.globalAlpha *= a2 * 0.8;
          arrow(ctx, x0 + w / 2, y + h + 3, x0 + w / 2, y + h + gap - 3, { color: `${color}88`, width: 1.6, head: 7 });
          ctx.restore();
        }
      });
    },
  };
}

/**
 * Marks a region of the diagram column as the HOST side and ties it to the card:
 * a violet frame (memory's colour) with its label, and a gold PCIe · DMA leader
 * from the card's edge connector — projected from 3D every frame — to the frame.
 * The diagrams inside it (descriptor ring, DPDK) then read as what they are:
 * structures in host memory, reached from the NIC only across PCIe.
 *
 *   hostFrame({ start, end, rect: [x, y, w, h], label: 'HOST MEMORY' })
 */
export function hostFrame({ start, end, rect, label = 'HOST MEMORY', from = { id: 'pcie-connector', name: 'out' }, leaderUntil = null }) {
  const [x, y, w, h] = rect;
  return {
    id: `host-frame:${label}`,
    start,
    end,
    layer: LAYER.diagram,
    fadeIn: 0.5,
    fadeOut: 0.4,
    draw(ctx, k) {
      const p = easeOutQuint(clamp01(k.local / 0.8));
      // PCIe · DMA: from the connector on the card to the host frame's left edge. `leaderUntil`
      // (absolute seconds) fades the link out early, for when something else will cover the
      // connector — a leader into a hidden connector would appear to point at whatever covers it.
      const src = k.project(from.id, from.name ?? 'center');
      const dst = [x, y + Math.min(h - 40, 150)];
      const linkAlpha = leaderUntil == null ? 1 : 1 - ramp(k.local, leaderUntil - start - 0.4, leaderUntil - start);
      if (src && linkAlpha > 0) {
        ctx.save();
        ctx.globalAlpha *= linkAlpha;
        leader(ctx, src, dst, { color: C.gold, progress: p, dotR: 4.5 });
        if (p > 0.7) {
          ctx.save();
          ctx.globalAlpha *= ramp(p, 0.7, 1);
          const tag = 'PCIe · DMA';
          const tw = measure(ctx, tag, { size: 18, weight: 700, track: TRACK.wide });
          const tx = dst[0] - 34 - tw - 26;
          panel(ctx, tx, dst[1] - 44, tw + 20, 30, { fill: C.panelSolid, stroke: 'rgba(240,192,96,0.45)' });
          text(ctx, tag, tx + 10, dst[1] - 23, { size: 18, weight: 700, color: C.gold, track: TRACK.wide });
          ctx.restore();
        }
        ctx.restore();
      }
      // The host region itself.
      ctx.save();
      ctx.globalAlpha *= ramp(k.local, 0.1, 0.5);
      ctx.strokeStyle = 'rgba(176,155,255,0.62)';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 6);
      ctx.stroke();
      const lw = measure(ctx, label, { size: 18, weight: 700, track: TRACK.xwide });
      panel(ctx, x + 18, y - 16, lw + 24, 32, { fill: C.panelSolid, stroke: 'rgba(176,155,255,0.62)' });
      text(ctx, label, x + 30, y + 6, { size: 18, weight: 700, color: C.violet, track: TRACK.xwide });
      ctx.restore();
    },
  };
}
