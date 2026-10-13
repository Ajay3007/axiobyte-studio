import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_DATA } from '../src/brand/data.js';
import { BRAND } from '../src/brand/axiobyte.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SOURCE = fs.readFileSync(path.join(HERE, '../src/brand/data.js'), 'utf8');
const POLICY = fs.readFileSync(path.join(REPO, 'docs/brand/AXIOBYTE_BRAND.md'), 'utf8');

const isDeepFrozen = (value) =>
  value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

describe('the shared brand data (docs/brand/AXIOBYTE_BRAND.md)', () => {
  it('gives each current platform its canonical handle', () => {
    expect(BRAND_DATA.handles).toEqual({
      youtube: '@theaxiobytes',
      instagram: '@axiobyte',
      linkedin: '@axiobyte',
    });
  });

  it('keeps @axiobyte.systems as legacy / reference only, never as a current platform handle', () => {
    expect(BRAND_DATA.legacyHandles).toEqual([expect.objectContaining({ handle: '@axiobyte.systems', status: 'legacy-reference-only' })]);
    expect(Object.values(BRAND_DATA.handles)).not.toContain('@axiobyte.systems');
  });

  it('has exactly one default call to action', () => {
    expect(BRAND_DATA.cta).toBe('FOLLOW AXIOBYTE FOR MORE');
  });

  it('records the logo: the supplied artwork, its ∀ mark apex down, and the colours it is drawn in', () => {
    const { logo } = BRAND_DATA;
    expect(logo.source).toBe('assets/axiobyte-logo');
    expect(logo.mark).toEqual({ glyph: '∀', codepoint: 'U+2200', name: 'for all', orientation: 'apex-down' });
    expect(logo.mark.glyph.codePointAt(0)).toBe(0x2200);
    expect(logo.colors).toEqual({ cyan: '#5DE8F5', amber: '#F0B429' });
    expect(fs.existsSync(path.join(REPO, logo.source))).toBe(true);
    for (const asset of Object.values(logo.renderingAssets)) expect(fs.existsSync(path.join(REPO, asset))).toBe(true);
  });

  it('agrees with the written policy', () => {
    for (const handle of [...Object.values(BRAND_DATA.handles), BRAND_DATA.legacyHandles[0].handle]) expect(POLICY).toContain(handle);
    expect(POLICY).toMatch(/\*\*YouTube\*\* \| \*\*@theaxiobytes\*\*/);
    expect(POLICY).toMatch(/\*\*Instagram\*\* \| \*\*@axiobyte\*\*/);
    expect(POLICY).toMatch(/\*\*LinkedIn\*\* \| \*\*@axiobyte\*\*/);
    expect(POLICY).toContain(BRAND_DATA.cta);
    expect(POLICY).toContain(BRAND_DATA.tagline);
    for (const hex of Object.values(BRAND_DATA.logo.colors)) expect(POLICY).toContain(hex);
  });

  it('is read-only', () => {
    expect(isDeepFrozen(BRAND_DATA)).toBe(true);
    expect(() => {
      BRAND_DATA.handles.youtube = '@other';
    }).toThrow(TypeError);
  });

  it('is data only and brand only: no imports, no functions, no colour except the logo’s', () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
    const values = [];
    const walk = (v) => (v && typeof v === 'object' ? Object.values(v).forEach(walk) : values.push(v));
    walk(BRAND_DATA);
    expect(values.every((v) => typeof v !== 'function')).toBe(true);
    const hexes = [...SOURCE.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    expect(new Set(hexes)).toEqual(new Set(Object.values(BRAND_DATA.logo.colors)));
  });

  it('is what the Three.js brand layer reads where they overlap', () => {
    expect(BRAND.name).toBe(BRAND_DATA.name);
    expect(BRAND.tagline).toBe(BRAND_DATA.tagline);
    expect(BRAND.cta).toBe(BRAND_DATA.cta);
    expect(BRAND.handle).toBe(BRAND_DATA.handles.youtube); // the 16:9 YouTube end card
  });
});
