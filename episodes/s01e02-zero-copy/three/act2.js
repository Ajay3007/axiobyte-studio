import * as THREE from 'three';
import { createMempool } from '@axiobyte/three/domains/memory/mempool/Mempool.js';
import { ELEMENT, FIRST, TRAY, bufferRect, elementRect } from '@axiobyte/three/domains/memory/mempool/layout.js';
import { canvasTexture, CANVAS_FONT } from '@axiobyte/three/core/textures.js';

/**
 * s01e02, the zero-copy half (sentences 17–46): THE BUFFER STAYS, THE BYTES STAY, THE HANDLE MOVES.
 *
 * Mounted into the stage (stage.js) beside the first half's actors, never replacing them:
 *   - the real Mempool asset (`pool.elements`), preallocated, with no state;
 *   - its first element marked as ONE REPRESENTATIVE ELEMENT, shown enlarged — the mbuf and
 *     buffer A already on screen are that element's mbuf and BUFFER, so the zero-copy DMA lands in
 *     the one canonical buffer the film has, which then never moves;
 *   - four episode-local processing stages (parser, classifier, firewall, routing): light nodes,
 *     not assets, highlighted only while the handle is at them;
 *   - the handle: a small yellow token — the pointer's colour, never the mbuf's — with a straight
 *     yellow line to buffer A. It is the ONLY thing that travels between the stages;
 *   - the in-place header edit, made on buffer A's own header cells (the asset's exposed
 *     `header.cells`): the same buffer, the same place, recoloured;
 *   - transmit: a DMA read from buffer A's `read` anchor back to the NIC, the bytes staying put;
 *   - a handful of extra handles that stream through the stages to suggest many packets.
 *
 * Everything is a pure function of t and the lanes.
 */

export const STAGES = ['parser', 'classifier', 'firewall', 'routing'];

/** Where the act's own things stand (centimetres, the film's world). */
export const PLACE2 = {
  pool: [-8.8, 0.5, 18.4],
  stageY: 0.5,
  stageZ: 14.6,
  stageX: [1.4, 4.8, 8.2, 11.6],
};

const HANDLE_HUE = '#f5d14f'; // the pointer's colour (design/themes/systems.yaml): a handle is a reference
const EDITED_HUE = '#e7e3d6'; // a rewritten header byte: still packet bytes, lit differently
const STAGE_HUE = '#e7e3d6';
const STAGE = { w: 2.6, h: 0.32, d: 1.3 };
const HANDLE_REST = 0.95; // the handle's height above a stage's top

const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
const smooth = (u) => u * u * (3 - 2 * u);
const within = (t, w, fadeIn = 0.3, fadeOut = 0.5) =>
  w ? Math.min(ramp(t, w.from - fadeIn, w.from), 1 - ramp(t, w.to, w.to + fadeOut)) : 0;

