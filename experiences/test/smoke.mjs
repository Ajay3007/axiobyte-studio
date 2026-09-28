#!/usr/bin/env node
/**
 * Smoke test for the built experiences, served the way the website serves
 * them: the whole dist/ mounted under /axiobyte/, never at the root.
 *
 *   npm run build && npm test          (from experiences/, or -w @axiobyte/experiences)
 *
 * For each experience in dist/manifest.json it fails on:
 *   - the application never becoming ready: its registry holds components AND
 *     the renderer has drawn a frame (draw calls > 0) — proof the Three.js
 *     scene initialised, not merely that the page loaded;
 *   - the WebGL fallback being shown;
 *   - any page error or console error;
 *   - any local request that 404s, fails, or escapes the /axiobyte/ mount
 *     (a root-relative URL);
 *   - the canvas not following a phone-sized viewport.
 *
 * Readiness is the application's own signal, never "network idle": an idle
 * network is neither necessary nor sufficient for the scene to exist, and a
 * third-party request that never settles would stall it forever. When a page
 * does fail, it prints what it was waiting on — URL, document state, the
 * readiness state, failed and still-pending requests — so the log names the
 * cause instead of just "timeout".
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
/** Budget for the document to parse. */
const NAVIGATION_MS = 30000;
/** Budget, after that, for the scene to initialise and draw (software WebGL on CI is slow). */
const READY_MS = 45000;

if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json missing — run the build first');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const entries = manifest.domains.flatMap((d) => d.experiences);

const misses = [];
const server = http.createServer((req, res) => {
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
const origin = `http://127.0.0.1:${server.address().port}`;

/** Ready means drawn, or a definitive failure (the fallback) — no guessing. */
const isReady = () => {
  const api = window.__AXIOBYTE__;
  const fallback = document.getElementById('fallback');
  if (fallback && !fallback.hidden) return 'fallback';
  return api && api.registry.all().length > 0 && api.stats().calls > 0 ? 'ready' : false;
};
const waitReady = (page) =>
  page.waitForFunction(isReady, { timeout: READY_MS, polling: 100 }).then((h) => h.jsonValue(), () => 'timeout');

/** The application's readiness, as the page itself reports it. */
const readiness = () => {
  const api = window.__AXIOBYTE__;
  const fallback = document.getElementById('fallback');
  return {
    readyState: document.readyState,
    fallbackShown: Boolean(fallback && !fallback.hidden),
    api: Boolean(api),
    components: api?.registry?.all().length ?? 0,
    drawCalls: api?.stats?.().calls ?? 0,
  };
};

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'shell', args: ['--enable-unsafe-swiftshader'] });
console.log(`browser: ${await browser.version()} (${chromePath()})`);
let failed = 0;
try {
  for (const e of entries) {
    misses.length = 0;
    const errors = [];
    const failedLocal = [];
    const external = [];
    const pending = new Map();
    const page = await browser.newPage();
    page.on('pageerror', (err) => errors.push(`page error: ${err.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console error: ${m.text()}`));
    page.on('request', (q) => pending.set(q, Date.now()));
    page.on('requestfinished', (q) => {
      pending.delete(q);
      const status = q.response()?.status() ?? 0;
      if (!q.url().startsWith(origin)) external.push(`${status} ${q.url()}`);
      else if (status >= 400) failedLocal.push(`${status} ${q.url().slice(origin.length)}`);
    });
    page.on('requestfailed', (q) => {
      pending.delete(q);
      const why = q.failure()?.errorText ?? 'failed';
      if (!q.url().startsWith(origin)) external.push(`${why} ${q.url()}`);
      else failedLocal.push(`${why} ${q.url().slice(origin.length)}`);
    });

    await page.setViewport({ width: 1280, height: 800 });
    const url = `${origin}${MOUNT}${e.path}`;
    const t0 = Date.now();
    let navigation = 'ok';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_MS });
    } catch (err) {
      navigation = `${err.name}: ${err.message}`;
    }
    const tParsed = Date.now() - t0;

    const outcome = await waitReady(page);
    const tReady = Date.now() - t0;
    const state = await page.evaluate(readiness).catch((err) => ({ error: err.message }));

    let canvas = null;
    let mobile = 'not run';
    if (outcome === 'ready') {
      // An isMobile viewport makes Chrome reload the page, so the phone check
      // waits for the same readiness again before measuring anything.
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      mobile = await waitReady(page);
      canvas = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        return c ? [c.clientWidth, c.clientHeight] : null;
      });
    }
    const stillPending = [...pending].map(([q, at]) => `${q.url()} (${Date.now() - at} ms)`);
    const currentUrl = page.url();
    await page.close();

    const problems = [
      ...(outcome === 'ready' ? [] : [`not ready after ${tReady} ms: ${outcome}`]),
      ...(navigation === 'ok' ? [] : [`navigation: ${navigation}`]),
      ...errors,
      ...failedLocal.map((r) => `local request failed: ${r}`),
      ...misses.map((u) => `missing or outside ${MOUNT}: ${u}`),
      ...(state.fallbackShown ? ['WebGL fallback shown'] : []),
      ...(outcome === 'ready' && mobile !== 'ready' ? [`not ready on a phone viewport: ${mobile}`] : []),
      ...(outcome === 'ready' && !(canvas && canvas[0] === 390) ? [`canvas did not follow a 390px viewport: ${canvas}`] : []),
    ];
    const summary = `${state.components ?? 0} components, ${state.drawCalls ?? 0} draw calls, parsed ${tParsed} ms, ready ${tReady} ms`;
    console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${MOUNT}${e.path}  (${summary})`);
    problems.forEach((p) => console.log(`        ${p}`));
    // Always reported, so CI logs show third-party dependencies even on a pass.
    [...new Set(external)].forEach((r) => console.log(`        external: ${r}`));
    stillPending.forEach((r) => console.log(`        still pending: ${r}`));
    if (problems.length) {
      console.log(`        url: ${currentUrl}`);
      console.log(`        state: ${JSON.stringify(state)}`);
      failed++;
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} of ${entries.length} experiences failed` : `\nall ${entries.length} experiences pass under ${MOUNT}`);
process.exit(failed ? 1 : 0);
