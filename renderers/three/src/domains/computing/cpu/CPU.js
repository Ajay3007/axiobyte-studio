import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { PartBatch } from '../../../core/hardware/parts/index.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { boxAt, extrudeAlongY, mergeAll, roundedRect } from '../../../core/geometry.js';
import { CENTER, CORE_TILES, DIE, IHS, LANDS, NOTCHES, PIN1, PKG, REGIONS, SUB_TOP } from './layout.js';
import { CPU_METADATA } from './metadata.js';

/**
 * Builds the CPU asset — a generic LGA processor package — in package-local coordinates, and
 * returns plain data the scene layer registers. The model knows nothing about raycasting, cameras
 * or UI; it exposes two physical motions (lifting the heat spreader, turning the package over)
 * as functions of a 0..1 value, so a page tweens them and a film can set them per frame.
 *
 * Parts: `ihs`, `substrate`, `lands`, `die` (physical) and `cores`, `cache`, `memory-controller`,
 * `io` (conceptual — drawn as labelled tiles on the die, never as hardware).
 */
export function createCPU() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'cpu';
  // `body` turns the package over about its centre; `inner` holds it in package coordinates.
  const pivotY = SUB_TOP / 2;
  const body = new THREE.Group();
  body.position.set(CENTER, pivotY, CENTER);
  const inner = new THREE.Group();
  inner.position.set(-CENTER, -pivotY, -CENTER);
  body.add(inner);
  root.add(body);

  const components = [];
  const add = (id, object, extra = {}) => {
    inner.add(object);
    components.push({ id, object, meta: CPU_METADATA[id], ...extra });
  };

  const substrate = createSubstrate(kit);
  add('substrate', substrate.group, { anchors: substrate.anchors });
  const lands = createLands(kit);
  add('lands', lands.group, { hitObjects: lands.hitObjects, anchors: lands.anchors });
  const die = createDie(kit);
  add('die', die.group, { anchors: die.anchors });
  const ihs = createIHS(kit);
  add('ihs', ihs.group, { anchors: ihs.anchors });

  const regions = new THREE.Group();
  regions.name = 'cpu-regions';
  regions.visible = false;
  inner.add(regions);
  for (const id of Object.keys(REGIONS)) {
    const region = createRegion(kit, id);
    regions.add(region.mesh);
    components.push({ id, object: region.mesh, meta: CPU_METADATA[id], anchors: region.anchors, setHighlight: region.setHighlight });
  }

  return {
    root,
    kit,
    components,
    occluders: [substrate.board],
    /** Heat spreader: 0 seated → 1 lifted and slid aside, revealing the die. */
    setOpen(k) {
      ihs.group.position.set(0, IHS.lift * Math.sin((k * Math.PI) / 2), -IHS.slide * k * k);
    },
    /** Package: 0 right way up → 1 turned over, lands on top. */
    setFlip(k) {
      body.rotation.x = Math.PI * k;
    },
    setRegionsVisible(v) {
      regions.visible = v;
    },
    setFieldsVisible(v) {
      lands.fields.visible = v;
    },
    stats: { lands: lands.count },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

// ------------------------------------------------------------------ substrate

function substrateShape() {
  const L = PKG.L;
  const s = new THREE.Shape();
  // Outline in (x, -z), with the socket-key notches cut into the two z edges.
  const n0 = NOTCHES.find((n) => n.edge === 'z0');
  const n1 = NOTCHES.find((n) => n.edge === 'z1');
  s.moveTo(0, 0);
  s.lineTo(n0.at, 0);
  s.lineTo(n0.at, -n0.d);
  s.lineTo(n0.at + n0.w, -n0.d);
  s.lineTo(n0.at + n0.w, 0);
  s.lineTo(L, 0);
  s.lineTo(L, -L);
  s.lineTo(L - n1.at, -L);
  s.lineTo(L - n1.at, -L + n1.d);
  s.lineTo(L - n1.at - n1.w, -L + n1.d);
  s.lineTo(L - n1.at - n1.w, -L);
  s.lineTo(0, -L);
  s.closePath();
  return s;
}

function createSubstrate(kit) {
  const group = new THREE.Group();
  group.name = 'cpu-substrate';
  const board = new THREE.Mesh(extrudeAlongY(substrateShape(), SUB_TOP, 0.01, 4), [kit.material('solderMask'), kit.material('pcbEdge')]);
  board.name = 'cpu-substrate-laminate';
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // Die-side decoupling capacitors in the margin around the heat spreader.
  const batch = new PartBatch(kit, { surfaceY: SUB_TOP });
  const inset = (PKG.L - IHS.size) / 4 + 0.02;
  for (let i = 0; i < 9; i++) {
    const t = 0.9 + i * 0.28;
    batch.capacitor(t, inset, { pkg: '0402', rot: 0 });
    batch.capacitor(t, PKG.L - inset, { pkg: '0402', rot: 0 });
    batch.capacitor(inset, t, { pkg: '0402', rot: Math.PI / 2 });
    batch.capacitor(PKG.L - inset, t, { pkg: '0402', rot: Math.PI / 2 });
  }
  group.add(batch.build('cpu-die-side-caps'));

  // Gold pin-1 triangle.
  const tri = new THREE.Shape();
  tri.moveTo(PIN1.x, -PIN1.z);
  tri.lineTo(PIN1.x + 0.28, -PIN1.z);
  tri.lineTo(PIN1.x, -PIN1.z - 0.28);
  tri.closePath();
  const marker = new THREE.Mesh(extrudeAlongY(tri, 0.006, 0, 1), kit.material('gold'));
  marker.position.y = SUB_TOP;
  group.add(marker);

  return {
    group,
    board,
    anchors: {
      center: new THREE.Vector3(CENTER, SUB_TOP / 2, CENTER),
      top: new THREE.Vector3(CENTER, SUB_TOP, CENTER),
      bottom: new THREE.Vector3(CENTER, 0, CENTER),
    },
  };
}

// ---------------------------------------------------------------------- lands

function createLands(kit) {
  const group = new THREE.Group();
  group.name = 'cpu-lands';
  const { pitch, margin, pad, keepOut } = LANDS;
  const positions = [];
  const k0 = CENTER - keepOut / 2;
  const k1 = CENTER + keepOut / 2;
  for (let x = margin; x <= PKG.L - margin + 1e-6; x += pitch) {
    for (let z = margin; z <= PKG.L - margin + 1e-6; z += pitch) {
      if (x > k0 && x < k1 && z > k0 && z < k1) continue;
      const nearNotch = NOTCHES.some((n) => {
        const nx = n.edge === 'z0' ? n.at + n.w / 2 : PKG.L - n.at - n.w / 2;
        const nz = n.edge === 'z0' ? 0 : PKG.L;
        return Math.abs(x - nx) < n.w && Math.abs(z - nz) < n.d + 0.12;
      });
      if (!nearNotch) positions.push([x, z]);
    }
  }
  const padGeo = kit.geometry('cpu-land', () => boxAt(pad, 0.006, pad, 0, -0.003, 0));
  const pads = new THREE.InstancedMesh(padGeo, kit.material('gold'), positions.length);
  pads.name = 'cpu-land-pads';
  const m = new THREE.Matrix4();
  positions.forEach(([x, z], i) => pads.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  pads.instanceMatrix.needsUpdate = true;
  pads.computeBoundingSphere();
  group.add(pads);

  // Land-side capacitors in the central keep-out, mirrored to hang below the underside.
  const caps = new THREE.Group();
  caps.scale.y = -1;
  const batch = new PartBatch(kit, { surfaceY: 0 });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) batch.capacitor(k0 + 0.22 + i * 0.22, k0 + 0.3 + j * 0.24, { pkg: '0402', rot: 0 });
  caps.add(batch.build('cpu-land-side-caps'));
  group.add(caps);

  // Where the memory channels and the PCIe lanes leave the package — a conceptual overlay, shown
  // only when the package is turned over.
  const fields = new THREE.Group();
  fields.name = 'cpu-land-fields';
  fields.visible = false;
  // Each label reads along its field, turned toward the package's near edge in the default view.
  fields.add(fieldOverlay(kit, LANDS.fields.memory, 'MEMORY CHANNELS', '#b09bff', -Math.PI / 2));
  fields.add(fieldOverlay(kit, LANDS.fields.pcie, 'PCIe LANES', '#f0c060', -Math.PI / 2 + Math.PI));
  group.add(fields);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(PKG.L - 2 * margin + pitch, 0.03, PKG.L - 2 * margin + pitch),
    kit.own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
  );
  hit.position.set(CENTER, -0.015, CENTER);
  hit.userData.hitOnly = true;
  hit.name = 'cpu-lands-hit';
  group.add(hit);

  const { memory: mem, pcie } = LANDS.fields;
  return {
    group,
    fields,
    count: positions.length,
    hitObjects: [hit],
    anchors: {
      center: new THREE.Vector3(CENTER, 0, CENTER),
      // The two structural interfaces: centres of the memory and PCIe groups of lands.
      memory: new THREE.Vector3((mem.x0 + mem.x1) / 2, 0, (mem.z0 + mem.z1) / 2),
      pcie: new THREE.Vector3((pcie.x0 + pcie.x1) / 2, 0, (pcie.z0 + pcie.z1) / 2),
    },
  };
}

