#!/usr/bin/env node
/**
 * Determinism check: renders the same frames of an episode in two independent
 * browser sessions and compares the bytes. If anything in the video target ever
 * starts reading a wall clock, this is what catches it.
 *
 *   node renderers/three/tools/check-determinism.mjs --episode <dir> [--frames 90,3600] [--expect <file>]
 *
 * --expect compares against a saved baseline ("frame hash" per line, as this
 * tool prints), which is how a refactor proves it changed no pixel.
 */
import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { resolveEpisode, videoServer, chromePath } from './lib/episode.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ep = resolveEpisode(opt('--episode'));
// Defaults cover the NIC film's hard moments: 3s, 2:00, 6:29, 6:51, 8:36, 11:36.
const FRAMES = (opt('--frames') ?? '90,3600,11670,12330,15480,20880').split(',').map(Number);

async function pass() {
  const { server, base } = await videoServer(ep);
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: 'shell',
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}${ep.page}?render=1&fps=30&ss=2&tail=1.5`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__VIDEO_READY__ === true', { timeout: 180000 });
    const out = {};
    for (const f of FRAMES) {
      const d = await page.evaluate((i) => window.__VIDEO__.encodeFrame(i, { type: 'image/png' }), f);
      out[f] = crypto.createHash('sha256').update(d).digest('hex').slice(0, 16);
    }
    return out;
  } finally {
    await browser.close();
    await server.close();
  }
}

const a = await pass();
const b = await pass();
let ok = true;
for (const f of FRAMES) {
  const same = a[f] === b[f];
  if (!same) ok = false;
  console.log(`frame ${String(f).padStart(6)}  ${a[f]}  ${b[f]}  ${same ? 'identical' : 'DIFFERS'}`);
}
console.log(ok ? '\nDETERMINISTIC: every frame byte-identical across sessions' : '\nNON-DETERMINISTIC');

const expectFile = opt('--expect');
if (expectFile) {
  const expected = Object.fromEntries(
    fs.readFileSync(expectFile, 'utf8').split('\n')
      .map((l) => l.match(/^frame\s+(\d+)\s+([0-9a-f]{16})/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  for (const f of FRAMES) {
    if (!(f in expected)) continue;
    const match = expected[f] === a[f];
    if (!match) ok = false;
    console.log(`baseline ${String(f).padStart(6)}  ${expected[f]}  ${match ? 'matches' : `CHANGED → ${a[f]}`}`);
  }
}
process.exit(ok ? 0 : 1);
