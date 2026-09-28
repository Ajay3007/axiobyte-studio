import * as THREE from 'three';
import { CameraDirector } from './CameraDirector.js';
import { Overlay } from './overlay/Overlay.js';
import { W as OW, H as OH } from './overlay/theme.js';

const _v = new THREE.Vector3();

/**
 * Binds one storyboard to one NIC world.
 *
 *   timeline.json  →  storyboard  →  VideoDirector
 *                                      ├── CameraDirector   (where we look)
 *                                      ├── animation        (what the model does — supplied by the domain)
 *                                      └── Overlay          (what we say on top)
 *
 * update(t) is the only entry point and is a pure function of t.
 */
export class VideoDirector {
  constructor({ world, story, animation }) {
    this.world = world;
    this.story = story;
    this.duration = story.duration;

    this.camera = new CameraDirector({ cameraManager: world.camera, engine: world.engine, shots: story.shots });
    // The domain builds the model's animation lanes from the storyboard
    // (e.g. the NIC's highlights, heatsink, packet flights, queue zones).
    this.animation = animation;

    this.overlay = new Overlay({ width: OW, height: OH });
    this.overlay.setCues(story.cues);

    // Projection from a component anchor to overlay pixels; leader lines use
    // this every frame so a label stays tied to the part it names.
    this.project = (id, anchor = 'center') => {
      const p = world.registry.anchorWorld(id, anchor, _v);
      if (!p) return null;
      const v = p.clone().project(world.engine.camera);
      if (v.z > 1) return null;
      return [(v.x * 0.5 + 0.5) * OW, (-v.y * 0.5 + 0.5) * OH];
    };
  }

  sectionAt(t) {
    return this.story.sections.find((s) => t >= s.from && t < s.to) ?? this.story.sections.at(-1);
  }

  /** Move the whole scene to time t. Does not render. */
  update(t) {
    this.camera.update(t);
    this.animation.update(t);
  }

  /** Draw the 2D layer for time t. Call after the 3D frame is rendered. */
  drawOverlay(t) {
    this.overlay.draw(t, { project: this.project, world: this.world });
    return this.overlay.canvas;
  }

  describeAt(t) {
    return {
      time: t,
      section: this.sectionAt(t),
      camera: this.camera.describeAt(t),
      heatsink: this.animation.heatsinkAt?.(t),
      highlights: Object.entries(this.animation.levelsAt(t))
        .filter(([, v]) => v > 0.05)
        .map(([id, v]) => `${id} ${v.toFixed(2)}`),
      cues: this.overlay.activeAt(t).map((c) => c.id),
    };
  }

  dispose() {
    this.animation.dispose();
  }
}
