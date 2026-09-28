import { Engine } from '../engine/Engine.js';
import { createLighting } from '../engine/Lighting.js';
import { createStage } from '../engine/Stage.js';
import { CameraManager } from '../engine/CameraManager.js';
import { ComponentRegistry } from '../interaction/ComponentRegistry.js';
import { Highlighter } from '../interaction/Highlighter.js';
import { LedController } from '../animation/LedController.js';
import { PacketAnimator } from '../animation/PacketAnimator.js';
import { createNicScene } from './nicScene.js';

/**
 * The NIC "world": engine + lights + stage + the card itself, wired to the
 * registry, camera presets, highlighter, LEDs and packet tokens.
 *
 * Both the interactive site and the video renderer build the world through
 * this function, so there is exactly one NIC model, one set of camera presets
 * and one packet system across both modes. Everything mode-specific
 * (OrbitControls, DOM UI, the video director) lives above it.
 */
export function createNicWorld({ container, reducedMotion = false, engine: engineOptions = {}, highlight = {} } = {}) {
  const engine = new Engine(container, engineOptions);
  const lighting = createLighting();
  const stage = createStage();
  engine.scene.add(lighting.group, stage.group);

  const registry = new ComponentRegistry();
  const camera = new CameraManager(engine, { reducedMotion });
  const scene = createNicScene({ engine, registry, camera });
  lighting.fitShadow(scene.modelBox());

  // LEDs flag their materials as noHighlight, so they must be registered before highlight clones are made.
  const leds = new LedController({ reducedMotion });
  scene.nic.leds.forEach((l) => leds.add(l));
  const highlighter = new Highlighter(registry, { strength: 0.14, ...highlight });
  highlighter.prepareAll();

  const packets = new PacketAnimator(engine.scene, registry, { reducedMotion });

  return {
    engine,
    lighting,
    stage,
    registry,
    camera,
    scene,
    leds,
    highlighter,
    packets,
    dispose() {
      packets.dispose();
      camera.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
