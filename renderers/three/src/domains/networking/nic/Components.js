import * as THREE from 'three';
import { mulberry32 } from '../../engine/rng.js';
import { boxAt } from '../../engine/geometry.js';
import { canvasTexture, CANVAS_FONT } from '../../engine/textures.js';
import {
  PartBatch,
  createCapacitor,
  createCrystal,
  createHeader,
  createIC,
  createInductor,
  createLedPackage,
  createMosfet,
  createPolymerCap,
  createResistor,
} from '../parts/index.js';
import { FINGERS, MISC, PCIE, TOP, VRM, fingerX } from './layout.js';

/**
 * Fill a rectangular region with a loose grid of passives. Placement is
 * seeded so the board is identical on every load, with small jitter and
 * occasional gaps so it reads as a routed layout rather than a pattern.
 */
function fillRegion(batch, rng, marks, { x0, z0, x1, z1, stepX = 0.22, stepZ = 0.2, rot = 0, density = 0.8, label = 'C', base = 100 }) {
  let n = base;
  for (let z = z0; z <= z1 + 1e-6; z += stepZ) {
    for (let x = x0; x <= x1 + 1e-6; x += stepX) {
      if (rng() > density) continue;
      const jx = (rng() - 0.5) * 0.03;
      const jz = (rng() - 0.5) * 0.02;
      const r = rng();
      const pkg = r < 0.55 ? '0402' : r < 0.85 ? '0201' : '0603';
      if (rng() < 0.62) createCapacitor(batch, x + jx, z + jz, { pkg, rot });
      else createResistor(batch, x + jx, z + jz, { pkg, rot });
      if (rng() < 0.12) marks.push({ type: 'text', x: x + jx, z: z + jz - 0.1, text: `${label}${n}`, size: 0.06, weight: 500 });
      n++;
    }
  }
}

function stickerTexture() {
  return canvasTexture(720, 440, (ctx, w, h) => {
    ctx.fillStyle = '#f1efe8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b1c1e';
    ctx.textBaseline = 'top';
    ctx.font = `700 46px ${CANVAS_FONT}`;
    ctx.fillText('AXIOBYTE', 28, 22);
    ctx.font = `500 30px ${CANVAS_FONT}`;
    ctx.fillText('AX-X2T  Dual 10GBASE-T', 28, 76);
    ctx.fillText(`MAC  ${MISC.sticker.mac}`, 28, 118);
    // barcode
    const rng = mulberry32(2638);
    let x = 28;
    while (x < w - 40) {
      const bw = 2 + Math.floor(rng() * 4);
      if (rng() > 0.4) ctx.fillRect(x, 166, bw, 110);
      x += bw + 2;
    }
    ctx.font = `500 26px ${CANVAS_FONT}`;
    ctx.fillText('S/N  AXB2638T2-00417', 28, 292);
    ctx.fillText('PBA  H62638-003   Rev B1', 28, 330);
    ctx.font = `500 22px ${CANVAS_FONT}`;
    ctx.fillText('Designed for the AxioByte learning lab', 28, 378);
  });
}

