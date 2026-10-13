// s01e02 — the AxioByte end card: APPENDED after the approved film (renderers/three/src/brand), never
// over it. The film's every shot, cue and lane ends where it did; the card starts exactly at the film's
// end, shows the CANONICAL AxioByte logo (the supplied artwork, never recreated in type), owns the whole
// frame, and stays centred, mobile-safe and deterministic. What the card DRAWS is checked on a
// recording canvas — never pixels.
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import words from '../../../episodes/s01e02-zero-copy/timeline/words.json';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { TimelineParser } from '../src/core/timeline/TimelineParser.js';
import { BRAND, BRAND_COLOR, LOGO, LOGO_ASSET, CTA_TYPE, CTA_LOGO_SCALE, loadBrandAssets } from '../src/brand/axiobyte.js';
import { brandEndCard, endCardBlock, END_CARD_LAYOUT } from '../src/brand/endCard.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '../../..');
const EPISODE = path.join(REPO, 'episodes/s01e02-zero-copy');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
/** The approved film's end: the voiceover plus its 1.5 s hold (three-final.mp4: 219.3 s, 6,579 frames). */
const APPROVED_TAIL = 1.5;

let story;
let tl;
/** A stand-in image for Node (no browser decoder): the loader resolves the logo's URL to it. */
const FAKE_LOGO = { width: 588, height: 749, fake: 'axiobyte-logo' };
const LOGO_PNG = path.join(REPO, 'renderers/three', LOGO_ASSET.file);

beforeAll(async () => {
  const THREE = await import('three');
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 0 : k in t ? t[k] : any()), set: (t, k, v) => ((t[k] = v), true), apply: () => any() });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => any() }) };
  const scene = new THREE.Scene();
  const registry = new ComponentRegistry();
  const { createNicScene } = await import('../src/domains/networking/nic/scene.js');
  createNicScene({ engine: { scene, aspect: 16 / 9 }, registry, camera: { definePreset() {}, addResolver() {} } });
  scene.updateMatrixWorld(true);
  const { createZeroCopyStage } = await import('../../../episodes/s01e02-zero-copy/three/stage.js');
  createZeroCopyStage({ engine: { scene }, registry });
  const { buildStoryboard } = await import('../../../episodes/s01e02-zero-copy/three/storyboard.js');
  tl = new TimelineParser(words);
  story = buildStoryboard({ timeline: tl, registry });
  await loadBrandAssets(async (url) => {
    expect(fileURLToPath(url)).toBe(LOGO_PNG);
    return FAKE_LOGO;
  });
});

const card = () => story.cues.find((c) => c.role === 'endcard');

/** Draw the card at local time `local` on a recording canvas: every string, font, fill and rectangle. */
function record(cue, local) {
  const calls = [];
  const state = { font: '', fillStyle: '', globalAlpha: 1, textAlign: 'left', letterSpacing: '0px' };
  const stack = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => {
        if (k === 'canvas') return { width: 1920, height: 1080 };
        if (k === 'fillText') return (s, x, y) => calls.push({ op: 'text', text: String(s), x, y, size: Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 0), ink: state.fillStyle, alpha: state.globalAlpha, align: state.textAlign });
        if (k === 'drawImage') return (img, x, y, w, h) => calls.push({ op: 'image', img, x, y, w, h, alpha: state.globalAlpha });
        if (k === 'fillRect') return (x, y, w, h) => calls.push({ op: 'rect', x, y, w, h, fill: typeof state.fillStyle === 'string' ? state.fillStyle : 'gradient', alpha: state.globalAlpha });
        if (k === 'measureText') return (s) => ({ width: String(s).length * 0.56 * Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 0) });
        if (k === 'save') return () => stack.push({ ...state });
        if (k === 'restore') return () => Object.assign(state, stack.pop() ?? {});
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k in state) return state[k];
        return () => {};
      },
      set: (_, k, v) => {
        state[k] = v;
        return true;
      },
    },
  );
  cue.draw(ctx, { t: cue.start + local, local, u: 0.5, a: 1, ein: 1, eout: 1, span: cue.end - cue.start, cue, project: () => null, world: {} });
  return calls;
}
const settled = () => record(card(), card().end - card().start - 0.05);

