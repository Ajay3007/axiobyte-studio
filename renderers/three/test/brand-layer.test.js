// The Three.js brand layer reads its POLICY values from the shared brand data (src/brand/data.js) and keeps
// its rendering values (colours, type, layout, timing) as its own. The values it renders are frozen with E02.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_DATA } from '../src/brand/data.js';
import { BRAND, BRAND_COLOR, LOGO, LOGO_ASSET } from '../src/brand/axiobyte.js';
import { brandEndCard } from '../src/brand/endCard.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const AXIOBYTE_SRC = fs.readFileSync(path.join(HERE, '../src/brand/axiobyte.js'), 'utf8');
const END_CARD_SRC = fs.readFileSync(path.join(HERE, '../src/brand/endCard.js'), 'utf8');

describe('the Three.js brand layer consumes BRAND_DATA', () => {
  it('axiobyte.js imports the shared data and no longer spells the policy values itself', () => {
    expect(AXIOBYTE_SRC).toMatch(/^import \{ BRAND_DATA \} from '\.\/data\.js';$/m);
    for (const literal of ["'FOLLOW AXIOBYTE FOR MORE'", "'@theaxiobytes'", "'Every concept has an axiom.'", "'AxioByte'", "'assets/axiobyte-logo'"]) {
      expect(AXIOBYTE_SRC).not.toContain(literal);
    }
  });

  it('endCard.js takes its text from the brand layer (BRAND, LOGO), not from literals', () => {
    expect(END_CARD_SRC).toMatch(/from '\.\/axiobyte\.js'/);
    expect(END_CARD_SRC).not.toMatch(/'FOLLOW AXIOBYTE FOR MORE'|'@theaxiobytes'|'Every concept has an axiom\.'/);
  });

  it('the policy values are the shared ones', () => {
    expect(BRAND.name).toBe(BRAND_DATA.name);
    expect(BRAND.tagline).toBe(BRAND_DATA.tagline);
    expect(BRAND.cta).toBe(BRAND_DATA.cta);
    expect(BRAND.handle).toBe(BRAND_DATA.handles.youtube);
    expect(LOGO.name).toBe(BRAND_DATA.name);
    expect(LOGO_ASSET.source).toBe(BRAND_DATA.logo.source);
    expect(LOGO_ASSET.includesWordmark).toBe(BRAND_DATA.logo.includesWordmark);
    expect(LOGO_ASSET.includesTagline).toBe(BRAND_DATA.logo.includesTagline);
  });
});

describe('what the brand layer renders is unchanged (frozen with E02)', () => {
  it('keeps the call, the 16:9 YouTube handle, the name and the tagline', () => {
    expect(BRAND).toMatchObject({
      name: 'AxioByte',
      tagline: 'Every concept has an axiom.',
      handle: '@theaxiobytes',
      cta: 'FOLLOW AXIOBYTE FOR MORE',
    });
    expect(brandEndCard({ start: 0, end: 3.5 }).text).toEqual({
      logo: ['AxioByte', 'Every concept has an axiom.'],
      call: ['FOLLOW AXIOBYTE FOR MORE'],
      handle: ['@theaxiobytes'],
    });
  });

  it('keeps its own rendering colours: not the artwork colours, which are a deferred decision', () => {
    expect(BRAND_COLOR).toEqual({
      background: '#090C13',
      surface: '#141B27',
      border: '#26344A',
      textPrimary: '#EAF0F6',
      textSecondary: '#9AA6BC',
      primary: '#34D8E8',
      secondary: '#F0A431',
    });
    expect(BRAND_COLOR.primary).not.toBe(BRAND_DATA.logo.colors.cyan);
    expect(BRAND_COLOR.secondary).not.toBe(BRAND_DATA.logo.colors.amber);
    expect(LOGO.wordmark.map((w) => w.color)).toEqual(['#34D8E8', '#F0A431']);
  });

  it('keeps the logo asset exactly as it was', () => {
    expect(LOGO_ASSET).toMatchObject({
      source: 'assets/axiobyte-logo',
      file: 'src/brand/assets/axiobyte-logo-transparent.png',
      width: 588,
      height: 749,
      visible: { x0: 96, y0: 159, x1: 492, y1: 661 },
      extent: { x0: 10, y0: 13, x1: 578, y1: 741 },
    });
  });

  it('leaves the semantic colours alone (systems.yaml roles)', () => {
    const theme = fs.readFileSync(path.join(REPO, 'src/axiobyte_studio/design/themes/systems.yaml'), 'utf8');
    const hue = (role) => theme.match(new RegExp(`\\n  ${role}:\\n    hue: "(#[0-9A-F]{6})"`))?.[1];
    expect({ copy: hue('copy'), packet: hue('packet'), pointer: hue('pointer'), mbuf: hue('mbuf'), cpu: hue('cpu') }).toEqual({
      copy: '#FF5C55',
      packet: '#4AA8FF',
      pointer: '#F5D14F',
      mbuf: '#34D8E8',
      cpu: '#F0A431',
    });
  });
});
