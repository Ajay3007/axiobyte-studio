// Platform-aware handles: the caller picks a platform from a closed set; BRAND_DATA says what its handle is.
// Without a platform the end card is the 16:9 YouTube one, exactly as E02 renders it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BRAND_DATA } from '../src/brand/data.js';
import { BRAND, DEFAULT_PLATFORM, PLATFORMS, loadBrandAssets, platformHandle } from '../src/brand/axiobyte.js';
import { brandEndCard } from '../src/brand/endCard.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const END_CARD_SRC = fs.readFileSync(path.join(HERE, '../src/brand/endCard.js'), 'utf8');

beforeAll(async () => {
  await loadBrandAssets(async () => ({ width: 588, height: 749, fake: 'axiobyte-logo' }));
});

/** Every string the card draws once it has fully arrived (the handle's "@" and name are drawn separately). */
function drawnText(cue, local = 3.0) {
  const texts = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => {
        if (k === 'canvas') return { width: 1920, height: 1080 };
        if (k === 'fillText') return (s) => texts.push(String(s));
        if (k === 'measureText') return (s) => ({ width: String(s).length * 30 });
        if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
        return () => {};
      },
      set: () => true,
    },
  );
  cue.draw(ctx, { local });
  return texts;
}
const drawnHandle = (cue) => drawnText(cue).slice(1).join(''); // [call, '@', name]

describe('platform → handle resolution', () => {
  it('BRAND_DATA is unchanged, and the platforms are exactly its handle keys', () => {
    expect(BRAND_DATA.handles).toEqual({ youtube: '@theaxiobytes', instagram: '@axiobyte', linkedin: '@axiobyte' });
    expect(BRAND_DATA.cta).toBe('FOLLOW AXIOBYTE FOR MORE');
    expect(PLATFORMS).toEqual(['youtube', 'instagram', 'linkedin']);
    expect(Object.isFrozen(PLATFORMS)).toBe(true);
    expect(DEFAULT_PLATFORM).toBe('youtube');
  });

  it('resolves each platform through BRAND_DATA', () => {
    expect(platformHandle('youtube')).toBe('@theaxiobytes');
    expect(platformHandle('instagram')).toBe('@axiobyte');
    expect(platformHandle('linkedin')).toBe('@axiobyte');
    for (const p of PLATFORMS) expect(platformHandle(p)).toBe(BRAND_DATA.handles[p]);
  });

  it('does not offer the legacy handle as a platform', () => {
    for (const p of ['systems', 'axiobyte.systems', '@axiobyte.systems', 'legacy']) expect(() => platformHandle(p)).toThrow(/unknown platform/);
    expect(PLATFORMS.map(platformHandle)).not.toContain('@axiobyte.systems');
  });

  it('rejects anything that is not a platform, by name, with the valid list', () => {
    for (const p of ['tiktok', 'YouTube', '', undefined, null, 1, 'toString', '__proto__', 'hasOwnProperty']) {
      expect(() => platformHandle(p)).toThrow('Expected one of: youtube, instagram, linkedin');
    }
  });
});

describe('the end card shows the resolved handle', () => {
  it('defaults to YouTube: the existing call (as in E02) is unchanged', () => {
    const card = brandEndCard({ start: 0, end: 3.5 });
    expect(card.platform).toBe('youtube');
    expect(card.brand).toBe(BRAND);
    expect(card.text).toEqual({ logo: ['AxioByte', 'Every concept has an axiom.'], call: ['FOLLOW AXIOBYTE FOR MORE'], handle: ['@theaxiobytes'] });
    expect(drawnText(card)).toEqual(['FOLLOW AXIOBYTE FOR MORE', '@', 'theaxiobytes']);
  });

  it('draws each platform’s handle, from BRAND_DATA, under the same call', () => {
    for (const platform of PLATFORMS) {
      const card = brandEndCard({ start: 0, end: 3.5, platform });
      expect(card.platform).toBe(platform);
      expect(card.text.handle).toEqual([BRAND_DATA.handles[platform]]);
      expect(drawnText(card)[0]).toBe('FOLLOW AXIOBYTE FOR MORE');
      expect(drawnHandle(card)).toBe(BRAND_DATA.handles[platform]);
    }
    expect(drawnHandle(brandEndCard({ start: 0, end: 3.5, platform: 'instagram' }))).toBe('@axiobyte');
    expect(drawnHandle(brandEndCard({ start: 0, end: 3.5, platform: 'linkedin' }))).toBe('@axiobyte');
  });

  it('an explicit youtube card draws exactly what the default card draws', () => {
    for (const local of [0.3, 0.8, 1.4, 2.0, 3.4]) {
      expect(drawnText(brandEndCard({ start: 0, end: 3.5, platform: 'youtube' }), local)).toEqual(drawnText(brandEndCard({ start: 0, end: 3.5 }), local));
    }
  });

  it('never builds a card for an invalid platform, so no handle is drawn', () => {
    expect(() => brandEndCard({ start: 0, end: 3.5, platform: 'tiktok' })).toThrow(/unknown platform "tiktok"/);
    expect(() => brandEndCard({ start: 0, end: 3.5, platform: 'systems' })).toThrow(/unknown platform/);
  });

  it('does not take handle text from the caller: a brand record must carry a platform handle', () => {
    for (const handle of ['@someone', '@axiobyte.systems', '', undefined]) {
      expect(() => brandEndCard({ start: 0, end: 3.5, brand: { ...BRAND, handle } })).toThrow(/is not a platform handle/);
    }
    expect(drawnHandle(brandEndCard({ start: 0, end: 3.5, brand: { ...BRAND, handle: '@axiobyte' } }))).toBe('@axiobyte');
    expect(() => brandEndCard({ start: 0, end: 3.5, platform: 'youtube', brand: BRAND })).toThrow(/not both/);
  });

  it('the source resolves the handle by platform and spells no handle itself', () => {
    expect(END_CARD_SRC).toMatch(/platformHandle\(/);
    expect(END_CARD_SRC).not.toMatch(/'@theaxiobytes'|'@axiobyte'|'@axiobyte\.systems'/);
    // The platform is never inferred from the frame: the same platform gives the same handle on every format.
    for (const platform of PLATFORMS) {
      const handles = ['16x9', '9x16'].map((target) => brandEndCard({ start: 0, end: 3.5, platform, target }).text.handle);
      expect(handles).toEqual([[BRAND_DATA.handles[platform]], [BRAND_DATA.handles[platform]]]);
    }
  });
});

describe('nothing else moves', () => {
  it('leaves the semantic colours alone (systems.yaml roles)', () => {
    const theme = fs.readFileSync(path.join(REPO, 'src/axiobyte_studio/design/themes/systems.yaml'), 'utf8');
    const hue = (role) => theme.match(new RegExp(`\\n  ${role}:\\n    hue: "(#[0-9A-F]{6})"`))?.[1];
    expect({ copy: hue('copy'), packet: hue('packet'), pointer: hue('pointer') }).toEqual({ copy: '#FF5C55', packet: '#4AA8FF', pointer: '#F5D14F' });
  });
});
