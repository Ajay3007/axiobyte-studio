import * as THREE from 'three';
import { canvasTexture, glowTexture, CANVAS_FONT } from '@axiobyte/three/core/textures.js';
import { mulberry32 } from '@axiobyte/three/core/rng.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { DIM, HUE, SPLIT, TOKENS, tileWidth } from './look.js';

/**
 * The film's objects, built once. Nothing here moves: animate.js poses every
 * object from the time alone.
 */

const PX = 320; // texture pixels per world unit — sharp at 2x supersampling on a 1080-wide frame

const additive = (color, opacity = 0) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

function halo(color, sx, sy) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  s.scale.set(sx, sy, 1);
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A token tile: a thin glass slab, its text on the front face, a halo behind. */
export function makeTile(text, { hue = HUE.token } = {}) {
  const w = tileWidth(text);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: C.bg0, metalness: 0.35, roughness: 0.28, transparent: true, opacity: 0.96 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, DIM.tileH, DIM.tileD), bodyMat);
  const tex = canvasTexture(w * PX, DIM.tileH * PX, (ctx, cw, ch) => {
    const line = Math.max(3, ch * 0.03);
    roundRect(ctx, line, line, cw - 2 * line, ch - 2 * line, ch * 0.16);
    ctx.fillStyle = `rgba(${hue.r * 255 | 0},${hue.g * 255 | 0},${hue.b * 255 | 0},0.10)`;
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = `#${hue.getHexString()}`;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `600 ${Math.round(DIM.textSize * PX)}px ${CANVAS_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch * 0.53);
  });
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, DIM.tileH), faceMat);
  face.position.z = DIM.tileD / 2 + 0.003;
  const glow = halo(hue, w * 2.3, DIM.tileH * 3.2);
  glow.position.z = -0.05;
  group.add(glow, body, face);
  // Readable text: check-safe-zones.mjs audits it against the platform interface zones.
  group.userData.safe = { w, h: DIM.tileH, label: text, face };
  return { group, body, face, glow, width: w, materials: [bodyMat, faceMat] };
}

/** An ID tag hung under a tile on a short string: a number, nothing more. */
export function makeTag(id) {
  const pivot = new THREE.Group();
  const string = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.24), new THREE.MeshBasicMaterial({ color: HUE.label, transparent: true, opacity: 0 }));
  string.position.y = -0.12;
  const pw = 0.94;
  const ph = 0.44;
  const tex = canvasTexture(pw * PX, ph * PX, (ctx, cw, ch) => {
    roundRect(ctx, 2, 2, cw - 4, ch - 4, ch * 0.18);
    ctx.fillStyle = 'rgba(20,24,30,0.96)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.lineStrong;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cw * 0.12, ch / 2, ch * 0.09, 0, Math.PI * 2);
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `700 ${Math.round(ch * 0.5)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(id), cw * 0.56, ch * 0.54);
  });
  const plateMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), plateMat);
  plate.position.y = -0.24 - ph / 2;
  plate.userData.safe = { w: pw, h: ph, label: `ID ${id}`, face: plate };
  pivot.add(string, plate);
  return { pivot, string, plate };
}

/** The learned numbers: a column of signed bars, centred on a spine, bottom to top. */
export function makeColumn(values, hue = HUE.vector) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, DIM.cellH, 0.05);
  const cells = values.map((v, k) => {
    const mat = additive(hue, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = k * (DIM.cellH + DIM.cellGap) + DIM.cellH / 2;
    group.add(m);
    return { mesh: m, mat, value: v };
  });
  const height = values.length * (DIM.cellH + DIM.cellGap);
  const spine = new THREE.Mesh(new THREE.PlaneGeometry(0.012, height), additive(hue, 0));
  spine.position.y = height / 2;
  group.add(spine);
  return { group, cells, spine, height };
}

