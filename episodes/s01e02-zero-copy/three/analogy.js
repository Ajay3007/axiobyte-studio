import * as THREE from 'three';

/**
 * s01e02's opening analogy (sentences 0–4), EPISODE-LOCAL storytelling geometry — not an asset,
 * not a concept, never registered as one.
 *
 *   "Imagine you're moving an entire library every time someone wants to read a single book.
 *    You pack all the books into a truck, drive them to a new building, unload them, and repeat…"
 *
 * A road, three buildings with loading docks, a flatbed truck and eight book crates. One crate is
 * edged in the packet's blue: "a single book", the piece of data the film follows. The truck
 * packs at the library, drives, unloads at a new building, and repeats once more. Then the marked
 * crate opens into six byte cells — the packet token's own arrangement — the scene folds flat into
 * the technical floor, and the cells fly into the NIC's network port, where the film's packet token
 * takes over at the same place, in the same shape.
 *
 * It stands where the NIC will stand (the NIC rises in its place: stage.js), with the road running
 * right to left so the last dock lies beside the NIC's network port.
 *
 * update(t, A) is a pure function of t and the storyboard's analogy lane.
 */

const C = {
  asphalt: 0x23272d,
  lane: 0xd8d2bf,
  wall: 0x48505c,
  wallLight: 0x5a6371,
  roof: 0x2c323a,
  door: 0x14171b,
  dock: 0x3a4049,
  cab: 0xdfe3e8,
  stripe: 0x4aa8ff,
  glass: 0x1d2a36,
  chassis: 0x22262b,
  tyre: 0x111214,
  hub: 0x9aa1a9,
  crate: 0xb48552,
  tape: 0x8c6237,
  packet: '#4aa8ff',
};

/** The buildings, right to left: the library, a new building, and the next one (the repeat). */
export const BUILDINGS = [
  { name: 'library', x: 12, h: 3.4, w: 5.4 },
  { name: 'new-building', x: 0, h: 2.8, w: 5.0 },
  { name: 'next-building', x: -12, h: 3.1, w: 5.2 },
];
const BUILDING_Z = -3.6;
const DOCK = { z: -0.9, w: 4.6, d: 1.5, h: 0.5 };
const ROAD = { z: 2.2, w: 3.2, x0: -26, x1: 30 };
const BED = { top: 1.12, centre: -1.05 }; // truck-local: the flatbed's top, and its centre along the truck
const CRATE = 0.82;
/** The marked crate: "a single book". Front row, second column — toward the camera, near the port side. */
export const MARKED = 5;

const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
const smooth = (u) => u * u * (3 - 2 * u);

/** Where crate i sits on a dock at x, or on the bed (truck-local, before the truck's 180° turn). */
const onDock = (x, i) => new THREE.Vector3(x - 1.5 + (i % 4) * 1.0, DOCK.h + CRATE / 2, DOCK.z - 0.45 + Math.floor(i / 4) * 0.9);
const onBedLocal = (i) => new THREE.Vector3(BED.centre - 1.5 + (i % 4) * 1.0, BED.top + CRATE / 2, -0.45 + Math.floor(i / 4) * 0.9);

