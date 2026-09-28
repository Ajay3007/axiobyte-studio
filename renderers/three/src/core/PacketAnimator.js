import * as THREE from 'three';
import { Ease } from './tween.js';
import { glowTexture } from './textures.js';

/**
 * Moves glowing "packet" tokens between component anchors. This is the hook
 * the future Packet Flow mode builds on:
 *
 *   await packets.animatePacket({ from: 'rj45-1', to: 'nic-controller', duration: 900 });
 *   await packets.animateRoute(hardwareRoute(RX_PATH, { port: 1 }));
 *
 * `from` / `to` accept a component id, { id, anchor }, or a THREE.Vector3.
 */
export class PacketAnimator {
  constructor(scene, registry, { reducedMotion = false } = {}) {
    this.registry = registry;
    this.reducedMotion = reducedMotion;
    this.group = new THREE.Group();
    this.group.name = 'packets';
    scene.add(this.group);
    this.active = new Set();
    this.pool = [];
    this.glow = glowTexture();
    this.geometry = new THREE.BoxGeometry(0.22, 0.09, 0.14);
  }

  resolve(ref, defaultAnchor) {
    if (ref?.isVector3) return ref.clone();
    const id = typeof ref === 'string' ? ref : ref?.id;
    const anchor = (typeof ref === 'object' && ref?.anchor) || defaultAnchor;
    const p = this.registry.anchorWorld(id, anchor);
    if (!p) throw new Error(`PacketAnimator: unknown component "${id}"`);
    return p;
  }