describe('the end card is appended — the approved film is untouched', () => {
  it('1–2. starts exactly where the approved film ends (the voiceover plus its hold), and runs after it', () => {
    expect(story.filmEnd).toBeCloseTo(story.audioEnd + APPROVED_TAIL, 9);
    expect(card().start).toBe(story.filmEnd);
    expect(card().end).toBe(story.duration);
    expect(story.duration - story.filmEnd).toBeGreaterThanOrEqual(3);
    expect(story.duration - story.filmEnd).toBeLessThanOrEqual(4);
  });

  it('3. leaves every frame of the film where it was: no shot, cue or section of the film starts after its end; the film’s frame count is the approved 6,579', () => {
    for (const s of story.shots) expect(s.at, 'shot').toBeLessThan(story.filmEnd);
    for (const c of story.cues.filter((x) => x.role !== 'endcard')) {
      expect(c.start, c.id).toBeLessThan(story.filmEnd);
      expect(c.end, c.id).toBeLessThanOrEqual(story.filmEnd + 1e-9);
    }
    expect(Math.round(story.filmEnd * 30)).toBe(6579);
    expect(story.sections.filter((s) => s.from >= story.filmEnd).map((s) => s.label)).toEqual(['AXIOBYTE']);
  });

  it('4. leaves the voiceover and the timeline untouched — and adds no audio of its own', () => {
    expect(sha(path.join(EPISODE, 'timeline/words.json'))).toBe('e8a05f4be6071274b2a0c3a3ca8cf8435e48512a37fe4a9c9879cc08dc42132e');
    const voiceover = path.join(EPISODE, 'voiceover.mp3');
    if (fs.existsSync(voiceover)) expect(sha(voiceover)).toBe('b5d66919c8bd45a31c32aaa242ac1d4ceac3e0eaf566b440dc527d4e4024caa1');
    expect(story.audioEnd).toBeCloseTo(tl.duration, 9);
    expect(Object.keys(card())).not.toContain('audio');
  });
});

describe('the end card carries the brand', () => {
  it('5. draws the brand: the AxioByte logo (the image), FOLLOW AXIOBYTE FOR MORE, @theaxiobytes — and the tagline only once, inside the logo', () => {
    const calls = settled();
    const images = calls.filter((c) => c.op === 'image');
    expect(images.map((c) => c.img)).toEqual([FAKE_LOGO]);
    const joined = calls.filter((c) => c.op === 'text').map((t) => t.text);
    expect(joined).toEqual(['FOLLOW AXIOBYTE FOR MORE', '@', 'theaxiobytes']);
    expect(BRAND).toMatchObject({ name: 'AxioByte', handle: '@theaxiobytes', tagline: 'Every concept has an axiom.', cta: 'FOLLOW AXIOBYTE FOR MORE' });
    // The logo carries the tagline; the card does not repeat it.
    expect(LOGO_ASSET.includesTagline).toBe(true);
    expect(joined).not.toContain(BRAND.tagline);
    // Not a generic outro: one call, no like / comment / share / subscribe / notifications.
    expect(joined.join(' ')).not.toMatch(/\b(LIKE|COMMENT|SHARE|SUBSCRIBE|NOTIFICATION)/i);
  });

  it('1–3 + 6. uses the canonical logo: the supplied artwork, untouched, rendered through its transparent extraction — never a typographic recreation', () => {
    // The canonical source, untouched.
    expect(sha(path.join(REPO, 'assets/axiobyte-logo'))).toBe('41974d6c71e2e0ab1abe10fa24e78b4cd19b8aeb796d932478032f102675a455');
    expect(LOGO_ASSET.source).toBe('assets/axiobyte-logo');
    // The rendering asset: an RGBA PNG of the extraction (assets/extract_logo.py, deterministic).
    const png = fs.readFileSync(LOGO_PNG);
    expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([LOGO_ASSET.width, LOGO_ASSET.height, 8, 6]); // 8-bit RGBA
    expect(sha(LOGO_PNG)).toBe('035e306ab0eae3b3ad55eb5dc7b88d73695bbdaa8d0a0fee608262f5e4de8de9');
    // The card draws that image — and no lettering of the logo in a typeface.
    const calls = settled();
    expect(calls.filter((c) => c.op === 'image').length).toBe(1);
    expect(typographicLogo(calls)).toEqual([]);
    // The palette is the theme's (systems.yaml); the logo's two halves are its cyan and amber.
    const theme = fs.readFileSync(path.join(REPO, 'src/axiobyte_studio/design/themes/systems.yaml'), 'utf8');
    const val = (re) => re.exec(theme)[1].toUpperCase();
    expect(BRAND_COLOR.background.toUpperCase()).toBe(val(/^\s+bg: "(#[0-9A-Fa-f]{6})"/m));
    expect(BRAND_COLOR.textPrimary.toUpperCase()).toBe(val(/^\s+primary: "(#[0-9A-Fa-f]{6})"/m));
    expect(BRAND_COLOR.primary.toUpperCase()).toBe(val(/mbuf:\s*\n\s+hue: "(#[0-9A-Fa-f]{6})"/m)); // "the AxioByte mark"
    expect(BRAND_COLOR.secondary.toUpperCase()).toBe(val(/cpu:\s*\n\s+hue: "(#[0-9A-Fa-f]{6})"/m));
    expect(LOGO.wordmark.map((w) => w.text).join('')).toBe('AxioByte');
  });

  it('7. owns the whole frame once it is up: an opaque ground over everything, above every other layer — no E02 element shows through, no episode semantic colour on it', () => {
    const ground = settled().find((c) => c.op === 'rect' && c.x === 0 && c.y === 0 && c.w === 1920 && c.h === 1080);
    expect(ground.fill.toUpperCase()).toBe(BRAND_COLOR.background.toUpperCase());
    expect(ground.alpha).toBe(1);
    for (const c of story.cues.filter((x) => x.role !== 'endcard')) expect(card().layer, c.id).toBeGreaterThan(c.layer ?? 10);
    const inks = settled().filter((c) => c.op === 'text').map((c) => String(c.ink).toUpperCase());
    for (const semantic of ['#4AA8FF', '#F5D14F', '#FF5C55', '#B79CF0', '#4DE6A0']) expect(inks).not.toContain(semantic); // bytes, pointer, copy, memory, NIC
  });
});

