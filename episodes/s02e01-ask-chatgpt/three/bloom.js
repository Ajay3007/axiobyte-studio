import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Camera layer the attention links render on, in addition to the default layer. */
export const BLOOM_LAYER = 1;

/**
 * Selective bloom: only objects on BLOOM_LAYER glow, and only their glow is
 * added — the frame itself is rendered once, untouched, by the engine.
 *
 *   1. render the BLOOM_LAYER objects alone into an offscreen buffer
 *   2. UnrealBloomPass blurs them; its renderTargetsHorizontal[0] then holds
 *      the bloom by itself
 *   3. add that bloom over the engine's finished frame
 *
 * Every step is a deterministic GPU pass over the same inputs, so a frame is
 * still a pure function of time.
 */
export function createBloom(engine, { strength, radius, threshold }) {
  const { renderer, scene, camera } = engine;
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const input = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
  const pass = new UnrealBloomPass(size.clone(), strength, radius, threshold);
  pass.renderToScreen = false;
  const add = new FullScreenQuad(
    new THREE.MeshBasicMaterial({ map: pass.renderTargetsHorizontal[0].texture, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
  );

  return {
    render() {
      const mask = camera.layers.mask;
      const autoClear = renderer.autoClear;
      camera.layers.set(BLOOM_LAYER);
      renderer.setRenderTarget(input);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      camera.layers.mask = mask;
      pass.render(renderer, null, input, 0, false);
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      add.render(renderer);
      renderer.autoClear = autoClear;
    },
    dispose() {
      input.dispose();
      pass.dispose();
      add.dispose();
    },
  };
}
