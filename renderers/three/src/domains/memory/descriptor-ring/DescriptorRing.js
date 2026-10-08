import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { extrudeAlongY, mergeAll, xz } from '../../../core/geometry.js';
import { BASE, CARD, HALF_SPAN, MARK, RING, SLOT, angleOf, cardRect, markCenter, polar, slotCenter } from './layout.js';
import { ANCHOR_METADATA, DESCRIPTOR_RING_METADATA } from './metadata.js';

/**
 * Role hues from the visual language: memory for the ring (software prepares it in host memory),
 * the pointer's colour for the buffer address a descriptor holds, ink for head and tail.
 */
const HUE = { memory: '#b79cf0', pointer: '#f5d14f', ink: '#e7e3d6', muted: 'rgba(231,227,214,0.6)' };

const TOP = BASE.h + SLOT.h; // the slots' top face

/**
 * Builds the Descriptor Ring asset in asset-local coordinates and returns plain data the scene
 * layer registers. One semantic part — `descriptors`, every slot of the ring — and two anchors,
 * `head` and `tail`, which are positions on the ring, not parts: they are returned separately as
 * `marks`, printed on the base, so a page can explain them without the asset claiming them as
 * parts. Nothing moves: the ring shows its structure, never runtime state, and no slot is shown
 * filled, posted or done.
 */
