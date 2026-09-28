import * as THREE from 'three';
import { boxAt, extrudeAlongX, mergeAll, polygon, roundedRect } from '../../../core/geometry.js';
import { glowTexture } from '../../../core/textures.js';
import { PORT } from './layout.js';

const T = 0.028; // shield sheet thickness

/** RJ45 plug opening (main window + latch slot below), optionally grown by a margin. */
function plugProfile(target, grow = 0) {
  const { openW, openH, openY, latchW, latchH } = PORT;
  const a = openW / 2 + grow;
  const l = latchW / 2 + grow;
  const y0 = openY - latchH - grow;
  const y1 = openY + grow * 0.3;
  const y2 = openY + openH + grow;
  return polygon(target, [
    [-a, y1],
    [-l, y1],
    [-l, y0],
    [l, y0],
    [l, y1],
    [a, y1],
    [a, y2],
    [-a, y2],
  ]);
}

function rectPath(u0, v0, u1, v1) {
  return polygon(new THREE.Path(), [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ]);
}

function shieldGeometry() {
  const { w, h, depth, ledU, ledW, ledV0, ledV1 } = PORT;

  const face = roundedRect(new THREE.Shape(), -w / 2, 0, w / 2, h, 0.05);
  face.holes.push(plugProfile(new THREE.Path(), 0.035));
  for (const u of [-ledU, ledU]) face.holes.push(rectPath(u - ledW / 2, ledV0, u + ledW / 2, ledV1));
  const front = extrudeAlongX(face, T, 0.006, 6);

  // Inverted U sleeve: top and sides, open to the PCB underneath.
  const sleeveShape = polygon(new THREE.Shape(), [
    [-w / 2, 0],
    [-w / 2, h],
    [w / 2, h],
    [w / 2, 0],
    [w / 2 - T, 0],
    [w / 2 - T, h - T],
    [-w / 2 + T, h - T],
    [-w / 2 + T, 0],
  ]);
  const sleeve = extrudeAlongX(sleeveShape, depth - 2 * T, 0.004, 2);
  sleeve.translate(T, 0, 0);

  const back = boxAt(T, h, w, depth - T / 2, h / 2, 0);

  // Grounding spring fingers pressed out of the top and sides.
  const springs = [];
  for (const z of [-0.45, 0, 0.45]) {
    const s = new THREE.BoxGeometry(0.34, 0.012, 0.14);
    s.rotateZ(-0.12);
    s.translate(0.3, h + 0.018, z);
    springs.push(s);
  }
  for (const side of [-1, 1]) {
    const s = new THREE.BoxGeometry(0.3, 0.12, 0.012);
    s.rotateY(side * 0.12);
    s.translate(0.3, h * 0.55, side * (w / 2 + 0.016));
    springs.push(s);
    // Board-lock legs that pass through the PCB.
    springs.push(boxAt(0.07, 0.24, T, 0.4, -0.12, side * (w / 2 - T / 2)));
    springs.push(boxAt(0.07, 0.24, T, depth - 0.35, -0.12, side * (w / 2 - T / 2)));
  }
  return mergeAll([front, sleeve, back, ...springs]);
}

function housingGeometry() {
  const { w, h } = PORT;
  const inset = T + 0.004;
  const shape = roundedRect(new THREE.Shape(), -w / 2 + inset, 0.01, w / 2 - inset, h - inset, 0.02);
  shape.holes.push(plugProfile(new THREE.Path(), 0));
  const g = extrudeAlongX(shape, 1.75, 0.008, 2);
  g.translate(T + 0.035, 0, 0);
  return g;
}

function contactsGeometry() {
  const { openY, openH } = PORT;
  const top = openY + openH - 0.02;
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const z = (i - 3.5) * 0.102;
    parts.push(boxAt(0.28, 0.012, 0.026, 0.38, top, z));
    const dx = 0.85;
    const dy = -0.3;
    const len = Math.hypot(dx, dy);
    const g = new THREE.BoxGeometry(len, 0.012, 0.026);
    g.rotateZ(Math.atan2(dy, dx));
    g.translate(0.52 + dx / 2, top + dy / 2, z);
    parts.push(g);
  }
  return mergeAll(parts);
}

/**
 * One shielded RJ45 jack with integrated link/activity LEDs.
 * Local frame: x = 0 at the front face (pointing out of the case is -x),
 * y = 0 on the PCB surface, z centred on the jack.
 */
export function createRJ45Port(kit, { name = 'rj45', ledColors = [0x39ff7a, 0xffa126] } = {}) {
  const group = new THREE.Group();
  group.name = name;

  const shield = new THREE.Mesh(kit.geometry('rj45-shield', shieldGeometry), kit.material('nickel'));
  shield.name = `${name}-shield`;
  shield.castShadow = true;
  shield.receiveShadow = true;

  const housing = new THREE.Mesh(kit.geometry('rj45-housing', housingGeometry), kit.material('plastic'));
  housing.name = `${name}-housing`;
  housing.receiveShadow = true;

  const backWall = new THREE.Mesh(
    kit.geometry('rj45-cavity', () => boxAt(0.02, PORT.openH + PORT.latchH + 0.02, PORT.openW + 0.02, 1.45, PORT.openY + PORT.openH / 2 - PORT.latchH / 2, 0)),
    kit.material('cavity'),
  );
  backWall.name = `${name}-cavity`;

  const contacts = new THREE.Mesh(kit.geometry('rj45-contacts', contactsGeometry), kit.material('gold'));
  contacts.name = `${name}-contacts`;

  group.add(shield, housing, backWall, contacts);

  // One glow texture per kit, shared by every LED halo.
  kit.glow ??= kit.texture(glowTexture());
  const sharedGlow = kit.glow;

  const leds = [];
  const lensGeo = kit.geometry('rj45-lens', () => boxAt(0.03, PORT.ledV1 - PORT.ledV0 - 0.01, PORT.ledW - 0.01, 0.012, (PORT.ledV0 + PORT.ledV1) / 2, 0));
  [-PORT.ledU, PORT.ledU].forEach((u, i) => {
    const color = new THREE.Color(ledColors[i]);
    const material = kit.own(
      new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.25), emissive: color, emissiveIntensity: 0.4, roughness: 0.3 }),
    );
    material.userData.noHighlight = true;
    const lens = new THREE.Mesh(lensGeo, material);
    lens.name = `${name}-led-${i}`;
    // extrudeAlongX maps u → -z, so mirror u to keep LED order consistent with the face profile.
    lens.position.z = -u;

    const halo = new THREE.Sprite(
      kit.own(new THREE.SpriteMaterial({ map: sharedGlow, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })),
    );
    halo.scale.setScalar(0.62);
    halo.position.set(-0.05, (PORT.ledV0 + PORT.ledV1) / 2, -u);
    halo.name = `${name}-led-halo-${i}`;
    group.add(lens, halo);
    leds.push({ material, halo, color });
  });

  const anchors = {
    in: new THREE.Vector3(-0.7, PORT.openY + PORT.openH / 2, 0),
    out: new THREE.Vector3(PORT.depth + 0.05, 0.45, 0),
    center: new THREE.Vector3(PORT.depth / 2, PORT.h / 2, 0),
  };
  return { group, leds, anchors };
}
