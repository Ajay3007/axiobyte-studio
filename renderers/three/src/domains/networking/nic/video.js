import { createNicWorld } from './world.js';
import { createSignalPaths } from './SignalPaths.js';
import { AnimationDirector } from './AnimationDirector.js';

/**
 * The NIC as a VIDEO-target scene: the shared world (the same one the
 * interactive page builds), plus what only the film needs — glowing signal
 * paths over the board routing, and the animation lanes a storyboard drives.
 *
 * Passed to createVideoApp({ createScene }) by any episode that films the NIC.
 */
export function createNicVideoScene({ container, engine, highlight }) {
  // The film shows no queues on the card: descriptor rings and packet buffers live in
  // host memory, which the film draws in its diagram column (the storyboard's host
  // frame), joined to the card's PCIe connector.
  const world = createNicWorld({ container, reducedMotion: false, engine, highlight, queuesOnCard: false });

  const signalPaths = createSignalPaths();
  world.scene.nic.root.add(signalPaths.group);

  // The 3D layer's own per-frame work: board glow and LED patterns. Highlights
  // and the heatsink are driven by the AnimationDirector instead, so the
  // interactive Highlighter.update() easing is deliberately not used here.
  world.engine.onTick((dt, t) => {
    world.leds.update(dt, t);
    world.scene.update(dt, t);
  });

  return {
    world,
    /** Animation lanes (highlights, heatsink, packet flights, zones, signals) from a storyboard. */
    createAnimation(story) {
      const animation = new AnimationDirector({ world, signalPaths })
        .setHighlights(story.highlights)
        .setHeatsink(story.heatsink)
        .setZones(story.zones)
        .setSignals(story.signals);
      story.flights.forEach((f) => animation.addFlight(f));
      return animation;
    },
    dispose() {
      signalPaths.dispose();
      world.dispose();
    },
  };
}
