import '@axiobyte/three/web/styles.css';
import './nic.css';
import { createApp } from './app.js';
import { createHostView } from './host.js';

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
  // Canvas-drawn labels (silkscreen, chip markings) need the web font; don't wait forever for it.
  if (document.fonts?.load) {
    await Promise.race([
      Promise.all([document.fonts.load('600 40px "Barlow Semi Condensed"'), document.fonts.load('700 40px "Barlow Semi Condensed"')]).catch(() => {}),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
  }
  // Two views share the viewport: the card on its own (the NIC asset), and the card in the host
  // (the nic_host composition). Switching disposes one world and builds the other.
  let current = null;
  const show = (mode) => {
    current?.dispose();
    const host = mode === 'host';
    document.querySelector('.views').hidden = host; // the card's camera views
    document.getElementById('host-note').hidden = !host;
    document.getElementById('hint').hidden = host;
    current = host ? createHostView(container, { onMode: show }) : createApp(container, { onMode: show });
  };
  try {
    show('hardware');
    return { dispose: () => current?.dispose() };
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
