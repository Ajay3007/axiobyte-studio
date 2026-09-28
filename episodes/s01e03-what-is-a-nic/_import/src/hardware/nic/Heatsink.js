import * as THREE from 'three';
import { Ease } from '../../engine/tween.js';
import { circlePath, extrudeAlongX, extrudeAlongY, mergeAll, polygon, xz } from '../../engine/geometry.js';
import { createPushPin } from '../parts/misc.js';
import { HEATSINK } from './layout.js';

/** Base outline: a square with two diagonal ears that carry the push pins. */
function baseShape() {
  const s = HEATSINK.half;
  const r = HEATSINK.earR;
  const [p1, p2] = HEATSINK.pins.map(([x, z]) => [x - HEATSINK.x, z - HEATSINK.z]);
  const arc = (c, a0, a1) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / 10);
      pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
    }
    return pts;
  };
  const pts = [
    [-s + 0.62, -s],
    [s, -s],
    [s, s - 0.62],
    ...arc(p2, -80, 170),
    [s - 0.62, s],
    [-s, s],
    [-s, -s + 0.62],
    ...arc(p1, 100, 350),
  ].map(([x, z]) => xz(x, z));
  const shape = polygon(new THREE.Shape(), pts);
  for (const [x, z] of [p1, p2]) {
    const [u, v] = xz(x, z);
    shape.holes.push(circlePath(u, v, 0.07));
  }
  return shape;
}

function finGeometry(length) {
  const b = HEATSINK.finT / 2;
  const t = b * 0.62;
  const h = HEATSINK.finH;
  const profile = polygon(new THREE.Shape(), [
    [-b, 0],
    [b, 0],
    [t, h - 0.015],
    [0, h],
    [-t, h - 0.015],
  ]);
  return extrudeAlongX(profile, length, 0, 1);
}

function heatsinkGeometry() {
  const { half, baseT, fins, finT, channel } = HEATSINK;
  const base = extrudeAlongY(baseShape(), baseT, 0.012, 10);
  const parts = [base];
  const pitch = (2 * half - finT) / (fins - 1);
  const segLen = half - channel / 2 - 0.03;
  for (let i = 0; i < fins; i++) {
    const z = -half + finT / 2 + i * pitch;
    for (const x0 of [-half + 0.03, channel / 2]) {
      const g = finGeometry(segLen);
      g.translate(x0, baseT - 0.005, z);
      parts.push(g);
    }
  }
  return mergeAll(parts);
}

/**
 * Anodised aluminium heatsink over the PHY. The inner group can be lifted
 * (with its push pins) to reveal the chip underneath.
 */
export function createHeatsink(kit) {
  const group = new THREE.Group();
  group.name = 'heatsink';
  group.position.set(HEATSINK.x, HEATSINK.baseY, HEATSINK.z);

  const lift = new THREE.Group();
  lift.name = 'heatsink-lift';
  group.add(lift);

  const body = new THREE.Mesh(kit.geometry('heatsink', heatsinkGeometry), kit.material('anodized'));
  body.name = 'heatsink-body';
  body.castShadow = true;
  body.receiveShadow = true;
  lift.add(body);

  HEATSINK.pins.forEach(([x, z]) => {
    const pin = createPushPin(kit, { boardDepth: HEATSINK.baseY + HEATSINK.baseT + 0.12 });
    pin.position.set(x - HEATSINK.x, HEATSINK.baseT, z - HEATSINK.z);
    lift.add(pin);
  });

  let lifted = false;
  let tween = null;
  /** Absolute lift, 0 = seated, 1 = fully raised. The tween below drives this too. */
  function setLiftAmount(a) {
    const k = THREE.MathUtils.clamp(a, 0, 1);
    lift.position.y = k * HEATSINK.lift;
    lift.rotation.z = Math.sin(k * Math.PI) * 0.04;
  }
  function setLifted(next, tweens, duration = 950) {
    lifted = next;
    tween?.cancel();
    const from = lift.position.y;
    const to = next ? HEATSINK.lift : 0;
    tween = tweens.add({
      duration,
      ease: Ease.inOutCubic,
      onUpdate: (k) => {
        lift.position.y = THREE.MathUtils.lerp(from, to, k);
        lift.rotation.z = Math.sin(k * Math.PI) * (next ? 0.04 : -0.04);
      },
    });
    return lifted;
  }

  return {
    group,
    body,
    lift,
    get lifted() {
      return lifted;
    },
    setLiftAmount,
    setLifted,
    toggle: (tweens) => setLifted(!lifted, tweens),
    anchors: {
      in: new THREE.Vector3(-HEATSINK.half, 0.3, 0),
      out: new THREE.Vector3(HEATSINK.half, 0.3, 0),
      center: new THREE.Vector3(0, 0.55, 0),
    },
  };
}
