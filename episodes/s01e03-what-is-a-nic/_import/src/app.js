import { InteractionManager } from './interaction/InteractionManager.js';
import { RX_PATH, TX_PATH, hardwareRoute, neighbors, STAGES } from './concepts/dataplane.js';
import { createNicWorld } from './scenes/nicWorld.js';
import { UI } from './ui/UI.js';

/**
 * Interactive mode. Layers, bottom to top:
 *   world (engine, NIC model, registry, camera, highlighter, packets)
 *   →  interaction (picking)  →  explanation (UI)
 *
 * The video renderer builds the same world from ./scenes/nicWorld.js and puts
 * a timeline director on top of it instead of this UI. See src/video/.
 */
export function createApp(container) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const world = createNicWorld({ container, reducedMotion });
  const { engine, registry, camera, scene, leds, highlighter, packets } = world;

  let selectedId = null;
  const ui = new UI({
    onPreset: (name) => {
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
  });

  const interaction = new InteractionManager({
    camera: engine.camera,
    dom: engine.renderer.domElement,
    controls: engine.controls,
    registry,
    occluders: scene.nic.occluders,
  });

  function select(id, { refocus = true } = {}) {
    selectedId = id;
    highlighter.setSelected(id);
    ui.showInfo(id ? registry.get(id).meta : null);
    // On wide screens, slide the image left so the part isn't hidden behind the info panel.
    const wide = container.clientWidth > 900;
    engine.setViewShift(id && wide ? Math.min(210, ui.info.offsetWidth / 2 + 12) : 0);
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
      interaction.dispose();
      ui.dispose();
      world.dispose();
      delete window.__AXIOBYTE__;
    },
  };
}
