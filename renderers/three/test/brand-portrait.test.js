// The portrait (9x16) end card: the same brand content, composed for a 9:16 frame, chosen explicitly and
// independent of the platform. The landscape (16x9) card stays the approved one.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BRAND_DATA } from '../src/brand/data.js';
import { BRAND_COLOR, LOGO_ASSET, PLATFORMS, brandLogoImage, loadBrandAssets } from '../src/brand/axiobyte.js';
import { brandEndCard, END_CARD_LAYOUT } from '../src/brand/endCard.js';
import { DEFAULT_END_CARD_TARGET, END_CARD_TARGETS, PORTRAIT_SAFE, portraitCallLines, portraitEndCardLayout, portraitSafeArea } from '../src/brand/endCardLayout.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const FAKE_LOGO = { width: 588, height: 749, fake: 'axiobyte-logo' };

beforeAll(async () => {
  await loadBrandAssets(async () => FAKE_LOGO);
});

/** Draw a cue on a recording canvas of the given size: text, images, rectangles and every colour set. */
function record(cue, local, width, height) {
  const calls = [];
  const colours = new Set();
  const state = { font: '', fillStyle: '', strokeStyle: '', globalAlpha: 1, textAlign: 'left', letterSpacing: '0px' };
  const stack = [];
  const size = () => Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 0);
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => {
        if (k === 'canvas') return { width, height };
        if (k === 'fillText') return (s, x, y) => calls.push({ op: 'text', text: String(s), x, y, size: size(), ink: state.fillStyle, align: state.textAlign, alpha: state.globalAlpha });
        if (k === 'drawImage') return (img, x, y, w, h) => calls.push({ op: 'image', img, x, y, w, h, alpha: state.globalAlpha });
        if (k === 'fillRect') return (x, y, w, h) => calls.push({ op: 'rect', x, y, w, h, fill: typeof state.fillStyle === 'string' ? state.fillStyle : 'gradient' });
        if (k === 'measureText') return (s) => ({ width: String(s).length * 0.5 * size() });
        if (k === 'createRadialGradient') return (...args) => ({ gradient: args, stops: [], addColorStop(o, c) { colours.add(c); this.stops.push([o, c]); } });
        if (k === 'save') return () => stack.push({ ...state });
        if (k === 'restore') return () => Object.assign(state, stack.pop());
        if (k in state) return state[k];
        return () => {};
      },
      set: (_, k, v) => {
        state[k] = v;
        if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') colours.add(v);
        return true;
      },
    },
  );
  cue.draw(ctx, { local });
  return { calls, colours };
}
const texts = (r) => r.calls.filter((c) => c.op === 'text').map((c) => c.text);
const portrait = (opts = {}) => brandEndCard({ start: 0, end: 3.5, target: '9x16', ...opts });

/**
 * Advance widths of the card's strings in the shipped Barlow Semi Condensed, measured in Chrome
 * (ctx.measureText at 100 px, untracked) and expressed per pixel of font size. Tracking is added per glyph.
 */
const ADVANCE = { 'FOLLOW AXIOBYTE': 7.564, 'FOR MORE': 4.011, '@theaxiobytes': 5.935, '@axiobyte': 4.197 };
const textWidth = (s, size, track) => ADVANCE[s] * size + s.length * track;

describe('formats', () => {
  it('offers exactly 16x9 and 9x16, defaulting to the approved landscape card', () => {
    expect(END_CARD_TARGETS).toEqual(['16x9', '9x16']);
    expect(DEFAULT_END_CARD_TARGET).toBe('16x9');
    expect(brandEndCard({ start: 0, end: 3.5 }).target).toBe('16x9');
    expect(portrait().target).toBe('9x16');
  });

  it('leaves the landscape card exactly as it was: same layout, and the same drawing with or without target', () => {
    expect(END_CARD_LAYOUT).toEqual({
      centreX: 960,
      logo: { x: 692, y: 134, w: 535, h: 682 },
      logoVisible: { top: 279, bottom: 736 },
      logoExtent: { top: 146, bottom: 808 },
      callY: 845,
      handleY: 921,
    });
    for (const local of [0.2, 0.7, 1.3, 2.0, 3.4]) {
      const before = record(brandEndCard({ start: 0, end: 3.5 }), local, 1920, 1080);
      const explicit = record(brandEndCard({ start: 0, end: 3.5, target: '16x9' }), local, 1920, 1080);
      expect(explicit.calls).toEqual(before.calls);
    }
    expect(texts(record(brandEndCard({ start: 0, end: 3.5 }), 3.0, 1920, 1080))).toEqual(['FOLLOW AXIOBYTE FOR MORE', '@', 'theaxiobytes']);
  });

  it('rejects an unknown format instead of guessing one', () => {
    for (const target of ['9:16', 'portrait', '1x1', '', null]) {
      expect(() => brandEndCard({ start: 0, end: 3.5, target })).toThrow(/unknown target/);
    }
  });
});