export function createComponents(kit) {
  const group = new THREE.Group();
  group.name = 'components';
  const rng = mulberry32(0xa1b2c3);
  const batch = new PartBatch(kit, { surfaceY: TOP });
  const marks = [];

  // Controller: decoupling between the PCIe pairs and along the top edge.
  for (let i = 0; i < 7; i++) createCapacitor(batch, 9.7125 + 0.225 * i, 4.45, { pkg: '0402', rot: Math.PI / 2 });
  [10.9, 11.08, 11.26].forEach((x) => createCapacitor(batch, x, 1.55, { pkg: '0402', rot: Math.PI / 2 }));

  // Crystal and its load capacitors.
  const xtal = createCrystal(kit);
  xtal.position.set(MISC.crystal.x, TOP, MISC.crystal.z);
  group.add(xtal);
  createCapacitor(batch, 8.05, 1.62, { pkg: '0402' });
  createCapacitor(batch, 8.62, 1.62, { pkg: '0402' });

  // PHY bus series terminations.
  for (let k = 0; k < 14; k++) createResistor(batch, 8.3, 2.22 + 0.12 * k, { pkg: '0201' });

  // PCIe AC-coupling capacitors on every lane.
  PCIE.pairs.forEach((p) => {
    const xa = fingerX(FINGERS.segA.count + p.fingers[0]);
    const xb = fingerX(FINGERS.segA.count + p.fingers[1]);
    const xc = (xa + xb) / 2;
    createCapacitor(batch, xc - PCIE.pairGap / 2, PCIE.capZ, { pkg: '0402', rot: Math.PI / 2 });
    createCapacitor(batch, xc + PCIE.pairGap / 2, PCIE.capZ, { pkg: '0402', rot: Math.PI / 2 });
  });

  // Line-side Bob Smith terminations and the 2 kV bleed capacitor.
  for (let i = 0; i < 5; i++) createResistor(batch, 2.3 + i * 0.24, 4.98, { pkg: '0603', rot: Math.PI / 2 });
  createCapacitor(batch, 3.62, 5.0, { pkg: '1206' });
  marks.push({ type: 'text', x: 2.78, z: 4.76, text: 'R41–R45', size: 0.07 });

  // VRM: power stages, chokes, bulk polymer capacitors and the PWM controller.
  VRM.inductors.forEach((p) => {
    createInductor(batch, p.x, p.z, { size: VRM.inductorSize, height: VRM.inductorH });
    createMosfet(batch, VRM.fetX, p.z - 0.27, { rot: Math.PI / 2 });
    createMosfet(batch, VRM.fetX, p.z + 0.27, { rot: Math.PI / 2 });
  });
  VRM.caps.forEach((p) => createPolymerCap(batch, p.x, p.z, { r: VRM.capR, height: VRM.capH }));
  for (let i = 0; i < 4; i++) createCapacitor(batch, 13.9 + i * 0.3, 0.52, { pkg: '1206', rot: 0 });
  const pwm = createIC(kit, { name: 'pwm', w: 0.4, d: 0.4, h: 0.08, standoff: 0, pins: { x: 6, z: 6 }, pitch: 0.05, leadLen: 0, leadW: 0.025 });
  pwm.position.set(VRM.pwm.x, TOP, VRM.pwm.z);
  group.add(pwm);
  fillRegion(batch, rng, marks, { x0: 14.05, z0: 4.5, x1: 14.8, z1: 5.2, label: 'R', base: 70 });
  fillRegion(batch, rng, marks, { x0: 15.6, z0: 4.45, x1: 16.3, z1: 5.0, label: 'C', base: 80, rot: Math.PI / 2 });

  // Configuration flash, JTAG header, status LEDs.
  const flash = createIC(kit, {
    name: 'flash',
    w: 0.39,
    d: 0.49,
    h: 0.15,
    standoff: 0.01,
    pins: { x: 4, z: 0 },
    pitch: 0.127,
    leadLen: 0.1,
    leadW: 0.04,
    label: ['AXB', '25Q64', '2638'],
    labelScale: 0.9,
  });
  flash.position.set(MISC.flash.x, TOP, MISC.flash.z);
  group.add(flash);

  const jtag = createHeader(kit, { cols: 5, rows: 2 });
  jtag.position.set(MISC.jtag.x, TOP, MISC.jtag.z);
  group.add(jtag);

  const boardLeds = MISC.boardLeds.map((l) => {
    const { group: led, lensMat } = createLedPackage(kit, l.color);
    led.position.set(l.x, TOP, l.z);
    group.add(led);
    createResistor(batch, l.x - 0.2, l.z + 0.02, { pkg: '0402' });
    return { material: lensMat, label: l.label };
  });

  // Supporting logic scattered in the free areas of the board.
  const ldo = [
    [7.95, 4.6],
    [5.6, 5.12],
    [12.0, 6.35],
  ];
  ldo.forEach(([x, z]) => batch.sot23(x, z));
  const eeprom = createIC(kit, { name: 'eeprom', w: 0.3, d: 0.3, h: 0.08, standoff: 0, pins: { x: 4, z: 4 }, pitch: 0.06, leadLen: 0, leadW: 0.025 });
  eeprom.position.set(5.45, TOP, 6.05);
  group.add(eeprom);

  fillRegion(batch, rng, marks, { x0: 8.25, z0: 4.05, x1: 9.1, z1: 5.25, label: 'C', base: 120 });
  fillRegion(batch, rng, marks, { x0: 3.55, z0: 5.3, x1: 4.9, z1: 6.45, label: 'C', base: 150, rot: Math.PI / 2 });
  fillRegion(batch, rng, marks, { x0: 11.5, z0: 5.15, x1: 12.15, z1: 6.1, label: 'R', base: 30 });
  fillRegion(batch, rng, marks, { x0: 13.05, z0: 5.1, x1: 13.65, z1: 6.5, label: 'C', base: 40 });
  fillRegion(batch, rng, marks, { x0: 0.95, z0: 4.78, x1: 1.95, z1: 5.1, label: 'C', base: 180, density: 0.6 });
  fillRegion(batch, rng, marks, { x0: 7.25, z0: 0.85, x1: 7.85, z1: 2.05, label: 'C', base: 190, rot: Math.PI / 2 });

  group.add(batch.build('passives'));

  // MAC / serial sticker.
  const tex = kit.texture(stickerTexture());
  const s = MISC.sticker;
  const face = kit.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  const paper = kit.material('paper');
  const sticker = new THREE.Mesh(boxAt(s.x1 - s.x0, 0.008, s.z1 - s.z0, 0, 0, 0), [paper, paper, face, paper, paper, paper]);
  sticker.position.set((s.x0 + s.x1) / 2, TOP + 0.006, (s.z0 + s.z1) / 2);
  sticker.receiveShadow = true;
  sticker.name = 'mac-sticker';
  group.add(sticker);

  group.userData.partCount = batch.count;
  return { group, marks, boardLeds };
}
