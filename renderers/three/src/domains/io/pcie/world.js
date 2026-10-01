import { Engine } from '../../../core/Engine.js';
import { createLighting } from '../../../core/Lighting.js';
import { createStage } from '../../../core/Stage.js';
import { CameraManager } from '../../../core/CameraManager.js';
import { ComponentRegistry } from '../../../core/ComponentRegistry.js';
import { Highlighter } from '../../../core/Highlighter.js';
import { createPCIeScene } from './scene.js';

/**
 * The PCIe "world": engine + lights + stage + the asset, wired to the registry, camera presets
 * and highlighter — the same services the NIC's world provides, so the asset looks and behaves
 * as part of the same library. Mode-specific layers (the page's controls and UI, or a film's
 * director) live above it.
 */
export function createPCIeWorld({ container, reducedMotion = false, engine: engineOptions = {}, highlight = {} } = {}) {
  const engine = new Engine(container, engineOptions);
  const lighting = createLighting();
  const stage = createStage();
  engine.scene.add(lighting.group, stage.group);

  const registry = new ComponentRegistry();
  const camera = new CameraManager(engine, { reducedMotion });
  const scene = createPCIeScene({ engine, registry, camera });
  lighting.fitShadow(scene.modelBox());

  // Lanes are 0.26 mm traces: they need a stronger highlight than the NIC's chips to read as lit.
  const highlighter = new Highlighter(registry, { strength: 0.5, ...highlight });
  highlighter.prepareAll();

  return {
    engine,
    lighting,
    stage,
    registry,
    camera,
    scene,
    highlighter,
    dispose() {
      camera.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
