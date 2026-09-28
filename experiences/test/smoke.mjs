#!/usr/bin/env node
/**
 * Smoke test for the built experiences, served the way the website serves
 * them: the whole dist/ mounted under /axiobyte/, never at the root. Any
 * root-relative URL, missing asset or runtime error fails the run.
 *
 *   npm run build && npm test          (from experiences/, or -w @axiobyte/experiences)
 *
 * For each experience in dist/manifest.json it checks: the page boots without
 * the WebGL fallback, it registers components, no request escapes the mount or
 * 404s, and the canvas follows a phone-sized viewport.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { chromePath } from '@axiobyte/three/tools/lib/episode.mjs';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MOUNT = '/axiobyte/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json missing — run the build first');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const entries = manifest.domains.flatMap((d) => d.experiences);

const misses = [];
const server = http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = url.startsWith(MOUNT) ? path.join(DIST, url.slice(MOUNT.length)) : null;
    if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file || !fs.existsSync(file)) {
      if (!url.endsWith('/favicon.ico')) misses.push(url);
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'shell', args: ['--enable-unsafe-swiftshader'] });
let failed = 0;
try {
  for (const e of entries) {
    misses.length = 0;
    const errors = [];
    const page = await browser.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://127.0.0.1:${port}${MOUNT}${e.path}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction('window.__AXIOBYTE__?.registry', { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(() => ({
      fallback: !document.getElementById('fallback')?.hidden,
      parts: window.__AXIOBYTE__?.registry.all().length ?? 0,
    }));
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise((ok) => setTimeout(ok, 600));
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? [c.clientWidth, c.clientHeight] : null;
    });
    await page.close();
    const problems = [
      ...errors.map((m) => `error: ${m}`),
      ...misses.map((u) => `missing: ${u}`),
      ...(r.fallback ? ['WebGL fallback shown'] : []),
      ...(r.parts ? [] : ['no components registered']),
      ...(canvas && canvas[0] === 390 ? [] : [`canvas did not follow a 390px viewport: ${canvas}`]),
    ];
    console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${MOUNT}${e.path}  (${r.parts} components)`);
    problems.forEach((p) => console.log(`        ${p}`));
    if (problems.length) failed++;
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} of ${entries.length} experiences failed` : `\nall ${entries.length} experiences pass under ${MOUNT}`);
process.exit(failed ? 1 : 0);
