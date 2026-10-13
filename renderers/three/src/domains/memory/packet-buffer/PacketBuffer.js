import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { boxAt, extrudeAlongY, mergeAll, roundedRect } from '../../../core/geometry.js';
import {
  BASE,
  BYTES_RECT,
  CAPTION_RECT,
  CELL,
  CELL_TOP,
  DIVIDER_RECT,
  FLOOR,
  FRAME,
  FRAME_RECT,
  HEADER,
  HEADER_RECT,
  LABEL_RECT,
  PAYLOAD,
  PAYLOAD_RECT,
  RIM_TOP,
  cells,
  center,
} from './layout.js';
import { PACKET_BUFFER_METADATA } from './metadata.js';

/**
 * Role hues from the visual language: memory's purple for the buffer (the frame that holds), the
 * packet's blue for the bytes it holds — the header's a lighter blue than the payload's, both
 * packet bytes. Never the mbuf's cyan or the pointer's yellow: the buffer is bytes, not metadata.
 */
const HUE = { memory: '#b79cf0', packet: '#4aa8ff', header: '#8ccbff', ink: '#e7e3d6', muted: 'rgba(231,227,214,0.62)' };

/**
 * Builds the Packet Buffer asset in asset-local coordinates and returns plain data the scene layer
 * registers. Two semantic parts — `header` and `payload`, the regions the packet's bytes are in —
 * drawn as byte cells inside one open frame. The frame is the buffer, not a part.
 *
 * Address-neutral and stateless: no address, no values, no free or in-use. What an animation needs
 * is exposed rather than animated here: `header.cells` are one mesh per header byte, each with its
 * own material, so a film can rewrite the header in place — recolour or swap its cells — without
 * rebuilding the buffer. Nothing in the asset moves.
 */
