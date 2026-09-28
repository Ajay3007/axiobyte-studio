import * as THREE from 'three';

const HOVER_LEVEL = 0.65;
const SELECT_LEVEL = 1.0;

/**
 * Each registered component gets its own material clones so highlighting one
 * part never bleeds into another part that shared a material. Levels ease
 * toward their targets every frame, which gives the soft hover animation.
 */
export class Highlighter {
  constructor(registry, { color = 0x6ec1ff, strength = 0.32 } = {}) {
    this.registry = registry;
    this.color = new THREE.Color(color);
    this.strength = strength;
    this.state = new Map();
    this.hoverId = null;
    this.selectedId = null;
    this._tmp = new THREE.Color();
  }

  prepare(entry) {
    const clones = new Map();
    const mats = [];
    const swap = (m) => {
      if (!m || m.userData?.noHighlight || !m.emissive) return m;
      if (!clones.has(m)) {
        const c = m.clone();
        clones.set(m, c);
        mats.push({ mat: c, emissive: m.emissive.clone(), intensity: m.emissiveIntensity });
      }
      return clones.get(m);
    };
    entry.object.traverse((o) => {
      if (!o.isMesh || o.userData.hitOnly) return;
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    this.state.set(entry.id, { entry, mats, level: 0 });
  }

  prepareAll() {
    this.registry.all().forEach((e) => this.prepare(e));
  }

  setHover(id) {
    this.hoverId = id;
  }

  setSelected(id) {
    this.selectedId = id;
  }

  /**
   * Absolute level control, bypassing the per-frame easing. The video renderer
   * computes every highlight level from the timeline instead of integrating it,
   * so seeking to any timestamp reproduces the same highlight state exactly.
   */
  setLevels(levels) {
    for (const s of this.state.values()) {
      const target = levels[s.entry.id] ?? 0;
      if (s.level === target) continue;
      s.level = target;
      this.apply(s);
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const s of this.state.values()) {
      const id = s.entry.id;
      const target = Math.max(id === this.selectedId ? SELECT_LEVEL : 0, id === this.hoverId ? HOVER_LEVEL : 0);
      if (s.level === target) continue;
      s.level += (target - s.level) * k;
      if (Math.abs(target - s.level) < 0.004) s.level = target;
      this.apply(s);
    }
  }

  apply(s) {
    const add = this._tmp.copy(this.color).multiplyScalar(s.level * this.strength);
    for (const { mat, emissive, intensity } of s.mats) {
      mat.emissive.copy(emissive).multiplyScalar(intensity).add(add);
      mat.emissiveIntensity = 1;
    }
    s.entry.setHighlight?.(s.level);
  }
}
