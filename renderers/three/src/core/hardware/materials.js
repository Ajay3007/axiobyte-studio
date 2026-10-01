import * as THREE from 'three';

const std = (params) => new THREE.MeshStandardMaterial(params);
const phys = (params) => new THREE.MeshPhysicalMaterial(params);

/**
 * Named material recipes shared by every hardware model. Kit instantiates each
 * recipe once per build, so a board with hundreds of parts still uses ~25 materials.
 */
export const MATERIALS = {
  solderMask: () => phys({ color: 0x1f5f36, roughness: 0.46, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.32 }),
  // Copper under solder mask reads as a slightly lighter green; its emissive drives the subtle board glow.
  solderMaskTrace: () =>
    phys({ color: 0x2f8048, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.28, emissive: 0x39d17a, emissiveIntensity: 0 }),
  pcbEdge: () => std({ color: 0x75804e, roughness: 0.85 }),
  copper: () => std({ color: 0xd08d5a, metalness: 1, roughness: 0.32 }),
  gold: () => std({ color: 0xf0c060, metalness: 0.8, roughness: 0.2 }),
  tin: () => std({ color: 0xc9cdd2, metalness: 0.9, roughness: 0.36 }),
  nickel: () => std({ color: 0xc4c8cc, metalness: 1, roughness: 0.27 }),
  steel: () => std({ color: 0xb6bbc1, metalness: 0.95, roughness: 0.34 }),
  anodized: () => std({ color: 0x17191c, metalness: 0.55, roughness: 0.42 }),
  mold: () => std({ color: 0x18191b, metalness: 0, roughness: 0.62 }),
  moldGloss: () => phys({ color: 0x0b0c0e, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08 }),
  substrate: () => std({ color: 0x3b4a2e, roughness: 0.55 }),
  plastic: () => std({ color: 0x131416, roughness: 0.58 }),
  cavity: () => std({ color: 0x050506, roughness: 0.95 }),
  resistor: () => std({ color: 0x151516, roughness: 0.55 }),
  ceramic: () => std({ color: 0x9b8462, roughness: 0.62 }),
  ferrite: () => std({ color: 0x3a3b3e, metalness: 0.2, roughness: 0.52 }),
  aluminum: () => std({ color: 0xcdd1d5, metalness: 1, roughness: 0.3 }),
  paper: () => std({ color: 0xffffff, roughness: 0.72 }),
  pinWhite: () => std({ color: 0xe8e6de, roughness: 0.6 }),
  capMark: () => std({ color: 0x101113, roughness: 0.5 }),
  ledBody: () => std({ color: 0xf1efe9, roughness: 0.45 }),
  dimple: () => std({ color: 0x070708, roughness: 0.95 }),
  hole: () => std({ color: 0x0b0c0d, roughness: 1, side: THREE.DoubleSide }),
  pushPin: () => std({ color: 0x1b1c1f, roughness: 0.5 }),
  spring: () => std({ color: 0xaeb3b8, metalness: 1, roughness: 0.3 }),
  // System boards: a deep blue-black mask, so a card (green) standing in one of its slots reads
  // as a separate board. Traces under it follow the same rule as solderMaskTrace.
  systemMask: () => phys({ color: 0x0f1a25, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.42, envMapIntensity: 0.55 }),
  systemMaskTrace: () =>
    phys({ color: 0x2d5577, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.7, emissive: 0x6ec1ff, emissiveIntensity: 0 }),
  systemEdge: () => std({ color: 0x4a5560, roughness: 0.85 }),
  // Connector housings in light glass-filled nylon, as on many system boards.
  plasticLight: () => std({ color: 0xc9c5b8, roughness: 0.68, envMapIntensity: 0.7 }),
  // Bare silicon: the polished back of a die, dark with a faint metallic sheen.
  silicon: () => phys({ color: 0x262b35, metalness: 0.55, roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.1 }),
  // The base of a logical view (an address map, a data structure): dark and matte, so it reads as
  // a diagram and never as a board, a chip or any other hardware.
  schematicBase: () => std({ color: 0x151a22, metalness: 0, roughness: 0.9, envMapIntensity: 0.4 }),
};
