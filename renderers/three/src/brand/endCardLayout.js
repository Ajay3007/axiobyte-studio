import { CTA_TYPE, LOGO_ASSET } from './axiobyte.js';

/**
 * The end card's frame formats: renderer geometry only (docs/brand/AXIOBYTE_BRAND.md, End card).
 *
 * A format is chosen explicitly by the caller, never guessed from a canvas, and is independent of the
 * platform: any platform's handle can sit on any format. The ids are the studio's target ids
 * (src/axiobyte_studio/design/targets/<id>.yaml).
 *
 *   16x9  the approved landscape card: its geometry is END_CARD_LAYOUT in endCard.js, frozen with E02.
 *   9x16  the portrait card, composed here for a 1080×1920 frame and resolved for any 9:16 size.
 */
export const END_CARD_TARGETS = Object.freeze(['16x9', '9x16']);
export const DEFAULT_END_CARD_TARGET = '16x9';

/**
 * The portrait safe area, as fractions of the frame. It is derived from design/targets/9x16.yaml (a test
 * holds them equal):
 *
 *   top     0.05  the target's `safe.top`. No platform declares UI over the top edge.
 *   bottom  0.20  the largest `platform_safe.*.bottom` (Reels 0.18, Shorts 0.14, TikTok 0.20): captions,
 *                 the account name and the description sit there.
 *   side    0.16  the largest `platform_safe.*.right` (Reels 0.14, Shorts 0.12, TikTok 0.16): the action
 *                 buttons. Applied to both sides, so the card stays centred on the frame.
 *
 * The largest zone of every platform is used, so the card never depends on the platform.
 */
export const PORTRAIT_SAFE = Object.freeze({ top: 0.05, bottom: 0.2, side: 0.16 });

/** The safe box of a portrait frame, in pixels. */
export function portraitSafeArea(width, height) {
  return Object.freeze({
    left: width * PORTRAIT_SAFE.side,
    right: width * (1 - PORTRAIT_SAFE.side),
    top: height * PORTRAIT_SAFE.top,
    bottom: height * (1 - PORTRAIT_SAFE.bottom),
  });
}

/**
 * The portrait composition. Sizes are fractions of the frame's width, so the card is the same at every
 * 9:16 size. At 1080 px: everything the logo shows is 691 px wide (scale ≈ 1.22); the call is 80 px on two
 * lines ("FOLLOW AXIOBYTE" / "FOR MORE"; one line would have to shrink to ≈ 56 px to clear the side
 * zones); the handle is 60 px.
 */
export const PORTRAIT_END_CARD = Object.freeze({
  logoExtentWidth: 0.64, // everything the logo shows, its faint outer echo included
  gapLogoCall: 0.06, // the lockup's bottom to the call's cap height
  call: Object.freeze({ size: 0.074, lineStep: 1.1 }),
  callToHandle: 0.085, // last call baseline to the handle's baseline
  handle: Object.freeze({ size: 0.056 }),
  riseLogo: 14 / 1080, // the arrival rises, as in the landscape card
  riseText: 12 / 1080,
  grid: 64 / 1080,
});

const CAP = 0.74; // cap height and descender, as fractions of the size (the landscape card's values)
const DESC = 0.22;
const EXT = LOGO_ASSET.extent;
const VIS = LOGO_ASSET.visible;

/**
 * The call, set on two balanced lines: the word break that makes the longer line shortest
 * ("FOLLOW AXIOBYTE FOR MORE" → "FOLLOW AXIOBYTE" / "FOR MORE"). The wording itself never changes.
 */
export function portraitCallLines(text) {
  const words = text.split(' ');
  if (words.length < 2) return [text];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const longest = Math.max(...lines.map((l) => l.length));
    if (!best || longest < best.longest) best = { lines, longest };
  }
  return best.lines;
}

/**
 * Where everything sits on a `width` × `height` portrait frame. One visual group (from the top of the
 * logo's outer echo to the handle's descender) is centred, horizontally on the frame and vertically in the
 * safe band. The frame must be 9:16; anything else is an error, never a stretched card.
 */
export function portraitEndCardLayout(width = 1080, height = 1920) {
  if (!(width > 0 && height > 0) || Math.abs(width / height - 9 / 16) > 0.005 * (9 / 16)) {
    throw new Error(`AxioByte end card: a 9x16 card needs a 9:16 frame, got ${width}×${height}`);
  }
  const P = PORTRAIT_END_CARD;
  const safe = portraitSafeArea(width, height);
  const scale = (P.logoExtentWidth * width) / (EXT.x1 - EXT.x0);
  const callSize = Math.round(P.call.size * width);
  const handleSize = Math.round(P.handle.size * width);
  const callStep = callSize * P.call.lineStep;
  // Offsets from the logo image's top edge.
  const offTop = EXT.y0 * scale;
  const offCall = VIS.y1 * scale + P.gapLogoCall * width + callSize * CAP;
  const offHandle = offCall + callStep + P.callToHandle * width;
  const offBottom = offHandle + handleSize * DESC;
  const imageY = Math.round((safe.top + safe.bottom) / 2 - (offTop + offBottom) / 2);
  const centreX = width / 2;
  const imageX = Math.round(centreX - ((EXT.x0 + EXT.x1) / 2) * scale);
  const at = (off) => Math.round(imageY + off);
  return Object.freeze({
    target: '9x16',
    width,
    height,
    safe,
    centreX,
    scale,
    unit: width / 1080,
    logo: Object.freeze({ x: imageX, y: imageY, w: Math.round(LOGO_ASSET.width * scale), h: Math.round(LOGO_ASSET.height * scale) }),
    logoVisible: Object.freeze({ left: imageX + VIS.x0 * scale, right: imageX + VIS.x1 * scale, top: at(VIS.y0 * scale), bottom: at(VIS.y1 * scale) }),
    logoExtent: Object.freeze({ left: imageX + EXT.x0 * scale, right: imageX + EXT.x1 * scale, top: at(offTop), bottom: at(EXT.y1 * scale) }),
    call: Object.freeze({
      size: callSize,
      weight: CTA_TYPE.call.weight,
      track: (CTA_TYPE.call.track * callSize) / CTA_TYPE.call.size,
      baselines: Object.freeze([at(offCall), at(offCall + callStep)]),
    }),
    handle: Object.freeze({
      size: handleSize,
      weight: CTA_TYPE.handle.weight,
      track: (CTA_TYPE.handle.track * handleSize) / CTA_TYPE.handle.size,
      baseline: at(offHandle),
    }),
    block: Object.freeze({ top: at(offTop), bottom: imageY + offBottom }),
    grid: P.grid * width,
  });
}
