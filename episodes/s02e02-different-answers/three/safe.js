import * as THREE from 'three';
import { SAFE } from './look.js';

/**
 * Copied from s02e01's three/safe.js (at d19cd13), unchanged; see objects.js.
 *
 * Mobile-safe context: how visible a piece of text may be, given where it lands on
 * screen. A tile drifting into the platform interface zones (Reels/Shorts buttons on
 * the right, captions and controls at the bottom — SAFE.right / SAFE.bottom) fades out
 * as it goes, so nothing readable sits under the platform's UI.
 *
 * It is evaluated after the camera is posed for the frame, from the camera alone, so it
 * stays a pure function of time. Subject text is framed clear of the zones by the
 * storyboard (and checked by check-safe-zones.mjs); this catches context at the edges.
 */
export const ZONE = { right: 1 - SAFE.right, bottom: 1 - SAFE.bottom };

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Vector3();

/** The on-screen box (0..1, y down) of a w×h rectangle centred on `object`, facing the camera. */
export function screenBox(camera, object, w, h) {
  object.updateWorldMatrix(true, false);
  object.getWorldPosition(_p);
  object.getWorldScale(_s);
  const hw = (w * _s.x) / 2;
  const hh = (h * _s.y) / 2;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [dx, dy] of [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]) {
    _c.set(_p.x + dx, _p.y + dy, _p.z).project(camera);
    const x = _c.x * 0.5 + 0.5;
    const y = -_c.y * 0.5 + 0.5;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1, behind: _c.z > 1 };
}

/** How far into the zones a box reaches, as a fraction of its own size (0 = clear, 1 = inside). */
export function intrusion(box) {
  const w = Math.max(1e-6, box.x1 - box.x0);
  const h = Math.max(1e-6, box.y1 - box.y0);
  const right = Math.min(1, Math.max(0, (box.x1 - ZONE.right) / w));
  const bottom = Math.min(1, Math.max(0, (box.y1 - ZONE.bottom) / h));
  // Off the frame entirely counts as clear: the edge already hides it.
  const off = box.x0 > 1 || box.y0 > 1 || box.x1 < 0 || box.y1 < 0;
  return off ? 0 : Math.max(right, bottom);
}

/** Opacity multiplier for context text: 1 when clear, easing to 0 by the time 15% of it is inside a zone. */
export function createSafeFade(camera) {
  return (object, w, h) => {
    camera.updateMatrixWorld();
    const u = intrusion(screenBox(camera, object, w, h));
    const k = Math.min(1, Math.max(0, u / 0.15));
    return 1 - k * k * (3 - 2 * k);
  };
}
