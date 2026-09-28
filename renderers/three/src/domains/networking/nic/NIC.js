import * as THREE from 'three';
import { Kit } from '../Kit.js';
import { createPCB } from './PCB.js';
import { createSilkscreen } from './Silkscreen.js';
import { createTraces } from './Traces.js';
import { createPCIeConnector } from './PCIeConnector.js';
import { createRJ45Port } from './RJ45Port.js';
import { createHeatsink } from './Heatsink.js';
import { createController, createMagnetics, createPHY } from './Chips.js';
import { createComponents } from './Components.js';
import { createBracket } from './Bracket.js';
import { createZone } from './Zones.js';
import { NIC_METADATA } from './metadata.js';
import { MAGNETICS, PORT, PORTS, TOP } from './layout.js';

/**
 * Builds the complete dual-port 10GBASE-T card in board-local coordinates.
 * Returns plain data the scene layer can register: the model knows nothing
 * about raycasting, cameras or UI.
 */
export function createNIC() {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'nic';

  const pcb = createPCB(kit);
  const traces = createTraces(kit);
  const parts = createComponents(kit);
  const silk = createSilkscreen(kit, parts.marks);
  root.add(pcb.group, traces, silk, parts.group);

  const components = [];
  const leds = [];
  const add = (id, object, extra = {}) => {
    root.add(object);
    components.push({ id, object, meta: NIC_METADATA[id], ...extra });
  };

  const connector = createPCIeConnector(kit);
  add('pcie-connector', connector.group, { hitObjects: connector.hitObjects, anchors: connector.anchors });

  PORTS.forEach((p) => {
    const port = createRJ45Port(kit, { name: p.id });
    port.group.position.set(PORT.front, TOP, p.z);
    add(p.id, port.group, { anchors: port.anchors });
    leds.push({ material: port.leds[0].material, halo: port.leds[0].halo, pattern: 'link', phase: p.index * 1.7 });
    leds.push({ material: port.leds[1].material, halo: port.leds[1].halo, pattern: 'activity', phase: p.index * 13.1 });
  });

  MAGNETICS.zs.forEach((z, i) => {
    const m = createMagnetics(kit, i + 1, z);
    add(`magnetics-${i + 1}`, m.group, { anchors: m.anchors });
  });

  const phy = createPHY(kit);
  add('phy', phy.group, { anchors: phy.anchors });

  const heatsink = createHeatsink(kit);
  add('heatsink', heatsink.group, { anchors: heatsink.anchors });

  const controller = createController(kit);
  add('nic-controller', controller.group, { anchors: controller.anchors });

  const bracket = createBracket(kit);
  add('bracket', bracket.group, { anchors: bracket.anchors });

  const zones = {};
  for (const key of ['rx', 'tx']) {
    const z = createZone(kit, key);
    zones[key] = z;
    add(`${key}-queue`, z.group, { hitObjects: z.hitObjects, anchors: z.anchors, setHighlight: z.setHighlight });
  }

  parts.boardLeds.forEach((l, i) => {
    l.material.userData.noHighlight = true;
    leds.push({ material: l.material, pattern: i === 0 ? 'steady' : 'heartbeat', phase: 0, peak: 1.6 });
  });

  const traceMaterial = kit.material('solderMaskTrace');

  return {
    root,
    kit,
    components,
    leds,
    heatsink,
    zones,
    occluders: [pcb.board],
    stats: { passives: parts.group.userData.partCount },
    /** Ambient life: the copper under the mask breathes very slightly. */
    update(elapsed) {
      traceMaterial.emissiveIntensity = 0.03 + 0.025 * (0.5 + 0.5 * Math.sin(elapsed * 0.9));
    },
    dispose() {
      kit.dispose();
    },
  };
}
