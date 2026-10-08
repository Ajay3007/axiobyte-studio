import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { PartBatch } from '../../../core/hardware/parts/index.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { boxAt, extrudeAlongY, mergeAll, roundedRect } from '../../../core/geometry.js';
import { BUFFERS, DIMM, MAP, MODULES, POINTER_LANDING, POSTED, REGIONS, RING, STRIPS, TILE, bufferRect, center, keyNotch, slotRect } from './layout.js';
import { DESCRIPTOR_REGION_WITH_RESIDENT_RING, HOST_MEMORY_METADATA, PACKET_BUFFER_REGION_WITH_RESIDENT_POOL } from './metadata.js';

/** Role hues from the visual language: memory for what software allocates, idle for the rest. */
const HUE = { memory: '#b79cf0', pointer: '#f5d14f', idle: '#65728a', ink: '#e7e3d6' };

/**
 * Builds the Host Memory asset in asset-local coordinates and returns plain data the scene layer
 * registers. Two layers, never blended: the physical modules (`dimm-0`, `dimm-1`) and the logical
 * map of the address space they provide (`address-space` and its regions: `descriptor-region`,
 * `packet-buffer-region`, `other-memory`). The model knows nothing about raycasting, cameras or
 * UI; it exposes one motion — the map unfolding in front of the modules — as a function of 0..1,
 * so a page tweens it and a film can set it per frame.
 *
 * `illustrativeRing` (default true) draws a descriptor ring, and its pointers to the buffers, inside
 * `descriptor-region`. A composition that places a real descriptor_ring asset in the region turns
 * it off, so the system never shows two rings; the region stays the same part either way.
 *
 * `illustrativeBuffers` (default true) does the same for the packet buffers drawn inside
 * `packet-buffer-region`: a composition that places a real mempool in the region turns it off. The
 * ring's pointers land on those buffers, so they are drawn only when both are.
 */
