/** Release every GPU resource reachable from a subtree. */
export function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((obj) => {
    if (obj.geometry) geometries.add(obj.geometry);
    const m = obj.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => materials.add(x));
    if (obj.isInstancedMesh) obj.dispose();
  });

  materials.forEach((mat) => {
    for (const key of Object.keys(mat)) {
      const value = mat[key];
      if (value && value.isTexture) textures.add(value);
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