export function createPacketBuffer() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'packet-buffer';

  const frame = createFrame(kit);
  root.add(frame.group);
  const header = createHeader(kit);
  root.add(header.group);
  const payload = createPayload(kit);
  root.add(payload.group);

  const v = ([x, z], y) => new THREE.Vector3(x, y, z);
  // The buffer's own anchors, the same on both parts — the buffer is exactly its header and payload.
  //   center          the middle of the bytes
  //   pointer_target  the buffer's address: its first byte, at the start of the header — where
  //                   buf_addr, a pointer or a handle points; on the frame's outside, at byte height
  //   dma_target      where a DMA write lands: the bytes, reached through the frame's opening
  //   read            where a DMA read (transmit) takes them from: the same bytes, the same opening
  const whole = {
    center: v(center(BYTES_RECT), FLOOR + CELL.h / 2),
    pointer_target: new THREE.Vector3(FRAME_RECT.x0, FLOOR + CELL.h / 2, center(HEADER_RECT)[1]),
    dma_target: v(center(BYTES_RECT), RIM_TOP),
    read: v(center(BYTES_RECT), RIM_TOP),
  };
  const components = [
    {
      id: 'header',
      object: header.group,
      hitObjects: header.hitObjects,
      meta: PACKET_BUFFER_METADATA.header,
      anchors: { ...cloneAll(whole), header: v(center(HEADER_RECT), CELL_TOP) },
      setHighlight: header.setHighlight,
    },
    {
      id: 'payload',
      object: payload.group,
      hitObjects: payload.hitObjects,
      meta: PACKET_BUFFER_METADATA.payload,
      anchors: { ...cloneAll(whole), payload: v(center(PAYLOAD_RECT), CELL_TOP) },
      setHighlight: payload.setHighlight,
    },
  ];

  return {
    root,
    kit,
    components,
    // For a film's in-place edit: the header's bytes, one mesh and one material each, in byte order.
    header: { cells: header.cells, materials: header.materials },
    occluders: [frame.base],
    stats: { headerBytes: HEADER.cols * HEADER.rows, payloadBytes: PAYLOAD.cols * PAYLOAD.rows },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

const cloneAll = (anchors) => Object.fromEntries(Object.entries(anchors).map(([k, p]) => [k, p.clone()]));

const lit = (kit, hue, k, extra = {}) =>
  kit.own(new THREE.MeshStandardMaterial({ color: new THREE.Color(hue).multiplyScalar(k), roughness: 0.7, metalness: 0, ...extra }));

const cellGeometry = (r) => {
  const s = roundedRect(new THREE.Shape(), r.x0, -r.z1, r.x1, -r.z0, CELL.radius);
  const g = extrudeAlongY(s, CELL.h, 0.015, 4);
  g.translate(0, FLOOR, 0);
  return g;
};

// ----------------------------------------------------------------------- frame

const PX = 130; // canvas pixels per centimetre of printed band

function createFrame(kit) {
  const group = new THREE.Group();
  group.name = 'packet-buffer-frame';

  // The base plate, under the frame and both bands.
  const base = new THREE.Mesh(
    kit.geometry('packet-buffer-base', () => {
      const s = roundedRect(new THREE.Shape(), -BASE.width / 2, -BASE.depth / 2, BASE.width / 2, BASE.depth / 2, FRAME.radius);
      return extrudeAlongY(s, FRAME.base, 0.015, 6);
    }),
    kit.material('schematicBase'),
  );
  base.name = 'packet-buffer-base';
  base.receiveShadow = true;

  // The frame that holds the bytes: four rim walls and the low divider between the regions.
  const f = FRAME_RECT;
  const h = FRAME.rim;
  const y = FLOOR + h / 2;
  const walls = new THREE.Mesh(
    kit.geometry('packet-buffer-walls', () =>
      mergeAll([
        boxAt(f.x1 - f.x0, h, FRAME.wall, (f.x0 + f.x1) / 2, y, f.z0 + FRAME.wall / 2),
        boxAt(f.x1 - f.x0, h, FRAME.wall, (f.x0 + f.x1) / 2, y, f.z1 - FRAME.wall / 2),
        boxAt(FRAME.wall, h, f.z1 - f.z0, f.x0 + FRAME.wall / 2, y, (f.z0 + f.z1) / 2),
        boxAt(FRAME.wall, h, f.z1 - f.z0, f.x1 - FRAME.wall / 2, y, (f.z0 + f.z1) / 2),
      ]),
    ),
    lit(kit, HUE.memory, 0.42),
  );
  walls.name = 'packet-buffer-walls';
  const d = DIVIDER_RECT;
  const divider = new THREE.Mesh(
    kit.geometry('packet-buffer-divider', () => boxAt(d.x1 - d.x0, h * 0.6, d.z1 - d.z0, (d.x0 + d.x1) / 2, FLOOR + (h * 0.6) / 2, (d.z0 + d.z1) / 2)),
    lit(kit, HUE.memory, 0.3),
  );
  divider.name = 'packet-buffer-divider';
  // The floor inside the frame, in memory's dark surface: what the bytes sit on.
  const floor = new THREE.Mesh(
    kit.geometry('packet-buffer-floor', () => {
      const g = new THREE.PlaneGeometry(f.x1 - f.x0 - 2 * FRAME.wall, f.z1 - f.z0 - 2 * FRAME.wall);
      g.rotateX(-Math.PI / 2);
      g.translate((f.x0 + f.x1) / 2, FLOOR + 0.001, (f.z0 + f.z1) / 2);
      return g;
    }),
    lit(kit, HUE.memory, 0.14),
  );
  floor.name = 'packet-buffer-floor';

  for (const m of [walls, divider]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  floor.receiveShadow = true;
  group.add(base, walls, divider, floor);

  // The printed bands: what the thing is (far), and which region is which (near).
  const W = BASE.width * PX;
  const D = BASE.depth * PX;
  const zc = (z) => (z + BASE.depth / 2) * PX; // base z → canvas y
  const xc = (x) => (x + BASE.width / 2) * PX; // base x → canvas x
  const tex = kit.texture(
    canvasTexture(W, D, (ctx) => {
      const pad = 0.16 * PX;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = HUE.memory;
      ctx.font = `700 ${Math.round(0.24 * PX)}px ${CANVAS_FONT}`;
      ctx.fillText('PACKET BUFFER', pad, zc((CAPTION_RECT.z0 + CAPTION_RECT.z1) / 2));
      ctx.textAlign = 'right';
      ctx.fillStyle = HUE.muted;
      ctx.font = `600 ${Math.round(0.17 * PX)}px ${CANVAS_FONT}`;
      ctx.fillText('THE PACKET’S BYTES LIVE HERE', W - pad, zc((CAPTION_RECT.z0 + CAPTION_RECT.z1) / 2));
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(0.19 * PX)}px ${CANVAS_FONT}`;
      const labelZ = zc((LABEL_RECT.z0 + LABEL_RECT.z1) / 2);
      ctx.fillStyle = HUE.header;
      ctx.fillText('HEADER', xc(center(HEADER_RECT)[0]), labelZ);
      ctx.fillStyle = HUE.packet;
      ctx.fillText('PAYLOAD', xc(center(PAYLOAD_RECT)[0]), labelZ);
    }),
  );
  const mat = kit.own(
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  mat.userData.noHighlight = true;
  const print = new THREE.Mesh(
    kit.geometry('packet-buffer-print', () => {
      const g = new THREE.PlaneGeometry(BASE.width, BASE.depth);
      g.rotateX(-Math.PI / 2);
      g.translate(0, FRAME.base + 0.002, 0);
      return g;
    }),
    mat,
  );
  print.name = 'packet-buffer-print';
  print.renderOrder = 1;
  group.add(print);

  return { group, base };
}

// -------------------------------------------------------------------- regions

/** The header: one mesh per byte, each with its own material, so a film can edit it in place. */
function createHeader(kit) {
  const group = new THREE.Group();
  group.name = 'packet-buffer-header';
  const rects = cells(HEADER_RECT, HEADER);
  const materials = rects.map(() => lit(kit, HUE.header, 0.62, { emissive: new THREE.Color(HUE.header).multiplyScalar(0.12) }));
  const cellsOut = rects.map((r, i) => {
    const mesh = new THREE.Mesh(kit.geometry(`packet-buffer-header-byte-${String.fromCharCode(97 + i)}`, () => cellGeometry(r)), materials[i]);
    mesh.name = 'packet-buffer-header-byte';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  });
  return { group, cells: cellsOut, materials, hitObjects: cellsOut, setHighlight() {} };
}

/** The payload: every byte the same, on one merged mesh. */
function createPayload(kit) {
  const group = new THREE.Group();
  group.name = 'packet-buffer-payload';
  const mesh = new THREE.Mesh(
    kit.geometry('packet-buffer-payload-bytes', () => mergeAll(cells(PAYLOAD_RECT, PAYLOAD).map(cellGeometry))),
    lit(kit, HUE.packet, 0.55, { emissive: new THREE.Color(HUE.packet).multiplyScalar(0.1) }),
  );
  mesh.name = 'packet-buffer-payload-bytes';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return { group, hitObjects: [mesh], setHighlight() {} };
}
