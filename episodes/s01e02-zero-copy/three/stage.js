import * as THREE from 'three';
import { createCPU } from '@axiobyte/three/domains/computing/cpu/CPU.js';
import { createPacketBuffer } from '@axiobyte/three/domains/memory/packet-buffer/PacketBuffer.js';
import { createMbuf } from '@axiobyte/three/domains/memory/mbuf/Mbuf.js';
import { canvasTexture, CANVAS_FONT, glowTexture } from '@axiobyte/three/core/textures.js';
import { createZeroCopyAct } from './act2.js';
import { createAnalogy } from './analogy.js';
import { annotationZones, poolZones, referenceZones, stageZones } from './composition.js';

/**
 * s01e02's stage: the host side of the film's one system, mounted into the film's world beside the
 * real NIC — the real CPU, two instances of the real packet_buffer asset (buffer A, buffer B) and
 * the real mbuf, each built from its own asset entry exactly as on its page and registered under an
 * instance prefix (`cpu.die`, `buffer_a.header`, `mbuf.fields`), as the nic_host composition does.
 *
 * Everything else here is EPISODE-LOCAL presentation, never an asset and never registered as one:
 *   packet token      the packet's bytes in flight (the packet's colour)
 *   DMA trail         the path of the NIC's write — the packet's colour, never red
 *   copy carriers     a duplicate of the bytes the CPU moves — red, the copy's colour, and only here
 *   copy trails       the paths of the two CPU copies — red
 *   CPU pulse         the CPU at work during a copy — red light from beneath its package
 *   application       a marker for the application and its own copy of the bytes
 *   reference         the mbuf's buf_addr reference to buffer A — yellow, straight (a pointer); traced, never travelled
 *   field markers     emphasis on the mbuf's field strips
 *   label anchors     points the overlay's callouts tether to (registered as `e02.*`)
 *
 * update(t, lanes) is a pure function of t and the storyboard's lanes: nothing here keeps state
 * between frames, so seeking anywhere gives the frame a straight render would have produced.
 */

/** Role hues (design/themes/systems.yaml). Red is the copy's alone. */
export const HUE = { packet: '#4aa8ff', copy: '#ff5c55', pointer: '#f5d14f', ink: '#e7e3d6', panel: '#10141b' };

/**
 * Where everything stands, in the film's world (centimetres). The NIC is centred on the origin by
 * its own scene, its PCIe edge toward +z; the host side lies in front of it: buffer A, buffer B and
 * the application in a row, the CPU at its true size behind buffer B — between the card and the row,
 * so both copies pass through it — and the mbuf left of buffer A, its buf_addr socket facing buffer
 * A's pointer_target on one straight line.
 */
export const PLACE = {
  buffer_a: { position: [-4.2, 0.5, 11.2] },
  buffer_b: { position: [5.2, 0.5, 11.2] },
  app: { position: [14.2, 0.5, 11.2] },
  cpu: { position: [5.2, 0.5, 7.3] },
  // buffer A's pointer_target is at its local (-3.08, ·, -0.41); the mbuf's socket at (1.42, ·, 0.59).
  mbuf: { position: [-4.2 - 3.08 - 3.0 - 1.42, 0.5, 11.2 - 0.41 - 0.59] },
};

const LIFT = 0.55; // how far a byte falls as it lands in its buffer

const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
const smooth = (u) => u * u * (3 - 2 * u);
const window01 = (t, w, fadeIn = 0.35, fadeOut = 0.5) =>
  w ? Math.min(ramp(t, w.from - fadeIn, w.from), 1 - ramp(t, w.to, w.to + fadeOut)) : 0;