/** Deterministic illustrative vectors: sky and cloud share most of their pattern; the rest do not. */
export function vectors() {
  const draw = (seed) => {
    const r = mulberry32(seed);
    return Array.from({ length: DIM.cells }, () => (r() * 2 - 1) * (0.35 + 0.65 * r()));
  };
  const out = TOKENS.map((t, i) => draw(101 + i * 37));
  const sky = out[3];
  const r = mulberry32(977);
  const cloud = sky.map((v) => Math.max(-1, Math.min(1, v * 0.92 + (r() - 0.5) * 0.22)));
  return { tokens: out, cloud };
}

/** A layer: a thin translucent floor with an edge and a faint grid, lying in the xz plane. */
export function makeFloor(width, depth) {
  const tex = canvasTexture(width * 64, depth * 64, (ctx, cw, ch) => {
    ctx.strokeStyle = 'rgba(176,155,255,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, cw - 4, ch - 4);
    ctx.strokeStyle = 'rgba(176,155,255,0.10)';
    ctx.lineWidth = 2;
    for (let x = 32; x < cw; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 32; y < ch; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(176,155,255,0.035)';
    ctx.fillRect(0, 0, cw, ch);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, mat };
}

/** One attention link on one layer: from an earlier position `i` to the position `j` that pulls from it. */
export function makeArc(from, to, lift) {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, 0.04));
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.014, 6, false), additive(HUE.context, 0));
  const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.05, 8, false), additive(HUE.context, 0));
  const sparks = Array.from({ length: 3 }, () => halo(HUE.context, 0.22, 0.22));
  return { curve, core, glow, sparks };
}

/** A position's state on one layer: a small sphere with a halo. */
export function makeNode() {
  const mat = new THREE.MeshBasicMaterial({ color: HUE.vector.clone(), transparent: true, opacity: 0, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), mat);
  const glow = halo(HUE.vector.clone(), 0.8, 0.8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.009, 8, 48), additive(HUE.context, 0));
  ring.rotation.x = -Math.PI / 2;
  return { mesh, mat, glow, ring };
}

/** A soft ground far below the tokens: it gives the empty space a floor, and fades into the fog. */
export function makeGround() {
  const tex = canvasTexture(1024, 1024, (ctx, cw, ch) => {
    const g = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw / 2);
    g.addColorStop(0, 'rgba(110,193,255,0.075)');
    g.addColorStop(1, 'rgba(110,193,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    for (let x = 0; x <= cw; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y <= ch; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.7;
  return mesh;
}

/** Positions on layer `y`, one per token, in the split row. */
export const nodeAt = (i, y) => new THREE.Vector3(SPLIT[i].x, y, 0);

/**
 * A line of text as a plane in the world, `h` units tall, as wide as the text
 * measures. Built once; animate.js only changes its opacity and position.
 */
export function makeText(str, { h = 0.26, color = C.ink, weight = 600, mono = false } = {}) {
  const font = (px) => `${weight} ${px}px ${mono ? 'ui-monospace, Menlo, monospace' : CANVAS_FONT}`;
  const px = Math.round(h * PX * 0.78);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font(px);
  const w = Math.max(0.05, (probe.measureText(str).width + px * 0.3) / PX);
  const tex = canvasTexture(w * PX, h * PX, (ctx, cw, ch) => {
    ctx.font = font(px);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, cw / 2, ch * 0.54);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return { mesh, mat, width: w };
}

/** A flat bar (probability, score), left-anchored: scale.x is its length. */
export function makeBar(color, h = 0.16) {
  const geo = new THREE.BoxGeometry(1, h, 0.04);
  geo.translate(0.5, 0, 0);
  const mat = additive(color, 0);
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, mat };
}

/** A glass panel with a rounded edge: the prompt bar. */
export function makePanel(w, h, edge = C.lineStrong) {
  const tex = canvasTexture(w * PX, h * PX, (ctx, cw, ch) => {
    const r = ch * 0.5;
    roundRect(ctx, 3, 3, cw - 6, ch - 6, r);
    ctx.fillStyle = 'rgba(18,22,30,0.92)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = edge;
    ctx.stroke();
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), mat };
}

export { additive, halo };