export function createHostMemory({ illustrativeRing = true, illustrativeBuffers = true } = {}) {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'host-memory';
  const components = [];

  // ------------------------------------------------------------ physical layer
  for (const m of MODULES) {
    const dimm = createDIMM(kit, m.id);
    // Stand the flat-built module on its contact edge, front face toward the viewer.
    const stand = new THREE.Group();
    stand.name = `${m.id}-stand`;
    stand.rotation.x = Math.PI / 2;
    stand.position.set(0, DIMM.H + DIMM.lift, m.z);
    stand.add(dimm.group);
    root.add(stand);
    components.push({ id: m.id, object: dimm.group, meta: HOST_MEMORY_METADATA[m.id], anchors: dimm.anchors });
  }

  // ------------------------------------------------------------- logical layer
  // `fold` unfolds the map from its back edge toward the viewer.
  const fold = new THREE.Group();
  fold.name = 'host-memory-map';
  fold.position.set(MAP.x0, 0, MAP.z0);
  root.add(fold);

  const plate = createPlate(kit);
  fold.add(plate.group);
  components.push({ id: 'address-space', object: plate.group, meta: HOST_MEMORY_METADATA['address-space'], anchors: plate.anchors });

  const regions = {};
  for (const id of ['other-memory', 'descriptor-region', 'packet-buffer-region']) {
    const region = createRegion(kit, id, { ring: illustrativeRing, buffers: illustrativeBuffers });
    regions[id] = region;
    fold.add(region.group);
    components.push({
      id,
      object: region.group,
      boundsObject: region.bounds,
      hitObjects: region.hitObjects,
      meta:
        id === 'descriptor-region' && !illustrativeRing
          ? DESCRIPTOR_REGION_WITH_RESIDENT_RING
          : id === 'packet-buffer-region' && !illustrativeBuffers
            ? PACKET_BUFFER_REGION_WITH_RESIDENT_POOL
            : HOST_MEMORY_METADATA[id],
      anchors: region.anchors,
      setHighlight: region.setHighlight,
    });
  }

  return {
    root,
    kit,
    components,
    occluders: [plate.mesh],
    /** Address map: 0 folded away (modules only) → 1 laid out in front of the modules. */
    setMap(k) {
      fold.visible = k > 0.001;
      fold.scale.set(1, 1, Math.max(0.001, k));
    },
    stats: { contacts: 2 * MODULES.length * (DIMM.contacts.left + DIMM.contacts.right), slots: RING.slots, buffers: BUFFERS.cols * BUFFERS.rows },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

// ----------------------------------------------------------------------- DIMM

function dimmShape() {
  const { L, H, keyDepth } = DIMM;
  const { z: lz, r } = DIMM.latch;
  const [k0, k1] = keyNotch();
  // Outline in (x, -z): the top edge, the latch notches on the short edges, the contact edge with
  // its key notch.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(L, 0);
  s.lineTo(L, -lz + r);
  s.absarc(L, -lz, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  s.lineTo(L, -H);
  s.lineTo(k1, -H);
  s.lineTo(k1, -H + keyDepth);
  s.lineTo(k0, -H + keyDepth);
  s.lineTo(k0, -H);
  s.lineTo(0, -H);
  s.lineTo(0, -lz - r);
  s.absarc(0, -lz, r, -Math.PI / 2, Math.PI / 2, false);
  s.closePath();
  return s;
}

function createDIMM(kit, id) {
  const { L, H, T } = DIMM;
  const group = new THREE.Group();
  group.name = id;

  const board = new THREE.Mesh(
    kit.geometry('dimm-board', () => extrudeAlongY(dimmShape(), T, 0.006, 8)),
    [kit.material('solderMask'), kit.material('pcbEdge')],
  );
  board.name = `${id}-board`;
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // Gold edge contacts on both faces.
  const { pitch, w, h, left, right, notch } = DIMM.contacts;
  const start = (L - (left + right) * pitch - notch) / 2;
  const xs = [];
  for (let i = 0; i < left; i++) xs.push(start + (i + 0.5) * pitch);
  for (let i = 0; i < right; i++) xs.push(start + left * pitch + notch + (i + 0.5) * pitch);
  const padGeo = kit.geometry('dimm-contact', () => boxAt(w, 0.004, h, 0, 0, 0));
  const contacts = new THREE.InstancedMesh(padGeo, kit.material('gold'), xs.length * 2);
  contacts.name = `${id}-contacts`;
  const m4 = new THREE.Matrix4();
  xs.forEach((x, i) => {
    contacts.setMatrixAt(2 * i, m4.makeTranslation(x, T + 0.002, H - 0.02 - h / 2));
    contacts.setMatrixAt(2 * i + 1, m4.makeTranslation(x, -0.002, H - 0.02 - h / 2));
  });
  contacts.instanceMatrix.needsUpdate = true;
  contacts.computeBoundingSphere();
  group.add(contacts);

  // One face of components; the back face is the same, mirrored through the board.
  const front = createFace(kit, id, 'front');
  const back = createFace(kit, id, 'back');
  back.scale.y = -1;
  back.position.y = T;
  group.add(front, back);
  group.add(silkscreen(kit, id));

  return {
    group,
    anchors: {
      center: new THREE.Vector3(L / 2, T / 2, H / 2),
      top: new THREE.Vector3(L / 2, T / 2, 0),
      // The structural interface: the middle of the contact edge, where the slot takes the module.
      edge: new THREE.Vector3(L / 2, T / 2, H),
    },
  };
}

function createFace(kit, id, side) {
  const { T, chips, spd } = DIMM;
  const face = new THREE.Group();
  face.name = `${id}-${side}`;

  // DRAM packages: one instanced body, one merged marking.
  const xs = Array.from({ length: chips.count }, (_, i) => chips.x0 + i * chips.pitch);
  const bodyGeo = kit.geometry('dram-body', () => {
    const s = roundedRect(new THREE.Shape(), -chips.w / 2, -chips.d / 2, chips.w / 2, chips.d / 2, 0.03);
    return extrudeAlongY(s, chips.h, 0.012, 4);
  });
  const bodies = new THREE.InstancedMesh(bodyGeo, kit.material('mold'), xs.length);
  bodies.name = `${id}-${side}-dram`;
  const m4 = new THREE.Matrix4();
  xs.forEach((x, i) => bodies.setMatrixAt(i, m4.makeTranslation(x, T + 0.01, chips.z)));
  bodies.instanceMatrix.needsUpdate = true;
  bodies.computeBoundingSphere();
  bodies.castShadow = true;
  face.add(bodies);

  const markGeo = kit.geometry('dram-marks', () =>
    mergeAll(
      xs.map((x) => {
        const g = new THREE.PlaneGeometry(chips.w * 0.78, chips.d * 0.5);
        g.rotateX(-Math.PI / 2);
        g.translate(x, T + 0.01 + chips.h + 0.001, chips.z);
        return g;
      }),
    ),
  );
  face.add(new THREE.Mesh(markGeo, markMaterial(kit)));

  // The SPD chip, between the fourth and fifth packages.
  const spdMesh = new THREE.Mesh(
    kit.geometry('dimm-spd', () => boxAt(spd.w, spd.h, spd.d, 0, spd.h / 2, 0)),
    kit.material('moldGloss'),
  );
  spdMesh.position.set(spd.x, T, spd.z);
  face.add(spdMesh);

  // Decoupling capacitors in the gaps between packages (the SPD chip has the middle gap).
  const batch = new PartBatch(kit, { surfaceY: T });
  const middle = Math.floor(chips.count / 2) - 1;
  for (let i = 0; i < chips.count - 1; i++) {
    if (i === middle) continue;
    const x = chips.x0 + (i + 0.5) * chips.pitch;
    batch.capacitor(x, chips.z - 0.24, { pkg: '0402', rot: Math.PI / 2 });
    batch.capacitor(x, chips.z + 0.24, { pkg: '0402', rot: Math.PI / 2 });
  }
  batch.capacitor(spd.x, spd.z + spd.d / 2 + 0.16, { pkg: '0402', rot: 0 });
  face.add(batch.build(`${id}-${side}-caps`));
  return face;
}

// One marking material per build, shared by every package on every module.
const marks = new WeakMap();
function markMaterial(kit) {
  if (!marks.has(kit)) {
    const tex = kit.texture(
      canvasTexture(300, 170, (ctx, W, H) => {
        ctx.fillStyle = 'rgba(200,198,190,0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${Math.round(H * 0.34)}px ${CANVAS_FONT}`;
        ctx.fillText('AXB DRAM', W / 2, H * 0.34);
        ctx.font = `500 ${Math.round(H * 0.24)}px ${CANVAS_FONT}`;
        ctx.fillStyle = 'rgba(190,190,184,0.45)';
        ctx.fillText('2638  EDU', W / 2, H * 0.72);
      }),
    );
    const mat = kit.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mat.userData.noHighlight = true;
    marks.set(kit, mat);
  }
  return marks.get(kit);
}

function silkscreen(kit, id) {
  const { L, T } = DIMM;
  const w = L * 0.6;
  const d = 0.34;
  const tex = kit.texture(
    canvasTexture(Math.round(w * 120), Math.round(d * 120), (ctx, W, H) => {
      ctx.fillStyle = 'rgba(236,234,224,0.8)';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(H * 0.62)}px ${CANVAS_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('AXIOBYTE  AX-DIMM  ·  EDUCATIONAL MODEL', 4, H / 2);
    }),
  );
  const mat = kit.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mat.userData.noHighlight = true;
  const plane = new THREE.Mesh(kit.geometry('dimm-silkscreen', () => new THREE.PlaneGeometry(w, d)), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0.5 + w / 2, T + 0.003, 0.12 + d / 2);
  plane.name = `${id}-silkscreen`;
  return plane;
}

// --------------------------------------------------------- address-space plate

function createPlate(kit) {
  const { w: W, d: D, h } = MAP;
  const group = new THREE.Group();
  group.name = 'host-memory-address-space';
  const shape = roundedRect(new THREE.Shape(), 0, -D, W, 0, 0.12);
  const mesh = new THREE.Mesh(
    kit.geometry('map-plate', () => {
      const g = extrudeAlongY(shape, h, 0.02, 6);
      g.translate(0, -h, 0);
      return g;
    }),
    kit.material('schematicBase'),
  );
  mesh.name = 'host-memory-map-plate';
  mesh.receiveShadow = true;
  group.add(mesh);

  const px = 130;
  const strip = (s, draw) => {
    const d = s.z1 - s.z0;
    const tex = kit.texture(canvasTexture(Math.round(W * px), Math.round(d * px), draw));
    const mat = kit.own(
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    mat.userData.noHighlight = true;
    const plane = new THREE.Mesh(kit.geometry(`map-strip:${s.z0}`, () => new THREE.PlaneGeometry(W, d)), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(W / 2, 0.002, (s.z0 + s.z1) / 2);
    plane.renderOrder = 1;
    group.add(plane);
  };

  // What this is, said on the object itself.
  strip(STRIPS.caption, (ctx, CW, CH) => {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = HUE.memory;
    ctx.font = `700 ${Math.round(CH * 0.5)}px ${CANVAS_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('PHYSICAL ADDRESS SPACE', 0.2 * px, CH / 2);
    ctx.fillStyle = 'rgba(231,227,214,0.62)';
    ctx.font = `600 ${Math.round(CH * 0.4)}px ${CANVAS_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('LOGICAL VIEW OF THE MODULES’ MEMORY  ·  NOT TO SCALE', CW - 0.2 * px, CH / 2);
  });

  // The address axis: low addresses on the left, higher to the right.
  strip(STRIPS.ruler, (ctx, CW, CH) => {
    const x0 = 0.2 * px;
    const x1 = CW - 0.2 * px;
    ctx.strokeStyle = 'rgba(231,227,214,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, CH * 0.22);
    ctx.lineTo(x1, CH * 0.22);
    for (let i = 0; i <= 32; i++) {
      const x = x0 + ((x1 - x0) * i) / 32;
      ctx.moveTo(x, CH * 0.22);
      ctx.lineTo(x, CH * (i % 8 === 0 ? 0.5 : 0.36));
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(231,227,214,0.7)';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(CH * 0.36)}px ${CANVAS_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('0x0', x0, CH * 0.76);
    ctx.textAlign = 'right';
    ctx.fillText('HIGHER ADDRESSES  →', x1, CH * 0.76);
    ctx.textAlign = 'center';
    ctx.fillText('ALLOCATED IN PAGES BY THE OPERATING SYSTEM', CW / 2, CH * 0.76);
  });

  return {
    group,
    mesh,
    anchors: {
      center: new THREE.Vector3(W / 2, 0, D / 2),
      // Address 0: the left end of the address axis.
      base: new THREE.Vector3(0, 0, (STRIPS.ruler.z0 + STRIPS.ruler.z1) / 2),
    },
  };
}

// ------------------------------------------------------------ regions (logical)

// Title and subtitle of each tile, by part id and tile index.
const TITLES = {
  'other-memory': [
    ['OTHER MEMORY', 'kernel · applications · page cache'],
    ['OTHER MEMORY', 'free pages'],
  ],
  'descriptor-region': [['DESCRIPTOR RING', 'addresses, not bytes']],
  // The region when a real descriptor_ring asset resides in it and is drawn on its own.
  'descriptor-region:resident': [['DESCRIPTOR REGION', 'a descriptor ring resides here']],
  // The region when a real mempool resides in it and is drawn on its own.
  'packet-buffer-region:resident': [['PACKET BUFFER REGION', 'a mempool resides here']],
  'packet-buffer-region': [['PACKET BUFFERS', 'fixed size · filled by the NIC']],
};
const PX = 170; // canvas pixels per centimetre of tile

function createRegion(kit, id, { ring = true, buffers = true } = {}) {
  const group = new THREE.Group();
  group.name = `host-memory-${id}`;
  const hue = id === 'other-memory' ? HUE.idle : HUE.memory;
  const side = kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(hue).multiplyScalar(0.35), toneMapped: false }));
  const tops = [];
  const hitObjects = [];

  REGIONS[id].forEach((r, index) => {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const tex = kit.texture(canvasTexture(Math.round(w * PX), Math.round(d * PX), (ctx, W, H) => drawTile(ctx, W, H, id, index, r, hue, ring, buffers)));
    const top = kit.own(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    tops.push(top);
    const geo = kit.geometry(`map-tile:${id}:${index}`, () => new THREE.BoxGeometry(w, MAP.tile, d));
    const tile = new THREE.Mesh(geo, [side, side, top, side, side, side]);
    tile.position.set((r.x0 + r.x1) / 2, MAP.tile / 2 + 0.001, (r.z0 + r.z1) / 2);
    tile.name = `host-memory-${id}-${index}`;
    tile.renderOrder = 1;
    group.add(tile);
    hitObjects.push(tile);
  });

  // Each descriptor holds a buffer's address: a pointer from its slot to that buffer. Straight, in
  // the pointer's own colour — an address, not a journey.
  let pointers = null;
  if (id === 'descriptor-region' && ring && buffers) {
    pointers = new THREE.Mesh(
      kit.geometry('map-pointers', pointerGeometry),
      kit.own(new THREE.MeshBasicMaterial({ color: HUE.pointer, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false })),
    );
    pointers.name = 'host-memory-descriptor-pointers';
    pointers.renderOrder = 3;
    group.add(pointers);
  }

  const [first] = REGIONS[id];
  const [cx, cz] = center(first);
  const head = slotRect(RING.head);
  const tail = slotRect(RING.tail);
  const firstBuffer = bufferRect(POSTED[0]);
  const y = MAP.tile;
  const anchors = { center: new THREE.Vector3(cx, y, cz) };
  if (id === 'descriptor-region' && ring) {
    anchors.head = new THREE.Vector3(...center3(head, y));
    anchors.tail = new THREE.Vector3(...center3(tail, y));
  }
  if (id === 'packet-buffer-region' && buffers) anchors.buffer = new THREE.Vector3(...center3(firstBuffer, y));

  return {
    group,
    // Frame on the tiles alone: the pointers reach into the buffer region.
    bounds: pointers ? hitObjects[0] : group,
    hitObjects,
    anchors,
    setHighlight(level) {
      const k = Math.min(1, level);
      tops.forEach((m) => m.color.setScalar(1 + 0.45 * k));
      side.color.set(hue).multiplyScalar(0.35 + 0.35 * k);
      if (pointers) pointers.material.opacity = 0.8 + 0.2 * k;
    },
  };
}

const center3 = (r, y) => [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2];

function pointerGeometry() {
  const y = MAP.tile + 0.012;
  const parts = [];
  const width = 0.03;
  POSTED.forEach((j, i) => {
    const s = slotRect(i);
    const b = bufferRect(j);
    const from = new THREE.Vector2(s.x1 - 0.08, (s.z0 + s.z1) / 2);
    const to = new THREE.Vector2(b.x0 + 0.1, b.z0 + (b.z1 - b.z0) * POINTER_LANDING);
    const dir = to.clone().sub(from);
    const len = dir.length();
    const angle = Math.atan2(dir.y, dir.x);
    const head = 0.14;
    // Shaft.
    const shaft = new THREE.PlaneGeometry(len - head, width);
    shaft.translate((len - head) / 2, 0, 0);
    // Arrowhead.
    const tri = new THREE.Shape();
    tri.moveTo(len - head, head * 0.42);
    tri.lineTo(len, 0);
    tri.lineTo(len - head, -head * 0.42);
    tri.closePath();
    const tip = new THREE.ShapeGeometry(tri);
    // Origin dot on the descriptor.
    const dot = new THREE.CircleGeometry(0.045, 12);
    for (const g of [shaft, tip, dot]) {
      g.rotateZ(-angle);
      g.rotateX(-Math.PI / 2);
      g.translate(from.x, y, from.y);
      parts.push(g);
    }
  });
  return mergeAll(parts);
}

// Tile artwork: title band, then the region's content, drawn in its role's hue.
function drawTile(ctx, W, H, id, index, r, hue, ring = true, buffers = true) {
  const cm = (v) => v * PX;
  const local = (rect) => ({ x: cm(rect.x0 - r.x0), y: cm(rect.z0 - r.z0), w: cm(rect.x1 - rect.x0), h: cm(rect.z1 - rect.z0) });
  ctx.fillStyle = '#10141b';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `${hue}1c`;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = hue;
  ctx.lineWidth = 5;
  ctx.strokeRect(2.5, 2.5, W - 5, H - 5);

  const resident = (id === 'descriptor-region' && !ring) || (id === 'packet-buffer-region' && !buffers);
  const [title, sub] = TITLES[resident ? `${id}:resident` : id][index];
  const pad = cm(TILE.pad);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const titleSize = Math.min(cm(TILE.header) * 0.36, ((W - 2 * pad) / title.length) * 1.75);
  ctx.fillStyle = hue;
  ctx.font = `700 ${Math.round(titleSize)}px ${CANVAS_FONT}`;
  ctx.fillText(title, pad, cm(0.08) + titleSize);
  ctx.fillStyle = 'rgba(231,227,214,0.66)';
  ctx.font = `600 ${Math.round(titleSize * 0.66)}px ${CANVAS_FONT}`;
  ctx.fillText(sub, pad, cm(0.14) + titleSize * 1.75, W - 2 * pad);

  if (id === 'descriptor-region' && ring) drawRing(ctx, local, hue);
  if (id === 'packet-buffer-region' && buffers) drawBuffers(ctx, local, hue);
  if (id === 'other-memory') drawOther(ctx, W, H, index, hue);
}

function drawRing(ctx, local, hue) {
  const slots = Array.from({ length: RING.slots }, (_, i) => local(slotRect(i)));
  slots.forEach((s, i) => {
    ctx.fillStyle = `${hue}40`;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = hue;
    ctx.lineWidth = 3;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = HUE.ink;
    ctx.font = `700 ${Math.round(s.h * 0.44)}px ${CANVAS_FONT}`;
    ctx.fillText(`D${i}`, s.x + 10, s.y + s.h / 2);
    ctx.fillStyle = HUE.pointer;
    ctx.font = `600 ${Math.round(s.h * 0.34)}px ${CANVAS_FONT}`;
    ctx.fillText('addr', s.x + s.h * 1.25, s.y + s.h / 2);
  });
  // Head and tail, in the margin.
  const tag = (i, text) => {
    const s = slots[i];
    ctx.fillStyle = HUE.ink;
    ctx.font = `700 ${Math.round(s.h * 0.34)}px ${CANVAS_FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${text} ▸`, s.x - 8, s.y + s.h / 2);
  };
  tag(RING.head, 'HEAD');
  tag(RING.tail, 'TAIL');
  // The wrap: after the last slot comes the first again.
  const first = slots[0];
  const last = slots[slots.length - 1];
  const x = first.x - first.h * 2.05;
  ctx.strokeStyle = `${hue}cc`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(last.x - 6, last.y + last.h / 2);
  ctx.lineTo(x, last.y + last.h / 2);
  ctx.lineTo(x, first.y + first.h / 2);
  ctx.lineTo(first.x - 6, first.y + first.h / 2);
  ctx.stroke();
  const ay = first.y + first.h / 2;
  ctx.fillStyle = `${hue}cc`;
  ctx.beginPath();
  ctx.moveTo(first.x - 4, ay);
  ctx.lineTo(first.x - 16, ay - 7);
  ctx.lineTo(first.x - 16, ay + 7);
  ctx.closePath();
  ctx.fill();
}

function drawBuffers(ctx, local, hue) {
  const posted = new Set(POSTED);
  for (let j = 0; j < BUFFERS.cols * BUFFERS.rows; j++) {
    const b = local(bufferRect(j));
    const isPosted = posted.has(j);
    ctx.fillStyle = isPosted ? `${hue}30` : '#0c0f14';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = isPosted ? hue : `${hue}88`;
    ctx.lineWidth = 3;
    ctx.setLineDash(isPosted ? [] : [10, 7]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Label to the right of where the pointer lands on the left edge (POINTER_LANDING).
    const size = b.h * 0.22;
    const x = b.x + b.w * 0.2;
    ctx.fillStyle = isPosted ? HUE.ink : 'rgba(231,227,214,0.5)';
    ctx.font = `700 ${Math.round(size)}px ${CANVAS_FONT}`;
    ctx.fillText('BUFFER', x, b.y + size * 1.25);
    ctx.font = `600 ${Math.round(size * 0.8)}px ${CANVAS_FONT}`;
    ctx.fillStyle = isPosted ? `${hue}` : 'rgba(231,227,214,0.42)';
    ctx.fillText(isPosted ? '2 KB · posted' : '2 KB · free', x, b.y + size * 2.3);
  }
}

function drawOther(ctx, W, H, index, hue) {
  const pad = TILE.pad * PX;
  const top = TILE.header * PX;
  const blocks = index === 0 ? ['KERNEL', 'APPLICATIONS', 'PAGE CACHE'] : ['FREE PAGES'];
  const gap = 0.12 * PX;
  const h = (H - top - pad - gap * (blocks.length - 1)) / blocks.length;
  blocks.forEach((name, i) => {
    const y = top + i * (h + gap);
    ctx.fillStyle = `${hue}2a`;
    ctx.fillRect(pad, y, W - 2 * pad, h);
    ctx.strokeStyle = `${hue}aa`;
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, y, W - 2 * pad, h);
    ctx.fillStyle = 'rgba(231,227,214,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(Math.min(h * 0.2, ((W - 2 * pad) / name.length) * 1.5))}px ${CANVAS_FONT}`;
    ctx.fillText(name, W / 2, y + h / 2);
  });
}
