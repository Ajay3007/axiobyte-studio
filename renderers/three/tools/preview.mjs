#!/usr/bin/env node
/**
 * Live preview of a Three.js episode's video page — the transport HUD, the real
 * voiceover, hot reload — for authoring cues. Nothing here writes a frame; the
 * offline renderer (render.mjs) is what makes the film.
 *
 *   node renderers/three/tools/preview.mjs --episode <dir> [--port 5174] [--open]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { resolveEpisode, rel } from './lib/episode.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ep = resolveEpisode(opt('--episode'));

if (fs.existsSync(ep.audio)) {
  const tools = path.dirname(fileURLToPath(import.meta.url));
  execFileSync(process.execPath, [path.join(tools, 'prepare-audio.mjs'), '--episode', ep.root], { stdio: 'inherit' });
} else {
  console.log(`no voiceover at ${rel(ep.audio)} — the preview runs silent (it is a local, gitignored input)`);
}

const server = await createServer({
  root: ep.root,
  configFile: false,
  server: { port: Number(opt('--port') ?? 5174), open: args.includes('--open') ? ep.page : false },
});
await server.listen();
console.log(`\n  ${ep.id} preview → ${server.resolvedUrls.local[0].replace(/\/$/, '')}${ep.page}`);
console.log('  space play/pause · ←/→ frame · shift ±1s · ,/. chapter · c captions\n');