function fieldOverlay(kit, f, label, color, turn) {
  const w = f.x1 - f.x0;
  const d = f.z1 - f.z0;
  const px = 220;
  const tex = kit.texture(
    canvasTexture(Math.round(w * px), Math.round(d * px), (ctx, W, H) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.setLineDash([18, 12]);
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(turn);
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.round(W * 0.34)}px ${CANVAS_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }),
  );
  const mat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  plane.rotation.x = Math.PI / 2; // faces down; faces up once the package is turned over
  plane.position.set((f.x0 + f.x1) / 2, -0.012, (f.z0 + f.z1) / 2);
  plane.renderOrder = 3;
  return plane;
}

// ------------------------------------------------------------------------ die

function createDie(kit) {
  const group = new THREE.Group();
  group.name = 'cpu-die';
  const x0 = CENTER - DIE.w / 2;
  const z0 = CENTER - DIE.d / 2;
  // Underfill: the epoxy fillet that locks the die's bumps to the substrate.
  const fillet = new THREE.Mesh(boxAt(DIE.w + 0.06, 0.018, DIE.d + 0.06, CENTER, SUB_TOP + 0.009, CENTER), kit.material('substrate'));
  const silicon = new THREE.Mesh(boxAt(DIE.w, DIE.h, DIE.d, CENTER, SUB_TOP + DIE.h / 2, CENTER), kit.material('silicon'));
  silicon.name = 'cpu-die-silicon';
  silicon.castShadow = true;
  group.add(fillet, silicon);
  return {
    group,
    anchors: {
      center: new THREE.Vector3(CENTER, SUB_TOP + DIE.h / 2, CENTER),
      top: new THREE.Vector3(CENTER, SUB_TOP + DIE.h, CENTER),
      corner: new THREE.Vector3(x0, SUB_TOP + DIE.h, z0),
    },
  };
}

