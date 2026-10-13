import { roundRect, leader, wipe, easeOut, easeOutQuint, clamp01, ramp, stagger } from '@axiobyte/three/video/overlay/draw.js';
import { F } from '@axiobyte/three/video/overlay/theme.js';

/**
 * s01e02's annotation typography (episode-local): one hierarchy for every explanatory overlay, sized
 * for a phone. All sizes are pixels on the 1920×1080 frame — the overlay is screen-space, so a size
 * here IS its projected height; there is no world-space text to convert.
 *
 *   PRIMARY    the concept a card names            52 px bold, near-white
 *   SECONDARY  the items of a list (costs, "no…")  38 px bold, near-white
 *   SUPPORT    a card's one-line explanation       28 px medium, light (never mid-grey)
 *   CHAPTER    the chapter identifier              26 px, light, accent index
 *
 * Colour carries MEANING, light text carries READING: every readable string is near-white or light;
 * the semantic colour (copy red, DMA blue, pointer yellow, mbuf cyan, buffer violet) marks the card —
 * its accent bar, border, chip tint, leader and the chapter index — never the only readable ink.
 */
export const TYPE = {
  primary: { size: 52, weight: 700, track: 0.6 },
  secondary: { size: 38, weight: 700, track: 1.6 },
  support: { size: 28, weight: 500, track: 0.8 },
  chapter: { size: 26, weight: 700, track: 3.0 },
};
/** The mobile-safe minimums the hierarchy is held to (tests check every drawn string against them). */
export const MIN = { primary: 48, secondary: 34, support: 26 };

export const INK = { primary: '#F6F7FA', secondary: '#F1F4F8', support: '#D7DDE6', chapter: '#DCE2EA' };

/** The semantic accents (the film's colour roles), brightened for type-adjacent use. */
export const ACCENT = {
  copy: '#FF6B5E',
  dma: '#5DB4FF',
  pointer: '#F5D14F',
  mbuf: '#34D8E8',
  buffer: '#B79CFF',
  neutral: '#A9BCCF',
};

/** The card: a dark, nearly opaque plate with a shadow, a coloured edge and generous padding. */
export const CARD = { fill: 'rgba(8,10,14,0.9)', padX: 30, padY: 24, gap: 12, accentW: 7, border: 2, radius: 9, shadow: 'rgba(0,0,0,0.6)' };
/** A list item: a chip with a dark plate under a light tint of the accent. */
export const CHIP = { padX: 20, padY: 12, gap: 14, radius: 7, border: 2 };

const fontOf = (s) => `${s.weight} ${s.size}px ${F.display}`;

/**
 * Deterministic text width (px) for a style — Barlow Semi Condensed's advances, per character class,
 * rounded up; used for LAYOUT (placement, collision tests), so it never depends on a canvas. A browser
 * check (the typography QA) confirms every real measured width fits inside it.
 */
export function textWidth(str, s) {
  let em = 0;
  for (const ch of String(str)) {
    if (ch === ' ') em += 0.24;
    else if (/[A-Z]/.test(ch)) em += 'MW'.includes(ch) ? 0.78 : 'IJ'.includes(ch) ? 0.3 : 0.56;
    else if (/[a-z]/.test(ch)) em += 'mw'.includes(ch) ? 0.74 : 'ijlft'.includes(ch) ? 0.3 : 0.5;
    else if (/[0-9]/.test(ch)) em += 0.52;
    else if (ch === '→') em += 0.95;
    else if (ch === '–' || ch === '—') em += 0.7;
    else em += 0.32; // punctuation: · ’ . , : + _ ( )
  }
  const bold = s.weight >= 700 ? 1.04 : 1;
  return Math.ceil(em * s.size * bold + s.track * Math.max(0, [...String(str)].length - 1));
}

/** A title as its lines: a string, or an array of lines for a title set on two. */
export const titleLines = (title) => (Array.isArray(title) ? title : [title]);
/** The line advance of a multi-line title. */
const TITLE_LEADING = Math.round(TYPE.primary.size * 1.08);

/** A card's size for its text. */
export function cardSize(title, subtitle) {
  const lines = titleLines(title);
  const tw = Math.max(...lines.map((l) => textWidth(l, TYPE.primary)));
  const sw = subtitle ? textWidth(subtitle, TYPE.support) : 0;
  const w = Math.max(tw, sw) + CARD.padX * 2 + CARD.accentW;
  const h = CARD.padY * 2 + TYPE.primary.size + (lines.length - 1) * TITLE_LEADING + (subtitle ? CARD.gap + TYPE.support.size : 0);
  return { w, h };
}

/** A chip group's size: heading over a column of chips. */
export function groupSize(heading, items) {
  const chipH = TYPE.secondary.size + CHIP.padY * 2;
  const w = Math.max(textWidth(heading, TYPE.primary) + 18, ...items.map((s) => textWidth(s, TYPE.secondary) + CHIP.padX * 2));
  const h = TYPE.primary.size + 22 + items.length * chipH + (items.length - 1) * CHIP.gap;
  return { w, h, chipH };
}

