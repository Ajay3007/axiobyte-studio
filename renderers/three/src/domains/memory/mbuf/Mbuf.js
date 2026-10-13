import * as THREE from 'three';
import { Kit } from '../../../core/hardware/Kit.js';
import { canvasTexture, CANVAS_FONT } from '../../../core/textures.js';
import { boxAt, extrudeAlongY, mergeAll, roundedRect } from '../../../core/geometry.js';
import { BODY, FIELDS, FIELD_TOP, ROW, TITLE, center, fieldRect } from './layout.js';
import { MBUF_METADATA } from './metadata.js';

/**
 * Role hues from the visual language: cyan for the mbuf (metadata), the pointer's colour for
 * buf_addr — the one field that is an address. Never the packet's colour: an mbuf holds no bytes.
 */
const HUE = { mbuf: '#34d8e8', pointer: '#f5d14f', ink: '#e7e3d6', muted: 'rgba(231,227,214,0.62)' };

/** Where the buf_addr socket sits: just proud of the record's right edge, on the buf_addr row. */
const SOCKET = { radius: 0.07, length: 0.12 };

/**
 * Builds the mbuf asset in asset-local coordinates and returns plain data the scene layer
 * registers. One semantic part — `fields` — drawn as one raised record: a title band and a strip per
 * field it shows (data_len, refcount, buf_addr). buf_addr is drawn in the pointer's colour, with a
 * small socket at the record's edge where a reference to the buffer leaves; the reference itself is
 * drawn by whatever composes the mbuf with a buffer, never here. No values, no bytes, no states.
 */
export function createMbuf() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'mbuf';

  const record = createRecord(kit);
  root.add(record.group);

  const top = ([x, z], y = FIELD_TOP) => new THREE.Vector3(x, y, z);
  const row = (name) => fieldRect(FIELDS.indexOf(name));
  const addr = row('buf_addr');
  const components = [
    {
      id: 'fields',
      object: record.group,
      hitObjects: record.hitObjects,
      meta: MBUF_METADATA.fields,
      anchors: {
        // The concept's anchors that are drawn: each field's strip, and buf_addr where the reference
        // to the buffer leaves the record (its socket). `next` is not drawn: chaining is not modelled.
        data_len: top(center(row('data_len'))),
        refcount: top(center(row('refcount'))),
        buf_addr: new THREE.Vector3(BODY.width / 2 + SOCKET.length, BODY.h + ROW.h / 2, (addr.z0 + addr.z1) / 2),
        center: top([0, 0], BODY.h),
      },
      setHighlight: record.setHighlight,
    },
  ];

  return {
    root,
    kit,
    components,
    occluders: [record.body],
    stats: { fields: FIELDS.length },
    update() {},
    dispose() {
      kit.dispose();
    },
  };
}

// ---------------------------------------------------------------------- record

const PX = 240; // canvas pixels per centimetre of printed artwork