  acquire(color) {
    let token = this.pool.pop();
    if (!token) {
      const core = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ toneMapped: false }));
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      halo.scale.setScalar(0.9);
      core.add(halo);
      token = { core, halo };
    }
    const c = new THREE.Color(color);
    token.core.material.color.copy(c);
    token.halo.material.color.copy(c);
    token.core.visible = true;
    this.group.add(token.core);
    return token;
  }

  release(token) {
    token.core.visible = false;
    this.group.remove(token.core);
    this.pool.push(token);
  }

  animatePacket({ from, to, duration = 1000, fromAnchor = 'out', toAnchor = 'in', color = 0x6ec1ff, lift = 0.6 } = {}) {
    const p0 = this.resolve(from, fromAnchor);
    const p2 = this.resolve(to, toAnchor);
    const p1 = p0.clone().lerp(p2, 0.5);
    p1.y += lift + p0.distanceTo(p2) * 0.08;
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const token = this.acquire(color);
    token.core.position.copy(p0);
    return new Promise((resolve) => {
      this.active.add({ token, curve, t: 0, duration: this.reducedMotion ? 1 : Math.max(1, duration), resolve });
    });
  }

  /**
   * Deterministic variant of animateRoute(): instead of running a sequence of
   * promises, it pre-computes the whole path and exposes seek(localTime). The
   * curves, anchors and hop rules are identical to animateRoute(), so
   * buildRoute(hardwareRoute(RX_PATH)) draws exactly the same route demoRx()
   * plays — it is just addressable by time instead of by playback.
   */
  buildRoute(stops, { hopDuration = 700, color = 0x6ec1ff, trail = 6, scale = 1 } = {}) {
    const segments = [];
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const same = !a?.isVector3 && !b?.isVector3 && (a.id ?? a) === (b.id ?? b);
      const from = a?.isVector3 ? a : typeof a === 'string' ? { id: a, anchor: i === 0 ? 'in' : 'out' } : { anchor: i === 0 ? 'in' : 'out', ...a };
      const to = b?.isVector3 ? b : typeof b === 'string' ? { id: b, anchor: 'in' } : { anchor: 'in', ...b };
      const p0 = this.resolve(from, from.anchor ?? 'out');
      const p2 = this.resolve(to, to.anchor ?? 'in');
      const lift = same ? 0.25 : 0.6;
      const p1 = p0.clone().lerp(p2, 0.5);
      p1.y += lift + p0.distanceTo(p2) * 0.08;
      const duration = (same ? hopDuration * 0.5 : hopDuration) / 1000;
      segments.push({ curve: new THREE.QuadraticBezierCurve3(p0, p1, p2), t0: total, t1: total + duration, duration });
      total += duration;
    }

    const tokens = [];
    for (let i = 0; i < Math.max(1, 1 + trail); i++) tokens.push(this.acquire(color));
    tokens.forEach((tk, i) => {
      tk.core.visible = false;
      tk.core.scale.setScalar(scale * (i === 0 ? 1 : 1 - i / (tokens.length + 1)));
    });

    const tmp = new THREE.Vector3();
    const self = this;
    const sample = (u, out) => {
      const t = THREE.MathUtils.clamp(u, 0, 1) * total;
      let seg = segments[segments.length - 1];
      for (const s of segments) {
        if (t <= s.t1) {
          seg = s;
          break;
        }
      }
      const k = Ease.inOutSine(THREE.MathUtils.clamp((t - seg.t0) / seg.duration, 0, 1));
      seg.curve.getPoint(k, out);
      return seg;
    };

    return {
      duration: total,
      segments,
      sample: (u) => sample(u, new THREE.Vector3()),
      /** u in 0..1 along the whole route; the trail lags slightly behind the head. */
      seek(u, { visible = true, trailSpan = 0.022 } = {}) {
        if (!visible || u < 0 || u > 1) {
          tokens.forEach((tk) => (tk.core.visible = false));
          return;
        }
        tokens.forEach((tk, i) => {
          const uu = u - i * trailSpan;
          if (uu < 0) {
            tk.core.visible = false;
            return;
          }
          tk.core.visible = true;
          const seg = sample(uu, tmp);
          tk.core.position.copy(tmp);
          const tangent = seg.curve.getTangent(0.5);
          tk.core.rotation.y = Math.atan2(-tangent.z, tangent.x);
          tk.halo.material.opacity = i === 0 ? 1 : Math.max(0, 0.55 - i * 0.09);
          tk.core.material.opacity = i === 0 ? 1 : Math.max(0, 0.7 - i * 0.12);
          tk.core.material.transparent = i !== 0;
        });
      },
      setColor(c) {
        const col = new THREE.Color(c);
        tokens.forEach((tk) => {
          tk.core.material.color.copy(col);
          tk.halo.material.color.copy(col);
        });
      },
      dispose() {
        tokens.forEach((tk) => {
          tk.core.scale.setScalar(1);
          tk.core.material.transparent = false;
          tk.core.material.opacity = 1;
          self.release(tk);
        });
      },
    };
  }

  /** Sequentially hops a packet through a list of stops (ids or { id, anchor }). */
  async animateRoute(stops, { hopDuration = 700, color = 0x6ec1ff } = {}) {
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const same = (a.id ?? a) === (b.id ?? b);
      await this.animatePacket({
        // The first hop enters from outside (e.g. the cable side of the RJ45).
        from: typeof a === 'string' ? { id: a, anchor: i === 0 ? 'in' : 'out' } : { anchor: i === 0 ? 'in' : 'out', ...a },
        to: typeof b === 'string' ? { id: b, anchor: 'in' } : { anchor: 'in', ...b },
        duration: same ? hopDuration * 0.5 : hopDuration,
        lift: same ? 0.25 : 0.6,
        color,
      });
    }
  }

  update(dt) {
    const tmp = new THREE.Vector3();
    for (const a of this.active) {
      a.t += (dt * 1000) / a.duration;
      const k = Ease.inOutSine(Math.min(a.t, 1));
      a.token.core.position.copy(a.curve.getPoint(k, tmp));
      const tangent = a.curve.getTangent(k);
      a.token.core.rotation.y = Math.atan2(-tangent.z, tangent.x);
      if (a.t >= 1) {
        this.active.delete(a);
        this.release(a.token);
        a.resolve();
      }
    }
  }

  clear() {
    for (const a of this.active) {
      this.release(a.token);
      a.resolve();
    }
    this.active.clear();
  }

  dispose() {
    this.clear();
    this.pool.forEach(({ core, halo }) => {
      core.material.dispose();
      halo.material.dispose();
    });
    this.geometry.dispose();
    this.glow.dispose();
    this.group.removeFromParent();
  }
}
