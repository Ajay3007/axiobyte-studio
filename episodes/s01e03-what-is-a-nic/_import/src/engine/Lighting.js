import * as THREE from 'three';

const KEY_OFFSET = new THREE.Vector3(-7, 15, 9);

/** Product-render style rig: warm key with shadows, cool fill, rim for silhouette, soft hemisphere. */
export function createLighting() {
  const group = new THREE.Group();
  group.name = 'lighting';

  const key = new THREE.DirectionalLight(0xfff3e4, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 2.5;

  const fill = new THREE.DirectionalLight(0xcddcff, 0.55);
  fill.position.set(11, 6, -3);

  const rim = new THREE.DirectionalLight(0xe4ecff, 1.5);
  rim.position.set(5, 6, -13);

  const hemi = new THREE.HemisphereLight(0xe6ecfa, 0x1a1d22, 0.35);

  group.add(key, key.target, fill, rim, hemi);

  /** Tighten the shadow frustum around the model so small parts get crisp contact shadows. */
  function fitShadow(box) {
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() * 0.55;
    key.target.position.copy(center);
    key.position.copy(center).add(KEY_OFFSET);
    const cam = key.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 1;
    cam.far = KEY_OFFSET.length() + radius * 2;
    cam.updateProjectionMatrix();
  }

  return { group, key, fill, rim, hemi, fitShadow };
}
