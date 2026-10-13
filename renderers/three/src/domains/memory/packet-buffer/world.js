import { Engine } from '../../../core/Engine.js';
import { createLighting } from '../../../core/Lighting.js';
import { createStage } from '../../../core/Stage.js';
import { CameraManager } from '../../../core/CameraManager.js';
import { ComponentRegistry } from '../../../core/ComponentRegistry.js';
import { Highlighter } from '../../../core/Highlighter.js';
import { createPacketBufferScene } from './scene.js';

/**
 * The Packet Buffer "world": engine + lights + stage + the asset, wired to the registry, camera
 * presets and highlighter — the same services as the other assets' worlds, so the buffer looks and
 * behaves as part of the same library. It has no page yet; a viewer's controls would live above it.
 */
export function createPacketBufferWorld({ container, reducedMotion = false, engine: engineOptions = {}, highlight = {} } = {}) {
  const engine = new Engine(container, engineOptions);
  const lighting = createLighting();
  const stage = createStage();
  engine.scene.add(lighting.group, stage.group);

  const registry = new ComponentRegistry();
  const camera = new CameraManager(engine, { reducedMotion });
  const scene = createPacketBufferScene({ engine, registry, camera });
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
