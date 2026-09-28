/**
 * What the Three.js video tools need to know about an episode, resolved from
 * its directory alone — no machine paths, no episode names baked in.
 *
 *   <episode>/three/video.html     the video-target page (entry: three/video-main.js)
 *   <episode>/audio/voiceover.*    the master clock's audio — a local input, gitignored
 *   <episode>/out/                 every derived file (gitignored)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

export function resolveEpisode(dir, { audio } = {}) {
  if (!dir) throw new Error('--episode <dir> is required, e.g. --episode episodes/s01e03-what-is-a-nic');
  const root = path.resolve(dir);
  const page = path.join(root, 'three', 'video.html');
  if (!fs.existsSync(page)) throw new Error(`${path.relative(process.cwd(), page)} not found — is ${dir} a Three.js episode?`);
  const audioDir = path.join(root, 'audio');
  const found = fs.existsSync(audioDir)
    ? fs.readdirSync(audioDir).find((f) => /^voiceover\.(mpeg|mp3|wav|m4a|flac)$/.test(f))
    : null;
  return {
    root,
    id: path.basename(root),
    page: '/three/video.html',
    audio: audio ? path.resolve(audio) : found ? path.join(audioDir, found) : path.join(audioDir, 'voiceover.mpeg'),
    out: path.join(root, 'out'),
  };
}

/** A Vite dev server rooted at the episode. HMR and the watcher are off: an edit mid-render must not reload the page. */
export async function videoServer(ep, { port = 0, strictPort = false } = {}) {
  const server = await createServer({
    root: ep.root,
    configFile: false,
    server: { port, strictPort, host: '127.0.0.1', hmr: false, watch: null },
    logLevel: 'warn',
  });
  await server.listen();
  return { server, base: `http://127.0.0.1:${server.httpServer.address().port}` };
}

export function chromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found. Set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium binary.');
  return hit;
}

/** A path for log lines: relative to where the user ran the command. */
export const rel = (p) => path.relative(process.cwd(), p) || '.';