describe('the end card is mobile-safe, centred and deterministic', () => {
  it('8. is mobile-safe (1920×1080 pixels): the logo’s visible lockup ≥ 400 px tall, the call ≥ 60, the handle ≥ 48 — the logo the hero, the call next', () => {
    const size = (t) => settled().find((c) => c.op === 'text' && c.text === t).size;
    const logoH = END_CARD_LAYOUT.logoVisible.bottom - END_CARD_LAYOUT.logoVisible.top;
    expect(logoH).toBeGreaterThanOrEqual(400); // ≥ 80 px on a 390 px-wide phone
    expect(size('FOLLOW AXIOBYTE FOR MORE')).toBeGreaterThanOrEqual(60);
    expect(size('theaxiobytes')).toBeGreaterThanOrEqual(48);
    expect(CTA_TYPE.call.size).toBeGreaterThan(CTA_TYPE.handle.size);
    expect(logoH).toBeGreaterThan(CTA_TYPE.call.size * 4);
  });

  it('6–7 + 9–10. keeps the logo’s lockup and every line inside the title-safe frame, the whole logo image inside the frame (nothing clipped), centred — horizontally, and vertically within ±60 px', () => {
    const img = settled().find((c) => c.op === 'image');
    expect(img.x).toBeGreaterThanOrEqual(0);
    expect(img.y).toBeGreaterThanOrEqual(0);
    expect(img.x + img.w).toBeLessThanOrEqual(1920);
    expect(img.y + img.h).toBeLessThanOrEqual(1080);
    expect(img.w / img.h).toBeCloseTo(LOGO_ASSET.width / LOGO_ASSET.height, 2); // never stretched
    expect(img.w / LOGO_ASSET.width).toBeCloseTo(CTA_LOGO_SCALE, 2);
    const v = LOGO_ASSET.visible;
    const vis = { x0: img.x + v.x0 * CTA_LOGO_SCALE, x1: img.x + v.x1 * CTA_LOGO_SCALE, y0: img.y + v.y0 * CTA_LOGO_SCALE, y1: img.y + v.y1 * CTA_LOGO_SCALE };
    expect(vis.x0).toBeGreaterThanOrEqual(112);
    expect(vis.x1).toBeLessThanOrEqual(1808);
    expect(vis.y0).toBeGreaterThanOrEqual(76);
    expect(vis.y1).toBeLessThanOrEqual(1004);
    expect(Math.abs((vis.x0 + vis.x1) / 2 - 960)).toBeLessThanOrEqual(2);
    for (const c of settled().filter((x) => x.op === 'text')) {
      const w = c.text.length * 0.6 * c.size; // generous width bound
      const x0 = c.align === 'center' ? c.x - w / 2 : c.x;
      expect(x0, c.text).toBeGreaterThanOrEqual(112);
      expect(x0 + w, c.text).toBeLessThanOrEqual(1808);
      expect(c.y - c.size, c.text).toBeGreaterThanOrEqual(76);
      expect(c.y, c.text).toBeLessThanOrEqual(1004);
      expect(c.y - c.size * 0.74, `${c.text} below the logo`).toBeGreaterThan(vis.y1);
    }
    expect(END_CARD_LAYOUT.centreX).toBe(960);
    expect(Math.abs(endCardBlock().centreY - 540)).toBeLessThanOrEqual(60);
  });

  it('balances the card as ONE group: everything the logo shows (its faint outer echo included) to the handle, centred — equal room above and below', () => {
    const { top, bottom, centreY } = endCardBlock();
    const extentTop = END_CARD_LAYOUT.logo.y + LOGO_ASSET.extent.y0 * CTA_LOGO_SCALE;
    expect(top).toBeCloseTo(extentTop, 0); // the group starts where the logo's visible extent does
    expect(Math.abs(centreY - 540)).toBeLessThanOrEqual(3);
    expect(Math.abs(top - (1080 - bottom))).toBeLessThanOrEqual(10); // room above ≈ room below
    expect(top).toBeGreaterThanOrEqual(120); // breathing room — not crowded against the top
    expect(1080 - bottom).toBeGreaterThanOrEqual(120);
    // The internal spacing is the approved one: the call 56 px below the lockup, the handle 76 px below the call.
    expect(END_CARD_LAYOUT.callY - CTA_TYPE.call.size * 0.74 - END_CARD_LAYOUT.logoVisible.bottom).toBeCloseTo(56, 0);
    expect(END_CARD_LAYOUT.handleY - END_CARD_LAYOUT.callY).toBe(76);
    expect(CTA_LOGO_SCALE).toBe(0.91); // the approved logo size, unchanged
  });

  it('11–12. draws the same card for the same moment, every time — and a fresh card from the same inputs draws it identically', () => {
    for (const local of [0.2, 0.7, 1.3, 2.0, 3.4]) {
      expect(record(card(), local)).toEqual(record(card(), local));
      expect(record(brandEndCard({ start: card().start, end: card().end }), local)).toEqual(record(card(), local));
    }
  });
});

