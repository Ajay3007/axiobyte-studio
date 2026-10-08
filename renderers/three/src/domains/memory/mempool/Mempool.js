import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { boxAt, extrudeAlongY, mergeAll, roundedRect } from '../../../core/geometry.js';
import { CAPTION, COUNT, ELEMENT, FIRST, FOOTNOTE, GRID_CENTER, LAST, TRAY, bufferRect, center, elementRect, mbufRect } from './layout.js';
import { MEMPOOL_METADATA } from './metadata.js';

/**
 * Role hues from the visual language: cyan for the mbuf (metadata), purple for memory (the buffer
 * that holds the bytes), the pointer's colour for buf_addr — an address, written as text.
 */
const HUE = { mbuf: '#34d8e8', memory: '#b79cf0', pointer: '#f5d14f', ink: '#e7e3d6', muted: 'rgba(231,227,214,0.62)' };

const TOP = TRAY.h + ELEMENT.h; // the elements' top face

/**
 * Builds the Mempool asset in asset-local coordinates and returns plain data the scene layer
 * registers. One semantic part — `elements` — drawn as twelve identical tiles, each divided into
 * its mbuf half and its buffer half. The tiles are geometry of that one part: none is a component,
 * none is numbered, and none shows a state. Nothing moves.
 */
