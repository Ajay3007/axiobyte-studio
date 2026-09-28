import * as THREE from 'three';

const DRAG_THRESHOLD = 5; // px; beyond this a press is an orbit, not a click

/**
 * Raycast picking against registered components. Picking happens at most
 * once per frame (in update) and only when the pointer or camera moved.
 *
 * Events: 'hover' { id, x, y } (id null when leaving), 'move' { x, y }, 'select' { id }
 */
export class InteractionManager extends EventTarget {
  constructor({ camera, dom, controls, registry, occluders = [] }) {
    super();
    this.camera = camera;
    this.dom = dom;
    this.controls = controls;
    this.registry = registry;
    this.occluders = occluders;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.client = { x: 0, y: 0 };
    this.inside = false;
    this.dirty = false;
    this.hoverId = null;
    this.down = null;
    this.enabled = true;

    this._move = (e) => {
      if (e.pointerType === 'touch' && !this.down) return;
      this.setPointer(e);
      this.inside = true;
      this.dirty = true;
      this.dispatchEvent(new CustomEvent('move', { detail: { ...this.client } }));
    };
    this._down = (e) => {
      if (e.button !== 0) return;
      this.down = { x: e.clientX, y: e.clientY };
      this.setPointer(e);
    };
    this._up = (e) => {
      if (!this.down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved > DRAG_THRESHOLD) return;
      this.setPointer(e);
      const id = this.pick();
      this.dispatchEvent(new CustomEvent('select', { detail: { id } }));
      if (e.pointerType === 'touch') this.setHover(null);
    };
    this._leave = () => {
      this.inside = false;
      this.setHover(null);
    };
    this._controlsChange = () => {
      if (this.inside) this.dirty = true;
    };
    this._key = (e) => {
      if (e.key === 'Escape') this.dispatchEvent(new CustomEvent('select', { detail: { id: null } }));
    };

    dom.addEventListener('pointermove', this._move);
    dom.addEventListener('pointerdown', this._down);
    dom.addEventListener('pointerup', this._up);
    dom.addEventListener('pointerleave', this._leave);
    controls.addEventListener('change', this._controlsChange);
    window.addEventListener('keydown', this._key);
  }

  setPointer(e) {
    const rect = this.dom.getBoundingClientRect();
    this.client.x = e.clientX - rect.left;
    this.client.y = e.clientY - rect.top;
    this.pointer.set((this.client.x / rect.width) * 2 - 1, -(this.client.y / rect.height) * 2 + 1);
  }

  pick() {
    if (!this.enabled) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [...this.registry.pickables(), ...this.occluders];
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      const id = this.registry.idFromObject(hit.object);
      // The bare PCB occludes parts behind it but is not itself selectable.
      return id;
    }
    return null;
  }

  setHover(id) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.dom.style.cursor = id ? 'pointer' : '';
    this.dispatchEvent(new CustomEvent('hover', { detail: { id, ...this.client } }));
  }

  update() {
    if (!this.dirty || this.down) return;
    this.dirty = false;
    this.setHover(this.inside ? this.pick() : null);
  }

  dispose() {
    this.dom.removeEventListener('pointermove', this._move);
    this.dom.removeEventListener('pointerdown', this._down);
    this.dom.removeEventListener('pointerup', this._up);
    this.dom.removeEventListener('pointerleave', this._leave);
    this.controls.removeEventListener('change', this._controlsChange);
    window.removeEventListener('keydown', this._key);
  }
}
