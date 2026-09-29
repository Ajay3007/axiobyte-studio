import * as THREE from 'three';
import { Ease } from '../../../core/tween.js';
import { RX_PATH, TX_PATH, hardwareRoute } from '../dataplane.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const ramp = (t, a, b) => smooth((t - a) / Math.max(1e-6, b - a));

/**
 * Everything that moves on the card, expressed as pure functions of the
 * voiceover clock.
 *
 * Nothing here integrates: highlight levels, the heatsink lift and packet
 * position are all evaluated from keyframes, so the renderer can jump to any
 * timestamp. That is why the interactive Highlighter's eased update() and the
 * heatsink's tween are bypassed in video mode — the underlying systems (and
 * the same PacketAnimator routes demoRx()/demoTx() use) are still the ones
 * doing the work.
 */
export class AnimationDirector {
  constructor({ world, signalPaths }) {
    this.world = world;
    this.signalPaths = signalPaths;
    this.highlights = [];
    this.heatsinkKeys = [{ t: 0, v: 0 }];
    this.zoneCues = [];
    this.signalCues = [];
    this.flights = [];
    this._levels = {};

    const { registry, packets } = world;
    // Where the cable meets the card, just outside the bracket, and where a
    // transmitted frame leaves it. Both are derived from the real port anchor.
    const rjIn = registry.anchorWorld('rj45-1', 'in').clone();
    this.cableIn = rjIn.clone().add(new THREE.Vector3(-3.4, 0.5, 0));
    this.cableOut = this.cableIn.clone();

    // The same stop lists demoRx() / demoTx() use, wrapped so they can be seeked.
    // Descriptor rings live in host memory: when the card carries no queue zones, a
    // received packet leaves through the edge connector to a point just off the card
    // (toward the host), and a transmitted one arrives from there. Same stop count, so
    // a storyboard's stop times still line up.
    const rxStops = hardwareRoute(RX_PATH, { port: 1 });
    const txStops = hardwareRoute(TX_PATH, { port: 1 });
    this.hostPort = registry.anchorWorld('pcie-connector', 'out').clone().add(new THREE.Vector3(0, -0.45, 1.5));
    const onCard = (stops) => stops.filter((s) => registry.has(s.id));
    const rx = registry.has('rx-queue') ? rxStops : [...onCard(rxStops), this.hostPort];
    const tx = registry.has('tx-queue') ? txStops : [this.hostPort, ...onCard(txStops)];
    this.routes = {
      rx: packets.buildRoute([this.cableIn, ...rx], { hopDuration: 700, color: 0x6ec1ff, trail: 7, scale: 1.7 }),
      tx: packets.buildRoute([...tx, this.cableOut], { hopDuration: 700, color: 0xffb454, trail: 7, scale: 1.7 }),
    };
    for (const r of Object.values(this.routes)) r.seek(0, { visible: false });
  }

  /** Normalised progress of stop `i` along a route (0 at the first stop, 1 at the last). */
  stopU(route, i) {
    if (i <= 0) return 0;
    if (i >= route.segments.length) return 1;
    return route.segments[i].t0 / route.duration;
  }

  /**
   * flight = {
   *   route: 'rx' | 'tx',
   *   stops: [{ at, travel }]  one per route stop, in order,
   *   end,                      when the token disappears
   *   color
   * }
   */
  addFlight(flight) {
    this.flights.push({ travel: 1.5, ...flight });
    return this;
  }

  setHighlights(list) {
    this.highlights = list;
    return this;
  }

  setHeatsink(keys) {
    this.heatsinkKeys = [{ t: 0, v: 0 }, ...keys].sort((a, b) => a.t - b.t);
    return this;
  }

  setZones(cues) {
    this.zoneCues = cues;
    return this;
  }

  setSignals(cues) {
    this.signalCues = cues;
    return this;
  }

  heatsinkAt(t) {
    const k = this.heatsinkKeys;
    if (t <= k[0].t) return k[0].v;
    for (let i = 1; i < k.length; i++) {
      if (t <= k[i].t) {
        const u = (t - k[i - 1].t) / Math.max(1e-6, k[i].t - k[i - 1].t);
        return THREE.MathUtils.lerp(k[i - 1].v, k[i].v, Ease.inOutCubic(clamp01(u)));
      }
    }
    return k.at(-1).v;
  }