function createRecord(kit) {
  const group = new THREE.Group();
  group.name = 'mbuf-record';

  const lit = (hue, k) => kit.own(new THREE.MeshStandardMaterial({ color: new THREE.Color(hue).multiplyScalar(k), roughness: 0.78, metalness: 0 }));

  // The record's body: one rounded slab in the mbuf's hue, like the mbuf half of a mempool element.
  const body = new THREE.Mesh(
    kit.geometry('mbuf-body', () => {
      const s = roundedRect(new THREE.Shape(), -BODY.width / 2, -BODY.depth / 2, BODY.width / 2, BODY.depth / 2, BODY.radius);
      return extrudeAlongY(s, BODY.h, 0.02, 6);
    }),
    lit(HUE.mbuf, 0.32),
  );
  body.name = 'mbuf-body';

  // The bookkeeping fields' strips, merged; buf_addr's strip apart, in the pointer's colour.
  const strip = (r) => boxAt(r.x1 - r.x0, ROW.h, r.z1 - r.z0, (r.x0 + r.x1) / 2, BODY.h + ROW.h / 2, (r.z0 + r.z1) / 2);
  const bookkeeping = FIELDS.filter((f) => f !== 'buf_addr');
  const fields = new THREE.Mesh(
    kit.geometry('mbuf-fields', () => mergeAll(bookkeeping.map((f) => strip(fieldRect(FIELDS.indexOf(f)))))),
    lit(HUE.mbuf, 0.18),
  );
  fields.name = 'mbuf-field-strips';
  const addrRect = fieldRect(FIELDS.indexOf('buf_addr'));
  const addr = new THREE.Mesh(
    kit.geometry('mbuf-buf-addr', () => strip(addrRect)),
    lit(HUE.pointer, 0.2),
  );
  addr.name = 'mbuf-buf-addr-strip';

  // The socket: where a reference to the buffer leaves the record. A stub, not a link.
  const socket = new THREE.Mesh(
    kit.geometry('mbuf-socket', () => {
      const g = new THREE.CylinderGeometry(SOCKET.radius, SOCKET.radius, SOCKET.length, 20);
      g.rotateZ(Math.PI / 2);
      g.translate(BODY.width / 2 + SOCKET.length / 2, BODY.h + ROW.h / 2, (addrRect.z0 + addrRect.z1) / 2);
      return g;
    }),
    kit.own(new THREE.MeshStandardMaterial({ color: new THREE.Color(HUE.pointer).multiplyScalar(0.7), roughness: 0.4, metalness: 0.1 })),
  );
  socket.name = 'mbuf-buf-addr-socket';

  for (const m of [body, fields, addr, socket]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // The printed artwork: the title on its band, and each field's name on its strip.
  const prints = [];
  const print = (name, w, d, x, y, z, draw) => {
    const tex = kit.texture(canvasTexture(Math.round(w * PX), Math.round(d * PX), draw));
    const mat = kit.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const mesh = new THREE.Mesh(
      kit.geometry(name, () => {
        const g = new THREE.PlaneGeometry(w, d);
        g.rotateX(-Math.PI / 2);
        g.translate(x, y + 0.002, z);
        return g;
      }),
      mat,
    );
    mesh.name = name;
    mesh.renderOrder = 2;
    group.add(mesh);
    prints.push(mat);
    return mesh;
  };

  // The record's face, drawn like a mempool element's card: dark, tinted and outlined in the mbuf's
  // hue, with the title in its band. The field strips stand on it with their own names.
  const title = print('mbuf-title-print', BODY.width, BODY.depth, 0, BODY.h, 0, (ctx, W, H) => {
    const cm = (v) => v * PX;
    // Rounded like the slab under it, so the face never overhangs its corners.
    const face = () => {
      const r = cm(BODY.radius);
      ctx.beginPath();
      ctx.moveTo(3 + r, 3);
      ctx.arcTo(W - 3, 3, W - 3, H - 3, r);
      ctx.arcTo(W - 3, H - 3, 3, H - 3, r);
      ctx.arcTo(3, H - 3, 3, 3, r);
      ctx.arcTo(3, 3, W - 3, 3, r);
      ctx.closePath();
    };
    face();
    ctx.fillStyle = '#10141b';
    ctx.fill();
    ctx.fillStyle = `${HUE.mbuf}24`;
    ctx.fill();
    ctx.strokeStyle = HUE.mbuf;
    ctx.lineWidth = 6;
    ctx.stroke();
    const band = cm(TITLE.depth);
    const x0 = cm(ROW.inset);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = HUE.mbuf;
    ctx.font = `700 ${Math.round(band * 0.5)}px ${CANVAS_FONT}`;
    ctx.fillText('MBUF', x0, band * 0.55);
    // The subtitle takes the room the title leaves, whatever face the page has loaded.
    const room = W - 2 * x0 - ctx.measureText('MBUF').width - band * 0.45;
    const sub = 'METADATA · NOT THE BYTES';
    let size = band * 0.3;
    ctx.font = `600 ${Math.round(size)}px ${CANVAS_FONT}`;
    const wide = ctx.measureText(sub).width;
    if (wide > room && wide > 0) size *= room / wide;
    ctx.textAlign = 'right';
    ctx.fillStyle = HUE.muted;
    ctx.font = `600 ${Math.round(size)}px ${CANVAS_FONT}`;
    ctx.fillText(sub, W - x0, band * 0.58);
  });

  const labels = FIELDS.map((f, i) => {
    const r = fieldRect(i);
    const [x, z] = center(r);
    const isAddr = f === 'buf_addr';
    return print(`mbuf-${f.replace('_', '-')}-print`, r.x1 - r.x0, r.z1 - r.z0, x, FIELD_TOP, z, (ctx, W, H) => {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = isAddr ? HUE.pointer : HUE.ink;
      ctx.font = `600 ${Math.round(H * 0.56)}px ${CANVAS_FONT}`;
      ctx.fillText(f, H * 0.3, H * 0.52);
      if (isAddr) {
        ctx.textAlign = 'right';
        ctx.fillText('→', W - H * 0.3, H * 0.52);
      }
    });
  });

  return {
    group,
    body,
    hitObjects: [body, fields, addr, socket, title, ...labels],
    // The lit meshes are highlighted by the Highlighter (emissive); the prints are unlit, so they
    // brighten here.
    setHighlight(level) {
      for (const m of prints) m.color.setScalar(1 + 0.4 * Math.min(1, level));
    },
  };
}
