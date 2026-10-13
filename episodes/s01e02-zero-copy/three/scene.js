import * as THREE from 'three';
import { createNicWorld } from '@axiobyte/three/domains/networking/nic/world.js';
import { createZeroCopyStage } from './stage.js';

/**
 * s01e02's film scene: the real NIC world — the same card, lights, stage floor, camera presets and
 * highlighter the NIC page builds — with the episode's host side mounted beside it (stage.js): the
 * real CPU, two packet buffers and the mbuf. One world, so the camera moves through one system.
 */
export function createEpisodeScene({ container, engine, highlight }) {
  const world = createNicWorld({ container, reducedMotion: false, engine, highlight });
  // The card's own per-frame work (LEDs, board glow), on the film's manual clock.
  world.engine.onTick((dt, t) => {
    world.leds.update(dt, t);
    world.scene.update(dt, t);
  });

  const stage = createZeroCopyStage({ engine: world.engine, registry: world.registry, highlighter: world.highlighter });
  const all = new THREE.Box3().setFromObject(world.scene.nic.root).union(new THREE.Box3().setFromObject(stage.root));
  world.lighting.fitShadow(all);

  return {
    world,
    stage,
    createAnimation(story) {
      const levelsAt = (t) => story.highlightsAt(t);
      return {
        update(t) {
          stage.update(t, story.lanes);
          world.highlighter.setLevels(levelsAt(t));
        },
        levelsAt,
        dispose() {},
      };
    },
    dispose() {
      stage.dispose();
      world.dispose();
    },
  };
}
