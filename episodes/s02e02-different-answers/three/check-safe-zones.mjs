#!/usr/bin/env node
/**
 * Mobile-safe audit for s02e02 (copied from s02e01's, with a time range): steps
 * through the film and reports every readable tile, label or answer word that
 * reaches into the Reels/Shorts interface zones (design/targets/9x16.yaml
 * platform_safe: right 14%, bottom 18%).
 *
 *   node episodes/s02e02-different-answers/three/check-safe-zones.mjs [--step 0.2] [--from 31] [--to 72.7]
 *
 * Text is "readable" above 15% opacity, and "intruding" when more than 15% of its
 * on-screen box is inside a zone. Exit status 1 if anything is reported.
 */
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveEpisode, videoServer, chromePath } from '../../../renderers/three/tools/lib/episode.mjs';

const arg = (name, dflt) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : dflt);
const step = arg('--step', 0.2) || 0.2;
const from = arg('--from', 0);
const to = arg('--to', Infinity);
const ep = resolveEpisode(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const { server, base } = await videoServer(ep);
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'shell', args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.goto(`${base}${ep.page}?render=1&ss=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__VIDEO_READY__ === true', { timeout: 180000 });
  const found = await page.evaluate(async (dt, from, to) => {
    const { screenBox, intrusion } = await import('/three/safe.js');
    const V = window.__VIDEO__;
    const camera = V.world.engine.camera;
    const items = [];
    V.world.engine.scene.traverse((o) => o.userData.safe && items.push(o));
    const hits = [];
    const filmEnd = V.story.filmEnd ?? V.duration;
    for (let t = from; t < Math.min(filmEnd, to); t += dt) {
      V.seek(t);
      camera.updateMatrixWorld();
      for (const o of items) {
        const { w, h, label, face } = o.userData.safe;
        let visible = true;
        o.traverseAncestors((a) => (visible &&= a.visible));
        const opacity = face.visible && o.visible && visible ? face.material.opacity : 0;
        if (opacity < 0.15) continue;
        const u = intrusion(screenBox(camera, o, w, h));
        if (u > 0.15) hits.push({ t: +t.toFixed(2), label, opacity: +opacity.toFixed(2), into: +u.toFixed(2) });
      }
    }
    return { hits, checked: items.length, frames: Math.ceil((Math.min(filmEnd, to) - from) / dt) };
  }, step, from, to);
  console.log(`checked ${found.checked} text objects over ${found.frames} instants (every ${step}s)`);
  // Group consecutive instants of the same label into spans.
  const spans = [];
  for (const h of found.hits) {
    const last = spans.find((s) => s.label === h.label && Math.abs(s.to - h.t) <= step * 1.5);
    if (last) Object.assign(last, { to: h.t, into: Math.max(last.into, h.into), opacity: Math.max(last.opacity, h.opacity) });
    else spans.push({ label: h.label, from: h.t, to: h.t, into: h.into, opacity: h.opacity });
  }
  for (const s of spans) console.log(`  ${s.from.toFixed(1).padStart(6)}–${s.to.toFixed(1).padEnd(6)} ${s.label.padEnd(10)} up to ${Math.round(s.into * 100)}% inside a zone, opacity ${s.opacity}`);
  console.log(spans.length ? `${spans.length} intrusion span(s)` : 'mobile-safe: no readable text in the platform zones');
  process.exitCode = spans.length ? 1 : 0;
} finally {
  await browser.close();
  await server.close();
}
