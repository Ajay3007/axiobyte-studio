import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { circlePath, extrudeAlongX, extrudeAlongY, mergeAll, offsetPolyline, roundedRect } from '../../../core/geometry.js';
import { BOARD, CEM, HOLES, LANES, ROUTE, SLOT, TOP, contactX, slotSpan } from './layout.js';
import { PCIE_METADATA } from './metadata.js';

const CU = 0.004; // copper + mask build-up above the laminate

/**
 * Builds the PCIe asset — an x8 slot on a section of system board, with its eight lanes and
 * its power and sideband wiring — in board-local coordinates. Returns plain data the scene layer
 * registers: the model knows nothing about raycasting, cameras or UI.
 *
 * Parts: `slot`, `sideband`, `lane-0` … `lane-7` (physical) and `link` (logical — drawn as an
 * overlay that appears only when it is inspected, so it never reads as hardware).
 */
export function createPCIe() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'pcie';

  const board = createBoard(kit);
  root.add(board, createSilkscreen(kit), createStitching(kit));

  const components = [];
  const add = (id, object, extra = {}) => {
    root.add(object);
    components.push({ id, object, meta: PCIE_METADATA[id], ...extra });
  };

  const slot = createSlot(kit);
  add('slot', slot.group, { anchors: slot.anchors });

  const sideband = createSideband(kit);
  add('sideband', sideband.group, { hitObjects: sideband.hitObjects, anchors: sideband.anchors });

  const lanes = LANES.map((l) => createLane(kit, l));
  lanes.forEach((l) => add(`lane-${l.lane}`, l.group, { hitObjects: l.hitObjects, anchors: l.anchors }));

  const link = createLinkOverlay(kit, lanes);
  add('link', link.group, { hitObjects: [], boundsObject: link.bounds, anchors: link.anchors, setHighlight: link.setHighlight });

  return {
    root,
    kit,
    components,
    occluders: [board],
    stats: { lanes: lanes.length, contacts: CEM.perSide * 2 },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

// ------------------------------------------------------------------ board

function createBoard(kit) {
  const { L, H, T, r } = BOARD;
  const shape = roundedRect(new THREE.Shape(), 0, -H, L, 0, r);
  HOLES.forEach((h) => shape.holes.push(circlePath(h.x, -h.z, h.r)));
  const mesh = new THREE.Mesh(extrudeAlongY(shape, T, 0.012, 20), [kit.material('systemMask'), kit.material('systemEdge')]);
  mesh.name = 'system-board';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  // Plated mounting holes: a tin ring on the surface.
  const ringGeo = kit.geometry('mount-ring', () => {
    const g = new THREE.RingGeometry(0.16, 0.27, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  HOLES.forEach((h) => {
    const ring = new THREE.Mesh(ringGeo, kit.material('tin'));
    ring.position.set(h.x, TOP + 0.002, h.z);
    mesh.add(ring);
  });
  return mesh;
}

// ------------------------------------------------------------------- slot

function createSlot(kit) {
  const group = new THREE.Group();
  group.name = 'pcie-slot';
  const span = slotSpan();
  const b = TOP;
  const t = TOP + SLOT.height;
  const w = SLOT.width / 2;
  const g = SLOT.gap / 2;
  const c = 0.035; // outer chamfer
  const lead = 0.06; // lead-in chamfer that guides the card into the opening
  const d = SLOT.depth;

  // Cross-section of the open section, in (u, v): u → -z about the slot centre, v → y.
  const open = new THREE.Shape();
  [
    [-w, b],
    [w, b],
    [w, t - c],
    [w - c, t],
    [g + lead, t],
    [g, t - lead],
    [g, t - d],
    [-g, t - d],
    [-g, t - lead],
    [-g - lead, t],
    [-w + c, t],
    [-w, t - c],
  ].forEach(([u, v], i) => (i ? open.lineTo(u, v) : open.moveTo(u, v)));
  const solid = new THREE.Shape();
  [
    [-w, b],
    [w, b],
    [w, t - c],
    [w - c, t],
    [-w + c, t],
    [-w, t - c],
  ].forEach(([u, v], i) => (i ? solid.lineTo(u, v) : solid.moveTo(u, v)));

  const body = [];
  const place = (geo, x0) => {
    geo.translate(x0, 0, SLOT.z);
    body.push(geo);
  };
  place(extrudeAlongX(open, span.open1 - span.open0, 0, 1), span.open0);
  place(extrudeAlongX(solid, SLOT.endWall, 0, 1), span.x0);
  place(extrudeAlongX(solid, SLOT.endWall, 0, 1), span.open1);
  // The key rib that meets the card's notch.
  const keyX = SLOT.pin1X + (CEM.notch.x0 + CEM.notch.x1) / 2;
  const key = new THREE.BoxGeometry(SLOT.keyW, SLOT.keyH, SLOT.gap);
  key.translate(keyX, t - d + SLOT.keyH / 2, SLOT.z);
  body.push(key);
  // Moulded base flange, a little proud of the walls, as on real connector housings.
  const flange = new THREE.BoxGeometry(span.x1 - span.x0 + 0.02, 0.05, SLOT.width + 0.05);
  flange.translate((span.x0 + span.x1) / 2, b + 0.025, SLOT.z);
  body.push(flange);
  const housing = new THREE.Mesh(mergeAll(body), kit.material('plasticLight'));
  housing.name = 'pcie-slot-housing';
  housing.castShadow = true;
  housing.receiveShadow = true;
  group.add(housing);

  // Two rows of spring contacts on the opening's inner walls, one per card contact.
  const contactGeo = kit.geometry('pcie-contact', () => {
    const geo = new THREE.BoxGeometry(0.062, d - 0.2, 0.022);
    geo.translate(0, 0, 0);
    return geo;
  });
  const contacts = new THREE.InstancedMesh(contactGeo, kit.material('gold'), CEM.perSide * 2);
  contacts.name = 'pcie-contacts';
  const m = new THREE.Matrix4();
  let k = 0;
  for (let n = 1; n <= CEM.perSide; n++) {
    const x = SLOT.pin1X + contactX(n);
    for (const side of [-1, 1]) {
      m.makeTranslation(x, t - d / 2 - 0.02, SLOT.z + side * (g - 0.011));
      contacts.setMatrixAt(k++, m);
    }
  }
  contacts.instanceMatrix.needsUpdate = true;
  contacts.computeBoundingSphere();
  group.add(contacts);

  // Contact windows along both outer walls: each contact's retention slot, one per position.
  const windowGeo = kit.geometry('pcie-window', () => new THREE.BoxGeometry(0.045, 0.09, 0.006));
  const windows = new THREE.InstancedMesh(windowGeo, kit.material('mold'), CEM.perSide * 2);
  windows.name = 'pcie-contact-windows';
  k = 0;
  for (let n = 1; n <= CEM.perSide; n++) {
    const x = SLOT.pin1X + contactX(n);
    for (const side of [-1, 1]) {
      m.makeTranslation(x, b + 0.05 + 0.08, SLOT.z + side * (w + 0.002));
      windows.setMatrixAt(k++, m);
    }
  }
  windows.instanceMatrix.needsUpdate = true;
  windows.computeBoundingSphere();
  group.add(windows);

  // Dark floor of the opening, so the contacts read against it.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(span.open1 - span.open0, 0.004, SLOT.gap), kit.material('cavity'));
  floor.position.set((span.open0 + span.open1) / 2, t - d + 0.002, SLOT.z);
  group.add(floor);

  const cx = (span.open0 + span.open1) / 2;
  return {
    group,
    anchors: {
      card: new THREE.Vector3(cx, t, SLOT.z),
      pin1: new THREE.Vector3(SLOT.pin1X, t, SLOT.z),
      key: new THREE.Vector3(keyX, t - d + SLOT.keyH, SLOT.z),
      center: new THREE.Vector3(cx, TOP + SLOT.height / 2, SLOT.z),
    },
  };
}

// ----------------------------------------------------------------- traces

/** Collects straight trace segments as thin boxes, and vias, for one part. */
class Traces {
  constructor() {
    this.boxes = [];
    this.vias = [];
  }
  segment([x0, z0], [x1, z1], w) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-5) return;
    const g = new THREE.BoxGeometry(len + w * 0.9, CU, w);
    g.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
    g.translate((x0 + x1) / 2, TOP + CU / 2, (z0 + z1) / 2);
    this.boxes.push(g);
  }
  path(points, w = ROUTE.w) {
    for (let i = 1; i < points.length; i++) this.segment(points[i - 1], points[i], w);
  }
  via(x, z, r = 0.03) {
    this.vias.push([x, z, r]);
  }
  build(kit, name) {
    const group = new THREE.Group();
    group.name = name;
    if (this.boxes.length) {
      const copper = new THREE.Mesh(mergeAll(this.boxes), kit.material('systemMaskTrace'));
      copper.name = `${name}-copper`;
      copper.receiveShadow = true;
      group.add(copper);
    }
    if (this.vias.length) {
      const ringGeo = kit.geometry('via-ring', () => {
        const g = new THREE.CylinderGeometry(1, 1, 0.01, 14);
        g.translate(0, TOP + 0.005, 0);
        return g;
      });
      const rings = new THREE.InstancedMesh(ringGeo, kit.material('tin'), this.vias.length);
      rings.name = `${name}-vias`;
      const m = new THREE.Matrix4();
      this.vias.forEach(([x, z, r], i) => rings.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r))));
      rings.instanceMatrix.needsUpdate = true;
      rings.computeBoundingSphere();
      group.add(rings);
      const drillGeo = kit.geometry('via-drill', () => {
        const g = new THREE.CylinderGeometry(0.42, 0.42, 0.012, 10);
        g.translate(0, TOP + 0.006, 0);
        return g;
      });
      const drills = new THREE.InstancedMesh(drillGeo, kit.material('hole'), this.vias.length);
      this.vias.forEach(([x, z, r], i) => drills.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r))));
      drills.instanceMatrix.needsUpdate = true;
      drills.computeBoundingSphere();
      drills.material.userData.noHighlight = true;
      group.add(drills);
    }
    return group;
  }
}

