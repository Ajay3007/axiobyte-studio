#!/usr/bin/env node
/**
 * A voiceover.mpeg is often an MPEG program stream wrapping an MP3 elementary
 * stream. ffmpeg reads it happily, so the offline renderer uses it directly,
 * but a browser <audio> element cannot — and the preview page needs real audio
 * to check lip-sync against the timeline.
 *
 * This lifts the audio out of the container with a stream copy into
 * <episode>/out/voiceover.mp3: no re-encode, no resampling, identical sample
 * timing. The result is derived and gitignored.
 *
 *   node renderers/three/tools/prepare-audio.mjs --episode <dir>
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveEpisode, rel } from './lib/episode.mjs';

const i = process.argv.indexOf('--episode');
const ep = resolveEpisode(i >= 0 ? process.argv[i + 1] : null);
const SRC = ep.audio;
const OUT = path.join(ep.out, 'voiceover.mp3');

if (!fs.existsSync(SRC)) {
  console.error(`missing ${rel(SRC)} — the voiceover is a local input (gitignored); put it there first`);
  process.exit(1);
}
if (fs.existsSync(OUT) && fs.statSync(OUT).mtimeMs >= fs.statSync(SRC).mtimeMs) {
  console.log(`${rel(OUT)} is up to date`);
  process.exit(0);
}
fs.mkdirSync(ep.out, { recursive: true });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', SRC, '-map', '0:a:0', '-c:a', 'copy', OUT], { stdio: 'inherit' });

const probe = (f) =>
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f]).toString().trim();
console.log(`${rel(OUT)}  ${probe(OUT)} s  (source ${probe(SRC)} s)`);
