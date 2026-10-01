import { InteractionManager } from '@axiobyte/three/web/InteractionManager.js';
import { RX_PATH, TX_PATH, hardwareRoute, neighbors, STAGES } from '@axiobyte/three/domains/networking/dataplane.js';
import { createNicWorld } from '@axiobyte/three/domains/networking/nic/world.js';
import { UI } from './UI.js';

/**
 * Interactive mode. Layers, bottom to top:
 *   world (engine, NIC model, registry, camera, highlighter, packets)
 *   →  interaction (picking)  →  explanation (UI)
 *
 * The video renderer builds the same world from ./scenes/nicWorld.js and puts
 * a timeline director on top of it instead of this UI. See src/video/.
 */
export function createApp(container, { onMode } = {}) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // The card on its own. Its rings live in host memory, which the page's "In the host" mode shows
  // through the nic_host composition (./host.js).
  const world = createNicWorld({ container, reducedMotion });
  const { engine, registry, camera, scene, leds, highlighter, packets } = world;

  let selectedId = null;
  const ui = new UI({
    onPreset: (name) => {
      // A bottom sheet across the screen would cover the view asked for: close it first, so
      // the preset looks exactly as it does with nothing selected. A side panel stays open.
      if (selectedId && sheetAcross()) select(null, { refocus: false });
      camera.focus(name);
      ui.setActivePreset(name);
    },
    onReset: () => {
      select(null, { refocus: false });
      camera.focus('overview');
      ui.setActivePreset('overview');
    },
    onAction: (id) => scene.actions[id]?.(),
    onClose: () => select(null),
    getActionState: (id) => scene.isActionActive(id),
    getPath: (id) => neighbors(id, RX_PATH),
    onMode,
  });

  const interaction = new InteractionManager({
    camera: engine.camera,
    dom: engine.renderer.domElement,
    controls: engine.controls,
    registry,
    occluders: scene.nic.occluders,
  });

  // Keep the selected part out from under the info panel. On narrow screens held upright the
  // panel is a bottom sheet across the screen (styles.css, max-width 760px): move the image so
  // the part lands midway between the brand block and the top of the sheet, both measured as
  // actually laid out. Beside a panel at the side — wide screens, and short landscape screens
  // where it takes only the right-hand part — slide the image left.
  // `pose` is the view a camera move is heading to; without one, the camera as it is.
  const sheetLayout = window.matchMedia('(max-width: 760px)');
  function sheetAcross() {
    const { clientWidth: w, clientHeight: h } = container;
    return sheetLayout.matches && (h > 500 || ui.info.offsetWidth > w * 0.6);
  }
  function applyViewShift(pose = null) {
    if (!selectedId) return engine.setViewShift(0, 0);
    const { clientWidth: w, clientHeight: h } = container;
    if (sheetAcross()) {
      const top = document.querySelector('.brand')?.getBoundingClientRect().bottom ?? 0;
      const shift = partScreenY(selectedId, pose, h) - (top + ui.info.offsetTop) / 2;
      return engine.setViewShift(0, Math.min(h / 2, Math.max(-h / 3, shift)));
    }
    const beside = w > 900 || h <= 500;
    engine.setViewShift(beside ? Math.min(210, ui.info.offsetWidth / 2 + 12) : 0, 0);
  }
  // Where a part's centre lands on screen (px from the top, before any shift).
  function partScreenY(id, pose, h) {
    const cam = engine.camera.clone();
    if (pose) {
      cam.position.copy(pose.position);
      cam.lookAt(pose.target);
    }
    cam.clearViewOffset();
    cam.updateMatrixWorld();
    const p = registry.worldBox(id).getCenter(cam.position.clone()).project(cam);
    return ((1 - p.y) / 2) * h;
  }
  // A cue that the panel scrolls, shown only while more of it is below the fold.
  function updateScrollCue() {
    const el = ui.info;
    el.classList.toggle('has-more', !el.hidden && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }
  const onResize = () => {
    applyViewShift();
    updateScrollCue();
  };
  window.addEventListener('resize', onResize);
  ui.info.addEventListener('scroll', updateScrollCue, { passive: true });

  function select(id, { refocus = true } = {}) {
    selectedId = id;
    highlighter.setSelected(id);
    ui.showInfo(id ? registry.get(id).meta : null);
    ui.info.scrollTop = 0;
    const view = id && refocus ? camera.describe(id) : null;
    applyViewShift(view ? camera.solve(view) : null);
    updateScrollCue();
    if (id && refocus) {
      camera.focus(id, { duration: 900 });
      ui.setActivePreset(null);
    }
  }

  interaction.addEventListener('hover', (e) => {
    const { id, x, y } = e.detail;
    highlighter.setHover(id);
    if (id) ui.showTooltip(registry.get(id).meta, x, y);
    else ui.hideTooltip();
  });
  interaction.addEventListener('move', (e) => ui.moveTooltip(e.detail.x, e.detail.y));
  interaction.addEventListener('select', (e) => {
    const { id } = e.detail;
    if (id === selectedId) return;
    select(id);
  });

  engine.controls.addEventListener('start', () => {
    ui.fadeHint();
    ui.setActivePreset(null);
  });

  engine.onTick((dt, elapsed) => {
    interaction.update();
    highlighter.update(dt);
    leds.update(dt, elapsed);
    packets.update(dt);
    scene.update(dt, elapsed);
  });

  camera.intro('overview');
  engine.start();

  // Developer / future-lesson API, e.g. in the console:
  //   __AXIOBYTE__.demoRx()          packet from port 1 to the RX queue
  //   __AXIOBYTE__.camera.focus('rj45')
  const api = {
    engine,
    registry,
    camera,
    packets,
    stages: STAGES,
    select: (id) => select(id),
    focus: (name) => camera.focus(name),
    animatePacket: (opts) => packets.animatePacket(opts),
    demoRx: (port = 1) => packets.animateRoute(hardwareRoute(RX_PATH, { port }), { color: 0x6ec1ff }),
    demoTx: (port = 1) => packets.animateRoute(hardwareRoute(TX_PATH, { port }), { color: 0xffb454 }),
    stats: () => ({ ...scene.nic.stats, calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles }),
  };
  window.__AXIOBYTE__ = api;

  return {
    api,
    dispose() {
      window.removeEventListener('resize', onResize);
      ui.info.removeEventListener('scroll', updateScrollCue);
      interaction.dispose();
      ui.dispose();
      world.dispose();
      delete window.__AXIOBYTE__;
    },
  };
}
