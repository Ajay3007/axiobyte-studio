import '@axiobyte/three/web/styles.css';
import './nic-host.css';
import { createApp } from './app.js';

function supportsWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot() {
  const container = document.getElementById('viewport');
  if (!supportsWebGL2()) {
    document.getElementById('fallback').hidden = false;
    return null;
  }
  // Canvas-drawn labels (the silkscreen) need the web font; don't wait forever for it.
  if (document.fonts?.load) {
    await Promise.race([
      Promise.all([document.fonts.load('600 40px "Barlow Semi Condensed"'), document.fonts.load('700 40px "Barlow Semi Condensed"')]).catch(() => {}),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
  }
  try {
    return createApp(container);
  } catch (err) {
    console.error(err);
    document.getElementById('fallback').hidden = false;
    return null;
  }
}

const appPromise = boot();

if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    (await appPromise)?.dispose();
  });
}