export function createZeroCopyStage({ engine, registry, highlighter = null }) {
  const root = new THREE.Group();
  root.name = 'e02-stage';
  engine.scene.add(root);
  const owned = []; // episode-local geometries and materials, disposed with the stage

  // ------------------------------------------------------------------ real assets, mounted

  const instances = {};
  const mount = (name, asset, { position, scale = 1 }) => {
    const holder = new THREE.Group();
    holder.name = `e02-${name}`;
    holder.position.set(...position);
    holder.scale.setScalar(scale);
    holder.add(asset.root);
    root.add(holder);
    instances[name] = { asset, holder };
    return asset;
  };
  const cpu = mount('cpu', createCPU(), PLACE.cpu);
  const bufferA = mount('buffer_a', createPacketBuffer(), PLACE.buffer_a);
  const bufferB = mount('buffer_b', createPacketBuffer(), PLACE.buffer_b);
  const mbuf = mount('mbuf', createMbuf(), PLACE.mbuf);
  // The CPU builds around its own corner; centre it on its place, as a scene module would.
  const cpuBox = new THREE.Box3().setFromObject(cpu.root);
  cpu.root.position.set(-(cpuBox.min.x + cpuBox.max.x) / 2, -cpuBox.min.y, -(cpuBox.min.z + cpuBox.max.z) / 2);
  root.updateWorldMatrix(true, true);

  for (const [name, { asset }] of Object.entries(instances)) {
    for (const c of asset.components) {
      const id = `${name}.${c.id}`;
      if (registry.has(id)) throw new Error(`s01e02 stage: "${id}" is already registered`);
      registry.register({ ...c, id });
      highlighter?.prepare(registry.get(id));
    }
  }

  // ------------------------------------------------------------------ episode-local geometry

  const own = (x) => (owned.push(x), x);
  const basic = (hue, extra = {}) => own(new THREE.MeshBasicMaterial({ color: hue, toneMapped: false, transparent: true, ...extra }));
  const glowTex = own(glowTexture());
  const glow = (hue, size) => {
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color: hue, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    s.scale.setScalar(size);
    return s;
  };

  /**
   * A cluster of byte cells: what is in flight — the packet's bytes, or the CPU's copy of them. A
   * copy is the same bytes (the packet's colour) wrapped in the copy's red glow: the data, being copied.
   */
  const cluster = (name, hue, emissive, glowHue = hue) => {
    const g = new THREE.Group();
    g.name = name;
    const geo = own(new THREE.BoxGeometry(0.3, 0.2, 0.3));
    const mat = own(new THREE.MeshStandardMaterial({ color: new THREE.Color(hue).multiplyScalar(0.7), emissive: new THREE.Color(hue).multiplyScalar(emissive), roughness: 0.5 }));
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set((i % 3) * 0.38 - 0.38, 0, Math.floor(i / 3) * 0.38 - 0.19);
      g.add(m);
    }
    g.add(glow(glowHue, glowHue === hue ? 2.4 : 3.2));
    g.visible = false;
    root.add(g);
    return g;
  };

  /** A path drawn as a tube whose visible length is the progress along it. */
  const trail = (name, points, hue, radius) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geo = own(new THREE.TubeGeometry(curve, 160, radius, 8, false));
    const mesh = new THREE.Mesh(geo, basic(hue, { opacity: 0.9, depthWrite: false }));
    mesh.name = name;
    mesh.visible = false;
    mesh.renderOrder = 3;
    root.add(mesh);
    const total = geo.index.count;
    return {
      curve,
      mesh,
      set(progress, opacity) {
        mesh.visible = progress > 0.002 && opacity > 0.01;
        geo.setDrawRange(0, Math.floor((total * Math.min(1, progress)) / 6) * 6);
        mesh.material.opacity = 0.9 * opacity;
      },
    };
  };

  const W = (id, anchor) => registry.anchorWorld(id, anchor).clone();
  const up = (p, h) => p.clone().add(new THREE.Vector3(0, h, 0));

  // The packet's arrival across the card: port → magnetics → PHY → controller.
  const arrivalPath = new THREE.CatmullRomCurve3(
    [
      up(W('rj45-1', 'in'), 0.5),
      up(W('rj45-1', 'out'), 0.5),
      up(W('magnetics-1', 'center'), 0.5),
      up(W('phy', 'center'), 0.5),
      up(W('nic-controller', 'in'), 0.6),
      up(W('nic-controller', 'dma'), 0.6),
    ],
    false,
    'centripetal',
  );

  // The opening analogy (sentences 0–4): the truck, the crates, and the marked crate's bytes, which
  // end exactly where the packet token begins its trip across the card.
  const analogy = createAnalogy({ root, own, glow, registry, portPoint: arrivalPath.getPoint(0) });

  // The NIC itself is the NIC world's; the film only decides when it is seen: not before the
  // analogy has made its point. Its holder is the top-level object the NIC scene added.
  let nicHolder = registry.get('nic-controller').object;
  while (nicHolder.parent && nicHolder.parent !== engine.scene) nicHolder = nicHolder.parent;

  // DMA: the controller's DMA engine → out through the PCIe edge → down into buffer A.
  const dmaTarget = W('buffer_a.payload', 'dma_target');
  const dma = trail(
    'e02-dma-trail',
    [
      up(W('nic-controller', 'dma'), 0.6),
      up(W('pcie-connector', 'in'), 0.5),
      up(W('pcie-connector', 'out'), 0.6),
      up(dmaTarget.clone().lerp(W('pcie-connector', 'out'), 0.45), 2.4),
      up(dmaTarget, 0.9),
      dmaTarget,
    ],
    HUE.packet,
    0.07,
  );

  // The CPU's two copies, as STRUCTURED DATA-FLOW ROUTES (createCopyPath): straight runs joined by
  // fixed-radius corners at one routing height, every waypoint taken from an asset anchor. Each
  // rises out of its source buffer, runs to a processing point above the CPU die, runs on, and drops
  // into its destination. Copy 1 is processed over the die's left half and copy 2 over its right, so
  // the two routes share no segment and never cross.
  // The routing height sits low — just over the CPU package, like a trace across it — so that from a
  // low camera the runs over the CPU lie on its top instead of hanging in front of it. The rise out
  // of each buffer is exactly two corner radii, so every corner keeps the same radius.
  const ROUTE_Y = 1.38;
  const CORNER = 0.25;
  const die = W('cpu.ihs', 'top');
  const cpu1 = new THREE.Vector3(die.x - 0.55, ROUTE_Y, die.z); // copy 1's processing point
  const cpu2 = new THREE.Vector3(die.x + 0.55, ROUTE_Y, die.z); // copy 2's processing point
  const at = (p, y = ROUTE_Y) => new THREE.Vector3(p.x, y, p.z);
  // Copy 1 leaves buffer A at the far (right) end of its payload, away from the DMA's landing point,
  // and runs back to the CPU through the open floor BETWEEN buffers A and B — a corridor the DMA
  // never enters (the DMA arrives from the card, on A's left), so the two paths stay apart on screen
  // from any of the film's cameras, not merely in depth.
  const payloadA = registry.worldBox('buffer_a.payload');
  const fromA = new THREE.Vector3(payloadA.max.x - 0.4, W('buffer_a.payload', 'read').y, W('buffer_a.payload', 'read').z);
  const boxA = new THREE.Box3().setFromObject(instances.buffer_a.holder);
  const boxB = new THREE.Box3().setFromObject(instances.buffer_b.holder);
  const gapX = (boxA.max.x + boxB.min.x) / 2; // the corridor between the two buffers
  const intoB = W('buffer_b.payload', 'dma_target').add(new THREE.Vector3(-0.55, 0, 0));
  const fromB = W('buffer_b.payload', 'read').add(new THREE.Vector3(0.55, 0, 0));
  const appSlot = new THREE.Vector3(PLACE.app.position[0], 0.5 + 0.34, PLACE.app.position[2] + 0.1);
  // Buffer B stands directly in front of the CPU: copy 1 turns at its processing point and runs straight
  // forward over B; copy 2 leaves B straight back to its own processing point.
  const copy1 = createCopyPath(
    'e02-copy-trail-a-b',
    [fromA, at(fromA), new THREE.Vector3(gapX, ROUTE_Y, fromA.z), new THREE.Vector3(gapX, ROUTE_Y, die.z), cpu1, at(intoB), intoB],
    { own, basic, root, corner: CORNER },
  );
  const copy2 = createCopyPath('e02-copy-trail-b-app', [fromB, at(fromB), cpu2, new THREE.Vector3(appSlot.x, ROUTE_Y, die.z), at(appSlot), appSlot], { own, basic, root, corner: CORNER });

  const packet = cluster('e02-packet-token', HUE.packet, 0.55);
  const carrier1 = cluster('e02-copy-carrier-a-b', HUE.packet, 0.45, HUE.copy);
  const carrier2 = cluster('e02-copy-carrier-b-app', HUE.packet, 0.45, HUE.copy);
  // Sentence 8, the cost: the same copies again and again — more carriers on the same two paths.
  const loops = [0, 1, 2, 3].map((i) => cluster(`e02-copy-carrier-loop-${'abcd'[i]}`, HUE.packet, 0.45, HUE.copy));

  // Where each copy passes the CPU, as a parameter along its path: the copy stops there while the
  // CPU does the work.
  const nearest = (curve, p) => {
    let best = 0;
    let d = Infinity;
    for (let k = 0; k <= 400; k++) {
      const q = curve.getPoint(k / 400).distanceTo(p);
      if (q < d) [d, best] = [q, k / 400];
    }
    return best;
  };
  const cpuAt = { copy1: nearest(copy1.curve, cpu1), copy2: nearest(copy2.curve, cpu2) };
  /** A copy's progress along its path at window position u: to the CPU, held there, then onward. */
  const viaCpu = (u, at) => {
    if (u <= 0.4) return at * smooth(u / 0.4);
    if (u <= 0.62) return at;
    return at + (1 - at) * smooth((u - 0.62) / 0.38);
  };
  /** How hard the CPU is working at window position u: brightest while the copy is held at it. */
  const atCpu = (u) => (u > 0.3 && u < 0.72 ? Math.min(ramp(u, 0.3, 0.42), 1 - ramp(u, 0.62, 0.72)) : 0);

  // The CPU at work, seen on the CPU itself: a red glow on its package while a copy passes through.
  const cpuGlow = glow(HUE.copy, 3.2);
  cpuGlow.name = 'e02-cpu-copy-glow';
  cpuGlow.position.copy(up(die, 0.25));
  cpuGlow.visible = false;
  root.add(cpuGlow);

  // The CPU at work, without circling it: red light spilling from under its package — a flat glow
  // the package's own footprint, just above the floor — while a copy is processed.
  const cpuFoot = new THREE.Box3().setFromObject(instances.cpu.holder);
  const cpuPulse = new THREE.Mesh(
    own(new THREE.PlaneGeometry(cpuFoot.max.x - cpuFoot.min.x + 1.1, cpuFoot.max.z - cpuFoot.min.z + 1.1)),
    own(new THREE.MeshBasicMaterial({ color: HUE.copy, map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
  );
  cpuPulse.name = 'e02-cpu-copy-pulse';
  cpuPulse.rotation.x = -Math.PI / 2;
  cpuPulse.position.set((cpuFoot.min.x + cpuFoot.max.x) / 2, 0.52, (cpuFoot.min.z + cpuFoot.max.z) / 2);
  cpuPulse.visible = false;
  root.add(cpuPulse);

  // The application: a marker, not an asset — a low slab with its own copy of the bytes.
  const app = createApplicationMarker(own);
  app.group.position.set(...PLACE.app.position);
  root.add(app.group);

  // buf_addr: a straight yellow reference from the mbuf's socket to buffer A's address.
  const refFrom = W('mbuf.fields', 'buf_addr');
  const refTo = W('buffer_a.header', 'pointer_target');
  const reference = createReference(refFrom, refTo, own, basic);
  root.add(reference.group);

  // Emphasis on the mbuf's strips: a lit OUTLINE around the strip of the field being named, with a
  // faint wash inside — cyan for the bookkeeping fields, pointer yellow for buf_addr — so the field's
  // own name stays legible. On the asset, never part of it.
  const outline = (w, d, t) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -d / 2).lineTo(w / 2, -d / 2).lineTo(w / 2, d / 2).lineTo(-w / 2, d / 2).lineTo(-w / 2, -d / 2);
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + t, -d / 2 + t).lineTo(-w / 2 + t, d / 2 - t).lineTo(w / 2 - t, d / 2 - t).lineTo(w / 2 - t, -d / 2 + t).lineTo(-w / 2 + t, -d / 2 + t);
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  };
  const fieldMarks = Object.fromEntries(
    ['data_len', 'refcount', 'buf_addr'].map((f) => {
      const hue = f === 'buf_addr' ? HUE.pointer : '#34d8e8';
      const m = new THREE.Mesh(
        own(outline(2.46, 0.48, 0.07)),
        own(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
      );
      const wash = new THREE.Mesh(
        own(new THREE.PlaneGeometry(2.34, 0.36)),
        own(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
      );
      wash.name = `e02-mark-${f.replace('_', '-')}-wash`;
      m.add(wash);
      m.name = `e02-mark-${f.replace('_', '-')}`;
      m.rotation.x = -Math.PI / 2;
      // On the strip's top face (every strip is the same height: data_len's anchor gives it), centred on
      // the strip — buf_addr's socket sits on its strip's centre line; the others' anchors are their centres.
      const stripTop = W('mbuf.fields', 'data_len').y;
      const z = f === 'buf_addr' ? refFrom.z : W('mbuf.fields', f).z;
      m.position.set(PLACE.mbuf.position[0], stripTop + 0.015, z);
      m.visible = false;
      root.add(m);
      return [f, m];
    }),
  );


  // Points the overlay's labels tether to: presentation anchors, not parts of anything.
  const markers = {
    'e02.dma': dma.curve.getPoint(0.55),
    'e02.copy_a_b': copy1.curve.getPoint(0.5),
    'e02.copy_b_app': copy2.curve.getPoint(0.5),
    'e02.app': up(app.group.position, 0.4),
    'e02.reference': refFrom.clone().lerp(refTo, 0.5),
    // Annotation zones (composition.js): empty floor the overlay's cards live over, derived from
    // the assets' footprints — never a point on an asset.
    ...annotationZones({
      nic: new THREE.Box3().setFromObject(nicHolder),
      cpu: new THREE.Box3().setFromObject(instances.cpu.holder),
      bufferA: new THREE.Box3().setFromObject(instances.buffer_a.holder),
      app: new THREE.Box3().setFromObject(app.group),
    }),
    ...referenceZones({
      mbuf: registry.worldBox('mbuf.fields'),
      bufferA: new THREE.Box3().setFromObject(instances.buffer_a.holder),
    }),
  };
  for (const [id, p] of Object.entries(markers)) {
    const g = new THREE.Group();
    g.name = id;
    g.position.copy(p);
    root.add(g);
    // The application's marker frames as the slab it marks; the others are points.
    const boundsObject = id === 'e02.app' ? app.group : undefined;
    registry.register({ id, object: g, boundsObject, hitObjects: [], meta: { name: id, presentation: true }, anchors: { center: new THREE.Vector3() } });
  }
  root.updateWorldMatrix(true, true);

  // The zero-copy half (sentences 17–46): the Mempool, the stages, the handle — act2.js.
  const act2 = createZeroCopyAct({ root, registry, mount, own, basic, glow, cluster, trail, instances, packet, dmaTrail: dma });
  root.updateWorldMatrix(true, true);
  // The processing stages' annotation zones (composition.js), from the stages' footprints at rest.
  for (const [id, p] of Object.entries(stageZones(Object.fromEntries(act2.stages.map((st) => [st.name, new THREE.Box3().setFromObject(st.group)]))))) {
    const g = new THREE.Group();
    g.name = id;
    g.position.copy(p);
    root.add(g);
    registry.register({ id, object: g, hitObjects: [], meta: { name: id, presentation: true }, anchors: { center: new THREE.Vector3() } });
  }
  // The Mempool's annotation zones (composition.js), from the pool's footprint at rest.
  const poolRest = new THREE.Box3().setFromObject(instances.pool.holder);
  for (const [id, p] of Object.entries(poolZones({ pool: poolRest, bufferA: new THREE.Box3().setFromObject(instances.buffer_a.holder), cpu: new THREE.Box3().setFromObject(instances.cpu.holder) }))) {
    const g = new THREE.Group();
    g.name = id;
    g.position.copy(p);
    root.add(g);
    registry.register({ id, object: g, hitObjects: [], meta: { name: id, presentation: true }, anchors: { center: new THREE.Vector3() } });
  }
  root.updateWorldMatrix(true, true);

  // ------------------------------------------------------------------ the bytes in the buffers

  const bytesOf = (buffer) => [...buffer.header.cells, buffer.root.getObjectByName('packet-buffer-payload-bytes')];
  /** Fill a buffer: the header's bytes land one after another, then the payload. u: 0 empty → 1 full. */
  const fill = (meshes, u) => {
    meshes.forEach((m, i) => {
      const k = smooth(ramp(u, (i / meshes.length) * 0.75, (i / meshes.length) * 0.75 + 0.25));
      m.visible = k > 0.001;
      m.position.y = LIFT * (1 - k);
    });
  };
  const bytes = { buffer_a: bytesOf(bufferA), buffer_b: bytesOf(bufferB), app: app.bytes };

  // Hidden or not, every position is set from t alone: no frame inherits another's state.
  const flight = (obj, curve, u) => {
    obj.visible = u > 0 && u < 1;
    obj.position.copy(curve.getPoint(smooth(Math.min(1, Math.max(0, u)))));
  };

  return {
    root,
    instances,
    trails: { dma, copy1, copy2 },
    carriers: { packet, carrier1, carrier2, loops },
    cpuGlow,
    cpuPulse,
    cpuAt,
    app,
    reference,
    bytes,
    act2,
    analogy,
    nicHolder,
    /** Bounding boxes the storyboard frames, in the world. */
    boxOf(...names) {
      const b = new THREE.Box3();
      for (const n of names) {
        if (instances[n]) b.union(new THREE.Box3().setFromObject(instances[n].holder));
        else if (n === 'app') b.union(new THREE.Box3().setFromObject(app.group));
        else b.union(registry.worldBox(n));
      }
      return b;
    },
    /** Put the stage at time t: a pure function of t and the lanes. */
    update(t, lanes) {
      const L = lanes;
      // The packet crosses the card, then the DMA carries it into buffer A — once in the copying
      // path (sentence 5), and once more in the zero-copy path (sentence 21), into the same buffer.
      const zero = t >= L.arrival2.from;
      const run = zero ? { arrival: L.arrival2, dma: L.zdma } : { arrival: L.arrival, dma: L.dma };
      const arrive = ramp(t, run.arrival.from, run.arrival.to);
      const dmaU = ramp(t, run.dma.from, run.dma.to);
      // It rests at the controller between crossing the card and the DMA.
      if (t < run.dma.from) packet.position.copy(arrivalPath.getPoint(smooth(arrive)));
      else packet.position.copy(dma.curve.getPoint(smooth(dmaU)));
      packet.visible = t > run.arrival.from && dmaU < 1;
      const dmaFade = zero ? 1 - ramp(t, L.zdmaFade.from, L.zdmaFade.to) : 1 - ramp(t, L.recede.from, L.recede.to);
      dma.set(dmaU, dmaFade);

      // Buffer A's bytes: written by the first DMA; gone "before any packet even arrives"
      // (sentence 17, the zero-copy story's start); written again — in place — by the NIC's DMA.
      if (t < L.empty.from) fill(bytes.buffer_a, ramp(t, L.dma.to - 0.5, L.dma.to + 0.7));
      else if (t < L.zdma.from) fill(bytes.buffer_a, 1 - ramp(t, L.empty.from, L.empty.to));
      else fill(bytes.buffer_a, ramp(t, L.zdma.to - 0.5, L.zdma.to + 0.7));

      // The opening: the analogy, then the NIC rising where it stood, then the host side.
      analogy.update(t, L.analogy);
      const rise = smooth(ramp(t, L.analogy.nicRise.from, L.analogy.nicRise.to));
      nicHolder.visible = rise > 0.001;
      nicHolder.position.y = -2.4 * (1 - rise);
      const host = smooth(ramp(t, L.host.from, L.host.to));
      for (const [obj, base] of [
        [instances.cpu.holder, PLACE.cpu.position],
        [instances.buffer_a.holder, PLACE.buffer_a.position],
        [instances.buffer_b.holder, PLACE.buffer_b.position],
        [app.group, PLACE.app.position],
      ]) obj.position.set(base[0], base[1] - 1.2 * (1 - host), base[2]);

      // The copying path's other buffer and the application belong to the first half only.
      instances.cpu.holder.visible = host > 0.001;
      instances.buffer_a.holder.visible = host > 0.001;
      instances.buffer_b.holder.visible = host > 0.001 && t < L.act2;
      app.group.visible = host > 0.001 && t < L.act2;

      // The two CPU copies: the bytes, copied — out of the source buffer (whose bytes stay), held at
      // the CPU while it works, then on into the next buffer. The red trail is the copy's path.
      const u1 = ramp(t, L.copy1.from, L.copy1.to);
      const u2 = ramp(t, L.copy2.from, L.copy2.to);
      const c1 = viaCpu(u1, cpuAt.copy1);
      const c2 = viaCpu(u2, cpuAt.copy2);
      carrier1.visible = u1 > 0 && u1 < 1;
      carrier1.position.copy(copy1.curve.getPoint(c1));
      carrier2.visible = u2 > 0 && u2 < 1;
      carrier2.position.copy(copy2.curve.getPoint(c2));
      const copyFade = 1 - ramp(t, L.recede.from, L.recede.to);
      copy1.set(c1, copyFade);
      copy2.set(c2, copyFade);

      // Sentence 8: the cost, made visible — the same copies running again and again through a busy
      // CPU, and the three copies of the same bytes pulsing together.
      const busy = window01(t, L.cost, 0.4, 0.6);
      loops.forEach((carrier, i) => {
        const trail = i < 2 ? copy1 : copy2;
        // Only while the cost is shown; parked at the path's start otherwise, so nothing hidden moves.
        const u = busy > 0.05 ? (((t - L.cost.from) / 1.7 + (i % 2) * 0.5) % 1 + 1) % 1 : 0;
        carrier.visible = busy > 0.05;
        carrier.position.copy(trail.curve.getPoint(u));
        carrier.scale.setScalar(Math.max(0.0001, busy));
      });
      const pulse = busy * (0.5 + 0.5 * Math.sin(t * 6.0) ** 2);
      app.bytes.forEach((m) => m.material.emissive.copy(app.glowBase).multiplyScalar(1 + 5 * pulse));
      const working1 = atCpu(u1);
      const working2 = atCpu(u2);
      const cpuWork = Math.max(working1, working2, busy * (0.45 + 0.55 * Math.sin(t * 7.5) ** 2));
      cpuGlow.visible = cpuWork > 0.02;
      cpuGlow.material.opacity = 0.75 * cpuWork;
      fill(bytes.buffer_b, ramp(t, L.copy1.to - 0.45, L.copy1.to + 0.6));
      fill(bytes.app, ramp(t, L.copy2.to - 0.45, L.copy2.to + 0.6));

      // The CPU's package lit from beneath: only while it processes a copy, and while the cost is shown.
      cpuPulse.visible = cpuWork > 0.02;
      cpuPulse.material.opacity = 0.85 * cpuWork;

      // The reference: grows from the mbuf's socket toward buffer A's address, then holds.
      // On "address" (sentence 15) the reference is traced from the socket to the buffer's first byte,
      // reaching it on "payload begins"; it stays lit through sentence 16 and fades as 17 begins.
      const traced = L.pulse && t >= L.pulse.from && t <= L.pulse.to
        ? { reach: smooth(ramp(t, L.pulse.from, L.pulse.reach)), level: Math.min(ramp(t, L.pulse.from, L.pulse.from + 0.3), 1 - ramp(t, L.pulse.to - 0.4, L.pulse.to)) }
        : null;
      reference.set(ramp(t, L.reference.from, L.reference.to), traced);

      // The mbuf arrives where the reference starts.
      const m = smooth(ramp(t, L.mbuf.from, L.mbuf.to));
      instances.mbuf.holder.visible = m > 0.001;
      instances.mbuf.holder.position.set(PLACE.mbuf.position[0], PLACE.mbuf.position[1] + 1.4 * (1 - m), PLACE.mbuf.position[2]);

      // Field emphasis on the mbuf, one strip at a time.
      for (const [f, mesh] of Object.entries(fieldMarks)) {
        const w = window01(t, L.fields[f], 0.3, 0.5);
        mesh.visible = w > 0.01 && m > 0.99;
        mesh.material.opacity = 0.95 * w;
        mesh.children[0].material.opacity = 0.12 * w;
      }

      act2.update(t, L);
    },
    dispose() {
      root.removeFromParent();
      owned.forEach((x) => x.dispose?.());
      Object.values(instances).forEach(({ asset }) => asset.dispose());
    },
  };
}

/**
 * A structured data-flow route (episode-local): straight runs between explicit world-space waypoints,
 * every corner rounded at one fixed radius, drawn as a tube of one constant thickness, with a small
 * 3D arrowhead at the destination pointing into it. No random or screen-space points: the route is a
 * function of its waypoints alone. `set(progress, opacity)` draws it up to `progress` (0..1).
 */
export function createCopyPath(name, waypoints, { own, basic, root, radius = 0.045, corner = 0.45, hue = HUE.copy }) {
  const path = new THREE.CurvePath();
  // Coincident waypoints would make a zero-length run with no direction: keep the first of each.
  const pts = waypoints.map((p) => p.clone()).filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]) > 1e-6);
  let from = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const next = pts[i + 1];
    if (!next) {
      path.add(new THREE.LineCurve3(from, p));
      break;
    }
    const din = p.clone().sub(pts[i - 1]).normalize();
    const dout = next.clone().sub(p).normalize();
    const r = Math.min(corner, p.distanceTo(pts[i - 1]) / 2, p.distanceTo(next) / 2);
    if (din.dot(dout) > 0.9999 || r < 1e-3) continue; // straight through: no corner to round
    const a = p.clone().addScaledVector(din, -r);
    const b = p.clone().addScaledVector(dout, r);
    path.add(new THREE.LineCurve3(from, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    from = b;
  }
  const geo = own(new THREE.TubeGeometry(path, 48 * path.curves.length, radius, 10, false));
  const mesh = new THREE.Mesh(geo, basic(hue, { opacity: 0.9, depthWrite: false }));
  mesh.name = name;
  mesh.visible = false;
  mesh.renderOrder = 3;
  root.add(mesh);
  const total = geo.index.count;
  // The arrowhead: small, at the destination, pointing along the last run (into the destination).
  const end = path.getPoint(1);
  const dir = path.getTangent(1).normalize();
  // Readable at normal viewing distance, still smaller than a byte cell.
  const arrow = new THREE.Mesh(own(new THREE.ConeGeometry(0.16, 0.36, 18)), basic(hue, { opacity: 0.95 }));
  arrow.name = `${name}-arrow`;
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  arrow.position.copy(end).addScaledVector(dir, -0.18);
  arrow.visible = false;
  root.add(arrow);
  return {
    curve: path,
    waypoints: pts,
    mesh,
    arrow,
    set(progress, opacity) {
      mesh.visible = progress > 0.002 && opacity > 0.01;
      geo.setDrawRange(0, Math.floor((total * Math.min(1, progress)) / 6) * 6);
      mesh.material.opacity = 0.9 * opacity;
      arrow.visible = progress > 0.97 && opacity > 0.01;
      arrow.material.opacity = 0.95 * opacity;
    },
  };
}

