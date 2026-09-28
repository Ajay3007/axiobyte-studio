#!/usr/bin/env node
/**
 * The supplied voiceover.mpeg is an MPEG program stream wrapping an MP3
 * elementary stream. ffmpeg reads it happily, so the offline renderer uses it
 * directly, but a browser <audio> element cannot — and the preview page needs
 * real audio to check lip-sync against the timeline.
 *
 * This lifts the MP3 out of the container with a stream copy: no re-encode,
 * no resampling, identical sample timing. Run it once (npm run audio); the
 * result is a derived file and is git-ignored.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content/nic/voiceover.mpeg');
const OUT = path.join(ROOT, 'content/nic/voiceover.mp3');

if (!fs.existsSync(SRC)) {
  console.error(`missing ${path.relative(ROOT, SRC)}`);
  process.exit(1);
}
if (fs.existsSync(OUT) && fs.statSync(OUT).mtimeMs >= fs.statSync(SRC).mtimeMs) {
  console.log(`${path.relative(ROOT, OUT)} is up to date`);
  process.exit(0);
}

execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', SRC, '-map', '0:a:0', '-c:a', 'copy', OUT], { stdio: 'inherit' });

const probe = (f) =>
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f]).toString().trim();
console.log(`${path.relative(ROOT, OUT)}  ${probe(OUT)} s  (source ${probe(SRC)} s)`);