  levelsAt(t) {
    const out = {};
    for (const h of this.highlights) {
      if (t < h.from - (h.in ?? 0.5) || t > h.to + (h.out ?? 0.6)) continue;
      const a = Math.min(ramp(t, h.from - (h.in ?? 0.5), h.from + 0.05), ramp(h.to + (h.out ?? 0.6) - t, 0, h.out ?? 0.6));
      const v = (h.level ?? 1) * clamp01(a);
      if (v > (out[h.id] ?? 0)) out[h.id] = v;
    }
    return out;
  }

  /** Position of one flight's token at time t, or null when it is off screen. */
  flightU(f, t) {
    const route = this.routes[f.route];
    const stops = f.stops;
    if (t < stops[0].at - (stops[0].travel ?? f.travel) || t > (f.end ?? Infinity)) return null;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const travel = s.travel ?? f.travel;
      const uHere = this.stopU(route, i);
      if (t < s.at) {
        if (i === 0) {
          // Fly in from before the first stop.
          return { u: 0, fade: clamp01((t - (s.at - travel)) / travel) };
        }
        const uPrev = this.stopU(route, i - 1);
        const k = Ease.inOutCubic(clamp01((t - (s.at - travel)) / travel));
        return { u: THREE.MathUtils.lerp(uPrev, uHere, k), fade: 1 };
      }
      if (i === stops.length - 1) {
        const tail = f.end ?? s.at + 1.5;
        return { u: uHere, fade: clamp01((tail - t) / 0.8) };
      }
    }
    return null;
  }

  update(t) {
    const { scene, highlighter, packets } = this.world;

    highlighter.setLevels(this.levelsAt(t));
    scene.nic.heatsink.setLiftAmount(this.heatsinkAt(t));

    for (const key of Object.keys(this.routes)) {
      const f = this.flights.find((x) => x.route === key && t >= x.stops[0].at - (x.stops[0].travel ?? x.travel) - 0.2 && t <= (x.end ?? Infinity));
      const state = f ? this.flightU(f, t) : null;
      if (!state || state.fade <= 0.01) this.routes[key].seek(0, { visible: false });
      else this.routes[key].seek(state.u, { visible: true });
    }

    // Descriptor slots filling and draining in the on-card queue zones.
    for (const z of this.zoneCues) {
      const zone = scene.nic.zones[z.zone];
      if (!zone) continue;
      const on = t >= z.from && t <= z.to;
      for (let i = 0; i < zone.slots.length; i++) {
        if (!on) {
          zone.setSlot(i, 0);
          continue;
        }
        const phase = (t - z.from) * (z.rate ?? 1.4) - i * 0.55;
        const cycle = ((phase % zone.slots.length) + zone.slots.length) % zone.slots.length;
        const lit = cycle < 2.4 ? Math.exp(-Math.pow((cycle - 0.7) / 1.1, 2)) : 0;
        zone.setSlot(i, lit * (z.level ?? 0.9) * Math.min(1, ramp(t, z.from, z.from + 0.7), ramp(z.to - t, 0, 0.7)));
      }
    }

    if (this.signalPaths) {
      const cue = this.signalCues.find((c) => t >= c.from - 0.5 && t <= c.to + 0.5);
      if (!cue) this.signalPaths.setState({});
      else {
        const a = Math.min(ramp(t, cue.from - 0.5, cue.from + 0.6), ramp(cue.to + 0.5 - t, 0, 0.8));
        const levels = {};
        for (const [k, v] of Object.entries(cue.keys)) levels[k] = v * a;
        const head = ((t - cue.from) * (cue.speed ?? 0.35)) % 1;
        this.signalPaths.setState(levels, { head, pulse: (cue.pulse ?? 1) * a });
      }
    }
  }

  dispose() {
    for (const r of Object.values(this.routes)) r.dispose();
  }
}
