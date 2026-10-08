import { InteractionManager } from '@axiobyte/three/web/InteractionManager.js';
import { createNicHostWorld } from '@axiobyte/three/compositions/nic_host/world.js';
import { createReceiveWalkthrough } from '@axiobyte/three/compositions/nic_host/walkthrough.js';
import { UI } from './UI.js';

/**
 * Interactive mode for the first composition. Layers, bottom to top:
 *   world (engine, the composed system, registry, system camera, highlighter)
 *   →  interaction (picking)  →  explanation (UI: views, DMA, parts, the About panel)
 *
 * A selection is a part of an asset (`cpu.die`), a whole asset (`cpu`), a connection
 * (`route.pcie`) or the DMA interaction (`interaction.dma`).
 */
export function createApp(container) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const world = createNicHostWorld({ container, reducedMotion });
  const { engine, registry, camera, system, highlighter } = world;
  const ASSETS = new Set(Object.keys(system.instances));

  // Presentation over the composition: it reads the system and leaves the contract untouched.
  const walk = createReceiveWalkthrough(system, { camera, highlighter, reducedMotion });
  const showStep = () => {
    ui.showWalk(walk.step, walk.index, walk.steps.length);
    applyWalkShift();
  };
  function endWalk() {
    if (!walk.active) return;
    walk.exit();
    ui.showWalk(null);
    engine.setViewShift(0, 0);
  }
  // Keep the framed step clear of the walkthrough bar, the way the image slides clear of the info
  // panel: lift it above the bar, or — on a short landscape screen, where the bar sits top right —
  // slide it left of the bar.
  function applyWalkShift() {
    if (!walk.active) return;
    const bar = ui.walk;
    if (container.clientHeight <= 500 && container.clientWidth > container.clientHeight) engine.setViewShift(Math.min(240, bar.offsetWidth / 2), 0);
    else engine.setViewShift(0, Math.min(container.clientHeight / 4, bar.offsetHeight / 2 + 12));
  }

  let selectedId = null;
  let hoverId = null;
  const ui = new UI({
    onPreset: (name) => {
      // A bottom sheet across the screen would cover the view asked for: close it first. A side
      // panel stays open.
      if ((selectedId || ui.aboutOpen) && sheetAcross()) closePanel();
      if (name === 'dma') setDma(true);
      camera.focus(name);
      ui.setActivePreset(name);
    },
    onDma: (on) => setDma(on),
    onReset: () => {
      endWalk();
      closePanel();
      setDma(true);
      camera.focus('system');
      ui.setActivePreset('system');
    },
    onPart: (id) => select(id),
    onAbout: () => {
      if (ui.aboutOpen) return closePanel();
      select(null, { refocus: false });
      ui.showAbout(true);
      applyViewShift();
      updateScrollCue();
    },
    onClose: () => closePanel(),
    onWalk: {
      start: () => {
        if (walk.active) return endWalk();
        closePanel();
        ui.fadeHint();
        ui.setActivePreset(null);
        walk.start();
        showStep();
      },
      next: () => {
        walk.next();
        showStep();
      },
      back: () => {
        walk.back();
        showStep();
      },
      exit: () => endWalk(),
    },
  });

  function setDma(on) {
    system.setDmaVisible(on);
    registry.setEnabled('interaction.dma', on);
    ui.setDma(on);
    if (!on && selectedId === 'interaction.dma') closePanel();
  }

  const interaction = new InteractionManager({
    camera: engine.camera,
    dom: engine.renderer.domElement,
    controls: engine.controls,
    registry,
    occluders: system.occluders,
  });

  // Keep the selection out from under the panel — the asset pages' behaviour. On narrow screens held
  // upright the panel is a bottom sheet: move the image so the selection lands between the brand
  // block and the sheet. Beside a side panel, slide the image aside.
  const sheetLayout = window.matchMedia('(max-width: 760px)');
  function sheetAcross() {
    const { clientWidth: w, clientHeight: h } = container;
    return sheetLayout.matches && (h > 500 || ui.info.offsetWidth > w * 0.6);
  }
  function applyViewShift(pose = null) {
    if (ui.info.hidden) return engine.setViewShift(0, 0);
    const h = container.clientHeight;
    if (sheetAcross()) {
      if (!selectedId) return engine.setViewShift(0, 0);
      const top = document.querySelector('.brand')?.getBoundingClientRect().bottom ?? 0;
      const shift = partScreenY(selectedId, pose, h) - (top + ui.info.offsetTop) / 2;
      return engine.setViewShift(0, Math.min(h / 2, Math.max(-h / 3, shift)));
    }
    engine.setViewShift(Math.min(210, ui.info.offsetWidth / 2 + 12), 0);
  }
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
  function updateScrollCue() {
    const el = ui.info;
    el.classList.toggle('has-more', !el.hidden && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }
  const onResize = () => {
    applyViewShift();
    applyWalkShift();
    updateScrollCue();
  };
  window.addEventListener('resize', onResize);
  ui.info.addEventListener('scroll', updateScrollCue, { passive: true });

  function select(id, { refocus = true } = {}) {
    // Picking something returns to exploring: the walkthrough ends.
    if (id) endWalk();
    if (id === 'interaction.dma') setDma(true);
    selectedId = id;
    highlighter.setSelected(ASSETS.has(id) ? null : id);
    if (id) ui.showInfo(id, registry.get(id).meta);
    else {
      ui.showInfo(null, null);
      ui.showAbout(false);
    }
    updateScrollCue();
    const view = id && refocus ? camera.describe(id) : null;
    applyViewShift(view ? camera.solve(view) : null);
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
    hoverId = id;
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
    // A whole asset is highlighted through its parts, at set levels; otherwise levels ease.
    if (ASSETS.has(selectedId)) {
      const levels = Object.fromEntries(system.partsOf(selectedId).map((id) => [id, 0.9]));
      levels[selectedId] = 1;
      if (hoverId) levels[hoverId] = Math.max(levels[hoverId] ?? 0, 0.65);
      highlighter.setLevels(levels);
    } else highlighter.update(dt);
    world.update(dt, elapsed);
    walk.update(dt);
  });

  camera.intro('system');
  engine.start();

  // Developer / future-lesson API, e.g. in the console:
  //   __AXIOBYTE__.select('route.pcie')     __AXIOBYTE__.focus('dma')
  const api = {
    engine,
    registry,
    camera,
    system,
    select: (id) => select(id),
    focus: (name) => camera.focus(name),
    setDma: (on) => setDma(on),
    walk: {
      start: () => (walk.active ? walk.step : (walk.start(), showStep(), walk.step)),
      next: () => (walk.next(), showStep(), walk.step),
      back: () => (walk.back(), showStep(), walk.step),
      exit: () => endWalk(),
      state: () => ({ active: walk.active, index: walk.index, outlines: walk.outlines.map((o) => o.name) }),
    },
    stats: () => ({ ...system.stats, calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles }),
  };
  window.__AXIOBYTE__ = api;

  return {
    api,
    dispose() {
      endWalk();
      window.removeEventListener('resize', onResize);
      ui.info.removeEventListener('scroll', updateScrollCue);
      interaction.dispose();
      ui.dispose();
      world.dispose();
      delete window.__AXIOBYTE__;
    },
  };
}