// ----------------------------------------------------------- regions (conceptual)

const REGION_STYLE = {
  cores: { color: '#6ec1ff', title: 'CPU CORES', note: 'each with private L1 + L2' },
  cache: { color: '#5cff8a', title: 'SHARED CACHE', note: 'last level' },
  'memory-controller': { color: '#b09bff', title: 'MEMORY CONTROLLER', note: 'to DRAM' },
  io: { color: '#f0c060', title: 'PCIe ROOT COMPLEX · I/O', note: 'to the PCIe lanes' },
};

function createRegion(kit, id) {
  const r = REGIONS[id];
  const style = REGION_STYLE[id];
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const px = 600;
  const tex = kit.texture(
    canvasTexture(Math.round(w * px), Math.round(d * px), (ctx, W, H) => {
      ctx.fillStyle = `${style.color}2e`;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, W - 6, H - 6);
      ctx.fillStyle = style.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (id === 'cores') {
        // The core region is drawn as tiles, one per core — an illustrative count.
        const { cols, rows } = CORE_TILES;
        const g = 22;
        const tw = (W - g * (cols + 1)) / cols;
        const th = (H - g * (rows + 1)) / rows;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const x = g + i * (tw + g);
            const y = g + j * (th + g);
            ctx.fillStyle = `${style.color}33`;
            ctx.fillRect(x, y, tw, th);
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, tw, th);
            ctx.fillStyle = style.color;
            ctx.font = `700 ${Math.round(th * 0.2)}px ${CANVAS_FONT}`;
            ctx.fillText('CORE', x + 14, y + 12);
            ctx.font = `600 ${Math.round(th * 0.13)}px ${CANVAS_FONT}`;
            ctx.fillStyle = `${style.color}cc`;
            ctx.fillText('L1 · L2', x + 14, y + 14 + th * 0.22);
          }
        }
        return;
      }
      const size = Math.min(H * 0.24, (W / style.title.length) * 1.7);
      ctx.font = `700 ${Math.round(size)}px ${CANVAS_FONT}`;
      ctx.fillText(style.title, 16, 14);
      ctx.font = `600 ${Math.round(size * 0.7)}px ${CANVAS_FONT}`;
      ctx.fillStyle = `${style.color}cc`;
      ctx.fillText(style.note, 16, 20 + size);
    }),
  );
  const mat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  const x0 = CENTER - DIE.w / 2;
  const z0 = CENTER - DIE.d / 2;
  const y = SUB_TOP + DIE.h + 0.003;
  mesh.position.set(x0 + (r.x0 + r.x1) / 2, y, z0 + (r.z0 + r.z1) / 2);
  mesh.name = `cpu-region-${id}`;
  mesh.renderOrder = 2;
  // Anchors in the tile's own plane: its centre, and for the two interface regions the edge that
  // faces their group of lands (memory toward -x, PCIe toward +x).
  const anchors = { center: new THREE.Vector3(0, 0, 0) };
  if (id === 'io') anchors.root_complex = new THREE.Vector3(w / 2, 0, 0);
  if (id === 'memory-controller') anchors.channels = new THREE.Vector3(-w / 2, 0, 0);
  return {
    mesh,
    anchors,
    setHighlight(level) {
      mat.opacity = 0.9 + 0.1 * Math.min(1, level);
      mat.color.setScalar(1 + 0.6 * level);
    },
  };
}