export function createAnalogy({ root, own, glow, registry, portPoint }) {
  const group = new THREE.Group();
  group.name = 'e02-analogy';
  root.add(group);
  const std = (color, extra = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra }));
  const box = (w, h, d, mat, name) => {
    const m = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // ------------------------------------------------------------------ the world of the analogy
  const ground = new THREE.Group();
  ground.name = 'e02-analogy-ground';
  group.add(ground);
  const roadMat = std(C.asphalt, { roughness: 0.95, transparent: true });
  const road = new THREE.Mesh(own(new THREE.BoxGeometry(ROAD.x1 - ROAD.x0, 0.04, ROAD.w)), roadMat);
  road.name = 'e02-analogy-road';
  road.position.set((ROAD.x0 + ROAD.x1) / 2, 0.02, ROAD.z);
  road.receiveShadow = true;
  ground.add(road);
  const laneMat = std(C.lane, { roughness: 0.6, transparent: true });
  for (let x = ROAD.x0 + 1; x < ROAD.x1 - 1; x += 2.4) {
    const dash = new THREE.Mesh(own(new THREE.BoxGeometry(1.2, 0.01, 0.12)), laneMat);
    dash.name = 'e02-analogy-lane';
    dash.position.set(x, 0.045, ROAD.z);
    ground.add(dash);
  }

  const buildings = BUILDINGS.map((b) => {
    const g = new THREE.Group();
    g.name = `e02-analogy-${b.name}`;
    g.position.set(b.x, 0, 0);
    const wall = box(b.w, b.h, 3.6, std(b.name === 'library' ? C.wallLight : C.wall), 'e02-analogy-wall');
    wall.position.set(0, b.h / 2, BUILDING_Z);
    const roof = box(b.w + 0.4, 0.22, 4.0, std(C.roof), 'e02-analogy-roof');
    roof.position.set(0, b.h + 0.11, BUILDING_Z);
    const door = new THREE.Mesh(own(new THREE.PlaneGeometry(3.0, 1.9)), std(C.door));
    door.name = 'e02-analogy-door';
    door.position.set(0, 0.5 + 0.95, BUILDING_Z + 1.81);
    const dock = box(DOCK.w, DOCK.h, DOCK.d, std(C.dock), 'e02-analogy-dock');
    dock.position.set(0, DOCK.h / 2, DOCK.z);
    g.add(wall, roof, door, dock);
    // The library reads as one: a row of columns across its front.
    if (b.name === 'library') {
      for (let k = 0; k < 5; k++) {
        const col = new THREE.Mesh(own(new THREE.CylinderGeometry(0.12, 0.12, b.h - 0.3, 12)), std(0xe3dfd2));
        col.name = 'e02-analogy-column';
        col.position.set(-b.w / 2 + 0.5 + k * ((b.w - 1) / 4), (b.h - 0.3) / 2, BUILDING_Z + 1.95);
        col.castShadow = true;
        g.add(col);
      }
    }
    group.add(g);
    return { ...b, group: g };
  });

  // ------------------------------------------------------------------ the truck
  const truck = new THREE.Group();
  truck.name = 'e02-analogy-truck';
  const body = new THREE.Group(); // built facing +x, turned to drive -x
  body.rotation.y = Math.PI;
  truck.add(body);
  const chassis = box(7.0, 0.36, 2.0, std(C.chassis), 'e02-analogy-truck-chassis');
  chassis.position.set(0, 0.62, 0);
  const bed = box(4.6, 0.16, 2.2, std(0x5b6470, { roughness: 0.8 }), 'e02-analogy-truck-bed');
  bed.position.set(BED.centre, BED.top - 0.08, 0);
  const rails = [-1.08, 1.08].map((z) => {
    const r = box(4.6, 0.26, 0.06, std(0x7d8792), 'e02-analogy-truck-rail');
    r.position.set(BED.centre, BED.top + 0.13, z);
    return r;
  });
  const cab = box(1.9, 1.75, 2.1, std(C.cab, { roughness: 0.45 }), 'e02-analogy-truck-cab');
  cab.position.set(2.45, 1.55, 0);
  const windscreen = new THREE.Mesh(own(new THREE.PlaneGeometry(1.7, 0.7)), std(C.glass, { roughness: 0.15, metalness: 0.4 }));
  windscreen.name = 'e02-analogy-truck-windscreen';
  windscreen.rotation.y = Math.PI / 2;
  windscreen.position.set(3.41, 1.95, 0);
  const stripe = box(1.92, 0.12, 2.12, std(C.stripe, { emissive: new THREE.Color(C.stripe).multiplyScalar(0.25) }), 'e02-analogy-truck-stripe');
  stripe.position.set(2.45, 1.05, 0);
  body.add(chassis, bed, ...rails, cab, windscreen, stripe);
  const wheels = [];
  for (const x of [-2.6, -1.5, 2.3]) {
    for (const z of [-1.0, 1.0]) {
      const w = new THREE.Group();
      w.name = 'e02-analogy-truck-wheel';
      const tyre = new THREE.Mesh(own(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 24)), std(C.tyre, { roughness: 0.9 }));
      tyre.rotation.x = Math.PI / 2;
      tyre.castShadow = true;
      const hub = new THREE.Mesh(own(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12)), std(C.hub, { metalness: 0.6 }));
      hub.rotation.x = Math.PI / 2;
      w.add(tyre, hub);
      w.position.set(x, 0.46, z);
      body.add(w);
      wheels.push(w);
    }
  }
  group.add(truck);

  // ------------------------------------------------------------------ the crates
  const crateMat = std(C.crate, { roughness: 0.85 });
  const tapeMat = std(C.tape, { roughness: 0.8 });
  // "A single book": the one crate the film follows is the packet's blue among the kraft-brown ones.
  const markedMat = std(0x5f9ddb, { roughness: 0.6, emissive: new THREE.Color(C.packet).multiplyScalar(0.12) });
  const markedTape = std(0x2f5f93, { roughness: 0.6 });
  const crates = Array.from({ length: 8 }, (_, i) => {
    const g = new THREE.Group();
    g.name = i === MARKED ? 'e02-analogy-crate-marked' : 'e02-analogy-crate';
    const c = box(CRATE, CRATE, CRATE, i === MARKED ? markedMat : crateMat, 'e02-analogy-crate-body');
    const tape = box(CRATE + 0.01, 0.08, CRATE + 0.01, i === MARKED ? markedTape : tapeMat, 'e02-analogy-crate-tape');
    g.add(c, tape);
    group.add(g);
    return g;
  });
  // The marked crate glows a little when the narration points at it.
  const marked = crates[MARKED];
  const markGlow = glow(C.packet, 2.2);
  markGlow.name = 'e02-analogy-crate-marked-glow';
  marked.add(markGlow);

  // ------------------------------------------------------------------ the bytes inside the crate
  const cells = new THREE.Group();
  cells.name = 'e02-analogy-bytes';
  const cellGeo = own(new THREE.BoxGeometry(0.3, 0.2, 0.3));
  const cellMat = own(new THREE.MeshStandardMaterial({ color: new THREE.Color(C.packet).multiplyScalar(0.7), emissive: new THREE.Color(C.packet).multiplyScalar(0.55), roughness: 0.5 }));
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(cellGeo, cellMat);
    m.name = 'e02-analogy-byte';
    // Exactly the film's packet token arrangement (stage.js cluster()), so the hand-over is seamless.
    m.position.set((i % 3) * 0.38 - 0.38, 0, Math.floor(i / 3) * 0.38 - 0.19);
    cells.add(m);
  }
  cells.add(glow(C.packet, 2.4));
  cells.visible = false;
  group.add(cells);

  // ------------------------------------------------------------------ framing markers (presentation only)
  const lastDock = BUILDINGS[2].x;
  const markedRest = onDock(lastDock, MARKED);
  const bounds = (name, w, h, d, at) => {
    const m = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)));
    m.name = name;
    m.visible = false;
    m.position.copy(at);
    group.add(m);
    return m;
  };
  const markers = {
    'e02.analogy.scene': bounds('e02.analogy.scene', 30, 3.6, 9, new THREE.Vector3(0, 1.8, -0.7)),
    'e02.analogy.library': bounds('e02.analogy.library', 7, 3.4, 7.6, new THREE.Vector3(BUILDINGS[0].x, 1.7, -0.7)),
    'e02.analogy.new_building': bounds('e02.analogy.new_building', 7, 3, 7.6, new THREE.Vector3(BUILDINGS[1].x, 1.5, -0.7)),
    'e02.analogy.next_building': bounds('e02.analogy.next_building', 7, 3, 7.6, new THREE.Vector3(BUILDINGS[2].x, 1.5, -0.7)),
    'e02.analogy.marked_crate': bounds('e02.analogy.marked_crate', 1.1, 1.1, 1.1, markedRest),
  };
  for (const [id, m] of Object.entries(markers)) {
    registry.register({ id, object: m, boundsObject: m, hitObjects: [], meta: { name: id, presentation: true }, anchors: { center: new THREE.Vector3() } });
  }

  // ------------------------------------------------------------------ motion
  const stopFor = (x) => x - BED.centre * -1; // the truck's x when its bed is centred on a dock at x
  const truckX = (t, A) => {
    const [lib, nb, nx] = BUILDINGS.map((b) => stopFor(b.x));
    const start = lib + 14;
    if (t < A.drive1) return start + (lib - start) * smooth(ramp(t, A.enter.from, A.enter.to));
    if (t < A.drive2) return lib + (nb - lib) * smooth(ramp(t, A.drive1, A.unload1 - 0.05));
    if (t < A.leave.from) return nb + (nx - nb) * smooth(ramp(t, A.drive2, A.unload2 - 0.05));
    // Unloaded, it drives on — off toward the next trip, leaving the crates on the dock.
    return nx - 26 * smooth(ramp(t, A.leave.from, A.leave.to));
  };
  const onBed = (x, i) => onBedLocal(i).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).add(new THREE.Vector3(x, 0, ROAD.z));
  // Each crate's moves: [start, duration, from, to]. Positions are evaluated at t, so nothing is kept.
  const crateAt = (i, t, A) => {
    const x = truckX(t, A);
    const moves = [
      ['dock', BUILDINGS[0].x, 'bed', A.load1 + i * 0.15, 0.55],
      ['bed', null, 'dock', A.unload1 + i * 0.08, 0.4, BUILDINGS[1].x],
      ['dock', BUILDINGS[1].x, 'bed', A.load2 + i * 0.07, 0.38],
      ['bed', null, 'dock', A.unload2 + i * 0.08, 0.4, BUILDINGS[2].x],
    ];
    let where = onDock(BUILDINGS[0].x, i);
    for (const [fromKind, fromX, toKind, start, dur, toX] of moves) {
      if (t < start) break;
      const a = fromKind === 'dock' ? onDock(fromX, i) : onBed(x, i);
      const b = toKind === 'dock' ? onDock(toX, i) : onBed(x, i);
      const u = smooth(ramp(t, start, start + dur));
      where = a.clone().lerp(b, u).add(new THREE.Vector3(0, 1.1 * Math.sin(Math.PI * u), 0));
      if (u >= 1 && toKind === 'bed') where = onBed(x, i);
    }
    return where;
  };

  return {
    group,
    crates,
    marked,
    cells,
    truck,
    markers,
    markedRest,
    /** Put the analogy at time t: a pure function of t and the storyboard's analogy lane. */
    update(t, A) {
      const live = t < A.dissolve.to;
      group.visible = live || t < A.cells.to;

      // The truck: along the road, its wheels turning with the distance.
      const x = truckX(t, A);
      truck.position.set(x, 0, ROAD.z);
      const travelled = (stopFor(BUILDINGS[0].x) + 14) - x;
      wheels.forEach((w) => (w.rotation.z = travelled / 0.46));

      crates.forEach((c, i) => c.position.copy(crateAt(i, t, A)));

      // "A single book": the marked crate's edge, brighter while the narration points at it.
      const look = Math.max(
        Math.min(ramp(t, A.single - 0.3, A.single + 0.2), 1 - ramp(t, A.single + 2.2, A.single + 3.2)),
        Math.min(ramp(t, A.focus - 0.2, A.focus + 0.6), 1),
      );
      markGlow.material.opacity = 0.1 + 0.7 * look;
      markedMat.emissiveIntensity = 1 + 2.5 * look;

      // The crate opens into bytes: it shrinks away as six byte cells grow out of it and lift.
      const open = smooth(ramp(t, A.toBytes.from, A.toBytes.to));
      marked.scale.setScalar(Math.max(0.0001, 1 - open));
      marked.visible = open < 0.999;
      const fly = smooth(ramp(t, A.cells.from, A.cells.to));
      const lifted = markedRest.clone().add(new THREE.Vector3(0, 1.0 * open, 0));
      cells.position.copy(lifted.clone().lerp(portPoint, fly).add(new THREE.Vector3(0, 2.2 * Math.sin(Math.PI * fly), 0)));
      cells.scale.setScalar(Math.max(0.0001, open));
      cells.visible = open > 0.001 && t < A.cells.to;

      // The analogy folds flat into the technical floor: every piece flattens toward the ground.
      const fold = smooth(ramp(t, A.dissolve.from, A.dissolve.to));
      const flat = Math.max(0.0001, 1 - fold);
      for (const g of [...buildings.map((b) => b.group), truck, ...crates.filter((c) => c !== marked)]) {
        g.scale.set(1, flat, 1);
        g.visible = live && flat > 0.002;
      }
      ground.visible = live;
      roadMat.opacity = 1 - fold;
      laneMat.opacity = 1 - fold;
    },
  };
}
