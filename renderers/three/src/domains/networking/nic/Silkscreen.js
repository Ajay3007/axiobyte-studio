import * as THREE from 'three';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { CONTROLLER, FINGERS, MAGNETICS, MISC, PCB, TOP, VRM } from './layout.js';

const PX = 170; // canvas pixels per cm
const INK = 'rgba(234,236,226,0.88)';

/**
 * Board-wide silkscreen as one transparent decal. Marks are plain data
 * ({ type, ... } in board coordinates) so part builders can contribute
 * designators without knowing anything about canvases.
 */
export function layoutMarks() {
  const marks = [];
  const c = CONTROLLER;
  const half = c.size / 2 + c.leadLen + 0.08;
  marks.push({ type: 'corners', x0: c.x - half, z0: c.z - half, x1: c.x + half, z1: c.z + half, len: 0.3 });
  marks.push({ type: 'pin1', x: c.x - half - 0.02, z: c.z - half - 0.02 });
  marks.push({ type: 'text', x: 9.12, z: 4.55, text: 'U1', size: 0.17, weight: 600 });

  MAGNETICS.zs.forEach((z, i) => {
    marks.push({ type: 'rect', x0: MAGNETICS.x - 0.66, z0: z - 0.71, x1: MAGNETICS.x + 0.66, z1: z + 0.71 });
    marks.push({ type: 'text', x: MAGNETICS.x, z: z + (i === 0 ? 0.9 : 0.88), text: `T${i + 1}`, size: 0.15, weight: 600 });
  });

  marks.push({ type: 'text', x: 4.05, z: 0.66, text: 'AXIOBYTE', size: 0.25, weight: 700, align: 'left', spacing: 3 });
  marks.push({ type: 'text', x: 5.65, z: 0.67, text: 'AX-X2T  10GBASE-T  DUAL PORT', size: 0.13, weight: 500, align: 'left' });
  marks.push({ type: 'text', x: 10.65, z: 6.72, text: 'PCIe 3.0 x8', size: 0.17, weight: 600 });
  marks.push({ type: 'text', x: 12.25, z: 0.28, text: 'E318251   94V-0   2638', size: 0.12, weight: 500, align: 'left' });
  marks.push({ type: 'text', x: 15.25, z: 6.72, text: 'REV B1', size: 0.13, weight: 600 });

  VRM.inductors.forEach((p, i) => {
    const s = VRM.inductorSize / 2 + 0.06;
    marks.push({ type: 'corners', x0: p.x - s, z0: p.z - s, x1: p.x + s, z1: p.z + s, len: 0.14 });
    marks.push({ type: 'text', x: p.x - s - 0.14, z: p.z, text: `L${i + 1}`, size: 0.11, weight: 600, rot: -Math.PI / 2 });
  });
  VRM.caps.forEach((p, i) => {
    marks.push({ type: 'circle', x: p.x, z: p.z, r: VRM.capR + 0.06, plus: true });
    marks.push({ type: 'text', x: p.x + 0.52, z: p.z, text: `C${60 + i}`, size: 0.1, weight: 500, rot: -Math.PI / 2 });
  });

  marks.push({ type: 'text', x: MISC.flash.x, z: MISC.flash.z - 0.42, text: 'U4', size: 0.12, weight: 600 });
  marks.push({ type: 'text', x: MISC.crystal.x, z: MISC.crystal.z - 0.3, text: 'Y1', size: 0.12, weight: 600 });
  marks.push({ type: 'rect', x0: MISC.jtag.x - 0.7, z0: MISC.jtag.z - 0.3, x1: MISC.jtag.x + 0.7, z1: MISC.jtag.z + 0.3 });
  marks.push({ type: 'text', x: MISC.jtag.x, z: MISC.jtag.z - 0.44, text: 'J3  JTAG', size: 0.12, weight: 600 });
  marks.push({ type: 'pin1', x: MISC.jtag.x - 0.78, z: MISC.jtag.z + 0.2 });
  MISC.boardLeds.forEach((l) => marks.push({ type: 'text', x: l.x - 0.26, z: l.z, text: l.label, size: 0.11, weight: 600, align: 'right' }));
  return marks;
}

function draw(ctx, marks) {
  const p = (v) => v * PX;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'square';
  ctx.textBaseline = 'middle';
  for (const m of marks) {
    ctx.lineWidth = p(m.thin ? 0.008 : 0.013);
    ctx.setLineDash([]);
    switch (m.type) {
      case 'rect':
        ctx.strokeRect(p(m.x0), p(m.z0), p(m.x1 - m.x0), p(m.z1 - m.z0));
        break;
      case 'dashed':
        ctx.setLineDash([p(0.08), p(0.06)]);
        ctx.strokeRect(p(m.x0), p(m.z0), p(m.x1 - m.x0), p(m.z1 - m.z0));
        break;
      case 'corners': {
        const l = m.len;
        ctx.beginPath();
        for (const [x, z, sx, sz] of [
          [m.x0, m.z0, 1, 1],
          [m.x1, m.z0, -1, 1],
          [m.x0, m.z1, 1, -1],
          [m.x1, m.z1, -1, -1],
        ]) {
          ctx.moveTo(p(x + sx * l), p(z));
          ctx.lineTo(p(x), p(z));
          ctx.lineTo(p(x), p(z + sz * l));
        }
        ctx.stroke();
        break;
      }
      case 'circle':
        ctx.beginPath();
        ctx.arc(p(m.x), p(m.z), p(m.r), 0, Math.PI * 2);
        ctx.stroke();
        if (m.plus) {
          ctx.font = `600 ${p(0.14)}px ${CANVAS_FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText('+', p(m.x - m.r - 0.1), p(m.z - m.r + 0.05));
        }
        break;
      case 'pin1':
        ctx.beginPath();
        ctx.arc(p(m.x), p(m.z), p(0.045), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'text': {
        ctx.save();
        ctx.translate(p(m.x), p(m.z));
        if (m.rot) ctx.rotate(m.rot);
        ctx.font = `${m.weight ?? 500} ${p(m.size)}px ${CANVAS_FONT}`;
        ctx.textAlign = m.align ?? 'center';
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${m.spacing ?? 0}px`;
        ctx.fillText(m.text, 0, 0);
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }
}

export function createSilkscreen(kit, extraMarks = []) {
  const depth = FINGERS.tab.z;
  const tex = kit.texture(canvasTexture(PCB.L * PX, depth * PX, (ctx) => draw(ctx, [...layoutMarks(), ...extraMarks])));
  const mat = kit.own(
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const geo = new THREE.PlaneGeometry(PCB.L, depth);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(PCB.L / 2, TOP + 0.0055, depth / 2);
  mesh.receiveShadow = true;
  mesh.name = 'silkscreen';
  mesh.renderOrder = 1;
  return mesh;
}
