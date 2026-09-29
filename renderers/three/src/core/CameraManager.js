import * as THREE from 'three';
import { Ease } from './tween.js';

const _center = new THREE.Vector3();
const _corner = new THREE.Vector3();

/**
 * Presets are functions evaluated at call time, so they stay correct after
 * resizes or when parts move (e.g. a lifted heatsink).
 *
 * A view descriptor is { box, direction, padding } or { target, position }.
 */
export class CameraManager {
  constructor(engine, { reducedMotion = false } = {}) {
    this.engine = engine;
    this.reducedMotion = reducedMotion;
    this.presets = new Map();
    this.resolvers = [];
    this.current = null;
    this._tween = null;
    this._onUserStart = () => {
      this._tween?.cancel();
      this.current = null;
    };
    engine.controls.addEventListener('start', this._onUserStart);
  }

  definePreset(name, describe) {
    this.presets.set(name, describe);
  }

  /** Resolvers turn arbitrary ids (e.g. component ids) into view descriptors. */
  addResolver(fn) {
    this.resolvers.push(fn);
  }

  describe(name) {
    if (this.presets.has(name)) return this.presets.get(name)();
    for (const r of this.resolvers) {
      const d = r(name, this);
      if (d) return d;
    }
    return null;
  }

  focus(name, { duration = 1100 } = {}) {
    const view = this.describe(name);
    if (!view) return false;
    const { target, position } = this.solve(view);
    this.animateTo(target, position, duration);
    this.current = this.presets.has(name) ? name : null;
    return true;
  }

  /** Current viewing direction (from target toward camera). */
  currentDirection() {
    return this.engine.camera.position.clone().sub(this.engine.controls.target).normalize();
  }

  currentDistance() {
    return this.engine.camera.position.distanceTo(this.engine.controls.target);
  }

  solve(view) {
    if (view.target && view.position) return view;
    const direction = (view.direction ?? this.currentDirection()).clone().normalize();
    const target = view.box.getCenter(new THREE.Vector3());
    let distance = view.distance ?? this.fitDistance(view.box, direction, view.padding ?? 1.08);
    if (view.minDistance) distance = Math.max(distance, view.minDistance);
    if (view.maxDistance) distance = Math.min(distance, view.maxDistance);
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }

  /** Exact frustum fit of a box's 8 corners for a given view direction. */
  fitDistance(box, direction, padding = 1.08) {
    const cam = this.engine.camera;
    const forward = direction.clone().normalize();
    const worldUp = Math.abs(forward.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const tanH = tanV * cam.aspect;
    box.getCenter(_center);
    let distance = 0;
    for (let i = 0; i < 8; i++) {
      _corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(_center);
      const x = Math.abs(_corner.dot(right));
      const y = Math.abs(_corner.dot(up));
      const z = _corner.dot(forward);
      distance = Math.max(distance, z + x / tanH, z + y / tanV);
    }
    return distance * padding;
  }

  /** Interpolates in spherical coordinates around a moving target so the camera orbits instead of cutting through the model. */
  animateTo(target, position, duration = 1100, ease = Ease.inOutCubic) {
    const { camera, controls, tweens } = this.engine;
    this._tween?.cancel();
    const t0 = controls.target.clone();
    const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(t0));
    const s1 = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    // A solved view must land where it was solved: OrbitControls clamps the camera to its
    // user-zoom limit every frame, which would pull a far framing back in and crop the subject.
    if (controls.maxDistance !== undefined) controls.maxDistance = Math.max(controls.maxDistance, s1.radius);
    let dTheta = s1.theta - s0.theta;
    if (dTheta > Math.PI) dTheta -= Math.PI * 2;
    if (dTheta < -Math.PI) dTheta += Math.PI * 2;
    const tmpTarget = new THREE.Vector3();
    const tmpSph = new THREE.Spherical();
    this._tween = tweens.add({
      duration: this.reducedMotion ? 0 : duration,
      ease,
      onUpdate: (k) => {
        tmpTarget.lerpVectors(t0, target, k);
        tmpSph.set(
          THREE.MathUtils.lerp(s0.radius, s1.radius, k),
          THREE.MathUtils.lerp(s0.phi, s1.phi, k),
          s0.theta + dTheta * k,
        );
        camera.position.setFromSpherical(tmpSph).add(tmpTarget);
        controls.target.copy(tmpTarget);
      },
    });
    return this._tween;
  }

  /** Opening move: start wide and slightly rotated, settle into the preset. */
  intro(name, { duration = 1700 } = {}) {
    const view = this.describe(name);
    if (!view) return;
    const { target, position } = this.solve(view);
    const offset = position.clone().sub(target);
    const start = new THREE.Spherical().setFromVector3(offset);
    start.radius *= 1.45;
    start.theta -= 0.55;
    start.phi = Math.max(0.2, start.phi - 0.15);
    this.engine.camera.position.setFromSpherical(start).add(target);
    this.engine.controls.target.copy(target);
    this.animateTo(target, position, duration, Ease.outCubic);
    this.current = name;
  }

  dispose() {
    this._tween?.cancel();
    this.engine.controls.removeEventListener('start', this._onUserStart);
  }
}
