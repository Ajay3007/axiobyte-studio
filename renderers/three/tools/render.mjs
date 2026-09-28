#!/usr/bin/env node
/**
 * Offline renderer: timeline.json → frames → ffmpeg → final/nic-video.mp4
 *
 *   node scripts/render.mjs                        full video, 1920x1080 @ 30fps
 *   node scripts/render.mjs --from 0 --to 0:30     preview A
 *   node scripts/render.mjs --from 7:15 --to 8:30  preview B
 *   node scripts/render.mjs --stills 0:05,3:00     PNG stills for review
 *
 * A Vite dev server is started in-process and driven by headless-capable
 * Chrome; the page exposes __VIDEO__.encodeFrame(i), which is a pure function
 * of the frame index. Frames are piped straight into ffmpeg, so nothing is
 * ever written to disk except the finished file.
 */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'content/nic/voiceover.mpeg');

// ------------------------------------------------------------------- args
function parseArgs(argv) {
  const o = {
    fps: 30,
    ss: 2,
    out: 'final/nic-video.mp4',
    format: 'jpeg',
    quality: 0.97,
    crf: 17,
    preset: 'medium',
    captions: false,
    audio: true,
    normalize: false,
    headless: false,
    tail: 1.5,
    port: 0, // 0 = let the OS pick; avoids colliding with a dev server
    from: 0,
    to: null,
    warmup: null,
    stills: null,
    sheet: null,
    cols: 3,
    probe: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--fps': o.fps = Number(next()); break;
      case '--ss': o.ss = Number(next()); break;
      case '--out': o.out = next(); break;
      case '--format': o.format = next(); break;
      case '--quality': o.quality = Number(next()); break;
      case '--crf': o.crf = Number(next()); break;
      case '--preset': o.preset = next(); break;
      case '--tail': o.tail = Number(next()); break;
      case '--port': o.port = Number(next()); break;
      case '--from': o.from = time(next()); break;
      // Frames stepped (but not written) before the first output frame, so a
      // segment that starts mid-video has the same integrated state — LED
      // easing, mostly — as a render that played into it from zero.
      case '--warmup': o.warmup = Number(next()); break;
      case '--to': o.to = time(next()); break;
      case '--stills': o.stills = next().split(',').map(time); break;
      // Contact sheet for review: "auto" = two seconds into every camera shot,
      // "every:20" = one frame every 20 s, or an explicit comma list.
      case '--sheet': o.sheet = next(); break;
      case '--cols': o.cols = Number(next()); break;
      case '--captions': o.captions = true; break;
      case '--no-audio': o.audio = false; break;
      case '--normalize': o.normalize = true; break;
      case '--headless': o.headless = true; break;
      case '--probe': o.probe = true; break;
      case '--help':
      case '-h':
        console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^#!.*\n/, ''));
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option ${a}`);
    }
  }
  return o;
}

/** "7:15" | "7:15.5" | "435" → seconds */
function time(s) {
  if (s == null) throw new Error('missing time value');
  const parts = String(s).split(':').map(Number);
  if (parts.some(Number.isNaN)) throw new Error(`bad time "${s}"`);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

function chromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found. Set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium binary.');
  return hit;
}

function requireFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error('ffmpeg not found on PATH. Install it (brew install ffmpeg) and retry.');
  }
}

// ------------------------------------------------------------------- main
async function main() {
  const o = parseArgs(process.argv);
  if (!o.stills && !o.sheet && !o.probe) requireFfmpeg();
  if (!fs.existsSync(AUDIO)) throw new Error(`Voiceover not found at ${AUDIO}`);

  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    // Port 0 asks the OS for a free one, so a render never collides with a dev
    // server (or with a previous run that did not shut down cleanly). HMR and
    // the file watcher are off: a source edit during a 12-minute render would
    // otherwise hot-reload the page out from under the frame loop.
    server: { port: o.port || 0, strictPort: Boolean(o.port), host: '127.0.0.1', hmr: false, watch: null },
    logLevel: 'warn',
  });
  await server.listen();
  const port = server.httpServer.address().port;
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: o.headless ? 'shell' : false,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: [
      '--window-size=1936,1140',
      '--window-position=0,0',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--enable-unsafe-swiftshader',
      '--force-color-profile=srgb',
      '--disable-lcd-text',
    ],
  });

  let ff = null;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('[console]', m.text());
    });

    const q = new URLSearchParams({
      render: '1',
      fps: String(o.fps),
      ss: String(o.ss),
      tail: String(o.tail),
      captions: o.captions ? '1' : '0',
    });
    await page.goto(`${base}/video.html?${q}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__VIDEO_READY__ === true', { timeout: 180000 });

    const info = await page.evaluate(() => ({
      duration: window.__VIDEO__.duration,
      audioDuration: window.__VIDEO__.audioDuration,
      frameCount: window.__VIDEO__.frameCount,
      sections: window.__VIDEO__.story.sections.map((s) => ({ index: s.index, label: s.label, from: s.from, to: s.to })),
    }));

    console.log(`voiceover ${fmt(info.audioDuration)}  ·  video ${fmt(info.duration)}  ·  ${info.frameCount} frames @ ${o.fps} fps`);

    if (o.probe) {
      for (const s of info.sections) console.log(`  ${s.index}  ${fmt(s.from)} → ${fmt(s.to)}  ${s.label}`);
      return;
    }

    // -------------------------------------------------------- contact sheet
    if (o.sheet) {
      let times;
      if (o.sheet === 'auto') {
        times = await page.evaluate(() =>
          window.__VIDEO__.director.camera.shots.map((s, i, a) => Math.min(s.at + 2.2, (a[i + 1]?.at ?? s.at + 4) - 0.3)),
        );
      } else if (o.sheet.startsWith('every:')) {
        const step = Number(o.sheet.slice(6));
        times = [];
        for (let t = 1; t < info.duration; t += step) times.push(t);
      } else {
        times = o.sheet.split(',').map(time);
      }
      const dir = path.join(ROOT, 'final/stills');
      fs.mkdirSync(dir, { recursive: true });
      const perSheet = o.cols * 4;
      for (let page0 = 0; page0 * perSheet < times.length; page0++) {
        const slice = times.slice(page0 * perSheet, (page0 + 1) * perSheet);
        const data = await page.evaluate(
          async (ts, cols) => {
            const V = window.__VIDEO__;
            const cw = 620;
            const ch = Math.round((cw * 1080) / 1920);
            const rows = Math.ceil(ts.length / cols);
            const c = document.createElement('canvas');
            c.width = cols * cw;
            c.height = rows * (ch + 24);
            const g = c.getContext('2d');
            g.fillStyle = '#05070a';
            g.fillRect(0, 0, c.width, c.height);
            g.imageSmoothingQuality = 'high';
            for (let i = 0; i < ts.length; i++) {
              V.seek(ts[i]);
              const x = (i % cols) * cw;
              const y = Math.floor(i / cols) * (ch + 24);
              g.drawImage(V.compositor.canvas, x, y + 24, cw, ch);
              g.fillStyle = '#6EC1FF';
              g.font = '600 15px monospace';
              const m = Math.floor(ts[i] / 60);
              g.fillText(`${String(m).padStart(2, '0')}:${(ts[i] % 60).toFixed(1).padStart(4, '0')}`, x + 8, y + 17);
            }
            return c.toDataURL('image/png');
          },
          slice,
          o.cols,
        );
        const file = path.join(dir, `sheet-${String(page0 + 1).padStart(2, '0')}.png`);
        fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
        console.log(`sheet ${page0 + 1} (${slice.length} frames) → ${path.relative(ROOT, file)}`);
      }
      return;
    }

    // ------------------------------------------------------------- stills
    if (o.stills) {
      fs.mkdirSync(path.join(ROOT, 'final/stills'), { recursive: true });
      for (const t of o.stills) {
        const data = await page.evaluate(
          (tt) => window.__VIDEO__.seek(tt) && window.__VIDEO__.compositor.canvas.toDataURL('image/png'),
          t,
        );
        const file = path.join(ROOT, 'final/stills', `${fmt(t).replace(':', 'm').replace('.', 's')}.png`);
        fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
        console.log(`still ${fmt(t)} → ${path.relative(ROOT, file)}`);
      }
      return;
    }

    // -------------------------------------------------------------- video
    const from = o.from;
    const to = Math.min(o.to ?? info.duration, info.duration);
    const first = Math.round(from * o.fps);
    const last = Math.min(info.frameCount, Math.round(to * o.fps));
    const total = last - first;
    if (total <= 0) throw new Error(`empty range ${fmt(from)} → ${fmt(to)}`);

    const outPath = path.resolve(ROOT, o.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const dur = (total / o.fps).toFixed(3);
    const audioFilter = [o.normalize ? 'loudnorm=I=-16:TP=-1.5:LRA=11' : null, 'apad'].filter(Boolean).join(',');
    const args = [
      '-y',
      '-f', 'image2pipe',
      '-framerate', String(o.fps),
      '-i', '-',
      ...(o.audio ? ['-ss', String(from), '-i', AUDIO] : []),
      '-map', '0:v:0',
      ...(o.audio ? ['-map', '1:a:0', '-af', audioFilter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []),
      '-c:v', 'libx264',
      '-preset', o.preset,
      '-crf', String(o.crf),
      // Frames arrive as full-range JPEG/PNG. Converting to limited range here
      // (rather than letting ffmpeg tag the output yuvj420p) is what keeps
      // blacks and whites correct on players that ignore the range flag.
      '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p',
      '-color_range', 'tv',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-level', '4.2',
      '-movflags', '+faststart',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      // The scale filter above clears primaries/transfer from the VUI; stamp
      // them back into the bitstream so players don't have to guess bt709.
      '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0',
      '-r', String(o.fps),
      '-t', dur,
      outPath,
    ];
    ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    // If this process is interrupted, ffmpeg must not survive it: an orphaned
    // encoder keeps burning CPU and writing into a file nobody is reading.
    const reap = () => {
      try {
        ff?.kill('SIGKILL');
      } catch {}
      process.exit(130);
    };
    process.once('SIGINT', reap);
    process.once('SIGTERM', reap);
    process.once('SIGHUP', reap);
    let ffErr = '';
    ff.stderr.on('data', (d) => {
      ffErr += d;
      if (ffErr.length > 40000) ffErr = ffErr.slice(-20000);
    });
    const ffDone = new Promise((res, rej) => {
      ff.on('error', rej);
      ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}\n${ffErr.slice(-3000)}`))));
    });

    const warmup = o.warmup ?? (first > 0 ? 45 : 0);
    if (warmup > 0) {
      for (let i = Math.max(0, first - warmup); i < first; i++) {
        await page.evaluate((idx) => void window.__VIDEO__.renderFrame(idx), i);
      }
    }

    const type = o.format === 'png' ? 'image/png' : 'image/jpeg';
    const t0 = Date.now();
    let bytes = 0;

    for (let i = first; i < last; i++) {
      const data = await page.evaluate(
        (idx, ty, qy) => window.__VIDEO__.encodeFrame(idx, { type: ty, quality: qy }),
        i,
        type,
        o.quality,
      );
      const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
      bytes += buf.length;
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));

      const n = i - first + 1;
      if (n % 30 === 0 || n === total) {
        const el = (Date.now() - t0) / 1000;
        const rate = n / el;
        const eta = (total - n) / rate;
        process.stdout.write(
          `\r  ${String(n).padStart(6)}/${total}  ${((n / total) * 100).toFixed(1).padStart(5)}%  ` +
            `${rate.toFixed(1)} fps  eta ${fmt(Math.max(0, eta))}   `,
        );
      }
    }
    process.stdout.write('\n');
    ff.stdin.end();
    await ffDone;

    const size = fs.statSync(outPath).size;
    console.log(
      `\nwrote ${path.relative(ROOT, outPath)}  ${(size / 1e6).toFixed(1)} MB  ` +
        `(${fmt(from)} → ${fmt(to)}, ${total} frames, ${(bytes / 1e6).toFixed(0)} MB piped)`,
    );
    console.log(execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate,duration',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1',
      outPath,
    ]).toString().trim());
  } finally {
    if (ff && !ff.killed && ff.exitCode === null) ff.kill('SIGKILL');
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
