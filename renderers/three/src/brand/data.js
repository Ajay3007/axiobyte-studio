/**
 * AxioByte brand policy data, the shared values every brand implementation reads (docs/brand/AXIOBYTE_BRAND.md).
 *
 * Data only: no rendering, no layout, no loading. It imports nothing.
 *
 * It holds BRAND values, never semantic ones. The colours an episode uses to mean something (copy, bytes,
 * DMA, a handle) belong to the theme's roles (src/axiobyte_studio/design/themes/systems.yaml) and never
 * appear here.
 *
 * The Three.js brand layer (axiobyte.js, and through it endCard.js) reads its policy values from here: the
 * name, tagline, call, YouTube handle and the logo's metadata. Its rendering colours stay its own.
 */

/** Canonical handles for NEW content, by platform. One handle per deliverable; never all at once. */
const HANDLES = Object.freeze({
  youtube: '@theaxiobytes',
  instagram: '@axiobyte',
  linkedin: '@axiobyte',
});

/** Handles that appear in older content and must not be generated for new content unless explicitly requested. */
const LEGACY_HANDLES = Object.freeze([
  Object.freeze({
    handle: '@axiobyte.systems',
    status: 'legacy-reference-only',
    usedIn: 'the reference Manim episodes and the old Systems profile',
  }),
]);

/**
 * The supplied logo: the canonical artwork, never redrawn. Its mark is the ∀ symbol ("for all") with the
 * apex down, not a stylized A, and its echoes are scaled copies of the same ∀. `colors` are the colours the
 * artwork is drawn in. They describe the logo; they are not (yet) a decision about the brand palette.
 */
const LOGO = Object.freeze({
  source: 'assets/axiobyte-logo',
  renderingAssets: Object.freeze({
    three: 'renderers/three/src/brand/assets/axiobyte-logo-transparent.png',
  }),
  mark: Object.freeze({
    glyph: '∀',
    codepoint: 'U+2200',
    name: 'for all',
    orientation: 'apex-down',
  }),
  includesWordmark: true,
  includesTagline: true,
  colors: Object.freeze({
    cyan: '#5DE8F5', // the ∀ and "Axio"
    amber: '#F0B429', // "Byte" and the tagline
  }),
});

export const BRAND_DATA = Object.freeze({
  name: 'AxioByte',
  tagline: 'Every concept has an axiom.',
  /** The default call to action: the same wording on every platform. */
  cta: 'FOLLOW AXIOBYTE FOR MORE',
  handles: HANDLES,
  legacyHandles: LEGACY_HANDLES,
  logo: LOGO,
});
