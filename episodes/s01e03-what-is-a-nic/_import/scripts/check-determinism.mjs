#!/usr/bin/env node
/**
 * Determinism check: renders the same timestamps in two independent browser
 * sessions and compares the bytes. If anything in video mode ever starts
 * reading a wall clock, this is what catches it.
 *
 *   npm run check:determinism
 */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';

const ROOT = '/Users/dukhi8ma/Documents/dev/projects/nic-3d';
const FRAMES = [90, 3600, 11670, 12330, 15480, 20880]; // 3s, 2:00, 6:29, 6:51, 8:36, 11:36

async function pass() {
  const server = await createServer({
    root: ROOT, configFile: ROOT + '/vite.config.js',
    server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'warn',
  });
  await server.listen();
  const port = server.httpServer.address().port;
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'shell', defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'],
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/video.html?render=1&fps=30&ss=2&tail=1.5`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__VIDEO_READY__ === true', { timeout: 180000 });
  const out = {};
  for (const f of FRAMES) {
    const d = await page.evaluate((i) => window.__VIDEO__.encodeFrame(i, { type: 'image/png' }), f);
    out[f] = crypto.createHash('sha256').update(d).digest('hex').slice(0, 16);
  }
  await browser.close(); await server.close();
  return out;
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
process.exit(ok ? 0 : 1);