describe('the guards fire (mutation tests)', () => {
  it('detects a card that starts over the film, a wrong handle, and an episode colour on the card', () => {
    const early = brandEndCard({ start: story.filmEnd - 1, end: story.duration });
    expect(early.start).toBeLessThan(story.filmEnd);
    const wrong = record(brandEndCard({ start: 0, end: 4, brand: { ...BRAND, handle: '@axiobyte' } }), 3.9).map((c) => c.text);
    expect(wrong).not.toContain('theaxiobytes');
    const tinted = record(brandEndCard({ start: 0, end: 4, color: { ...BRAND_COLOR, textPrimary: '#4AA8FF' } }), 3.9).filter((c) => c.op === 'text').map((c) => String(c.ink).toUpperCase());
    expect(tinted).toContain('#4AA8FF');
  });

  it('detects a top-heavy card (mutation: the group centred on the lockup alone, ignoring the logo’s outer echo)', () => {
    const lockupCentred = { top: END_CARD_LAYOUT.logoExtent.top - 67, bottom: endCardBlock().bottom - 67 };
    expect(Math.abs(lockupCentred.top - (1080 - lockupCentred.bottom))).toBeGreaterThan(10);
  });

  it('detects a typographic recreation of the logo, and a duplicated tagline', () => {
    const fake = [{ op: 'text', text: 'Axio' }, { op: 'text', text: 'Byte' }];
    expect(typographicLogo(fake)).toEqual(['Axio', 'Byte']);
    expect(typographicLogo([{ op: 'text', text: 'AxioByte' }])).toEqual(['AxioByte']);
    expect(typographicLogo([{ op: 'text', text: BRAND.tagline }])).toEqual([BRAND.tagline]);
  });

  it('refuses to draw the card without the logo loaded — it never falls back to a typed wordmark', async () => {
    const { brandLogoImage } = await import('../src/brand/axiobyte.js');
    const loaded = brandLogoImage();
    await loadBrandAssets(async () => null);
    expect(() => record(card(), 3)).toThrow(/logo is not loaded/);
    await loadBrandAssets(async () => loaded);
    expect(() => record(card(), 3)).not.toThrow();
  });
});

/** Guard: any lettering of the logo — its wordmark or its tagline — set as text instead of drawn as the image. */
function typographicLogo(calls) {
  return calls.filter((c) => c.op === 'text' && /^(Axio|Byte|AxioByte)$|Every concept has an axiom/.test(c.text)).map((c) => c.text);
}
