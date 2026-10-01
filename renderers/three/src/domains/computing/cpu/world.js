import { Engine } from '../../../core/Engine.js';
import { createLighting } from '../../../core/Lighting.js';
import { createStage } from '../../../core/Stage.js';
import { CameraManager } from '../../../core/CameraManager.js';
import { ComponentRegistry } from '../../../core/ComponentRegistry.js';
import { Highlighter } from '../../../core/Highlighter.js';
import { createCPUScene } from './scene.js';

/**
 * The CPU "world": engine + lights + stage + the asset, wired to the registry, camera presets and
 * highlighter — the same services as the NIC's and PCIe's worlds, so the asset looks and behaves as
 * part of the same library. The page's controls and UI (or a film's director) live above it.
 */
export function createCPUWorld({ container, reducedMotion = false, engine: engineOptions = {}, highlight = {} } = {}) {
  const engine = new Engine(container, engineOptions);
  const lighting = createLighting();
  const stage = createStage();
  engine.scene.add(lighting.group, stage.group);

  const registry = new ComponentRegistry();
  const camera = new CameraManager(engine, { reducedMotion });
  const scene = createCPUScene({ engine, registry, camera, reducedMotion });
  lighting.fitShadow(scene.modelBox());

  const highlighter = new Highlighter(registry, { strength: 0.3, ...highlight });
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
