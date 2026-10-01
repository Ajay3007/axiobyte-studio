import { InteractionManager } from '@axiobyte/three/web/InteractionManager.js';
import { createPCIeWorld } from '@axiobyte/three/domains/io/pcie/world.js';
import { UI } from './UI.js';

/**
 * Interactive mode for the PCIe asset. Layers, bottom to top:
 *   world (engine, the asset, registry, camera, highlighter)
 *   →  interaction (picking)  →  explanation (UI: parts, the link, the About panel)
 */
export function createApp(container) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const world = createPCIeWorld({ container, reducedMotion });
  const { engine, registry, camera, scene, highlighter } = world;

  let selectedId = null;
  const ui = new UI({
    onPreset: (name) => {
      // A bottom sheet across the screen would cover the view asked for: close it first, so the
      // preset looks exactly as it does with nothing open. A side panel stays open.
      if ((selectedId || ui.aboutOpen) && sheetAcross()) closePanel();
      camera.focus(name);
      ui.setActivePreset(name);
    },
    onReset: () => {
      closePanel();
      camera.focus('overview');
      ui.setActivePreset('overview');
    },
    onLink: () => (selectedId === 'link' ? select(null) : select('link')),
    onPart: (id) => select(id),
    onAbout: () => {
      if (ui.aboutOpen) return closePanel();
      select(null, { refocus: false });
      ui.showAbout(true);
      applyViewShift();
      updateScrollCue();
    },
    onClose: () => closePanel(),
  });

  const interaction = new InteractionManager({
    camera: engine.camera,
    dom: engine.renderer.domElement,
    controls: engine.controls,
    registry,
    occluders: scene.pcie.occluders,
  });

  // Keep the selected part out from under the panel — the NIC page's behaviour. On narrow
  // screens held upright the panel is a bottom sheet across the screen: move the image so the
  // part lands midway between the brand block and the top of the sheet. Beside a panel at the
  // side — wide screens, short landscape screens — slide the image left.
  const sheetLayout = window.matchMedia('(max-width: 760px)');
  function sheetAcross() {
    const { clientWidth: w, clientHeight: h } = container;
    return sheetLayout.matches && (h > 500 || ui.info.offsetWidth > w * 0.6);
  }
  function applyViewShift(pose = null) {
    const panelOpen = !ui.info.hidden;
    if (!panelOpen) return engine.setViewShift(0, 0);
    const h = container.clientHeight;
    if (sheetAcross()) {
      if (!selectedId) return engine.setViewShift(0, 0); // reading About: the sheet is the focus
      const top = document.querySelector('.brand')?.getBoundingClientRect().bottom ?? 0;
      const shift = partScreenY(selectedId, pose, h) - (top + ui.info.offsetTop) / 2;
      return engine.setViewShift(0, Math.min(h / 2, Math.max(-h / 3, shift)));
    }
    // Any side panel: this asset's lanes run under the panel's side of the screen, so unlike the
    // NIC (whose parts sit clear of it on tablets) the image always slides aside.
    engine.setViewShift(Math.min(210, ui.info.offsetWidth / 2 + 12), 0);
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
    ui.setLinkShown(id === 'link');
    if (id) ui.showInfo(id, registry.get(id).meta);
    else {
      ui.showInfo(null, null);
      ui.showAbout(false);
    }
    const view = id && refocus ? camera.describe(id) : null;
    applyViewShift(view ? camera.solve(view) : null);
    updateScrollCue();
    if (id && refocus) {
      camera.focus(id, { duration: 900 });
      ui.setActivePreset(null);
    }
  }
  function closePanel() {
    select(null, { refocus: false });
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
    if (id) select(id);
    else if (selectedId) closePanel();
  });

  engine.controls.addEventListener('start', () => {
    ui.fadeHint();
    ui.setActivePreset(null);
  });

  engine.onTick((dt, elapsed) => {
    interaction.update();
    highlighter.update(dt);
    scene.update(dt, elapsed);
  });

  camera.intro('overview');
  engine.start();

  // Developer / future-lesson API, e.g. in the console:
  //   __AXIOBYTE__.select('lane-3')     __AXIOBYTE__.focus('slot')
  const api = {
    engine,
    registry,
    camera,
    select: (id) => select(id),
    focus: (name) => camera.focus(name),
    stats: () => ({ ...scene.pcie.stats, calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles }),
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