/** The application marker: episode-local, a slab with a label and a tray for its copy of the bytes. */
function createApplicationMarker(own) {
  const group = new THREE.Group();
  group.name = 'e02-application';
  const W = 4.4;
  const D = 2.3;
  const slab = new THREE.Mesh(own(new THREE.BoxGeometry(W, 0.22, D)), own(new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.8 })));
  slab.position.y = 0.11;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);
  const tex = own(
    canvasTexture(W * 120, D * 120, (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(231,227,214,0.7)';
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = HUE.ink;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(h * 0.15)}px ${CANVAS_FONT}`;
      ctx.fillText('APPLICATION', h * 0.1, h * 0.17);
      ctx.fillStyle = 'rgba(231,227,214,0.55)';
      ctx.font = `600 ${Math.round(h * 0.09)}px ${CANVAS_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('ITS OWN COPY', w - h * 0.1, h * 0.18);
    }),
  );
  const print = new THREE.Mesh(own(new THREE.PlaneGeometry(W, D)), own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })));
  print.rotation.x = -Math.PI / 2;
  print.position.y = 0.222;
  group.add(print);
  const bytes = [];
  const geo = own(new THREE.BoxGeometry(0.3, 0.2, 0.3));
  const glowBase = new THREE.Color(HUE.packet).multiplyScalar(0.1);
  const mat = own(new THREE.MeshStandardMaterial({ color: new THREE.Color(HUE.packet).multiplyScalar(0.55), emissive: glowBase.clone(), roughness: 0.7 }));
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.name = 'e02-application-byte';
    m.position.set(-1.6 + (i % 6) * 0.42, 0.33, 0.1 + Math.floor(i / 6) * 0.42);
    m.castShadow = true;
    m.visible = false;
    group.add(m);
    bytes.push(m);
  }
  // fill() offsets a byte's position.y; keep each byte's resting height in a parent.
  bytes.forEach((m) => {
    const holder = new THREE.Group();
    holder.position.set(m.position.x, m.position.y, m.position.z);
    m.position.set(0, 0, 0);
    group.add(holder);
    holder.add(m);
  });
  return { group, bytes, glowBase };
}

