#!/usr/bin/env node
/**
 * E02 Zero Copy: render the YouTube thumbnail (thumbnail.html) to
 * episodes/s01e02-zero-copy/out/youtube/thumbnail.{png,jpg}, with previews at 640×360 and 320×180.
 *
 * A publishing asset, not part of the film: it reads nothing from the episode's scenes and changes nothing.
 * Colours come from the design theme (src/axiobyte_studio/design/themes/systems.yaml), the type is the
 * renderer's self-hosted Barlow Semi Condensed, and the drawing is deterministic.
 *
 *   node episodes/s01e02-zero-copy/social/youtube/thumbnail.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { chromePath } from '../../../../renderers/three/tools/lib/episode.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const OUT = path.join(REPO, 'episodes/s01e02-zero-copy/out/youtube');
const FONTS = path.join(REPO, 'renderers/three/src/web/fonts/barlow-semi-condensed.css');

/** The theme's values for the roles the thumbnail uses (systems.yaml is the only place colours live). */
function themeColours() {
  const yaml = fs.readFileSync(path.join(REPO, 'src/axiobyte_studio/design/themes/systems.yaml'), 'utf8');
  const value = (block, key) => {
    const m = new RegExp(`\\n  ${block}:\\n(?:    .*\\n)*?    ${key}: "(#[0-9A-Fa-f]{6})"`).exec(yaml);
    if (!m) throw new Error(`systems.yaml: no ${block}.${key}`);
    return m[1];
  };
  const flat = (key) => {
    const m = new RegExp(`\\n  ${key}: "(#[0-9A-Fa-f]{6})"`).exec(yaml);
    if (!m) throw new Error(`systems.yaml: no ${key}`);
    return m[1];
  };
  return {
    bg: flat('bg'),
    surface: flat('surface'),
    border: flat('border'),
    ink: flat('primary'),
    inkSecondary: flat('secondary'),
    packet: value('packet', 'hue'),
    memory: value('memory', 'hue'),
    memorySurface: value('memory', 'surface'),
    pointer: value('pointer', 'hue'),
  };
}

const colours = themeColours();
fs.mkdirSync(OUT, { recursive: true });

// The page imports the renderer's font stylesheet through a tiny shim served next to it.
const server = await createServer({
  root: HERE,
  configFile: false,
  logLevel: 'silent',
  server: { port: 0, fs: { allow: [REPO] } },
  plugins: [
    {
      name: 'fonts-shim',
      configureServer(s) {
        s.middlewares.use('/fonts.css', (_, res) => {
          res.setHeader('Content-Type', 'text/css');
          res.end(`@import url('/@fs${FONTS}');`);
        });
      },
    },
  ],
});
await server.listen();
const url = `${server.resolvedUrls.local[0]}thumbnail.html`;

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready__);
  const result = await page.evaluate(async (C) => {
    await Promise.all(['600', '700'].map((w) => document.fonts.load(`${w} 64px "Barlow Semi Condensed"`)));
    if (!document.fonts.check('700 64px "Barlow Semi Condensed"')) throw new Error('Barlow Semi Condensed did not load');
    const canvas = window.__render__(C);
    const scaled = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(canvas, 0, 0, w, h);
      return c.toDataURL('image/png');
    };
    return {
      png: canvas.toDataURL('image/png'),
      jpg: canvas.toDataURL('image/jpeg', 0.92),
      p640: scaled(640, 360),
      p320: scaled(320, 180),
      p168: scaled(168, 94),
    };
  }, colours);
  const write = (name, dataUrl) => {
    fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`wrote ${path.relative(REPO, path.join(OUT, name))}`);
  };
  write('thumbnail.png', result.png);
  write('thumbnail.jpg', result.jpg);
  write('thumbnail-preview-640x360.png', result.p640);
  write('thumbnail-preview-320x180.png', result.p320);
  write('thumbnail-preview-168x94.png', result.p168);
} finally {
  await browser.close();
  await server.close();
}