/** An invisible, generous pick volume along a centre line: 0.26 mm traces are too thin to hover. */
function hitRibbon(kit, points, width, name) {
  const boxes = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(len + width * 0.5, 0.05, width);
    g.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
    g.translate((x0 + x1) / 2, TOP + 0.025, (z0 + z1) / 2);
    boxes.push(g);
  }
  const hit = new THREE.Mesh(mergeAll(boxes), kit.own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })));
  hit.userData.hitOnly = true;
  hit.name = name;
  return hit;
}

const pinX = (n) => SLOT.pin1X + contactX(n);
const laneCentre = (lane) => ROUTE.laneX0 + (lane * (ROUTE.laneX1 - ROUTE.laneX0)) / (LANES.length - 1);

/** Centre line of one differential pair, from the slot to its vias, before length matching. */
function pairLine(x0, xt) {
  const { exitZ, neckZ, viaZ } = ROUTE;
  const dx = xt - x0;
  const jog = neckZ + Math.abs(dx);
  return [
    [x0, exitZ],
    [x0, neckZ],
    [xt, jog],
    [xt, viaZ - 0.16],
  ];
}

const lineLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/**
 * Insert a serpentine on the straight run to add `extra` length — the length matching every
 * PCIe pair gets, so both of its wires and all of a link's lanes arrive together.
 */
