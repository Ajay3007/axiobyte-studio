import * as THREE from 'three';
import { Ease } from '../core/tween.js';

const TAU = Math.PI * 2;
const shortestAngle = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

/**
 * Deterministic camera choreography.
 *
 * Shots are resolved through the existing CameraManager (same presets, same
 * component resolvers, same frustum fit as the interactive site), then held in
 * spherical coordinates so the camera can orbit, push and drift without ever
 * cutting through the model. Everything is a pure function of time: there are
 * no tweens and no frame-to-frame state, so seeking to 07:42 gives exactly the
 * frame the renderer would have produced by playing there.
 *
 * shot = {
 *   at,                     start time in seconds (voiceover clock)
 *   view,                   preset name, component id, or { box|target|position }
 *   transition,             seconds to blend out of the previous shot
 *   ease,                   easing for that blend
 *   distance, padding,      overrides applied when solving the view
 *   motion: {
 *     orbit,  radians per second of azimuth drift
 *     push,   [fromScale, toScale] applied to the radius across the shot
 *     phi,    total polar drift in radians across the shot
 *     pan,    [x, y, z] world-space target drift across the shot
 *     ease,   easing for push/phi/pan (default inOutSine)
 *   },
 * }
 */
export class CameraDirector {
  constructor({ cameraManager, engine, shots = [], breathe = true }) {
    this.cm = cameraManager;
    this.engine = engine;
    this.breathe = breathe;
    this.shots = [];
    this.setShots(shots);
  }

  setShots(shots) {
    this.shots = shots
      .slice()
      .sort((a, b) => a.at - b.at)
      .map((s, i, arr) => ({
        transition: 1.6,
        ease: Ease.inOutCubic,
        motion: {},
        ...s,
        index: i,
        end: arr[i + 1]?.at ?? Infinity,
      }));
    this._poses = this.shots.map((s) => this.resolve(s));
  }

  /** Turn a shot's view into a base pose: target + spherical offset. */
  resolve(shot) {
    let view = shot.view;
    if (typeof view === 'string') {
      const described = this.cm.describe(view);
      if (!described) throw new Error(`CameraDirector: unknown view "${view}" at ${shot.at}s`);
      view = described;
    }
    if (shot.padding != null) view = { ...view, padding: shot.padding };
    if (shot.distance != null) view = { ...view, distance: shot.distance };
    const { target, position } = this.cm.solve(view);
    const sph = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    const frame = shot.frame ?? [0, 0];
    return { target: target.clone(), radius: sph.radius, theta: sph.theta, phi: sph.phi, fov: shot.fov ?? 30, frame };
  }

  /**
   * Pose of one shot at absolute time t. Evaluated past the shot's end too,
   * so a blend into the next shot starts from a still-moving camera and the
   * cut has no visible velocity step.
   */
  poseAt(i, t) {
    const shot = this.shots[i];
    const base = this._poses[i];
    const m = shot.motion ?? {};
    const span = Math.max(0.001, Math.min(shot.end, shot.at + 600) - shot.at);
    const l = t - shot.at;
    const u = Math.max(0, Math.min(1, l / span));
    const ez = (m.ease ?? Ease.inOutSine)(u);

    let radius = base.radius;
    let theta = base.theta;
    let phi = base.phi;
    const target = base.target.clone();

    if (m.push) radius *= m.push[0] + (m.push[1] - m.push[0]) * ez;
    if (m.orbit) theta += m.orbit * l;
    if (m.phi) phi += m.phi * ez;
    if (m.pan) target.add(new THREE.Vector3(m.pan[0], m.pan[1], m.pan[2]).multiplyScalar(ez));

    if (this.breathe) {
      // A hair of movement so held frames never look like a still image.
      radius *= 1 + 0.0035 * Math.sin(t * 0.37 + i);
      theta += 0.0032 * Math.sin(t * 0.23 + i * 1.7);
      phi += 0.0022 * Math.sin(t * 0.19 + i * 2.3);
    }

    phi = Math.max(0.06, Math.min(Math.PI - 0.06, phi));
    return { target, radius, theta, phi, fov: base.fov, frame: base.frame };
  }

  shotIndexAt(t) {
    let i = 0;
    for (let j = 0; j < this.shots.length; j++) {
      if (this.shots[j].at <= t) i = j;
      else break;
    }
    return i;
  }

  /** The pose the camera should have at absolute time t, blends included. */
  poseFor(t) {
    const i = this.shotIndexAt(t);
    const shot = this.shots[i];
    const pose = this.poseAt(i, t);
    const trans = shot.transition ?? 0;
    if (i === 0 || trans <= 0 || t >= shot.at + trans) return pose;

    const k = shot.ease(Math.max(0, Math.min(1, (t - shot.at) / trans)));
    const prev = this.poseAt(i - 1, t);
    return {
      target: prev.target.clone().lerp(pose.target, k),
      radius: prev.radius + (pose.radius - prev.radius) * k,
      theta: prev.theta + shortestAngle(prev.theta, pose.theta) * k,
      phi: prev.phi + (pose.phi - prev.phi) * k,
      fov: prev.fov + (pose.fov - prev.fov) * k,
      frame: [prev.frame[0] + (pose.frame[0] - prev.frame[0]) * k, prev.frame[1] + (pose.frame[1] - prev.frame[1]) * k],
    };
  }

  update(t) {
    const p = this.poseFor(t);
    const cam = this.engine.camera;
    const sph = new THREE.Spherical(p.radius, p.phi, p.theta);
    cam.position.setFromSpherical(sph).add(p.target);
    this.engine.controls.target.copy(p.target);
    cam.lookAt(p.target);
    if (Math.abs(cam.fov - p.fov) > 1e-4) cam.fov = p.fov;

    // Composition shift: slides the rendered image sideways/vertically so a
    // diagram can own one half of the 16:9 frame without moving the model
    // off its own axis. +x pushes the image left, +y pushes it up.
    const { width: w, height: h } = this.engine.size;
    if (Math.abs(p.frame[0]) < 1e-4 && Math.abs(p.frame[1]) < 1e-4) {
      cam.clearViewOffset();
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    } else {
      cam.aspect = w / h;
      cam.setViewOffset(w, h, p.frame[0] * w, p.frame[1] * h, w, h);
    }
    return p;
  }

  describeAt(t) {
    const i = this.shotIndexAt(t);
    const s = this.shots[i];
    return { index: i, view: typeof s.view === 'string' ? s.view : s.label ?? 'custom', at: s.at, motion: Object.keys(s.motion ?? {}).join(',') || 'hold' };
  }
}
