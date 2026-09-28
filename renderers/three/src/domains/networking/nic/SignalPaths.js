import * as THREE from 'three';
import { CONTROLLER, MAGNETICS, PHY, PORT, PORTS, TOP, PCIE } from './layout.js';

/**
 * Glowing signal routes laid over the real board routing. The PCB section
 * needs to show that the copper is a signal path, not decoration, and the
 * packet sections need the route the packet is about to take — but the card's
 * traces are one merged mesh with one material, so there is nothing per-route
 * to light. These ribbons sit 0.5 mm above the mask and follow the same
 * layout constants the traces are built from.
 *
 * Fully deterministic: brightness and the travelling pulse are functions of
 * the video clock only.
 */

const y0 = TOP + 0.05;

/** Routes in board-local (x, z), matching Traces.js. */
function routes() {
  const p1 = PORTS[0];
  const p2 = PORTS[1];
  const portOut = PORT.front + PORT.depth;
  const magL = MAGNETICS.x - MAGNETICS.w / 2 - 0.12;
  const magR = MAGNETICS.x + MAGNETICS.w / 2 + 0.12;
  const phyL = PHY.x - PHY.size / 2;
  const phyR = PHY.x + PHY.size / 2;
  const ctlL = CONTROLLER.x - CONTROLLER.size / 2 - CONTROLLER.leadLen;
  const ctlR = CONTROLLER.x + CONTROLLER.size / 2;
  const ctlB = CONTROLLER.z + CONTROLLER.size / 2 + CONTROLLER.leadLen;

  return [
    {
      key: 'port1',
      group: 'front',
      points: [
        [portOut, p1.z],
        [magL, p1.z],
        [magR, p1.z],
        [phyL - 0.5, p1.z],
        [phyL, PHY.z - 0.5],
      ],
    },
    {
      key: 'port2',
      group: 'front',
      points: [
        [portOut, p2.z],
        [magL, p2.z],
        [magR, p2.z],
        [phyL - 0.5, p2.z],
        [phyL, PHY.z + 0.5],
      ],
    },
    {
      key: 'phy-mac',
      group: 'core',
      points: [
        [phyR, PHY.z - 0.35],
        [phyR + 1.2, PHY.z - 0.35],
        [ctlL - 0.9, CONTROLLER.z - 0.4],
        [ctlL, CONTROLLER.z - 0.4],
      ],
    },
    {
      key: 'phy-mac-b',
      group: 'core',
      points: [
        [phyR, PHY.z + 0.35],
        [phyR + 1.2, PHY.z + 0.35],
        [ctlL - 0.9, CONTROLLER.z + 0.4],
        [ctlL, CONTROLLER.z + 0.4],
      ],
    },
    {
      key: 'pcie',
      group: 'host',
      points: [
        [CONTROLLER.x + 0.3, ctlB],
        [CONTROLLER.x + 0.3, PCIE.pairs[3].laneZ],
        [PCIE.pairs[0].targetX, PCIE.pairs[3].laneZ + 0.35],
        [PCIE.pairs[0].targetX - 1.1, 6.95],
      ],
    },
    {
      key: 'pcie-b',
      group: 'host',
      points: [
        [ctlR, CONTROLLER.z + 0.6],
        [ctlR + 0.7, CONTROLLER.z + 0.6],
        [ctlR + 0.7, PCIE.pairs[7].laneZ],
        [PCIE.pairs[7].targetX, PCIE.pairs[7].laneZ + 0.3],
        [PCIE.pairs[7].targetX - 0.4, 6.95],
      ],
    },
  ];
}

/** Flat ribbon along a polyline, carrying normalised arc length in `aU`. */
function ribbon(points, width) {
  const pos = [];
  const us = [];
  const idx = [];
  const lens = [0];
  for (let i = 1; i < points.length; i++) {
    lens.push(lens[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = lens.at(-1) || 1;

  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let nx = -(next[1] - prev[1]);
    let nz = next[0] - prev[0];
    const l = Math.hypot(nx, nz) || 1;
    nx = (nx / l) * (width / 2);
    nz = (nz / l) * (width / 2);
    pos.push(points[i][0] - nx, y0, points[i][1] - nz);
    pos.push(points[i][0] + nx, y0, points[i][1] + nz);
    const u = lens[i] / total;
    us.push(u, u);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1));
  g.setIndex(idx);
  return { geometry: g, length: total };
}

const VERT = /* glsl */ `
  attribute float aU;
  varying float vU;
  void main() {
    vU = aU;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOn;      // 0..1 overall brightness of this route
  uniform float uHead;    // 0..1 position of the travelling pulse
  uniform float uPulse;   // 0..1 strength of the pulse
  varying float vU;
  void main() {
    float base = 0.22 * uOn;
    float d = abs(vU - uHead);
    d = min(d, 1.0 - d);
    float band = exp(-pow(d / 0.055, 2.0)) * uPulse;
    // Trailing comet so direction reads clearly.
    float behind = clamp((uHead - vU), 0.0, 1.0);
    float tail = exp(-behind / 0.16) * 0.35 * uPulse;
    float a = clamp(base + band + tail, 0.0, 1.4) * uOn;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.7 + a), a);
  }
`;

export function createSignalPaths({ color = 0x6ec1ff, width = 0.075 } = {}) {
  const group = new THREE.Group();
  group.name = 'signal-paths';
  group.renderOrder = 4;

  const items = routes().map((r) => {
    const { geometry, length } = ribbon(r.points, width);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOn: { value: 0 },
        uHead: { value: 0 },
        uPulse: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `signal-${r.key}`;
    mesh.visible = false;
    group.add(mesh);
    return { ...r, mesh, material, length };
  });

  return {
    group,
    keys: items.map((i) => i.key),
    groups: [...new Set(items.map((i) => i.group))],
    /** levels: { [key|group]: 0..1 }, head/pulse drive the travelling highlight. */
    setState(levels = {}, { head = 0, pulse = 0 } = {}) {
      for (const it of items) {
        const on = levels[it.key] ?? levels[it.group] ?? levels.all ?? 0;
        it.mesh.visible = on > 0.004;
        it.material.uniforms.uOn.value = on;
        it.material.uniforms.uHead.value = head;
        it.material.uniforms.uPulse.value = pulse;
      }
    },
    dispose() {
      items.forEach((i) => {
        i.mesh.geometry.dispose();
        i.material.dispose();
      });
      group.removeFromParent();
    },
  };
}
