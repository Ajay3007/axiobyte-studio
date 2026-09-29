import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Tweens } from './tween.js';
import { disposeObject } from './dispose.js';

/** Stand-in for OrbitControls when the host drives the camera itself (video mode). */
function fixedControls() {
  return {
    target: new THREE.Vector3(),
    enabled: false,
    enableDamping: false,
    addEventListener() {},
    removeEventListener() {},
    update() {},
    dispose() {},
  };
}

/**
 * Scene-agnostic rendering core. It knows nothing about NICs: scene modules
 * add objects to `engine.scene` and subscribe to the frame loop via onTick().
 *
 * Two clocks are supported:
 *   raf     (default) requestAnimationFrame drives the loop in realtime.
 *   manual  the host calls stepTo(seconds); nothing reads the wall clock, so
 *           the same timestamp always produces the same frame.
 */
export class Engine {
  constructor(container, { fov = 30, clock = 'raf', size = null, pixelRatio = null, controls = true } = {}) {
    this.container = container;
    this.clock = clock;
    this.fixedSize = size;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: clock === 'manual',
    });
    renderer.setPixelRatio(pixelRatio ?? Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D model');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 400);
    this.camera.position.set(-12, 10, 16);

    if (controls) {
      const oc = new OrbitControls(this.camera, renderer.domElement);
      oc.enableDamping = true;
      oc.dampingFactor = 0.075;
      oc.rotateSpeed = 0.7;
      oc.zoomSpeed = 0.9;
      oc.panSpeed = 0.8;
      oc.screenSpacePanning = true;
      oc.minDistance = 2.5;
      oc.maxDistance = 70;
      oc.maxPolarAngle = Math.PI * 0.94;
      this.controls = oc;
    } else {
      this.controls = fixedControls();
    }

    // Image-based lighting is what makes the metals (gold fingers, shield, bracket) read correctly.
    this.pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.envMap = this.pmrem.fromScene(room, 0.035).texture;
    room.dispose?.();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;

    // Frame shift (px) so the model stays visible beside or above a panel: x moves the
    // image left (a side panel), y moves it up (a bottom sheet). Both 0 unless asked for.
    this.viewShift = 0;
    this.viewShiftY = 0;
    this._viewShift = 0;
    this._viewShiftY = 0;

    this.tweens = new Tweens(clock === 'manual' ? 0 : performance.now());
    this.tickers = new Set();
    this.elapsed = 0;
    this._last = null;

    this._frame = this._frame.bind(this);
    this._resize = this._resize.bind(this);
    if (size) {
      this._resize();
    } else {
      this._resizeObserver = new ResizeObserver(this._resize);
      this._resizeObserver.observe(container);
      this._resize();
    }
  }

  get aspect() {
    return this.camera.aspect;
  }

  /** Render-target size in CSS pixels (the fixed size in video mode). */
  get size() {
    if (this.fixedSize) return this.fixedSize;
    return { width: Math.max(1, this.container.clientWidth), height: Math.max(1, this.container.clientHeight) };
  }

  onTick(fn) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  start() {
    if (this.clock !== 'raf') return;
    this.renderer.setAnimationLoop(this._frame);
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  setViewShift(px, py = 0) {
    this.viewShift = px;
    this.viewShiftY = py;
  }

  _applyViewShift(dt) {
    const tx = this.viewShift;
    const ty = this.viewShiftY;
    if (this._viewShift === tx && this._viewShiftY === ty) return;
    const k = 1 - Math.exp(-dt * 7);
    this._viewShift += (tx - this._viewShift) * k;
    this._viewShiftY += (ty - this._viewShiftY) * k;
    if (Math.abs(tx - this._viewShift) < 0.5) this._viewShift = tx;
    if (Math.abs(ty - this._viewShiftY) < 0.5) this._viewShiftY = ty;
    const { width: w, height: h } = this.size;
    if (this._viewShift === 0 && this._viewShiftY === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, this._viewShift, this._viewShiftY, w, h);
  }

  /**
   * Manual clock: advance the whole scene to an absolute time in seconds and
   * draw one frame. Sub-systems that integrate (highlight easing, LED blinks)
   * see a fixed dt, so stepping 0, 1/30, 2/30 … always yields the same frames.
   */
  stepTo(time, { dt = null } = {}) {
    const step = dt ?? (this._last === null ? 0 : time - this._last);
    this._last = time;
    this.elapsed = time;
    this.tweens.update(time * 1000);
    this._applyViewShift(step);
    for (const fn of this.tickers) fn(step, time);
    this.renderer.render(this.scene, this.camera);
  }

  /** Reset the manual clock so a render pass can start cleanly from t = 0. */
  resetClock() {
    this._last = null;
    this.elapsed = 0;
    this.tweens.clear();
    this.tweens.now = 0;
  }

  _frame(timeMs) {
    const t = timeMs / 1000;
    const dt = this._last === null ? 0 : Math.min(t - this._last, 0.1);
    this._last = t;
    this.elapsed += dt;

    this.tweens.update(performance.now());
    this._applyViewShift(dt);
    for (const fn of this.tickers) fn(dt, this.elapsed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    const { width: w, height: h } = this.size;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    if (this._viewShift || this._viewShiftY) this.camera.setViewOffset(w, h, this._viewShift, this._viewShiftY, w, h);
    else this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.stop();
    this._resizeObserver?.disconnect();
    this.tickers.clear();
    this.tweens.clear();
    this.controls.dispose();
    disposeObject(this.scene);
    this.envMap.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
