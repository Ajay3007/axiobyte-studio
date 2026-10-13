import { BRAND, BRAND_COLOR, CTA_LOGO_SCALE, CTA_TYPE, DEFAULT_PLATFORM, LOGO, LOGO_ASSET, PLATFORMS, brandLogoImage, font, platformHandle } from './axiobyte.js';
import { DEFAULT_END_CARD_TARGET, END_CARD_TARGETS, portraitCallLines, portraitEndCardLayout } from './endCardLayout.js';

/**
 * The AxioByte end card: a closing card of its own, AFTER a film — never over its last scene.
 *
 *          [ the AxioByte logo ]      the canonical logo (∀ mark, wordmark, tagline) — the hero
 *      FOLLOW AXIOBYTE FOR MORE       the call (dominant text)
 *        the platform's handle        the handle (YouTube, the default: @theaxiobytes)
 *
 * The logo is the supplied artwork (LOGO_ASSET), drawn as an image — never recreated in type. It
 * carries the tagline, so the card does not repeat it. An overlay cue: from `start` the card's own dark
 * ground fades up over the film's last frame (the film itself is untouched), then the logo and the
 * lines arrive one after another and hold. Pure function of t. Silent — it adds no audio.
 *
 * Requires `loadBrandAssets()` (axiobyte.js) to have finished before the first frame is drawn.
 */

/**
 * ONE visual group, centred on the frame: from the top of everything the logo shows (its faint outer
 * echo included — it reads on a dark ground) to the handle's descender. Inside the group the spacing is
 * fixed: the call sits a set gap below the logo's lockup, the handle a set step below the call.
 */
const S = CTA_LOGO_SCALE;
const VIS = LOGO_ASSET.visible;
const EXT = LOGO_ASSET.extent;
const GAP_LOGO_CALL = 56;
const CALL_TO_HANDLE = 76;
const CALL_CAP = CTA_TYPE.call.size * 0.74;
const HANDLE_DESC = CTA_TYPE.handle.size * 0.22;
// Offsets from the logo image's top edge.
const OFF_TOP = EXT.y0 * S;
const OFF_CALL = VIS.y1 * S + GAP_LOGO_CALL + CALL_CAP;
const OFF_BOTTOM = OFF_CALL + CALL_TO_HANDLE + HANDLE_DESC;
const IMAGE_Y = Math.round(540 - (OFF_TOP + OFF_BOTTOM) / 2);

export const END_CARD_LAYOUT = Object.freeze({
  centreX: 960,
  /** Where the logo IMAGE is drawn and how large. */
  logo: Object.freeze({
    x: Math.round(960 - ((EXT.x0 + EXT.x1) / 2) * S),
    y: IMAGE_Y,
    w: Math.round(LOGO_ASSET.width * S),
    h: Math.round(LOGO_ASSET.height * S),
  }),
  /** The logo's clearly visible lockup, and everything it shows (the outer echo included), on the frame. */
  logoVisible: Object.freeze({ top: Math.round(IMAGE_Y + VIS.y0 * S), bottom: Math.round(IMAGE_Y + VIS.y1 * S) }),
  logoExtent: Object.freeze({ top: Math.round(IMAGE_Y + OFF_TOP), bottom: Math.round(IMAGE_Y + EXT.y1 * S) }),
  callY: Math.round(IMAGE_Y + OFF_CALL), // baselines
  handleY: Math.round(IMAGE_Y + OFF_CALL + CALL_TO_HANDLE),
});

/** The group's extent — the logo's outer echo to the handle's descender: its centre is the frame's. */
export const endCardBlock = () => {
  const top = END_CARD_LAYOUT.logoExtent.top;
  const bottom = END_CARD_LAYOUT.handleY + HANDLE_DESC;
  return { top, bottom, centreY: (top + bottom) / 2 };
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  const u = clamp01(x);
  return 1 - (1 - u) ** 3;
};

/** Timings, in seconds from the card's start. */
export const END_CARD_TIMING = Object.freeze({
  ground: [0, 0.5],
  logo: [0.5, 1.1],
  call: [0.9, 1.5],
  handle: [1.2, 1.8],
});