function lengthMatched(pts, extra) {
  const amp = 0.07;
  const pitch = 0.2;
  const bumps = Math.min(7, Math.round(extra / (2 * amp)));
  if (bumps < 1) return pts;
  const [xt, zEnd] = pts[pts.length - 1];
  const z0 = zEnd - 0.35 - bumps * pitch;
  const out = pts.slice(0, -1);
  out.push([xt, z0]);
  for (let i = 0; i < bumps; i++) {
    const za = z0 + i * pitch;
    out.push([xt + amp, za + pitch * 0.15], [xt + amp, za + pitch * 0.65], [xt, za + pitch * 0.8]);
  }
  out.push([xt, zEnd]);
  return out;
}

function createLane(kit, { lane, b, a }) {
  const traces = new Traces();
  const lc = laneCentre(lane);
  const pairs = [
    { x0: (pinX(b) + pinX(b + 1)) / 2, xt: lc - ROUTE.pairGap / 2 },
    { x0: (pinX(a) + pinX(a + 1)) / 2, xt: lc + ROUTE.pairGap / 2 },
  ];
  const lines = pairs.map((p) => pairLine(p.x0, p.xt));
  const longest = Math.max(...LANES.flatMap((l) => {
    const c = laneCentre(l.lane);
    return [pairLine((pinX(l.b) + pinX(l.b + 1)) / 2, c - ROUTE.pairGap / 2), pairLine((pinX(l.a) + pinX(l.a + 1)) / 2, c + ROUTE.pairGap / 2)].map(lineLength);
  }));
  const centreLines = [];
  lines.forEach((line) => {
    const centre = lengthMatched(line, longest - lineLength(line));
    centreLines.push(centre);
    const half = ROUTE.pairPitch / 2;
    for (const side of [-1, 1]) {
      const wire = offsetPolyline(centre, side * half);
      // Leave the slot at the contact pitch, then close up into the pair.
      const [ex, ez] = centre[0];
      wire.unshift([ex + side * CEM.pitch * 0.5, ez - 0.001]);
      wire[1] = [wire[1][0], ez + 0.12];
      // Splay apart into the pair's two vias.
      const [vx, vz] = wire[wire.length - 1];
      const via = [vx + side * 0.035, ROUTE.viaZ];
      wire.push(via);
      traces.path(wire);
      traces.via(via[0], via[1]);
    }
    // Ground-return vias beside every pair's signal vias.
    const [cx] = centre[centre.length - 1];
    traces.via(cx - 0.17, ROUTE.viaZ + 0.03, 0.026);
    traces.via(cx + 0.17, ROUTE.viaZ + 0.03, 0.026);
  });
  const group = traces.build(kit, `lane-${lane}`);
  const hit = hitRibbon(kit, pairLine((pairs[0].x0 + pairs[1].x0) / 2, lc), 0.46, `lane-${lane}-hit`);
  group.add(hit);
  return {
    lane,
    group,
    hitObjects: [hit],
    centreLines,
    anchors: {
      card: new THREE.Vector3((pairs[0].x0 + pairs[1].x0) / 2, TOP, ROUTE.exitZ),
      host: new THREE.Vector3(lc, TOP, ROUTE.viaZ),
      center: new THREE.Vector3(lc, TOP, (ROUTE.fanZ + ROUTE.viaZ) / 2),
    },
  };
}