export function createDescriptorRing() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'descriptor-ring';

  const base = createBase(kit);
  root.add(base.group);

  const descriptors = createDescriptors(kit);
  root.add(descriptors.group);

  const marks = ['head', 'tail'].map((id) => createMark(kit, id));
  marks.forEach((m) => root.add(m.object));

  const top = (i) => {
    const [x, z] = slotCenter(i);
    return new THREE.Vector3(x, TOP, z);
  };

  const components = [
    {
      id: 'descriptors',
      object: descriptors.group,
      hitObjects: descriptors.hitObjects,
      meta: DESCRIPTOR_RING_METADATA.descriptors,
      anchors: {
        center: new THREE.Vector3(0, TOP, 0),
        // The concept's anchors, as fixed locations: `slot` is a representative descriptor entry
        // (D0) to frame and point at — not a slot's identity, index or state; `head` and `tail` are
        // where their marks point, at illustrative positions — not runtime values.
        slot: top(RING.representative),
        head: top(RING.head),
        tail: top(RING.tail),
      },
      setHighlight: descriptors.setHighlight,
    },
  ];

  return {
    root,
    kit,
    components,
    marks,
    occluders: [base.mesh],
    stats: { descriptors: RING.count },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

// ----------------------------------------------------------------------- base

const BASE_PX = 120; // canvas pixels per centimetre of base

function createBase(kit) {
  const group = new THREE.Group();
  group.name = 'descriptor-ring-base';
  const mesh = new THREE.Mesh(
    kit.geometry('ring-base', () => {
      const g = new THREE.CylinderGeometry(BASE.radius, BASE.radius, BASE.h, 96);
      g.translate(0, BASE.h / 2, 0);
      return g;
    }),
    kit.material('schematicBase'),
  );
  mesh.name = 'descriptor-ring-base-disc';
  mesh.receiveShadow = true;
  group.add(mesh);

  const size = 2 * BASE.radius;
  const tex = kit.texture(canvasTexture(size * BASE_PX, size * BASE_PX, drawBase));
  const mat = kit.own(
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  mat.userData.noHighlight = true;
  const print = new THREE.Mesh(
    kit.geometry('ring-base-print', () => {
      const g = new THREE.PlaneGeometry(size, size);
      g.rotateX(-Math.PI / 2);
      g.translate(0, BASE.h + 0.002, 0);
      return g;
    }),
    mat,
  );
  print.name = 'descriptor-ring-base-print';
  print.renderOrder = 1;
  group.add(print);
  return { group, mesh };
}

/** What is printed on the base: the order the slots are used in, and what the ring is. */
function drawBase(ctx, W) {
  const px = (v) => (v + BASE.radius) * BASE_PX; // ring x or z → canvas
  const cm = (v) => v * BASE_PX;

  // The order of use: an arrow from each slot to the next, just outside the ring — after the last
  // slot comes the first again.
  const r = cm(RING.outer + 0.34);
  ctx.strokeStyle = `${HUE.memory}b0`;
  ctx.fillStyle = `${HUE.memory}b0`;
  ctx.lineWidth = 5;
  for (let i = 0; i < RING.count; i++) {
    // Canvas angles: 0 along +x, clockwise on screen — and the canvas is the ring seen from above.
    const a0 = angleOf(i) + HALF_SPAN * 0.35 - Math.PI / 2;
    const a1 = angleOf(i + 1) - HALF_SPAN * 0.35 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, r, a0, a1);
    ctx.stroke();
    // Arrowhead at the end, along the direction of travel.
    const ex = W / 2 + r * Math.cos(a1);
    const ey = W / 2 + r * Math.sin(a1);
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const nx = Math.cos(a1);
    const ny = Math.sin(a1);
    const L = cm(0.2);
    ctx.beginPath();
    ctx.moveTo(ex + tx * L * 0.6, ey + ty * L * 0.6);
    ctx.lineTo(ex - tx * L * 0.5 + nx * L * 0.5, ey - ty * L * 0.5 + ny * L * 0.5);
    ctx.lineTo(ex - tx * L * 0.5 - nx * L * 0.5, ey - ty * L * 0.5 - ny * L * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Centre: what the ring is, and what it never holds.
  ctx.fillStyle = HUE.memory;
  ctx.font = `700 ${Math.round(cm(0.36))}px ${CANVAS_FONT}`;
  ctx.fillText('DESCRIPTOR RING', px(0), px(-0.95));
  ctx.fillStyle = HUE.muted;
  ctx.font = `600 ${Math.round(cm(0.21))}px ${CANVAS_FONT}`;
  ctx.fillText(`${RING.count} DESCRIPTORS · USED IN A CIRCLE`, px(0), px(-0.58));
  ctx.fillText('ADDRESSES AND STATUS', px(0), px(0.62));
  ctx.fillText('NEVER THE PACKET BYTES', px(0), px(0.92));

  // The rim: what this is a view of, and the wrap.
  ctx.font = `600 ${Math.round(cm(0.2))}px ${CANVAS_FONT}`;
  ctx.fillStyle = 'rgba(231,227,214,0.5)';
  ctx.fillText('LOGICAL VIEW · NOT TO SCALE', px(0), px(BASE.radius - 0.28));
  ctx.fillText('AFTER THE LAST DESCRIPTOR COMES THE FIRST AGAIN', px(0), px(-BASE.radius + 0.28));
}

// ---------------------------------------------------------------- descriptors

const CARD_PX = 220; // canvas pixels per centimetre of card
const ATLAS_COLS = 4;
const ATLAS_ROWS = Math.ceil(RING.count / ATLAS_COLS);

/** Slot i: an annular sector in the ring plane, drawn in (x, −z) for extrudeAlongY. */
function slotShape(i) {
  const a = angleOf(i);
  const steps = 18;
  const s = new THREE.Shape();
  const at = (radius, t) => xz(...polar(radius, a - HALF_SPAN + 2 * HALF_SPAN * t));
  s.moveTo(...at(RING.outer, 0));
  for (let k = 1; k <= steps; k++) s.lineTo(...at(RING.outer, k / steps));
  for (let k = steps; k >= 0; k--) s.lineTo(...at(RING.inner, k / steps));
  s.closePath();
  return s;
}

function createDescriptors(kit) {
  const group = new THREE.Group();
  group.name = 'descriptor-ring-descriptors';

  // Every slot in one mesh: the descriptors are one part.
  const bodyMat = kit.own(new THREE.MeshStandardMaterial({ color: new THREE.Color(HUE.memory).multiplyScalar(0.3), roughness: 0.78, metalness: 0 }));
  const bodies = new THREE.Mesh(
    kit.geometry('ring-slots', () =>
      mergeAll(
        Array.from({ length: RING.count }, (_, i) => {
          const g = extrudeAlongY(slotShape(i), SLOT.h, 0.015, 4);
          g.translate(0, BASE.h, 0);
          return g;
        }),
      ),
    ),
    bodyMat,
  );
  bodies.name = 'descriptor-ring-slots';
  bodies.castShadow = true;
  bodies.receiveShadow = true;
  group.add(bodies);

  // Each slot's field card: one texture atlas, one mesh. Cards are upright to a viewer in front.
  const W = CARD.w * CARD_PX;
  const H = CARD.d * CARD_PX;
  const tex = kit.texture(
    canvasTexture(W * ATLAS_COLS, H * ATLAS_ROWS, (ctx) => {
      for (let i = 0; i < RING.count; i++) drawCard(ctx, (i % ATLAS_COLS) * W, Math.floor(i / ATLAS_COLS) * H, W, H, i);
    }),
  );
  const cardMat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const cards = new THREE.Mesh(
    kit.geometry('ring-cards', () =>
      mergeAll(
        Array.from({ length: RING.count }, (_, i) => {
          const r = cardRect(i);
          const g = new THREE.PlaneGeometry(CARD.w, CARD.d);
          // This card's cell of the atlas (texture v runs up; the atlas's first row is at the top).
          const col = i % ATLAS_COLS;
          const row = Math.floor(i / ATLAS_COLS);
          const uv = g.attributes.uv;
          for (let k = 0; k < uv.count; k++) {
            uv.setXY(k, (col + uv.getX(k)) / ATLAS_COLS, 1 - (row + 1 - uv.getY(k)) / ATLAS_ROWS);
          }
          g.rotateX(-Math.PI / 2);
          g.translate((r.x0 + r.x1) / 2, TOP + 0.002, (r.z0 + r.z1) / 2);
          return g;
        }),
      ),
    ),
    cardMat,
  );
  cards.name = 'descriptor-ring-cards';
  cards.renderOrder = 2;
  group.add(cards);

  return {
    group,
    hitObjects: [bodies, cards],
    // The slots' lit material is highlighted by the Highlighter (emissive); the cards are unlit,
    // so they brighten here.
    setHighlight(level) {
      cardMat.color.setScalar(1 + 0.4 * Math.min(1, level));
    },
  };
}

/**
 * One descriptor's field card: its index, then its fields as a schematic layout — a buffer
 * address (in the pointer's colour: an address, not bytes) and length · status. No values: the
 * ring shows what a descriptor holds, not what any one holds now.
 */
function drawCard(ctx, x, y, W, H, i) {
  const pad = W * 0.07;
  ctx.fillStyle = '#10141b';
  ctx.fillRect(x, y, W, H);
  ctx.fillStyle = `${HUE.memory}1f`;
  ctx.fillRect(x, y, W, H);
  ctx.strokeStyle = HUE.memory;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 2, y + 2, W - 4, H - 4);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = HUE.ink;
  ctx.font = `700 ${Math.round(H * 0.27)}px ${CANVAS_FONT}`;
  ctx.fillText(`D${i}`, x + pad, y + H * 0.22);
  ctx.textAlign = 'right';
  ctx.fillStyle = HUE.muted;
  ctx.font = `600 ${Math.round(H * 0.14)}px ${CANVAS_FONT}`;
  ctx.fillText('DESCRIPTOR', x + W - pad, y + H * 0.22);

  const field = (row, label, colour) => {
    const fy = y + H * (0.42 + row * 0.27);
    const fh = H * 0.21;
    ctx.strokeStyle = `${colour}`;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + pad, fy, W - 2 * pad, fh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    ctx.textAlign = 'left';
    ctx.font = `600 ${Math.round(fh * 0.62)}px ${CANVAS_FONT}`;
    ctx.fillText(label, x + pad * 1.6, fy + fh / 2);
  };
  field(0, 'BUFFER ADDRESS  →', HUE.pointer);
  field(1, 'LENGTH · STATUS', HUE.ink);
}

// ---------------------------------------------------------------------- marks

const MARK_PX = 200;

/**
 * Head or tail: a mark printed on the base inside the ring, pointing out at its slot. Flat on the
 * base — a position on the ring, not an object beside it.
 */
function createMark(kit, id) {
  const index = RING[id];
  const [cx, cz] = markCenter(index);
  const right = cx > 0; // head and tail sit on opposite sides; each arrow points out at its slot
  const label = id.toUpperCase();
  const tex = kit.texture(
    canvasTexture(MARK.w * MARK_PX, MARK.d * MARK_PX, (ctx, W, H) => {
      const tri = H * 0.62;
      ctx.fillStyle = HUE.ink;
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(H * 0.6)}px ${CANVAS_FONT}`;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(label, right ? W * 0.06 : W * 0.94, H / 2);
      const tipX = right ? W - 4 : 4;
      const backX = right ? W - 4 - tri : 4 + tri;
      ctx.beginPath();
      ctx.moveTo(tipX, H / 2);
      ctx.lineTo(backX, H / 2 - tri / 2);
      ctx.lineTo(backX, H / 2 + tri / 2);
      ctx.closePath();
      ctx.fill();
    }),
  );
  const mat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  const mesh = new THREE.Mesh(
    kit.geometry(`ring-mark:${id}`, () => {
      const g = new THREE.PlaneGeometry(MARK.w, MARK.d);
      g.rotateX(-Math.PI / 2);
      g.translate(cx, BASE.h + 0.004, cz);
      return g;
    }),
    mat,
  );
  mesh.name = `descriptor-ring-${id}`;
  mesh.renderOrder = 2;
  return {
    id,
    object: mesh,
    meta: ANCHOR_METADATA[id],
    anchors: { center: new THREE.Vector3(cx, BASE.h, cz) },
    setHighlight(level) {
      mat.color.setScalar(1 + 0.5 * Math.min(1, level));
    },
  };
}
