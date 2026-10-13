import { createNicVideoScene } from '@axiobyte/three/domains/networking/nic/video.js';
import { createNicHostVideoStage } from '@axiobyte/three/compositions/nic_host/video.js';

/**
 * The film's scene: the NIC, as every other shot sees it, and — for the receive path's host
 * side (shots 0114 and 0116) — the nic_host system in its place, the same composition the
 * NIC-host page shows. The storyboard's `host` lanes say when; the swap lands on the shot cuts,
 * so each shot shows one model. Both share one engine, registry and highlighter, so camera
 * shots, highlights and leader lines name either model's parts the same way.
 */
export function createEpisodeScene(options) {
  const nic = createNicVideoScene(options);
  const { world } = nic;
  const host = createNicHostVideoStage({ engine: world.engine, registry: world.registry, highlighter: world.highlighter });
  const card = world.scene.nic.root;
  const cardBox = world.scene.modelBox();

  return {
    world,
    host,
    createAnimation(story) {
      const animation = nic.createAnimation(story);
      let shown = null;
      return {
        update(t) {
          animation.update(t);
          const on = host.update(t, story.host);
          card.visible = !on;
          // The key light's shadow fits whichever model is on screen (a function of `on` only).
          if (on !== shown) world.lighting.fitShadow(on ? host.systemBox() : cardBox);
          shown = on;
        },
        levelsAt: (t) => animation.levelsAt(t),
        heatsinkAt: (t) => animation.heatsinkAt(t),
        dispose: () => animation.dispose(),
      };
    },
    dispose() {
      host.dispose();
      nic.dispose();
    },
  };
}
