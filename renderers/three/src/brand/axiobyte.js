import { BRAND_DATA } from './data.js';

/**
 * AxioByte — the brand layer every film, short and page shares (docs/brand/AXIOBYTE_BRAND.md).
 *
 * The BRAND sits above an episode's visual language and never inside it: these values dress the
 * film's frame (the end card, a watermark, a title) — they never recolour a technical object. In
 * the systems theme the brand cyan is also the mbuf's hue and the brand amber the CPU's; that is
 * where they come from, and why the brand appears only where no technical object is on screen.
 *
 * Colours are the systems theme's values (src/axiobyte_studio/design/themes/systems.yaml — the one
 * source of truth; a test holds these equal to it). The logo is the canonical
 * supplied logo (`assets/axiobyte-logo`, see LOGO below).
 *
 * Brand POLICY values (name, tagline, call, handle, the logo's metadata) come from the shared brand data
 * (./data.js). The rendering colours below stay this layer's own: they are not the logo's artwork colours
 * (BRAND_DATA.logo.colors), and that decision is deferred (docs/brand/AXIOBYTE_BRAND.md).
 */
export const BRAND = Object.freeze({
  name: BRAND_DATA.name,
  tagline: BRAND_DATA.tagline,
  handle: BRAND_DATA.handles.youtube, // the 16:9 YouTube end card's handle
  positioning: 'Systems that power the Internet — explained from first principles.',
  positioningShort: 'Systems explained from first principles.',
  topics: Object.freeze(['Linux Kernel', 'DPDK', 'Networking', 'Distributed Systems', 'Performance Engineering']),
  cta: BRAND_DATA.cta,
});

/**
 * The platforms a deliverable can be made for: a closed set, the keys of BRAND_DATA.handles. The caller
 * chooses the platform; BRAND_DATA alone says what its handle is. A legacy handle (BRAND_DATA.legacyHandles)
 * is not a platform. The platform is independent of the aspect ratio, the episode and the CTA.
 */
export const PLATFORMS = Object.freeze(Object.keys(BRAND_DATA.handles));
/** Without an explicit platform, a deliverable is the 16:9 YouTube one (BRAND.handle). */
export const DEFAULT_PLATFORM = 'youtube';

/** The canonical handle for `platform`. An unknown platform is an error, never a fallback handle. */
export function platformHandle(platform) {
  if (typeof platform !== 'string' || !Object.hasOwn(BRAND_DATA.handles, platform)) {
    throw new Error(`AxioByte brand: unknown platform "${String(platform)}". Expected one of: ${PLATFORMS.join(', ')}`);
  }
  return BRAND_DATA.handles[platform];
}

/** The palette: ground, ink and the two brand accents (systems.yaml: ground.bg, ink.*, roles.mbuf.hue, roles.cpu.hue). */
export const BRAND_COLOR = Object.freeze({
  background: '#090C13',
  surface: '#141B27',
  border: '#26344A',
  textPrimary: '#EAF0F6',
  textSecondary: '#9AA6BC',
  primary: '#34D8E8', // cyan — the AxioByte mark
  secondary: '#F0A431', // amber
});

/**
 * The logo — the CANONICAL AxioByte logo, supplied as `assets/axiobyte-logo` (1080×1080 JPEG): the
 * stylized A mark with its two layered echoes, the "AxioByte" wordmark (Axio cyan, Byte amber), a rule
 * and the tagline. It is never recreated in an episode's typography.
 *
 * For rendering, `LOGO_ASSET` is its transparent extraction (src/brand/assets/axiobyte-logo-transparent.png,
 * made by assets/extract_logo.py: the supplied pixels un-blended from their background — nothing redrawn).
 * `visible` is the lockup's clearly visible extent within the image (opacity > 0.1: mark, inner echo,
 * wordmark, rule, tagline); `extent` adds the large outer echo, faint (≤ 5 %) but visible on a dark
 * ground — what a layout centres.
 */
export const LOGO_ASSET = Object.freeze({
  source: BRAND_DATA.logo.source,
  file: 'src/brand/assets/axiobyte-logo-transparent.png',
  url: new URL('./assets/axiobyte-logo-transparent.png', import.meta.url).href,
  width: 588,
  height: 749,
  visible: Object.freeze({ x0: 96, y0: 159, x1: 492, y1: 661 }),
  /** The whole of what shows on a dark ground — the faint outer echo included (opacity > 0.05). */
  extent: Object.freeze({ x0: 10, y0: 13, x1: 578, y1: 741 }),
  includesWordmark: BRAND_DATA.logo.includesWordmark,
  includesTagline: BRAND_DATA.logo.includesTagline,
});

export const LOGO = Object.freeze({
  name: BRAND_DATA.name,
  asset: LOGO_ASSET,
  /** The wordmark's two halves, as they appear in the logo (for alt text and checks, never to redraw it). */
  wordmark: Object.freeze([
    Object.freeze({ text: 'Axio', color: BRAND_COLOR.primary }),
    Object.freeze({ text: 'Byte', color: BRAND_COLOR.secondary }),
  ]),
  /** Supporting CTA text only — never the logo: */
  weight: 700,
  family: "'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif",
});

// The logo image, loaded once before the first frame is drawn (a video signals ready only after it).
let logoImage = null;
const browserLoad = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.decode ? img.decode().then(() => resolve(img), () => resolve(img)) : resolve(img));
    img.onerror = () => reject(new Error(`AxioByte logo failed to load: ${url}`));
    img.src = url;
  });
/** Load the brand's image assets. `load(url)` → an image (defaults to the browser's). */
export async function loadBrandAssets(load = browserLoad) {
  logoImage = await load(LOGO_ASSET.url);
  return logoImage;
}
/** The loaded logo image, or null before `loadBrandAssets` has finished. */
export const brandLogoImage = () => logoImage;

/** The end card's type: every size in pixels on the 1920×1080 frame — mobile-safe by construction. */
export const CTA_TYPE = Object.freeze({
  call: Object.freeze({ size: 72, weight: 700, track: 3 }),
  handle: Object.freeze({ size: 58, weight: 600, track: 1.5 }),
  tagline: Object.freeze({ size: 36, weight: 500, track: 1 }), // for a card whose logo carries no tagline
});
/** The logo's scale on the end card: its visible lockup ≈ 456 px tall on the 1920×1080 frame. */
export const CTA_LOGO_SCALE = 0.91;

export const font = (s) => `${s.weight} ${s.size}px ${LOGO.family}`;
