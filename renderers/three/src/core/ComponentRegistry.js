import * as THREE from 'three';

/**
 * The contract between 3D models and everything built on top of them
 * (hover, selection, camera focus, packet animation, explanations).
 *
 * entry = {
 *   id, object, meta,
 *   hitObjects,      meshes the raycaster tests (defaults to every mesh in object)
 *   boundsObject,    object used for camera framing (defaults to object)
 *   anchors,         { name: Vector3 in object-local space } e.g. in / out / center
 *   setHighlight,    optional custom highlight (level 0..1+) for non-material parts
 *   enabled,
 * }
 */
export class ComponentRegistry {
  constructor() {
    this.entries = new Map();
    this._pickables = null;
  }

  register({ id, object, meta = {}, hitObjects, boundsObject, anchors = {}, setHighlight }) {
    if (this.entries.has(id)) throw new Error(`Component "${id}" is already registered`);
    object.userData.componentId = id;
    const hits = hitObjects ?? collectMeshes(object);
    hits.forEach((h) => {
      h.userData.componentId = id;
    });
    const entry = {
      id,
      object,
      meta: { id, ...meta },
      hitObjects: hits,
      boundsObject: boundsObject ?? object,
      anchors,
      setHighlight,
      enabled: true,
    };
    this.entries.set(id, entry);
    this._pickables = null;
    return entry;
  }

  has(id) {
    return this.entries.has(id);
  }

  get(id) {
    return this.entries.get(id) ?? null;
  }

  all() {
    return [...this.entries.values()];
  }

  setEnabled(id, enabled) {
    const e = this.get(id);
    if (e) {
      e.enabled = enabled;
      this._pickables = null;
    }
  }

  pickables() {
    if (!this._pickables) {
      this._pickables = this.all()
        .filter((e) => e.enabled)
        .flatMap((e) => e.hitObjects);
    }
    return this._pickables;
  }

  idFromObject(obj) {
    for (let o = obj; o; o = o.parent) {
      if (o.userData.componentId) return o.userData.componentId;
    }
    return null;
  }

  worldBox(id, out = new THREE.Box3()) {
    const e = this.get(id);
    if (!e) return null;
    e.boundsObject.updateWorldMatrix(true, true);
    return out.setFromObject(e.boundsObject);
  }

  anchorWorld(id, name = 'center', out = new THREE.Vector3()) {
    const e = this.get(id);
    if (!e) return null;
    const local = e.anchors[name] ?? e.anchors.center;
    if (!local) return this.worldBox(id).getCenter(out);
    e.object.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(e.object.matrixWorld);
  }
}

function collectMeshes(root) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.isSprite) meshes.push(o);
  });
  return meshes;
}