describe('the portrait frame', () => {
  it('is a true 9:16 frame: 1080×1920 by default, any 9:16 size accepted, anything else refused', () => {
    const L = portraitEndCardLayout();
    expect([L.width, L.height]).toEqual([1080, 1920]);
    for (const [w, h] of [[720, 1280], [1440, 2560], [2160, 3840]]) expect(portraitEndCardLayout(w, h).target).toBe('9x16');
    for (const [w, h] of [[1920, 1080], [1080, 1080], [1000, 1920], [0, 0]]) expect(() => portraitEndCardLayout(w, h)).toThrow(/9:16 frame/);
    expect(() => record(portrait(), 3.0, 1920, 1080)).toThrow(/9:16 frame/); // a portrait card on a landscape canvas
  });

  it('keeps its safe area equal to design/targets/9x16.yaml: the target safe top, and the largest platform zones', () => {
    const yaml = fs.readFileSync(path.join(REPO, 'src/axiobyte_studio/design/targets/9x16.yaml'), 'utf8');
    const top = Number(/^safe: \{ top: ([\d.]+)/m.exec(yaml)[1]);
    const zones = [...yaml.matchAll(/^\s+\w+: \{ bottom: ([\d.]+), right: ([\d.]+) \}/gm)].map((m) => ({ bottom: Number(m[1]), right: Number(m[2]) }));
    expect(zones.length).toBeGreaterThanOrEqual(3);
    expect(PORTRAIT_SAFE).toEqual({ top, bottom: Math.max(...zones.map((z) => z.bottom)), side: Math.max(...zones.map((z) => z.right)) });
    const safe = portraitSafeArea(1080, 1920);
    for (const [k, v] of Object.entries({ left: 172.8, right: 907.2, top: 96, bottom: 1536 })) expect(safe[k]).toBeCloseTo(v, 6);
  });
});

describe('the portrait composition', () => {
  const SIZES = [[1080, 1920], [720, 1280], [1440, 2560], [2160, 3840]];

  it('keeps everything that matters inside the safe area, and the whole logo inside the frame, at every size', () => {
    for (const [w, h] of SIZES) {
      const L = portraitEndCardLayout(w, h);
      const { safe } = L;
      expect(L.logoVisible.left).toBeGreaterThanOrEqual(safe.left);
      expect(L.logoVisible.right).toBeLessThanOrEqual(safe.right);
      expect(L.logoVisible.top).toBeGreaterThanOrEqual(safe.top);
      expect(L.logoExtent.left).toBeGreaterThanOrEqual(0);
      expect(L.logoExtent.right).toBeLessThanOrEqual(w);
      expect(L.logoExtent.top).toBeGreaterThanOrEqual(safe.top);
      expect(L.logoExtent.bottom).toBeLessThanOrEqual(h);
      const widest = Math.max(
        ...portraitCallLines(BRAND_DATA.cta).map((s) => textWidth(s, L.call.size, L.call.track)),
        ...PLATFORMS.map((p) => textWidth(BRAND_DATA.handles[p], L.handle.size, L.handle.track)),
      );
      expect(widest / 2).toBeLessThanOrEqual(L.centreX - safe.left); // centred, so half each side
      expect(L.handle.baseline + 0.22 * L.handle.size).toBeLessThanOrEqual(safe.bottom);
    }
  });

  it('stacks logo, call and handle without collisions, in that order', () => {
    for (const [w, h] of SIZES) {
      const L = portraitEndCardLayout(w, h);
      const cap = (size) => 0.74 * size;
      const desc = (size) => 0.22 * size;
      const [b1, b2] = L.call.baselines;
      expect(L.logoVisible.bottom).toBeLessThan(b1 - cap(L.call.size));
      expect(b1 + desc(L.call.size)).toBeLessThan(b2 - cap(L.call.size));
      expect(b2 + desc(L.call.size)).toBeLessThan(L.handle.baseline - cap(L.handle.size));
    }
  });

  it('is one group, centred on the frame horizontally and in the safe band vertically', () => {
    for (const [w, h] of SIZES) {
      const L = portraitEndCardLayout(w, h);
      expect(Math.abs((L.logoExtent.left + L.logoExtent.right) / 2 - w / 2)).toBeLessThanOrEqual(1);
      const band = (L.safe.top + L.safe.bottom) / 2;
      expect(Math.abs((L.block.top + L.block.bottom) / 2 - band)).toBeLessThanOrEqual(1);
    }
  });

  it('is the same composition at every 9:16 size (proportional), with a hierarchy logo › call › handle', () => {
    const base = portraitEndCardLayout(1080, 1920);
    expect(base.logoVisible.bottom - base.logoVisible.top).toBeGreaterThan(550); // the hero: ≈ 611 px tall
    expect(base.call.size).toBe(80);
    expect(base.handle.size).toBe(60);
    for (const [w, h] of SIZES) {
      const L = portraitEndCardLayout(w, h);
      const k = w / 1080;
      // Proportional up to whole-pixel rounding of the font sizes (≤ 3 px even at 2160 × 3840).
      expect(Math.abs(L.logo.y - base.logo.y * k)).toBeLessThanOrEqual(3);
      expect(Math.abs(L.call.baselines[0] - base.call.baselines[0] * k)).toBeLessThanOrEqual(3);
      expect(Math.abs(L.handle.baseline - base.handle.baseline * k)).toBeLessThanOrEqual(3);
    }
  });
});

describe('the portrait card’s content', () => {
  it('draws the canonical logo image, the call on two lines and the handle, from the brand', () => {
    const r = record(portrait(), 3.0, 1080, 1920);
    const L = portraitEndCardLayout(1080, 1920);
    const image = r.calls.find((c) => c.op === 'image');
    expect(image.img).toBe(brandLogoImage());
    expect(image).toMatchObject({ x: L.logo.x, y: L.logo.y, w: L.logo.w, h: L.logo.h, alpha: 1 });
    expect(texts(r)).toEqual(['FOLLOW AXIOBYTE', 'FOR MORE', '@', 'theaxiobytes']);
    expect(portraitCallLines(BRAND_DATA.cta)).toEqual(['FOLLOW AXIOBYTE', 'FOR MORE']);
    expect(portraitCallLines(BRAND_DATA.cta).join(' ')).toBe('FOLLOW AXIOBYTE FOR MORE');
    expect(portrait().text.call).toEqual(['FOLLOW AXIOBYTE FOR MORE']);
  });

  it('uses the same canonical logo file', () => {
    expect(LOGO_ASSET.file).toBe('src/brand/assets/axiobyte-logo-transparent.png');
    const png = fs.readFileSync(path.join(REPO, 'renderers/three', LOGO_ASSET.file));
    expect(crypto.createHash('sha256').update(png).digest('hex').slice(0, 16)).toBe('035e306ab0eae3b3');
  });

  it('shows each platform’s handle from BRAND_DATA; platform and format are independent', () => {
    expect(portrait().platform).toBe('youtube');
    for (const platform of PLATFORMS) {
      const r = record(portrait({ platform }), 3.0, 1080, 1920);
      expect(texts(r).slice(2).join('')).toBe(BRAND_DATA.handles[platform]);
      // Same geometry for every platform: the platform changes only the handle text.
      expect(r.calls.filter((c) => c.op !== 'text' || c.text !== 'theaxiobytes')[0]).toEqual(record(portrait(), 3.0, 1080, 1920).calls[0]);
    }
    expect(texts(record(portrait({ platform: 'youtube' }), 3.0, 1080, 1920)).slice(2).join('')).toBe('@theaxiobytes');
    expect(texts(record(portrait({ platform: 'instagram' }), 3.0, 1080, 1920)).slice(2).join('')).toBe('@axiobyte');
    expect(texts(record(portrait({ platform: 'linkedin' }), 3.0, 1080, 1920)).slice(2).join('')).toBe('@axiobyte');
    for (const target of END_CARD_TARGETS) for (const platform of PLATFORMS) {
      const card = brandEndCard({ start: 0, end: 3.5, platform, target });
      expect([card.platform, card.target]).toEqual([platform, target]);
    }
  });

  it('still rejects invalid platforms and free handle text', () => {
    expect(() => portrait({ platform: 'tiktok' })).toThrow(/unknown platform/);
    expect(() => portrait({ platform: 'systems' })).toThrow(/unknown platform/);
    expect(() => portrait({ brand: { ...BRAND_DATA, handle: '@axiobyte.systems' } })).toThrow(/not a platform handle/);
  });

  it('paints only brand colours: no semantic colour reaches the card', () => {
    const { colours } = record(portrait(), 3.0, 1080, 1920);
    const allowed = new Set([BRAND_COLOR.background, BRAND_COLOR.textPrimary, BRAND_COLOR.primary, 'rgba(52,216,232,0.045)', 'rgba(9,12,19,0)', 'rgba(9,12,19,0.92)']);
    expect([...colours].filter((c) => !allowed.has(c))).toEqual([]);
    const theme = fs.readFileSync(path.join(REPO, 'src/axiobyte_studio/design/themes/systems.yaml'), 'utf8');
    for (const role of ['copy', 'packet', 'pointer', 'memory', 'nic']) {
      const hue = new RegExp(`\\n  ${role}:\\n    hue: "(#[0-9A-F]{6})"`).exec(theme)[1];
      expect([...colours].map((c) => String(c).toUpperCase())).not.toContain(hue);
    }
  });

  it('arrives like the landscape card: ground, then logo, then call, then handle', () => {
    const at = (local) => texts(record(portrait(), local, 1080, 1920));
    expect(record(portrait(), 0.3, 1080, 1920).calls.some((c) => c.op === 'image')).toBe(false);
    expect(at(0.95)).toEqual(['FOLLOW AXIOBYTE', 'FOR MORE']);
    expect(at(1.3)).toEqual(['FOLLOW AXIOBYTE', 'FOR MORE', '@', 'theaxiobytes']);
  });
});