// ------------------------------------------------------------------------ IHS

function createIHS(kit) {
  const group = new THREE.Group();
  group.name = 'cpu-ihs';
  const s = IHS.size;
  const x0 = CENTER - s / 2;
  const shape = roundedRect(new THREE.Shape(), x0, -(x0 + s), x0 + s, -x0, 0.14);
  const lid = new THREE.Mesh(extrudeAlongY(shape, IHS.height - IHS.bead, 0.035, 10), kit.material('nickel'));
  lid.position.y = SUB_TOP + IHS.bead;
  lid.name = 'cpu-ihs-lid';
  lid.castShadow = true;
  lid.receiveShadow = true;
  group.add(lid);

  // Sealant bead where the lid's skirt is bonded to the substrate.
  const bead = [];
  const t = 0.05;
  bead.push(boxAt(s, IHS.bead, t, CENTER, SUB_TOP + IHS.bead / 2, x0 + t / 2));
  bead.push(boxAt(s, IHS.bead, t, CENTER, SUB_TOP + IHS.bead / 2, x0 + s - t / 2));
  bead.push(boxAt(t, IHS.bead, s, x0 + t / 2, SUB_TOP + IHS.bead / 2, CENTER));
  bead.push(boxAt(t, IHS.bead, s, x0 + s - t / 2, SUB_TOP + IHS.bead / 2, CENTER));
  group.add(new THREE.Mesh(mergeAll(bead), kit.material('mold')));

  // Laser marking on the top face.
  const px = 260;
  const tex = kit.texture(
    canvasTexture(Math.round(s * px), Math.round(s * px), (ctx, W) => {
      ctx.fillStyle = 'rgba(70,74,80,0.62)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${Math.round(W * 0.075)}px ${CANVAS_FONT}`;
      ctx.fillText('AXIOBYTE', W * 0.12, W * 0.3);
      ctx.font = `600 ${Math.round(W * 0.05)}px ${CANVAS_FONT}`;
      ctx.fillText('AX-CPU  EDUCATIONAL MODEL', W * 0.12, W * 0.4);
      ctx.fillText('ENGINEERING SAMPLE', W * 0.12, W * 0.48);
      ctx.font = `500 ${Math.round(W * 0.04)}px ${CANVAS_FONT}`;
      ctx.fillText('2638   L0T 7X1', W * 0.12, W * 0.8);
      // Pin-1 mark, matching the substrate's triangle corner.
      ctx.beginPath();
      ctx.moveTo(W * 0.05, W * 0.05);
      ctx.lineTo(W * 0.13, W * 0.05);
      ctx.lineTo(W * 0.05, W * 0.13);
      ctx.closePath();
      ctx.fill();
    }),
  );
  const mat = kit.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, metalness: 0, depthWrite: false }));
  mat.userData.noHighlight = true;
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(s - 0.2, s - 0.2), mat);
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(CENTER, SUB_TOP + IHS.height + 0.002, CENTER);
  group.add(decal);

  return {
    group,
    anchors: {
      center: new THREE.Vector3(CENTER, SUB_TOP + IHS.height / 2, CENTER),
      top: new THREE.Vector3(CENTER, SUB_TOP + IHS.height, CENTER),
    },
  };
}
