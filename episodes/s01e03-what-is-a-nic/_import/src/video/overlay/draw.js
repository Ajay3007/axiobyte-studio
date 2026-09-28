import { C, F, font, TRACK } from './theme.js';

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - clamp01(t), 5);
export const easeInOut = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** 0 before a, 1 after b, smooth in between. */
export const ramp = (t, a, b) => smooth((t - a) / Math.max(1e-6, b - a));

/** Staggered reveal: item i of n starts `step` seconds after the one before. */
export const stagger = (local, i, step = 0.16, dur = 0.5) => smooth((local - i * step) / dur);

export function withAlpha(ctx, a, fn) {
  if (a <= 0.001) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  fn();
  ctx.globalAlpha = prev;
}

export function roundRect(ctx, x, y, w, h, r = 4) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Frosted technical panel: dark fill, hairline border, optional accent edge. */
export function panel(ctx, x, y, w, h, { r = 5, fill = C.panel, stroke = C.line, accent = null, accentW = 3 } = {}) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (accent) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, accentW, h);
    ctx.restore();
  }
}

export function text(ctx, str, x, y, { size = 26, weight = 500, color = C.ink, align = 'left', baseline = 'alphabetic', track = TRACK.normal, mono = false, maxWidth = null } = {}) {
  ctx.save();
  ctx.font = font(weight, size, mono);
  ctx.letterSpacing = track;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (maxWidth) ctx.fillText(str, x, y, maxWidth);
  else ctx.fillText(str, x, y);
  ctx.restore();
}

export function measure(ctx, str, { size = 26, weight = 500, track = TRACK.normal, mono = false } = {}) {
  ctx.save();
  ctx.font = font(weight, size, mono);
  ctx.letterSpacing = track;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Small uppercase tag, the workhorse label of the whole video. */
export function chip(ctx, str, x, y, { size = 20, color = C.accent, bg = 'rgba(110,193,255,0.10)', border = 'rgba(110,193,255,0.40)', padX = 12, padY = 7, mono = false, weight = 600, align = 'left' } = {}) {
  const tw = measure(ctx, str, { size, weight, track: TRACK.wide, mono });
  const w = tw + padX * 2;
  const h = size + padY * 2;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  roundRect(ctx, x0, y, w, h, 3);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, str, x0 + padX, y + h / 2 + 1, { size, weight, color, track: TRACK.wide, baseline: 'middle', mono });
  return { x: x0, y, w, h };
}

/** Horizontal rule that wipes in from the left. */
export function rule(ctx, x, y, w, progress = 1, { color = C.lineStrong, thickness = 1 } = {}) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp01(progress), thickness);
}

export function line(ctx, pts, { color = C.line, width = 1, dash = null } = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

export function arrowHead(ctx, x, y, angle, size = 9, color = C.accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.52);
  ctx.lineTo(-size, size * 0.52);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Straight arrow with an optional flowing dash pattern (offset is animated). */
export function arrow(ctx, x0, y0, x1, y1, { color = C.accent, width = 2, head = 10, dash = null, dashOffset = 0, headed = true } = {}) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const bx = x1 - Math.cos(a) * (headed ? head * 0.9 : 0);
  const by = y1 - Math.sin(a) * (headed ? head * 0.9 : 0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dash) {
    ctx.setLineDash(dash);
    ctx.lineDashOffset = dashOffset;
  }
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();
  if (headed) arrowHead(ctx, x1, y1, a, head, color);
}

/** Soft additive glow blob, used sparingly to lift focal points. */
export function glow(ctx, x, y, r, color = C.accent, alpha = 0.3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Leader line from a projected 3D point to a label anchor: elbow + dot. */
export function leader(ctx, from, to, { color = C.accent, progress = 1, dotR = 3.5 } = {}) {
  const p = clamp01(progress);
  const midX = to[0] < from[0] ? to[0] + 34 : to[0] - 34;
  const pts = [
    [from[0], from[1]],
    [lerp(from[0], midX, 0.62), lerp(from[1], to[1], 0.62)],
    [midX, to[1]],
    [to[0], to[1]],
  ];
  // Draw only the first `p` of the polyline length.
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d);
    total += d;
  }
  let want = total * p;
  const out = [pts[0]];
  for (let i = 0; i < segs.length; i++) {
    if (want <= 0) break;
    const k = Math.min(1, want / segs[i]);
    out.push([lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]);
    want -= segs[i];
  }
  line(ctx, out, { color, width: 1.25 });
  ctx.beginPath();
  ctx.arc(from[0], from[1], dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(from[0], from[1], dotR + 4 * (1 - p) + 4, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.4 * p;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha /= 0.4 * p || 1;
}

/** Wrap text into lines that fit `maxW`. */
export function wrap(ctx, str, maxW, opts) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(ctx, next, opts) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Clip-reveal a block of drawing with a left-to-right wipe. */
export function wipe(ctx, x, y, w, h, progress, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w * clamp01(progress), h);
  ctx.clip();
  fn();
  ctx.restore();
}

export { C, F, font, TRACK };
