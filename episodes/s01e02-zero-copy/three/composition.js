import * as THREE from 'three';
import { easeOut } from '@axiobyte/three/video/overlay/draw.js';
import { ACCENT, cardSize, chapterWidth, drawCard, drawChapter, drawGroup, drawTag, groupSize, tagSize, titleLines } from './typography.js';
import { C, LAYER, SAFE, W, H } from '@axiobyte/three/video/overlay/theme.js';

/**
 * s01e02's composition rule (episode-local presentation, sentences 5–12):
 *
 *   PHYSICAL ASSETS OWN THEIR SPACE. EXPLANATORY GRAPHICS OWN NEGATIVE SPACE.
 *
 * An annotation is not pinned to a fixed spot on the screen, where whatever the camera happens to put
 * there (usually the NIC, which stands upstage of everything) ends up underneath it. It is pinned to
 * an ANNOTATION ZONE: a point on EMPTY FLOOR, derived from the assets' own footprints, so the card
 * sits in the negative space the shot composes around the hardware and follows that space as the
 * camera moves. The zones are presentation markers — never part of an asset, never registered as one.
 */

/** Clearance (world units) a zone keeps from every asset footprint. */
export const ZONE_CLEARANCE = 1.2;

/**
 * The zones, from the assets' world boxes:
 *  - `cpu_side`: the open floor upstage-right of the CPU, past the NIC's right end and behind the
 *    copies' run line — beside the processing the copies stop at.
 *  - `upstage_right`: the open floor right of the NIC and behind the application — the largest
 *    negative space of the wide shots.
 *  - `left`: the floor left of the DMA's descent, in front of the NIC's bracket end and behind the
 *    (not yet arrived) mbuf.
 *  - `before_a`: the floor between the NIC's front edge and buffer A.
 */
export function annotationZones(boxes) {
  const { nic, cpu, bufferA, app } = boxes;
  const floor = cpu.min.y;
  const runZ = (cpu.min.z + cpu.max.z) / 2;
  return {
    // Upstage-right of the CPU: open floor past the NIC's right end (nothing stands there), well
    // behind the copies' run line — which floats at the routing height, so on screen it sits further
    // upstage than its floor position; a card centred here clears both.
    'e02.zone.cpu_side': new THREE.Vector3(Math.max(cpu.max.x, nic.max.x) + 4.6, floor, Math.min(nic.max.z - 1.0, runZ - 3.8)),
    'e02.zone.upstage_right': new THREE.Vector3(nic.max.x + 3.2, floor, Math.min(nic.max.z - 4.0, app.min.z - 6)),
    'e02.zone.left': new THREE.Vector3(bufferA.min.x - 3.0, floor, nic.max.z + 3.2),
    // The floor between the NIC's front edge and buffer A, over A's middle: sentence 10's reference.
    'e02.zone.before_a': new THREE.Vector3((bufferA.min.x + bufferA.max.x) / 2, floor, (nic.max.z + bufferA.min.z) / 2),
  };
}

/**
 * Sentences 13–16's zones (the mbuf and its reference), on the same rule:
 *  - `behind_mbuf`: the floor upstage of the mbuf — empty until the Mempool arrives in sentence 17.
 *  - `below_ref`: the floor downstage of the gap between the mbuf and buffer A, under the reference.
 */
export function referenceZones(boxes) {
  const { mbuf, bufferA } = boxes;
  const floor = bufferA.min.y;
  return {
    'e02.zone.behind_mbuf': new THREE.Vector3((mbuf.min.x + mbuf.max.x) / 2, floor, mbuf.min.z - 1.8),
    'e02.zone.below_ref': new THREE.Vector3((mbuf.max.x + bufferA.min.x) / 2, floor, Math.max(mbuf.max.z, bufferA.max.z) + 1.4),
  };
}

/**
 * Sentences 17–22's zones (the Mempool), on the same rule:
 *  - `pool_right`: the floor right of the pool's tray — beside the pool, never on it.
 *  - `pool_left`: the floor left of the pool, between it and the mbuf/buffer row — beside both the
 *    representative tile and the element it is shown enlarged as.
 *  - `cpu_right`: the floor right of the CPU, for sentence 22's "no CPU" — beside the idle CPU.
 */