export function createMempool() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'mempool';

  const tray = createTray(kit);
  root.add(tray.group);

  const elements = createElements(kit);
  root.add(elements.group);

  const top = ([x, z]) => new THREE.Vector3(x, TOP, z);
  const components = [
    {
      id: 'elements',
      object: elements.group,
      hitObjects: elements.hitObjects,
      meta: MEMPOOL_METADATA.elements,
      anchors: {
        // The concept's anchors: the first and last elements in layout order — the extent of the
        // set allocated up front — and the grid's centre. Positions, not allocation state.
        first_slot: top(center(elementRect(FIRST))),
        last_slot: top(center(elementRect(LAST))),
        center: top(GRID_CENTER),
      },
      setHighlight: elements.setHighlight,
    },
  ];

  return {
    root,
    kit,
    components,
    occluders: [tray.mesh],
    stats: { elements: COUNT },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

// ----------------------------------------------------------------------- tray

const TRAY_PX = 130; // canvas pixels per centimetre of tray

function createTray(kit) {
  const group = new THREE.Group();
  group.name = 'mempool-tray';
  const mesh = new THREE.Mesh(
    kit.geometry('mempool-tray', () => {
      const s = roundedRect(new THREE.Shape(), -TRAY.width / 2, -TRAY.depth / 2, TRAY.width / 2, TRAY.depth / 2, TRAY.radius);
      return extrudeAlongY(s, TRAY.h, 0.02, 6);
    }),
    kit.material('schematicBase'),
  );
  mesh.name = 'mempool-tray-plate';
  mesh.receiveShadow = true;
  group.add(mesh);

  // What is printed on the tray: what the pool is, what an element is, and that this is a diagram.
  const W = TRAY.width * TRAY_PX;
  const D = TRAY.depth * TRAY_PX;
  const z = (v) => (v + TRAY.depth / 2) * TRAY_PX; // tray z → canvas y
  const tex = kit.texture(
    canvasTexture(W, D, (ctx) => {
      const pad = 0.3 * TRAY_PX;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = HUE.memory;
      ctx.font = `700 ${Math.round(0.3 * TRAY_PX)}px ${CANVAS_FONT}`;
      ctx.fillText('MEMPOOL · ALLOCATED ONCE, UP FRONT', pad, z(CAPTION.z0 + TRAY.caption * 0.42));
      ctx.textAlign = 'right';
      ctx.fillStyle = HUE.muted;
      ctx.font = `600 ${Math.round(0.2 * TRAY_PX)}px ${CANVAS_FONT}`;
      ctx.fillText('EACH ELEMENT: MBUF + BUFFER', W - pad, z(CAPTION.z0 + TRAY.caption * 0.45));
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(231,227,214,0.5)';
      ctx.fillText('LOGICAL VIEW · NOT TO SCALE', W / 2, z((FOOTNOTE.z0 + FOOTNOTE.z1) / 2));
    }),
  );
  const mat = kit.own(
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  mat.userData.noHighlight = true;
  const print = new THREE.Mesh(
    kit.geometry('mempool-tray-print', () => {
      const g = new THREE.PlaneGeometry(TRAY.width, TRAY.depth);
      g.rotateX(-Math.PI / 2);
      g.translate(0, TRAY.h + 0.002, 0);
      return g;
    }),
    mat,
  );
  print.name = 'mempool-tray-print';
  print.renderOrder = 1;
  group.add(print);
  return { group, mesh };
}

// ------------------------------------------------------------------- elements

const CARD_PX = 220; // canvas pixels per centimetre of element card

/** One raised slab per element half, all merged: every element is identical. */
function slabs(kit, name, rectOf) {
  return kit.geometry(name, () =>
    mergeAll(
      Array.from({ length: COUNT }, (_, i) => {
        const r = rectOf(i);
        return boxAt(r.x1 - r.x0, ELEMENT.h, r.z1 - r.z0, (r.x0 + r.x1) / 2, TRAY.h + ELEMENT.h / 2, (r.z0 + r.z1) / 2);
      }),
    ),
  );
}

function createElements(kit) {
  const group = new THREE.Group();
  group.name = 'mempool-elements';

  // The two halves of every element: the mbuf's in the mbuf hue, the buffer's in memory's.
  const lit = (hue) => kit.own(new THREE.MeshStandardMaterial({ color: new THREE.Color(hue).multiplyScalar(0.32), roughness: 0.78, metalness: 0 }));
  const mbufs = new THREE.Mesh(slabs(kit, 'mempool-mbuf-halves', mbufRect), lit(HUE.mbuf));
  mbufs.name = 'mempool-mbuf-halves';
  const buffers = new THREE.Mesh(slabs(kit, 'mempool-buffer-halves', bufferRect), lit(HUE.memory));
  buffers.name = 'mempool-buffer-halves';
  for (const m of [mbufs, buffers]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // One card artwork, shared by every element — they are identical — on one merged mesh.
  const tex = kit.texture(canvasTexture(ELEMENT.width * CARD_PX, ELEMENT.depth * CARD_PX, drawCard));
  const cardMat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const cards = new THREE.Mesh(
    kit.geometry('mempool-cards', () =>
      mergeAll(
        Array.from({ length: COUNT }, (_, i) => {
          const r = elementRect(i);
          const g = new THREE.PlaneGeometry(ELEMENT.width, ELEMENT.depth);
          g.rotateX(-Math.PI / 2);
          g.translate((r.x0 + r.x1) / 2, TOP + 0.002, (r.z0 + r.z1) / 2);
          return g;
        }),
      ),
    ),
    cardMat,
  );
  cards.name = 'mempool-cards';
  cards.renderOrder = 2;
  group.add(cards);

  return {
    group,
    hitObjects: [mbufs, buffers, cards],
    // The slabs' lit materials are highlighted by the Highlighter (emissive); the cards are unlit,
    // so they brighten here.
    setHighlight(level) {
      cardMat.color.setScalar(1 + 0.4 * Math.min(1, level));
    },
  };
}

/**
 * One element's card: the mbuf half — "MBUF", and "buf_addr →" in the pointer's colour, an address
 * written as text, never drawn as a link — and the buffer half — "BUFFER", "packet bytes". No values:
 * the pool shows what an element is, not what any one holds now.
 */
function drawCard(ctx, W, H) {
  const cm = (v) => v * CARD_PX;
  const half = (x0, w, hue, title, sub, subHue) => {
    ctx.fillStyle = '#10141b';
    ctx.fillRect(x0, 0, w, H);
    ctx.fillStyle = `${hue}24`;
    ctx.fillRect(x0, 0, w, H);
    ctx.strokeStyle = hue;
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 2, 2, w - 4, H - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hue;
    ctx.font = `700 ${Math.round(Math.min(H * 0.24, (w / title.length) * 1.5))}px ${CANVAS_FONT}`;
    ctx.fillText(title, x0 + w / 2, H * 0.36);
    ctx.fillStyle = subHue;
    ctx.font = `600 ${Math.round(Math.min(H * 0.16, (w / sub.length) * 1.7))}px ${CANVAS_FONT}`;
    ctx.fillText(sub, x0 + w / 2, H * 0.66);
  };
  half(0, cm(ELEMENT.mbufWidth), HUE.mbuf, 'MBUF', 'buf_addr →', HUE.pointer);
  half(cm(ELEMENT.mbufWidth + ELEMENT.gap), cm(ELEMENT.bufferWidth), HUE.memory, 'BUFFER', 'packet bytes', HUE.muted);
}
