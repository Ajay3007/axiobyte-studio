import { MATERIALS } from './materials.js';

/**
 * Resource cache for one hardware build. Every part factory receives the kit,
 * so identical geometries and materials are created once and shared, and the
 * whole model can be released with a single dispose().
 */
export class Kit {
  constructor() {
    this.materials = new Map();
    this.geometries = new Map();
    this.textures = new Set();
    this.extraMaterials = new Set();
  }

  material(name) {
    if (!this.materials.has(name)) {
      const recipe = MATERIALS[name];
      if (!recipe) throw new Error(`Unknown material "${name}"`);
      const m = recipe();
      m.name = name;
      this.materials.set(name, m);
    }
    return this.materials.get(name);
  }

  /** Track a one-off material (e.g. a decal) so dispose() still reaches it. */
  own(material) {
    this.extraMaterials.add(material);
    return material;
  }

  geometry(name, factory) {
    if (!this.geometries.has(name)) this.geometries.set(name, factory());
    return this.geometries.get(name);
  }

  texture(tex) {
    this.textures.add(tex);
    return tex;
  }

  dispose() {
    this.materials.forEach((m) => m.dispose());
    this.extraMaterials.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.textures.forEach((t) => t.dispose());
    this.materials.clear();
    this.extraMaterials.clear();
    this.geometries.clear();
    this.textures.clear();
  }
}