function createSideband(kit) {
  const traces = new Traces();
  const { exitZ } = ROUTE;
  const left = 0.62;
  const run = (n, z, w) => {
    const x = pinX(n);
    traces.path([[x, exitZ - 0.001], [x, z], [left + (z - exitZ) * 0.2, z]], w);
    traces.via(left + (z - exitZ) * 0.2 - 0.05, z, w > 0.05 ? 0.045 : 0.028);
  };
  // +12 V (contacts 1–3) and +3.3 V (8–10): wide power traces into via clusters.
  traces.path([[pinX(1), exitZ - 0.001], [pinX(1), exitZ + 0.22]], 0.1);
  traces.path([[pinX(3), exitZ - 0.001], [pinX(3), exitZ + 0.22]], 0.1);
  traces.path([[pinX(3) + 0.05, exitZ + 0.2], [left, exitZ + 0.2]], 0.16);
  for (let i = 0; i < 3; i++) traces.via(left - 0.02 - i * 0.13, exitZ + 0.2, 0.045);
  traces.path([[pinX(8), exitZ - 0.001], [pinX(8), exitZ + 0.44]], 0.08);
  traces.path([[pinX(10), exitZ - 0.001], [pinX(10), exitZ + 0.44]], 0.08);
  traces.path([[pinX(10) + 0.04, exitZ + 0.42], [left + 0.1, exitZ + 0.42]], 0.11);
  for (let i = 0; i < 2; i++) traces.via(left + 0.05 - i * 0.12, exitZ + 0.42, 0.04);
  // Management and control: SMBus (5–6), JTAG (5–8 side A), WAKE# / PERST# (11).
  [5, 6, 7].forEach((n, i) => run(n, exitZ + 0.3 + i * 0.045, 0.022));
  run(11, exitZ + 0.56, 0.022);
  // REFCLK±: the 100 MHz reference clock pair on A13–A14, which sits right beside lane 0, so it
  // drops straight to an inner layer through a pair of vias instead of crossing the lanes.
  const cx = (pinX(13) + pinX(14)) / 2;
  for (const side of [-1, 1]) {
    traces.path([[cx + side * 0.05, exitZ - 0.001], [cx + side * 0.028, exitZ + 0.08], [cx + side * 0.028, exitZ + 0.14]], 0.022);
    traces.via(cx + side * 0.045, exitZ + 0.19, 0.026);
  }
  const group = traces.build(kit, 'sideband');
  const x0 = left - 0.35;
  const x1 = pinX(13);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.78), kit.own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })));
  hit.position.set((x0 + x1) / 2, TOP + 0.025, exitZ + 0.36);
  hit.userData.hitOnly = true;
  hit.name = 'sideband-hit';
  group.add(hit);
  return {
    group,
    hitObjects: [hit],
    anchors: {
      card: new THREE.Vector3((pinX(1) + pinX(11)) / 2, TOP, exitZ),
      center: new THREE.Vector3((x0 + x1) / 2, TOP, exitZ + 0.36),
    },
  };
}

