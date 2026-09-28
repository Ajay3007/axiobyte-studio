# Network Interface Card — interactive

**Live:** <https://ajay3007.github.io/axiobyte/networking/nic/>

An interactive, fully procedural 3D model of a dual-port 10GBASE-T PCIe network interface card.
Every part is real geometry — PCB outline, traces, gold fingers, RJ45 jacks, heatsink fins,
bracket, SMD parts. There are no photo textures; canvas textures are used only for printed
markings (silkscreen, chip labels, the MAC sticker).

It is the web representation of the Networking/NIC concept. The model itself is not here: it
lives in the Three.js backend's networking domain
([`renderers/three/src/domains/networking/nic/`](../../../renderers/three/src/domains/networking/nic/)),
and the film [`s01e03-what-is-a-nic`](../../../episodes/s01e03-what-is-a-nic/) is rendered from the
very same world. This folder is only the page: `index.html`, `main.js` (boot, WebGL check,
fonts), `app.js` (picking, selection, camera, the console API) and `UI.js` (tooltip, info panel,
controls).

## Run it

```bash
abs web dev      # → http://localhost:5173/networking/nic/
```

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| Hover | Highlight and tooltip |
| Click | Select, gentle zoom, info panel |
| Esc | Clear selection |

Camera presets: Overview, Front, Top, Rear, PCIe. The heatsink's info panel has a *Lift heatsink*
action that reveals the PHY underneath. "AxioByte" in the top-left returns to the hub.

## Packet animation hooks

The foundation for the upcoming Packet flow mode. In the browser console:

```js
__AXIOBYTE__.demoRx()                   // port 1 → magnetics → PHY → controller → DMA → PCIe → RX queue
__AXIOBYTE__.demoTx(2)
__AXIOBYTE__.animatePacket({ from: 'rj45-1', to: 'nic-controller', duration: 1200 })
__AXIOBYTE__.focus('rj45')              // or 'controller', 'pcie', any component id
__AXIOBYTE__.stats()                    // draw calls, triangles, part count
```

Host-side stages (descriptor ring, mempool, worker core, application) are defined in
`@axiobyte/three/domains/networking/dataplane.js` with `host: true`, ready for their own scenes.
