import { createNicWorld } from '../scenes/nicWorld.js';
import { createSignalPaths } from './scene/SignalPaths.js';
import { TimelineParser } from './TimelineParser.js';
import { buildStoryboard } from './storyboard.js';
import { VideoDirector } from './VideoDirector.js';
import { Compositor } from './Compositor.js';
import { W, H } from './overlay/theme.js';

/**
 * Video mode.
 *
 * Same NIC, same camera presets, same packet system as the interactive site
 * (see ../scenes/nicWorld.js) — but no OrbitControls, no DOM UI, no cursor and
 * no realtime clock. The frame at time t is produced by:
 *
 *   director.update(t)    camera pose + card animation, from the storyboard
 *   engine.stepTo(t)      renders the 3D layer with a fixed dt
 *   director.drawOverlay  the 2D graphics layer
 *   compositor.compose    background + 3D + overlay → the output frame
 */
export function createVideoApp({
  container,
  timelineData,
  fps = 30,
  supersample = 2,
  captions = false,
  tail = 1.5,
  width = W,
  height = H,
}) {
  const timeline = new TimelineParser(timelineData);

  const world = createNicWorld({
    container,
    reducedMotion: false,
    engine: { clock: 'manual', size: { width, height }, pixelRatio: supersample, controls: false, fov: 30 },
    // The site's hover highlight is deliberately faint; on video it needs to
    // survive compression and a 1080p viewport.
    highlight: { strength: 0.2 },
  });

  const signalPaths = createSignalPaths();
  world.scene.nic.root.add(signalPaths.group);

  const story = buildStoryboard({ timeline, registry: world.registry, captions, tail });
  const director = new VideoDirector({ world, story, signalPaths });
  const compositor = new Compositor({ width, height });

  // The 3D layer's own per-frame work: board glow and LED patterns. Highlights
  // and the heatsink are driven by the AnimationDirector instead, so the
  // interactive Highlighter.update() easing is deliberately not used here.
  world.engine.onTick((dt, t) => {
    world.leds.update(dt, t);
    world.scene.update(dt, t);
  });

  let lastTime = -1;

  /** Put the whole scene at time t and produce one composited frame. */
  function seek(t, { dt = 1 / fps } = {}) {
    const time = Math.max(0, Math.min(story.duration, t));
    director.update(time);
    world.engine.stepTo(time, { dt: lastTime < 0 ? 0 : dt });
    director.drawOverlay(time);
    lastTime = time;
    return compositor.compose(world.engine.renderer.domElement, director.overlay.canvas);
  }

  const api = {
    world,
    story,
    director,
    timeline,
    compositor,
    canvas: compositor.canvas,
    fps,
    duration: story.duration,
    audioDuration: story.audioEnd,
    frameCount: Math.ceil(story.duration * fps),
    seek,
    /** Frame-indexed entry point used by the offline renderer. */
    renderFrame(index) {
      return seek(index / fps);
    },
    /** Base64 PNG/JPEG of one frame, for the puppeteer render loop. */
    encodeFrame(index, { type = 'image/jpeg', quality = 0.95 } = {}) {
      seek(index / fps);
      return compositor.canvas.toDataURL(type, quality);
    },
    describeAt: (t) => director.describeAt(t),
    dispose() {
      director.dispose();
      signalPaths.dispose();
      world.dispose();
    },
  };

  window.__VIDEO__ = api;
  return api;
}