export function poolZones(boxes) {
  const { pool, bufferA, cpu } = boxes;
  const floor = bufferA.min.y;
  return {
    // Sentence 22: the floor right of the CPU, clear of where buffer B and the application stood and
    // well downstage of the NIC — the right edge of a card hung leftward toward the idle CPU.
    'e02.zone.cpu_right': new THREE.Vector3(cpu.max.x + 5.6, floor, (cpu.min.z + cpu.max.z) / 2 + 0.8),
    'e02.zone.pool_right': new THREE.Vector3(pool.max.x + 4.0, floor, (pool.min.z + pool.max.z) / 2),
    'e02.zone.pool_left': new THREE.Vector3(pool.min.x - 1.6, floor, (bufferA.max.z + pool.min.z) / 2),
  };
}

/** Pixel position of a zone this frame, kept inside the title-safe frame for a card of size w×h. */
function placeAt(k, zone, { w, h, align, dx, dy }) {
  const p = k.project(zone, 'center');
  if (!p) return null;
  let x = p[0] + dx;
  let y = p[1] + dy;
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  const clampedLeft = Math.min(Math.max(left, SAFE.x), W - SAFE.x - w);
  x += clampedLeft - left;
  y = Math.min(Math.max(y, SAFE.y + 60), H - SAFE.y - h);
  return [x, y];
}

/** The pixel rectangle [x0, y0, x1, y1] a zoned annotation occupies, given a projection. */
function rectAt(project, zone, size) {
  const at = placeAt({ project }, zone, size);
  if (!at) return null;
  const x0 = size.align === 'right' ? at[0] - size.w : size.align === 'center' ? at[0] - size.w / 2 : at[0];
  return [x0, at[1], x0 + size.w, at[1] + size.h];
}

/** The film's colour roles, as the overlay's accents (typography.js): a storyboard colour → its accent. */
const ACCENT_OF = { [C.red]: ACCENT.copy, [C.gold]: ACCENT.pointer, '#34D8E8': ACCENT.mbuf, [C.violet]: ACCENT.buffer, [C.accent]: ACCENT.dma };
export const accentOf = (color) => ACCENT_OF[color] ?? color ?? ACCENT.dma;

/**
 * A callout whose card lives in an annotation zone (its leader still points at what it names), drawn
 * in the episode's typography (typography.js): its size follows from its text, `layout(project)`
 * reports the rectangle it occupies — what the composition tests check against the projected
 * hardware — and `valign: 'middle'` centres the card on its zone instead of hanging it below.
 */
export function zonedCallout(spec) {
  let { zone, dx = 0, dy = null, valign = 'top', align = 'left', title, subtitle = null, color, anchorTo = null, start, end, fadeIn = 0.42, fadeOut = 0.42 } = spec;
  const { w, h } = cardSize(title, subtitle);
  dy ??= valign === 'middle' ? -h / 2 : valign === 'above' ? -h - 20 : 0;
  const size = { w, h, align, dx, dy };
  const accent = accentOf(color);
  return {
    id: `callout:${titleLines(title).join(' ')}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn,
    fadeOut,
    zone,
    role: 'card',
    spec, // what it was built from: lets QA tools try a placement variant of the same card
    text: { primary: titleLines(title), support: subtitle ? [subtitle] : [] },
    layout: (project) => rectAt(project, zone, size),
    draw(ctx, k) {
      const at = placeAt(k, zone, size);
      if (!at) return;
      const x = align === 'right' ? at[0] - w : at[0];
      const src = anchorTo ? k.project(anchorTo.id, anchorTo.name ?? 'center') : null;
      drawCard(ctx, k, { x, y: at[1], title, subtitle, accent, src, alignRight: align === 'right' });
    },
  };
}

/**
 * A card at a fixed place on the frame (sentence 4's reveal labels, whose composition is the approved
 * opening's), in the same typography as every other card. `at` is its top-left — or top-right with
 * `align: 'right'`.
 */
export function fixedCard({ at, align = 'left', title, subtitle = null, color, anchorTo = null, start, end, fadeIn = 0.42, fadeOut = 0.42 }) {
  const { w, h } = cardSize(title, subtitle);
  const x = align === 'right' ? at[0] - w : at[0];
  const accent = accentOf(color);
  return {
    id: `callout:${titleLines(title).join(' ')}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn,
    fadeOut,
    role: 'card',
    text: { primary: titleLines(title), support: subtitle ? [subtitle] : [] },
    layout: () => [x, at[1], x + w, at[1] + h],
    draw(ctx, k) {
      const src = anchorTo ? k.project(anchorTo.id, anchorTo.name ?? 'center') : null;
      drawCard(ctx, k, { x, y: at[1], title, subtitle, accent, src, alignRight: align === 'right' });
    },
  };
}

/**
 * A list of consequences as ONE group in an annotation zone — sentence 8's costs, sentence 22's
 * "no…": a heading (what the items are) and the items under it, each revealed on its beat. Not
 * attached to any hardware.
 */