/** The handles a card may show: BRAND_DATA's platform handles, and nothing else (no legacy, no free text). */
const CANONICAL_HANDLES = new Set(PLATFORMS.map(platformHandle));

/**
 * `platform` (one of PLATFORMS; default DEFAULT_PLATFORM, the 16:9 YouTube card) picks the handle, which
 * BRAND_DATA supplies. `brand` replaces the whole brand record instead (a seam for checks); its handle must
 * still be one of the platform handles. Pass one or the other, not both.
 *
 * `target` (one of END_CARD_TARGETS; default '16x9') picks the frame format: '16x9' is the approved
 * landscape card below, '9x16' the portrait card (endCardLayout.js). It is independent of the platform.
 */
export function brandEndCard({ start, end, platform, brand, color = BRAND_COLOR, target = DEFAULT_END_CARD_TARGET }) {
  if (!END_CARD_TARGETS.includes(target)) {
    throw new Error(`AxioByte end card: unknown target "${String(target)}". Expected one of: ${END_CARD_TARGETS.join(', ')}`);
  }
  if (platform !== undefined && brand !== undefined) {
    throw new Error('AxioByte end card: pass a platform or a brand record, not both');
  }
  if (brand !== undefined && !CANONICAL_HANDLES.has(brand.handle)) {
    throw new Error(`AxioByte end card: "${String(brand.handle)}" is not a platform handle. Expected one of: ${[...CANONICAL_HANDLES].join(', ')}`);
  }
  const resolved = brand === undefined ? (platform ?? DEFAULT_PLATFORM) : null;
  const handle = resolved === null ? brand.handle : platformHandle(resolved);
  brand ??= BRAND;
  const lines = [
    { key: 'call', text: brand.cta, style: CTA_TYPE.call, ink: color.textPrimary, y: END_CARD_LAYOUT.callY },
    { key: 'handle', text: handle, style: CTA_TYPE.handle, ink: color.textPrimary, y: END_CARD_LAYOUT.handleY },
  ];
  return {
    id: 'brand:end-card',
    role: 'endcard',
    start,
    end,
    layer: 95, // above every episode layer: the card owns the whole frame
    fadeIn: 0.001,
    fadeOut: 0.001,
    brand,
    platform: resolved, // null for a card given a whole brand record
    target,
    logo: LOGO_ASSET,
    // The logo carries the brand name and the tagline; the card's own text is the call and the handle.
    text: { logo: [LOGO.name, brand.tagline], call: [brand.cta], handle: [handle] },
    draw(ctx, k) {
      if (target === '9x16') {
        drawPortrait(ctx, k.local, { cta: brand.cta, handle, color });
        return;
      }
      const t = k.local;
      const W = ctx.canvas?.width ?? 1920;
      const H = ctx.canvas?.height ?? 1080;
      const at = (span) => ease((t - span[0]) / (span[1] - span[0]));
      ctx.save();
      // The card's ground: opaque at full strength, fading up over the film's last frame.
      ctx.globalAlpha = at(END_CARD_TIMING.ground);
      ctx.fillStyle = color.background;
      ctx.fillRect(0, 0, W, H);
      // A quiet technical grid, brightest at the centre.
      ctx.strokeStyle = 'rgba(52,216,232,0.045)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
      for (let y = 28; y <= H; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }
      const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.62);
      vignette.addColorStop(0, 'rgba(9,12,19,0)');
      vignette.addColorStop(1, 'rgba(9,12,19,0.92)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // The logo: the canonical artwork, centred, rising gently into place.
      const l = at(END_CARD_TIMING.logo);
      if (l > 0.001) {
        const img = brandLogoImage();
        if (!img) throw new Error('AxioByte end card: the logo is not loaded — call loadBrandAssets() before rendering');
        const L = END_CARD_LAYOUT.logo;
        ctx.save();
        ctx.globalAlpha = l;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, L.x, L.y + (1 - l) * 14, L.w, L.h);
        ctx.restore();
      }
      // The call and the handle — each centred, each on its beat.
      ctx.textBaseline = 'alphabetic';
      for (const line of lines) {
        const a = at(END_CARD_TIMING[line.key]);
        if (a <= 0.001) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = font(line.style);
        ctx.letterSpacing = `${line.style.track}px`;
        ctx.fillStyle = line.ink;
        const y = line.y + (1 - a) * 12;
        if (line.key === 'handle' && line.text.startsWith('@')) {
          // The handle's "@" in the brand cyan; the name in near-white.
          ctx.textAlign = 'left';
          const full = ctx.measureText(line.text).width;
          const at0 = ctx.measureText('@').width;
          const x0 = END_CARD_LAYOUT.centreX - full / 2;
          ctx.fillStyle = color.primary;
          ctx.fillText('@', x0, y);
          ctx.fillStyle = line.ink;
          ctx.fillText(line.text.slice(1), x0 + at0, y);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(line.text, END_CARD_LAYOUT.centreX, y);
        }
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

/**
 * The portrait card: the same ground, logo, call and handle, and the same arrival, composed for a 9:16
 * frame (endCardLayout.js) rather than scaled from the landscape one.
 */
function drawPortrait(ctx, t, { cta, handle, color }) {
  const L = portraitEndCardLayout(ctx.canvas?.width ?? 1080, ctx.canvas?.height ?? 1920);
  const { width: W, height: H, unit } = L;
  const at = (span) => ease((t - span[0]) / (span[1] - span[0]));
  ctx.save();
  // The ground: opaque at full strength, fading up over the film's last frame.
  ctx.globalAlpha = at(END_CARD_TIMING.ground);
  ctx.fillStyle = color.background;
  ctx.fillRect(0, 0, W, H);
  // The quiet technical grid, and a vignette brightest at the group's centre.
  ctx.strokeStyle = 'rgba(52,216,232,0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += L.grid) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, H);
    ctx.stroke();
  }
  for (let y = (28 / 64) * L.grid; y <= H; y += L.grid) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(W, Math.round(y) + 0.5);
    ctx.stroke();
  }
  const cy = (L.block.top + L.block.bottom) / 2;
  const vignette = ctx.createRadialGradient(L.centreX, cy, 120 * unit, L.centreX, cy, Math.max(W, H) * 0.62);
  vignette.addColorStop(0, 'rgba(9,12,19,0)');
  vignette.addColorStop(1, 'rgba(9,12,19,0.92)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // The logo: the canonical artwork, centred, rising gently into place.
  const l = at(END_CARD_TIMING.logo);
  if (l > 0.001) {
    const img = brandLogoImage();
    if (!img) throw new Error('AxioByte end card: the logo is not loaded — call loadBrandAssets() before rendering');
    ctx.save();
    ctx.globalAlpha = l;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, L.logo.x, L.logo.y + (1 - l) * 14 * unit, L.logo.w, L.logo.h);
    ctx.restore();
  }

  // The call on two lines, then the handle — each centred, each on its beat.
  ctx.textBaseline = 'alphabetic';
  const call = at(END_CARD_TIMING.call);
  if (call > 0.001) {
    ctx.save();
    ctx.globalAlpha = call;
    ctx.font = font(L.call);
    ctx.letterSpacing = `${L.call.track}px`;
    ctx.fillStyle = color.textPrimary;
    ctx.textAlign = 'center';
    portraitCallLines(cta).forEach((line, i) => ctx.fillText(line, L.centreX, L.call.baselines[i] + (1 - call) * 12 * unit));
    ctx.restore();
  }
  const h = at(END_CARD_TIMING.handle);
  if (h > 0.001) {
    ctx.save();
    ctx.globalAlpha = h;
    ctx.font = font(L.handle);
    ctx.letterSpacing = `${L.handle.track}px`;
    ctx.textAlign = 'left';
    const y = L.handle.baseline + (1 - h) * 12 * unit;
    const x0 = L.centreX - ctx.measureText(handle).width / 2;
    // The handle's "@" in the brand cyan; the name in near-white.
    ctx.fillStyle = color.primary;
    ctx.fillText('@', x0, y);
    ctx.fillStyle = color.textPrimary;
    ctx.fillText(handle.slice(1), x0 + ctx.measureText('@').width, y);
    ctx.restore();
  }
  ctx.restore();
}
