import * as THREE from 'three';
import { canvasTexture, glowTexture, CANVAS_FONT } from '@axiobyte/three/core/textures.js';
import { C } from '@axiobyte/three/video/overlay/theme.js';
import { DIM, HUE, tileWidth } from './look.js';

/**
 * Generic primitives: a token tile, a text plane, a bar, a glass panel, a halo.
 * Built once; animate.js poses them from the time alone.
 *
 * Copied from s02e01's three/objects.js (at d19cd13), which stays untouched:
 * moving both films onto one shared module is a separate, approved migration
 * with s02e01's determinism baseline as its gate (notes/visual-plan.md §6).
 * The additions: a tile's `ink` option (a ghost's text), a panel's `round`, and
 * text planes tagged for the safe-zone audit as tiles already were.
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
export function makeTile(text, { hue = HUE.token, ink = C.ink } = {}) {
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
    ctx.fillStyle = ink;
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
  // Readable text: check-safe-zones.mjs audits it against the platform interface zones.
  mesh.userData.safe = { w, h, label: str, face: mesh };
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

/** A glass panel with a rounded edge: a pill (round 0.5, the prompt bar) or a card (an answer). */
export function makePanel(w, h, edge = C.lineStrong, { round = 0.5 } = {}) {
  const tex = canvasTexture(w * PX, h * PX, (ctx, cw, ch) => {
    const r = ch * round;
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
