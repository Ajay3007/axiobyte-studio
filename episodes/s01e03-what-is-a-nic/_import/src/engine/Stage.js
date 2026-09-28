import * as THREE from 'three';
import { canvasTexture } from './textures.js';

function gridTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const cells = 36;
    const step = w / cells;
    ctx.strokeStyle = 'rgba(236,232,218,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step + 0.5, 0);
      ctx.lineTo(i * step + 0.5, h);
      ctx.moveTo(0, i * step + 0.5);
      ctx.lineTo(w, i * step + 0.5);
      ctx.stroke();
    }
    // soft pool of light under the model
    const pool = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.3);
    pool.addColorStop(0, 'rgba(255,255,255,0.06)');
    pool.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);
    // fade everything out toward the edges so the floor has no visible border
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createRadialGradient(w / 2, h / 2, w * 0.08, w / 2, h / 2, w * 0.5);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  });
}

export function createStage({ size = 64 } = {}) {
  const group = new THREE.Group();
  group.name = 'stage';

  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  grid.rotation.x = -Math.PI / 2;
  grid.renderOrder = -2;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShadowMaterial({ color: 0x05070a, opacity: 0.38, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.receiveShadow = true;
  shadow.renderOrder = -1;

  group.add(grid, shadow);
  return { group, floorY: 0 };
}
