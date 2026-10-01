import { InteractionManager } from '@axiobyte/three/web/InteractionManager.js';
import { createNicHostWorld } from '@axiobyte/three/compositions/nic_host/world.js';
import { UI } from './UI.js';

/**
 * The NIC page's "In the host" view: the card seated in the system, shown through the nic_host
 * composition — the same world as /axiobyte/networking/nic-host/, built by the same function.
 * This file only connects that world to this page's own UI (tooltip, info panel, Reset); the
 * system itself (instances, connections, DMA, the system camera) belongs to the composition.
 */
export function createHostView(container, { onMode }) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const world = createNicHostWorld({ container, reducedMotion });
  const { engine, registry, camera, system, highlighter } = world;

  // The composition's part metadata names the asset a part belongs to; this page's panel shows it
  // in the designator line.
  const metaOf = (id) => {
    const meta = registry.get(id).meta;
    return { ...meta, designator: [meta.asset, meta.designator].filter(Boolean).join(' · ') };
  };

  let selectedId = null;
  const ui = new UI({
    onPreset: () => {},
    onReset: () => {
      select(null, { refocus: false });
      camera.focus('system');
    },
    onAction: () => {},
    onClose: () => select(null, { refocus: false }),
    getActionState: () => false,
    getPath: () => null,
    onMode,
  });

  const interaction = new InteractionManager({
    camera: engine.camera,
    dom: engine.renderer.domElement,
    controls: engine.controls,
    registry,
    occluders: system.occluders,
  });

  // Keep the selection out from under the panel, as in the card view.
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
      const cam = engine.camera.clone();
      if (pose) {
        cam.position.copy(pose.position);
        cam.lookAt(pose.target);
      }
      cam.clearViewOffset();
      cam.updateMatrixWorld();
      const p = registry.worldBox(selectedId).getCenter(cam.position.clone()).project(cam);
      const shift = ((1 - p.y) / 2) * h - (top + ui.info.offsetTop) / 2;
      return engine.setViewShift(0, Math.min(h / 2, Math.max(-h / 3, shift)));
    }
    const beside = w > 900 || h <= 500;
    engine.setViewShift(beside ? Math.min(210, ui.info.offsetWidth / 2 + 12) : 0, 0);
  }
  const onResize = () => applyViewShift();
  window.addEventListener('resize', onResize);

  function select(id, { refocus = true } = {}) {
    selectedId = id;
    highlighter.setSelected(id);
    ui.showInfo(id ? metaOf(id) : null);
    ui.info.scrollTop = 0;
    const view = id && refocus ? camera.describe(id) : null;
    applyViewShift(view ? camera.solve(view) : null);
    if (id && refocus) camera.focus(id, { duration: 900 });
  }

  interaction.addEventListener('hover', (e) => {
    const { id, x, y } = e.detail;
    highlighter.setHover(id);
    if (id) ui.showTooltip(metaOf(id), x, y);
    else ui.hideTooltip();
  });
  interaction.addEventListener('move', (e) => ui.moveTooltip(e.detail.x, e.detail.y));
  interaction.addEventListener('select', (e) => {
    if (e.detail.id !== selectedId) select(e.detail.id);
  });
  engine.controls.addEventListener('start', () => ui.fadeHint());

  engine.onTick((dt, elapsed) => {
    interaction.update();
    highlighter.update(dt);
    world.update(dt, elapsed);
  });

  camera.intro('system');
  engine.start();

  const api = {
    engine,
    registry,
    camera,
    system,
    select: (id) => select(id),
    focus: (name) => camera.focus(name),
    stats: () => ({ ...system.stats, calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles }),
  };
  window.__AXIOBYTE__ = api;

  return {
    api,
    dispose() {
      window.removeEventListener('resize', onResize);
      interaction.dispose();
      ui.dispose();
      world.dispose();
      delete window.__AXIOBYTE__;
    },
  };
}
