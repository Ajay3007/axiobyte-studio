import { TimelineParser } from '../core/timeline/TimelineParser.js';
import { VideoDirector } from './VideoDirector.js';
import { Compositor } from './Compositor.js';
import { W, H } from './overlay/theme.js';

/**
 * The Three.js backend's VIDEO target.
 *
 * Same world as the interactive page (a domain's world factory, e.g.
 * domains/networking/nic/world.js) — but no OrbitControls, no DOM UI, no
 * cursor and no realtime clock. Nothing here knows which model it renders:
 * the caller supplies `createScene` (a domain's video scene) and
 * `buildStoryboard` (an episode's score). The frame at time t is produced by:
 *
 *   director.update(t)    camera pose + card animation, from the storyboard
 *   engine.stepTo(t)      renders the 3D layer with a fixed dt
 *   director.drawOverlay  the 2D graphics layer
 *   compositor.compose    background + 3D + overlay → the output frame
 */
export function createVideoApp({
  container,
  timelineData,
  createScene,
  buildStoryboard,
  fps = 30,
  supersample = 2,
  captions = false,
  tail = 1.5,
  width = W,
  height = H,
}) {
  const timeline = new TimelineParser(timelineData);

  const scene = createScene({
    container,
    engine: { clock: 'manual', size: { width, height }, pixelRatio: supersample, controls: false, fov: 30 },
    // The site's hover highlight is deliberately faint; on video it needs to
    // survive compression and a 1080p viewport.
    highlight: { strength: 0.2 },
  });
  const { world } = scene;

  const story = buildStoryboard({ timeline, registry: world.registry, captions, tail });
  const director = new VideoDirector({ world, story, animation: scene.createAnimation(story) });
  const compositor = new Compositor({ width, height });

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
      scene.dispose();
    },
  };

  window.__VIDEO__ = api;
  return api;
}