// ------------------------------------------------------------- link (logical)

/**
 * The link is logical, not a physical object, so it is drawn as an overlay in the interface
 * accent colour — never as copper — and only while it is inspected: the eight lanes' centre
 * lines, bound together where they leave the slot and where they reach the root complex.
 */
function createLinkOverlay(kit, lanes) {
  const group = new THREE.Group();
  group.name = 'pcie-link';
  const mat = kit.own(
    new THREE.MeshBasicMaterial({ color: 0x6ec1ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  );
  const y = TOP + 0.03;
  const strips = [];
  lanes.forEach((l) => {
    l.centreLines.forEach((line) => {
      for (let i = 1; i < line.length; i++) {
        const [x0, z0] = line[i - 1];
        const [x1, z1] = line[i];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const g = new THREE.BoxGeometry(len + 0.05, 0.004, 0.06);
        g.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
        g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
        strips.push(g);
      }
    });
  });
  const xs = lanes.map((l) => l.anchors.card.x);
  const hs = lanes.map((l) => l.anchors.host.x);
  strips.push(new THREE.BoxGeometry(Math.max(...xs) - Math.min(...xs) + 0.5, 0.004, 0.05).translate((Math.max(...xs) + Math.min(...xs)) / 2, y, ROUTE.exitZ + 0.02));
  strips.push(new THREE.BoxGeometry(Math.max(...hs) - Math.min(...hs) + 0.6, 0.004, 0.05).translate((Math.max(...hs) + Math.min(...hs)) / 2, y, ROUTE.viaZ + 0.2));
  const mesh = new THREE.Mesh(mergeAll(strips), mat);
  mesh.name = 'pcie-link-overlay';
  mesh.renderOrder = 2;
  mesh.visible = false;
  group.add(mesh);

  // Framing volume for the camera: the lanes' region.
  const bounds = new THREE.Mesh(new THREE.BoxGeometry(ROUTE.laneX1 - ROUTE.laneX0 + 0.6, 0.1, ROUTE.viaZ - ROUTE.exitZ + 0.3));
  bounds.position.set((ROUTE.laneX0 + ROUTE.laneX1) / 2, TOP, (ROUTE.exitZ + ROUTE.viaZ) / 2);
  bounds.visible = false;
  group.add(bounds);

  return {
    group,
    bounds,
    anchors: {
      card: new THREE.Vector3((Math.max(...xs) + Math.min(...xs)) / 2, TOP, ROUTE.exitZ),
      host: new THREE.Vector3((Math.max(...hs) + Math.min(...hs)) / 2, TOP, ROUTE.viaZ),
      center: new THREE.Vector3((ROUTE.laneX0 + ROUTE.laneX1) / 2, TOP, (ROUTE.exitZ + ROUTE.viaZ) / 2),
    },
    setHighlight(level) {
      mat.opacity = Math.min(0.75, level * 0.75);
      mesh.visible = level > 0.01;
    },
  };
}

// --------------------------------------------------- detail: stitching, silkscreen

/** Ground stitching vias between the lanes — the return path every high-speed pair needs. */
function createStitching(kit) {
  const traces = new Traces();
  for (let i = 0; i < LANES.length - 1; i++) {
    const x = (laneCentre(i) + laneCentre(i + 1)) / 2;
    for (let z = 4.9; z < ROUTE.viaZ - 0.3; z += 0.55) traces.via(x, z, 0.024);
  }
  return traces.build(kit, 'stitching');
}

const PX = 150; // canvas pixels per cm
const INK = 'rgba(232,236,240,0.86)';

function createSilkscreen(kit) {
  const { L, H } = BOARD;
  const span = slotSpan();
  const tex = kit.texture(
    canvasTexture(Math.round(L * PX), Math.round(H * PX), (ctx) => {
      ctx.fillStyle = INK;
      ctx.strokeStyle = INK;
      ctx.textBaseline = 'middle';
      const text = (s, x, z, size, weight = 600, align = 'center') => {
        ctx.font = `${weight} ${Math.round(size * PX)}px ${CANVAS_FONT}`;
        ctx.textAlign = align;
        ctx.fillText(s, x * PX, z * PX);
      };
      // Slot outline and pin-1 marker.
      ctx.lineWidth = 0.018 * PX;
      const pad = 0.07;
      ctx.strokeRect((span.x0 - pad) * PX, (SLOT.z - SLOT.width / 2 - pad) * PX, (span.x1 - span.x0 + 2 * pad) * PX, (SLOT.width + 2 * pad) * PX);
      const px = (span.x0 - pad - 0.05) * PX;
      const pz = (SLOT.z - SLOT.width / 2 - pad) * PX;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px - 0.14 * PX, pz - 0.1 * PX);
      ctx.lineTo(px - 0.14 * PX, pz + 0.1 * PX);
      ctx.closePath();
      ctx.fill();
      text('PCIE1', span.x0, SLOT.z - SLOT.width / 2 - 0.32, 0.2, 700, 'left');
      text('x8', span.x1, SLOT.z - SLOT.width / 2 - 0.32, 0.2, 700, 'right');
      text('AXIOBYTE  SB-1', 0.55, H - 0.4, 0.17, 700, 'left');
      text('REV A   94V-0', L - 0.55, 0.42, 0.13, 500, 'right');
    }),
  );
  const mat = kit.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, depthWrite: false }));
  mat.userData.noHighlight = true;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(L, H), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(L / 2, TOP + CU + 0.001, H / 2);
  plane.name = 'silkscreen';
  return plane;
}