export function createZeroCopyAct({ root, registry, mount, own, basic, glow, cluster, trail, instances, packet, dmaTrail }) {
  const W = (id, anchor) => registry.anchorWorld(id, anchor).clone();
  const up = (p, h) => p.clone().add(new THREE.Vector3(0, h, 0));

  // ------------------------------------------------------------------ the real Mempool
  const pool = mount('pool', createMempool(), { position: PLACE2.pool });
  root.updateWorldMatrix(true, true);
  for (const c of pool.components) registry.register({ ...c, id: `pool.${c.id}` });
  const poolHolder = instances.pool.holder;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(poolHolder.matrixWorld);

  // ------------------------------------------------------------------ one representative element
  const TOP = TRAY.h + ELEMENT.h + 0.02;
  const rect = elementRect(FIRST);
  // Outlines drawn as thin tubes, so they read at film scale (a 1-pixel line does not).
  const outlineOf = (pts, name, radius = 0.045, hue = '#fff1c2') => {
    const path = new THREE.CurvePath();
    for (let i = 0; i + 1 < pts.length; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    const geo = own(new THREE.TubeGeometry(path, 24 * (pts.length - 1), radius, 6, false));
    const line = new THREE.Mesh(geo, basic(hue, { opacity: 0, depthWrite: false }));
    line.name = name;
    return line;
  };
  const tileCorners = [
    toWorld(rect.x0 - 0.06, TOP, rect.z0 - 0.06),
    toWorld(rect.x1 + 0.06, TOP, rect.z0 - 0.06),
    toWorld(rect.x1 + 0.06, TOP, rect.z1 + 0.06),
    toWorld(rect.x0 - 0.06, TOP, rect.z1 + 0.06),
  ];
  const pair = new THREE.Box3().setFromObject(instances.mbuf.holder).union(new THREE.Box3().setFromObject(instances.buffer_a.holder)).expandByScalar(0.35);
  const y = pair.max.y;
  const pairCorners = [
    new THREE.Vector3(pair.min.x, y, pair.min.z),
    new THREE.Vector3(pair.max.x, y, pair.min.z),
    new THREE.Vector3(pair.max.x, y, pair.max.z),
    new THREE.Vector3(pair.min.x, y, pair.max.z),
  ];
  const rep = new THREE.Group();
  rep.name = 'e02-representative';
  rep.add(
    outlineOf([...tileCorners, tileCorners[0]], 'e02-representative-tile'),
    outlineOf([...pairCorners, pairCorners[0]], 'e02-representative-enlarged'),
    // The magnifier's two rays: from the tile's near corners to the enlarged pair's far corners.
    outlineOf([tileCorners[3], pairCorners[3]], 'e02-representative-ray', 0.025),
    outlineOf([tileCorners[2], pairCorners[2]], 'e02-representative-ray', 0.025),
  );
  root.add(rep);
  const repLines = rep.children;

  // The representative element's BUFFER half, lit while the DMA lands in buffer A (its enlargement).
  const br = bufferRect(FIRST);
  const bufferHalf = new THREE.Mesh(
    own(new THREE.PlaneGeometry(br.x1 - br.x0, br.z1 - br.z0)),
    own(new THREE.MeshBasicMaterial({ color: '#4aa8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
  );
  bufferHalf.name = 'e02-representative-buffer-half';
  // Drawn after the pool's own transparent print, which would otherwise paint over it.
  bufferHalf.renderOrder = 10;
  bufferHalf.rotation.x = -Math.PI / 2;
  bufferHalf.position.copy(toWorld((br.x0 + br.x1) / 2, TOP + 0.01, (br.z0 + br.z1) / 2));
  bufferHalf.visible = false;
  root.add(bufferHalf);

  // ------------------------------------------------------------------ the four stages (episode-local)
  const stages = STAGES.map((name, i) => {
    const g = new THREE.Group();
    g.name = `e02-stage-${name}`;
    g.position.set(PLACE2.stageX[i], PLACE2.stageY, PLACE2.stageZ);
    const slab = new THREE.Mesh(own(new THREE.BoxGeometry(STAGE.w, STAGE.h, STAGE.d)), own(new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.8 })));
    slab.position.y = STAGE.h / 2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    const tex = own(
      canvasTexture(STAGE.w * 130, STAGE.d * 130, (ctx, w, h) => {
        ctx.strokeStyle = 'rgba(231,227,214,0.55)';
        ctx.lineWidth = 5;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = STAGE_HUE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.round(h * 0.3)}px ${CANVAS_FONT}`;
        ctx.fillText(name.toUpperCase(), w / 2, h * 0.52);
      }),
    );
    const print = new THREE.Mesh(own(new THREE.PlaneGeometry(STAGE.w, STAGE.d)), own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })));
    print.rotation.x = -Math.PI / 2;
    print.position.y = STAGE.h + 0.003;
    // The highlight while the handle is here: a glow under the print, nothing kept afterwards.
    const lit = new THREE.Mesh(own(new THREE.PlaneGeometry(STAGE.w + 0.3, STAGE.d + 0.3)), basic(HANDLE_HUE, { opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    lit.name = `e02-stage-${name}-highlight`;
    lit.rotation.x = -Math.PI / 2;
    lit.position.y = STAGE.h + 0.002;
    print.name = `e02-stage-${name}-print`;
    g.add(slab, lit, print);
    g.visible = false;
    root.add(g);
    return { name, group: g, lit, print, rest: new THREE.Vector3(PLACE2.stageX[i], PLACE2.stageY + STAGE.h + HANDLE_REST, PLACE2.stageZ) };
  });
  const stageBoxes = Object.fromEntries(stages.map((s) => [s.name, s.group]));
  for (const s of stages) registry.register({ id: `e02.stage.${s.name}`, object: s.group, hitObjects: [], meta: { name: s.name, presentation: true }, anchors: { center: new THREE.Vector3(0, STAGE.h, 0) } });

  // ------------------------------------------------------------------ the handle
  const handle = new THREE.Group();
  handle.name = 'e02-handle';
  const chip = new THREE.Mesh(own(new THREE.BoxGeometry(1.05, 0.22, 0.55)), own(new THREE.MeshStandardMaterial({ color: new THREE.Color(HANDLE_HUE).multiplyScalar(0.55), emissive: new THREE.Color(HANDLE_HUE).multiplyScalar(0.45), roughness: 0.4 })));
  chip.name = 'e02-handle-chip';
  const chipTex = own(
    canvasTexture(1.05 * 200, 0.55 * 200, (ctx, w, h) => {
      ctx.fillStyle = '#1b1606';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(h * 0.46)}px ${CANVAS_FONT}`;
      ctx.fillText('HANDLE', w / 2, h * 0.54);
    }),
  );
  const chipPrint = new THREE.Mesh(own(new THREE.PlaneGeometry(1.05, 0.55)), own(new THREE.MeshBasicMaterial({ map: chipTex, transparent: true, depthWrite: false, toneMapped: false })));
  chipPrint.name = 'e02-handle-print';
  chipPrint.rotation.x = -Math.PI / 2;
  chipPrint.position.y = 0.112;
  handle.add(chip, chipPrint, glow(HANDLE_HUE, 1.6));
  handle.visible = false;
  root.add(handle);
  registry.register({ id: 'e02.handle', object: handle, hitObjects: [], meta: { name: 'handle', presentation: true }, anchors: { center: new THREE.Vector3() } });

  // Its line to the buffer it refers to: straight, yellow, ending on buffer A's header.
  const target = up(W('buffer_a.header', 'header'), 0.62);
  const line = new THREE.Mesh(own(new THREE.CylinderGeometry(0.035, 0.035, 1, 10)), basic(HANDLE_HUE, { opacity: 0.95 }));
  line.name = 'e02-handle-line';
  line.visible = false;
  const tip = new THREE.Mesh(own(new THREE.ConeGeometry(0.12, 0.28, 14)), basic(HANDLE_HUE, { opacity: 1 }));
  tip.name = 'e02-handle-line-tip';
  tip.visible = false;
  const bead = new THREE.Mesh(own(new THREE.SphereGeometry(0.1, 14, 10)), basic('#fff3b0', { opacity: 1 }));
  bead.name = 'e02-handle-line-bead';
  bead.visible = false;
  // The line's TRACE (sentences 32–35, "the key idea… only the pointer… cheap"): a soft glow in the
  // pointer's yellow laid along the whole line, which then stays — the reference emphasised, nothing
  // travelling along it (milestone 3's buf_addr language).
  const lineTrace = new THREE.Mesh(
    own(new THREE.CylinderGeometry(0.09, 0.09, 1, 14)),
    own(new THREE.MeshBasicMaterial({ color: HANDLE_HUE, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
  );
  lineTrace.name = 'e02-handle-line-trace';
  lineTrace.visible = false;
  root.add(line, tip, bead, lineTrace);
  const Y = new THREE.Vector3(0, 1, 0);
  const setLine = (from, opacity, pulse, trace = 0) => {
    const dir = target.clone().sub(from);
    const length = dir.length();
    const n = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(Y, n);
    line.visible = tip.visible = opacity > 0.01;
    line.material.opacity = tip.material.opacity = opacity;
    line.quaternion.copy(q);
    tip.quaternion.copy(q);
    line.scale.set(1, Math.max(0.001, length - 0.28), 1);
    line.position.copy(from).addScaledVector(n, (length - 0.28) / 2);
    tip.position.copy(target).addScaledVector(n, -0.14);
    bead.visible = opacity > 0.5 && pulse >= 0;
    bead.position.copy(from).addScaledVector(dir, Math.max(0, pulse));
    // Set every frame, lit or not: a frame never depends on the one before it.
    const lit = trace > 0.01 && opacity > 0.01;
    lineTrace.visible = lit;
    lineTrace.quaternion.copy(q);
    lineTrace.scale.copy(line.scale);
    lineTrace.position.copy(line.position);
    lineTrace.material.opacity = lit ? 0.45 * trace * opacity : 0;
  };

  // A few more handles, streaming through the stages: many packets, each a small handle.
  const stream = Array.from({ length: 5 }, (_, i) => {
    const s = new THREE.Mesh(chip.geometry, chip.material);
    s.name = 'e02-handle-stream';
    s.visible = false;
    root.add(s);
    return s;
  });
  const streamPath = new THREE.CatmullRomCurve3([up(stages[0].rest, 0).add(new THREE.Vector3(-2.4, 0, 0)), ...stages.map((s) => s.rest.clone()), stages[3].rest.clone().add(new THREE.Vector3(2.4, 0, 0))]);

  // ------------------------------------------------------------------ transmit: a DMA read, from the same buffer
  const readA = W('buffer_a.payload', 'read');
  const tx = trail(
    'e02-transmit-trail',
    [readA, up(readA, 0.9), ...dmaTrail.curve.getPoints(40).reverse().slice(6), up(W('phy', 'center'), 0.5), up(W('rj45-1', 'out'), 0.5), up(W('rj45-1', 'in'), 0.5)],
    '#4aa8ff',
    0.07,
  );
  const txToken = cluster('e02-transmit-token', '#4aa8ff', 0.55);
  registry.register({ id: 'e02.transmit', object: (() => { const g = new THREE.Group(); g.name = 'e02.transmit'; g.position.copy(tx.curve.getPoint(0.35)); root.add(g); return g; })(), hitObjects: [], meta: { name: 'transmit', presentation: true }, anchors: { center: new THREE.Vector3() } });
  registry.register({ id: 'e02.representative', object: (() => { const g = new THREE.Group(); g.name = 'e02.representative'; g.position.copy(tileCorners[1]); root.add(g); return g; })(), hitObjects: [], meta: { name: 'representative element', presentation: true }, anchors: { center: new THREE.Vector3() } });

  // ------------------------------------------------------------------ the in-place header edit
  const headerCells = instances.buffer_a.asset.header.cells;
  const original = headerCells.map((c) => ({ color: c.material.color.clone(), emissive: c.material.emissive.clone() }));
  const EDITED = [0, 1, 2]; // the first row of header bytes: "change an address"
  const editedColor = new THREE.Color(EDITED_HUE).multiplyScalar(0.8);
  const editedGlow = new THREE.Color(EDITED_HUE).multiplyScalar(0.18);
  const flash = new THREE.Color('#ffffff');

  /** Where the handle is at time t: born at the mbuf, then from stage to stage on the narration. */
  const handleAt = (t, L) => {
    const birth = up(W('mbuf.fields', 'center'), 0.6);
    const legs = [];
    // [time, from, to] — each leg a quick snap, as a pointer moves.
    legs.push([L.stage[0], birth, stages[0].rest]);
    for (let i = 1; i < 4; i++) legs.push([L.stage[i], stages[i - 1].rest, stages[i].rest]);
    // "The packet buffer never moves" (sentence 29): the handle runs the pipeline once more while
    // the buffer stands still — and "Only the pointer is" / "only the mBuff … was passed": again.
    for (const run of [L.neverRun, L.runs[0], L.runs[1]].filter((r) => r != null)) {
      legs.push([run, stages[3].rest, stages[0].rest]);
      for (let i = 1; i < 4; i++) legs.push([run + 0.5 * i, stages[i - 1].rest, stages[i].rest]);
    }
    let at = birth;
    for (const [when, from, to] of legs) {
      if (t < when) break;
      const u = smooth(ramp(t, when, when + 0.42));
      at = from.clone().lerp(to, u).add(new THREE.Vector3(0, 0.5 * Math.sin(Math.PI * u), 0));
    }
    return at;
  };
  /** Which stage the handle is at, or -1 while it is between stages or not yet born. */
  const stageAt = (p) => stages.findIndex((s) => s.rest.distanceTo(p) < 0.05);

  return {
    pool,
    stages,
    stageBoxes,
    handle,
    lineTrace,
    stream,
    tx,
    txToken,
    rep,
    bufferHalf,
    headerCells,
    EDITED,
    handleAt,
    update(t, L) {
      // The pool rises on sentence 17 and stays.
      // …and settles away for the ending (sentence 45 on), so the last frame holds only the pointer and its bytes.
      const away = L.finale ? smooth(ramp(t, L.finale.from, L.finale.to)) : 0;
      const p = smooth(ramp(t, L.pool.from, L.pool.to)) * (1 - away);
      poolHolder.visible = p > 0.001;
      poolHolder.position.set(PLACE2.pool[0], PLACE2.pool[1] - 0.8 * (1 - p), PLACE2.pool[2]);

      // One representative element, shown enlarged: on from sentence 19, cleared on sentence 41.
      const r = within(t, L.representative, 0.6, 0.9);
      for (const l of repLines) {
        l.visible = r > 0.01;
        l.material.opacity = (l.name === 'e02-representative-ray' ? 0.45 : 0.9) * r;
      }
      const half = within(t, L.bufferHalf, 0.3, 0.9);
      bufferHalf.visible = half > 0.01;
      bufferHalf.material.opacity = 0.95 * half;

      // The stages appear on sentence 23.
      const s = smooth(ramp(t, L.stages.from, L.stages.to)) * (1 - away);
      stages.forEach((st, i) => {
        st.group.visible = s > 0.001;
        const rise = smooth(ramp(t, L.stages.from + 0.25 * i, L.stages.to + 0.25 * i)) * (1 - away);
        st.group.position.set(PLACE2.stageX[i], PLACE2.stageY - 0.6 * (1 - rise), PLACE2.stageZ);
      });

      // The handle, and its line to buffer A.
      const born = t >= L.stage[0] - 0.2;
      const at = handleAt(t, L);
      handle.visible = born && t < L.handleOut;
      handle.position.copy(at);
      const lineOn = born ? Math.min(ramp(t, L.stage[0] + 0.3, L.stage[0] + 0.8), 1 - ramp(t, L.handleOut - 0.5, L.handleOut)) : 0;
      // The line stays lit to the buffer; nothing travels along it while the pipeline is explained
      // (sentences 23–30): a reference, not a transfer.
      const quiet = L.quietHandle && t >= L.quietHandle.from && t <= L.quietHandle.to;
      // The line's trace windows (sentences 32–36; 45 to the end): a static glow, nothing travelling.
      const traced = Math.max(0, ...[L.handleTrace, L.handleTrace2].filter(Boolean).map((w) => within(t, w, 0.5, 0.8)));
      setLine(at, 0.95 * lineOn, !quiet && t >= L.handlePulse.from && t <= L.handlePulse.to ? ((t - L.handlePulse.from) * 0.7) % 1 : -1, traced);

      // While the overlay's tags name the stages (sentences 23–30), the slabs' own small prints step aside.
      const tagged = within(t, L.stagePrintsOff ?? L.stageTags, 0.3, 0.5);
      stages.forEach((st) => {
        st.print.material.opacity = 1 - tagged;
        st.print.visible = tagged < 0.99;
      });

      // A stage glows only while the handle is at it: nothing is kept once it leaves.
      const here = stageAt(at);
      stages.forEach((st, i) => {
        const level = here === i && handle.visible ? 1 : 0;
        st.lit.visible = level > 0;
        st.lit.material.opacity = 0.32 * level;
      });

      // Many packets: a few more handles stream through the stages.
      const many = within(t, L.scale, 0.6, 0.8);
      stream.forEach((m, i) => {
        m.visible = many > 0.01;
        m.position.copy(streamPath.getPoint((((t - L.scale.from) * 0.18 + i / stream.length) % 1 + 1) % 1));
        m.scale.setScalar(0.75 * Math.max(0.01, many));
      });

      // The in-place edit: the first header bytes are rewritten where they lie — recoloured, never moved.
      const e = smooth(ramp(t, L.edit.from, L.edit.to));
      const f = Math.max(0, 1 - Math.abs(t - L.edit.to) / 0.6);
      headerCells.forEach((cell, i) => {
        const o = original[i];
        if (!EDITED.includes(i)) {
          cell.material.color.copy(o.color);
          cell.material.emissive.copy(o.emissive);
          return;
        }
        cell.material.color.copy(o.color).lerp(editedColor, e);
        cell.material.emissive.copy(o.emissive).lerp(editedGlow, e).lerp(flash, 0.35 * f);
      });

      // Transmit: the NIC reads buffer A — a DMA read; the bytes stay in the buffer.
      const tu = ramp(t, L.transmit.from, L.transmit.to);
      tx.set(tu, 1 - ramp(t, L.transmit.to + 0.5, L.transmit.to + 2.5));
      txToken.visible = tu > 0 && tu < 1;
      txToken.position.copy(tx.curve.getPoint(smooth(tu)));
    },
  };
}
