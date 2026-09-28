/**
 * Part vocabulary shared by every hardware model (NIC today; switch ASICs,
 * CPUs or DIMMs later). Small passives are batched into InstancedMeshes, so
 * the create* helpers register a placement on a PartBatch rather than
 * returning a mesh per component.
 */
export { createIC } from './ic.js';
export { PartBatch, PACKAGES } from './PartBatch.js';
export { createHeader, createCrystal, createLedPackage, createPanScrew, createPushPin } from './misc.js';

export const createResistor = (batch, x, z, opts) => batch.resistor(x, z, opts);
export const createCapacitor = (batch, x, z, opts) => batch.capacitor(x, z, opts);
export const createInductor = (batch, x, z, opts) => batch.inductor(x, z, opts);
export const createMosfet = (batch, x, z, opts) => batch.mosfet(x, z, opts);
export const createPolymerCap = (batch, x, z, opts) => batch.polymerCap(x, z, opts);