export function costGroup({ zone, start, end, heading, items, color = C.red, step = 0.6, dx = 0, dy = 0, align = 'left' }) {
  const { w, h } = groupSize(heading, items);
  const size = { w, h, align, dx, dy };
  const accent = accentOf(color);
  return {
    id: `cost-group:${heading}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.42,
    fadeOut: 0.42,
    zone,
    role: 'group',
    text: { primary: [heading], secondary: items },
    layout: (project) => rectAt(project, zone, size),
    draw(ctx, k) {
      const at = placeAt(k, zone, size);
      if (!at) return;
      drawGroup(ctx, k, { x: align === 'right' ? at[0] - w : at[0], y: at[1], heading, items, accent, step });
    },
  };
}

/**
 * The chapter identifier in its own small title region — the lower-left corner, which every shot of
 * sentences 5–9 keeps as empty floor (the hardware stands upstage, the frame is composed upwards).
 * Subordinate, never a panel — but light and 26 px, so it survives a phone.
 */
export function chapterLabel({ start, end, index, label, color = C.accent, corner = 'bottom-left' }) {
  const y = H - SAFE.y - 20;
  const w = chapterWidth(index, label);
  // The lower-right corner, for a chapter whose shots keep the lower-left occupied.
  const x = corner === 'bottom-right' ? W - SAFE.x - w : SAFE.x;
  return {
    id: `chapter-label:${label}`,
    start,
    end,
    layer: LAYER.brand,
    fadeIn: 0.7,
    fadeOut: 0.7,
    corner,
    role: 'chapter',
    text: { chapter: [index, label] },
    layout: () => [x, y - 16, x + w, y + 16],
    draw(ctx) {
      drawChapter(ctx, { x, y, index, label, accent: accentOf(color) });
    },
  };
}

/** The chapter identifier in the top-left title region (the film's section-label place), in the episode's typography. */
export function sectionTitle({ start, end, index, label, color = C.accent }) {
  const y = SAFE.y + 44;
  const w = chapterWidth(index, label);
  return {
    id: `section-label:${label}`,
    start,
    end,
    layer: LAYER.brand,
    fadeIn: 0.7,
    fadeOut: 0.7,
    corner: 'top-left',
    role: 'chapter',
    text: { chapter: [index, label] },
    layout: () => [SAFE.x, y - 16, SAFE.x + w, y + 16],
    draw(ctx, k) {
      ctx.save();
      ctx.translate((1 - easeOut(k.local / 0.7)) * -10, 0);
      drawChapter(ctx, { x: SAFE.x, y, index, label, accent: accentOf(color) });
      ctx.restore();
    },
  };
}

/** Whether a zone projects inside the frame. */
function onScreen(project, zone) {
  const p = project(zone, 'center');
  return Boolean(p) && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H;
}

/**
 * A tag naming something on screen — sentences 24–30's processing stages — centred on its zone (the
 * floor just in front of what it names), in the episode's typography (a secondary-size chip).
 */
export function stageTag({ zone, label, color = ACCENT.neutral, start, end, dy = 0 }) {
  const { w, h } = tagSize(label);
  const size = { w, h, align: 'center', dx: 0, dy };
  const accent = accentOf(color);
  return {
    id: `tag:${label}`,
    start,
    end,
    layer: LAYER.callout,
    fadeIn: 0.42,
    fadeOut: 0.42,
    zone,
    role: 'tag',
    text: { secondary: [label] },
    // A tag names something on screen: while its stage is out of frame, it is not drawn (and never
    // clamped to the frame's edge, away from what it names).
    layout: (project) => (onScreen(project, zone) ? rectAt(project, zone, size) : null),
    draw(ctx, k) {
      if (!onScreen(k.project, zone)) return;
      const at = placeAt(k, zone, size);
      if (!at) return;
      drawTag(ctx, k, { x: at[0] - w / 2, y: at[1], label, accent });
    },
  };
}

/**
 * Sentences 23–30's zones (the processing stages): the floor in front of each stage — its tag's place
 * — and the floor right of the stage row, beside the routing stage where the handle ends up.
 */
export function stageZones(stageBoxes) {
  const out = {};
  const boxes = Object.entries(stageBoxes);
  for (const [name, b] of boxes) out[`e02.zone.stage_${name}`] = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, b.max.z + 0.4);
  const last = boxes.at(-1)[1];
  out['e02.zone.stages_right'] = new THREE.Vector3(last.max.x + 1.6, last.min.y, (last.min.z + last.max.z) / 2);
  return out;
}