function txt(ctx, str, x, y, s, color, baseline = 'alphabetic') {
  ctx.save();
  ctx.font = fontOf(s);
  ctx.letterSpacing = `${s.track}px`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/**
 * Draw a card with its top-left at (x, y), sized for its text, and (optionally) a leader from the
 * projected anchor `src` to the card's near edge. `k.local` drives the reveal.
 */
export function drawCard(ctx, k, { x, y, title, subtitle = null, accent, src = null, alignRight = false }) {
  const { w, h } = cardSize(title, subtitle);
  const p = easeOutQuint(clamp01(k.local / 0.55));
  if (src) {
    ctx.save();
    ctx.lineWidth = 2.5;
    leader(ctx, src, [alignRight ? x + w : x, y + h / 2], { color: accent, progress: p, dotR: 5 });
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= ramp(k.local, 0.06, 0.4);
  // The plate: shadowed, nearly opaque, with a semantic edge and border.
  ctx.save();
  ctx.shadowColor = CARD.shadow;
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, x, y, w, h, CARD.radius);
  ctx.fillStyle = CARD.fill;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, CARD.radius);
  ctx.strokeStyle = withAlphaHex(accent, 0.55);
  ctx.lineWidth = CARD.border;
  ctx.stroke();
  ctx.save();
  roundRect(ctx, x, y, w, h, CARD.radius);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, CARD.accentW, h);
  ctx.restore();
  wipe(ctx, x, y, w, h, easeOut(clamp01((k.local - 0.08) / 0.5)), () => {
    const tx = x + CARD.accentW + CARD.padX;
    const lines = titleLines(title);
    lines.forEach((l, i) => txt(ctx, l, tx, y + CARD.padY + TYPE.primary.size * 0.86 + i * TITLE_LEADING, TYPE.primary, INK.primary));
    const below = y + CARD.padY + TYPE.primary.size + (lines.length - 1) * TITLE_LEADING;
    if (subtitle) txt(ctx, subtitle, tx, below + CARD.gap + TYPE.support.size * 0.84, TYPE.support, INK.support);
  });
  ctx.restore();
  return { w, h };
}

/** Draw a chip group — a heading with an accent underline, then the items, each revealed on its beat. */
export function drawGroup(ctx, k, { x, y, heading, items, accent, step }) {
  const { chipH } = groupSize(heading, items);
  const a = ramp(k.local, 0, 0.45);
  ctx.save();
  ctx.globalAlpha *= a;
  // The heading sits on its own dark plate so it reads on any floor.
  const hw = textWidth(heading, TYPE.primary) + 18;
  ctx.save();
  ctx.shadowColor = CARD.shadow;
  ctx.shadowBlur = 22;
  roundRect(ctx, x - 12, y - 8, hw + 12, TYPE.primary.size + 26, CARD.radius);
  ctx.fillStyle = CARD.fill;
  ctx.fill();
  ctx.restore();
  txt(ctx, heading, x, y + TYPE.primary.size * 0.86, TYPE.primary, INK.primary);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y + TYPE.primary.size + 6, Math.min(hw - 18, 140), 5);
  ctx.restore();
  items.forEach((label, i) => {
    const r = stagger(k.local, i, step, 0.45);
    if (r <= 0.01) return;
    const cy = y + TYPE.primary.size + 22 + i * (chipH + CHIP.gap);
    const cw = textWidth(label, TYPE.secondary) + CHIP.padX * 2;
    ctx.save();
    ctx.globalAlpha *= r;
    ctx.translate((1 - r) * -14, 0);
    ctx.save();
    ctx.shadowColor = CARD.shadow;
    ctx.shadowBlur = 18;
    roundRect(ctx, x, cy, cw, chipH, CHIP.radius);
    ctx.fillStyle = CARD.fill;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x, cy, cw, chipH, CHIP.radius);
    ctx.fillStyle = withAlphaHex(accent, 0.2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = CHIP.border;
    ctx.stroke();
    txt(ctx, label, x + CHIP.padX, cy + chipH / 2 + 2, TYPE.secondary, INK.secondary, 'middle');
    ctx.restore();
  });
}

/** A single tag's size: one secondary-size label on a chip (the same chip as a group's items). */
export function tagSize(label) {
  return { w: textWidth(label, TYPE.secondary) + CHIP.padX * 2, h: TYPE.secondary.size + CHIP.padY * 2 };
}

/** Draw a single tag — a name for something on screen (sentences 24–30's processing stages). */
export function drawTag(ctx, k, { x, y, label, accent }) {
  const { w, h } = tagSize(label);
  const r = ramp(k.local, 0, 0.45);
  ctx.save();
  ctx.globalAlpha *= r;
  ctx.translate(0, (1 - r) * 10);
  ctx.save();
  ctx.shadowColor = CARD.shadow;
  ctx.shadowBlur = 18;
  roundRect(ctx, x, y, w, h, CHIP.radius);
  ctx.fillStyle = CARD.fill;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, CHIP.radius);
  ctx.fillStyle = withAlphaHex(accent, 0.2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = CHIP.border;
  ctx.stroke();
  txt(ctx, label, x + CHIP.padX, y + h / 2 + 2, TYPE.secondary, INK.secondary, 'middle');
  ctx.restore();
}

/** The chapter identifier: an accent index, a rule, and a light label. */
export function drawChapter(ctx, { x, y, index, label, accent }) {
  const s = TYPE.chapter;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 10;
  txt(ctx, index, x, y, s, accent, 'middle');
  const iw = textWidth(index, s);
  ctx.fillStyle = 'rgba(220,226,234,0.5)';
  ctx.fillRect(x + iw + 12, y - 11, 2, 22);
  txt(ctx, label, x + iw + 26, y, { ...s, weight: 600 }, INK.chapter, 'middle');
  ctx.restore();
}
export const chapterWidth = (index, label) => textWidth(index, TYPE.chapter) + 26 + textWidth(label, { ...TYPE.chapter, weight: 600 });

function withAlphaHex(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