/**
 * buf_addr's reference: a straight yellow rod with an arrowhead — and, when the narration follows it,
 * a TRACE: a soft glow in the same pointer yellow laid along the rod from the socket toward the buffer,
 * which then stays lit. Nothing travels along it: it is a relationship, not a transfer.
 */
function createReference(from, to, own, basic) {
  const group = new THREE.Group();
  group.name = 'e02-reference';
  const dir = to.clone().sub(from);
  const length = dir.length();
  const rod = new THREE.Mesh(own(new THREE.CylinderGeometry(0.045, 0.045, 1, 12)), basic(HUE.pointer, { opacity: 1 }));
  rod.name = 'e02-reference-rod';
  const head = new THREE.Mesh(own(new THREE.ConeGeometry(0.14, 0.32, 16)), basic(HUE.pointer, { opacity: 1 }));
  head.name = 'e02-reference-head';
  const trace = new THREE.Mesh(
    own(new THREE.CylinderGeometry(0.09, 0.09, 1, 16)),
    own(new THREE.MeshBasicMaterial({ color: HUE.pointer, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
  );
  trace.name = 'e02-reference-trace';
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  for (const m of [rod, head, trace]) {
    m.quaternion.copy(q);
    m.visible = false;
    group.add(m);
  }
  const lengthTo = (k) => Math.max(0.0001, (length - 0.3) * k);
  return {
    group,
    from,
    to,
    trace,
    /**
     * progress 0..1 grows the rod. trace = { reach, level }: how far along the rod (0..1) the trace
     * is lit, and how brightly — or null for none.
     */
    set(progress, trace_ = null) {
      const l = lengthTo(progress);
      rod.visible = progress > 0.01;
      rod.scale.set(1, l, 1);
      rod.position.copy(from).addScaledVector(dir, l / length / 2);
      head.visible = progress > 0.98;
      head.position.copy(to).addScaledVector(dir, -0.16 / length);
      const lit = Boolean(trace_ && progress > 0.98 && trace_.reach > 0.001 && trace_.level > 0.01);
      // Unlit, the trace rests in one canonical state, so a frame never depends on the one before it.
      const tl = lengthTo(lit ? trace_.reach : 0);
      trace.visible = lit;
      trace.scale.set(1, tl, 1);
      trace.position.copy(from).addScaledVector(dir, tl / length / 2);
      trace.material.opacity = lit ? 0.45 * trace_.level : 0;
    },
  };
}
