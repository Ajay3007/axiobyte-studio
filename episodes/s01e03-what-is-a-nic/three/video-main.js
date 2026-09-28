import '@axiobyte/three/web/styles.css';
import '@axiobyte/three/video/video.css';
import timelineData from '../timeline/words.json';
import { createVideoApp } from '@axiobyte/three/video/VideoApp.js';
import { createDebugOverlay } from '@axiobyte/three/video/DebugOverlay.js';
import { createNicVideoScene } from '@axiobyte/three/domains/networking/nic/video.js';
import { buildStoryboard } from './storyboard.js';

const params = new URLSearchParams(location.search);
const flag = (name, dflt) => (params.has(name) ? params.get(name) !== '0' : dflt);
const num = (name, dflt) => (params.has(name) ? Number(params.get(name)) : dflt);

// `render=1` is what the offline renderer loads: no HUD, no audio element,
// nothing but the composite canvas.
const RENDER = flag('render', false);

function supportsWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function loadFonts() {
  if (!document.fonts?.load) return;
  await Promise.race([
    Promise.all([
      document.fonts.load('500 40px "Barlow Semi Condensed"'),
      document.fonts.load('600 40px "Barlow Semi Condensed"'),
      document.fonts.load('700 40px "Barlow Semi Condensed"'),
      document.fonts.ready,
    ]).catch(() => {}),
    new Promise((r) => setTimeout(r, RENDER ? 8000 : 2000)),
  ]);
}

async function boot() {
  if (!supportsWebGL2()) {
    document.getElementById('video-fallback').hidden = false;
    return null;
  }
  await loadFonts();

  const app = createVideoApp({
    container: document.getElementById('render-host'),
    timelineData,
    createScene: createNicVideoScene,
    buildStoryboard,
    fps: num('fps', 30),
    supersample: num('ss', RENDER ? 2 : 1),
    captions: flag('captions', false),
    tail: num('tail', 1.5),
  });

  document.getElementById('out-host').appendChild(app.canvas);
  app.canvas.id = 'out';

  const fit = () => {
    const stage = document.getElementById('stage');
    const pad = RENDER ? 0 : 0.94;
    const s = Math.min(window.innerWidth / 1920, (window.innerHeight * (RENDER ? 1 : 0.76)) / 1080) * (RENDER ? 1 : pad);
    stage.style.setProperty('--fit', String(RENDER ? Math.min(1, window.innerWidth / 1920) : s));
  };
  fit();
  window.addEventListener('resize', fit);

  const audio = document.getElementById('voiceover');
  // Only the preview plays sound; the renderer never fetches the audio.
  if (!RENDER && audio) audio.src = audio.dataset.src;
  if (RENDER) {
    audio?.remove();
    document.body.classList.add('is-render');
    app.seek(num('t', 0));
    // Signals the renderer that fonts are in and the first frame is drawable.
    window.__VIDEO_READY__ = true;
  } else {
    const hud = createDebugOverlay({ app, audio, root: document.getElementById('hud-root') });
    hud.setTime(num('t', 0));
    window.__HUD__ = hud;
  }
  return app;
}

const appPromise = boot();
window.__VIDEO_BOOT__ = appPromise;

if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    (await appPromise)?.dispose();
  });
}
