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
fonts, the two views), `app.js` (the card: picking, selection, camera, the console API), `host.js` (the
card in the host, below), `UI.js` (tooltip, info panel, controls) and `nic.css`.

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

The card carries only hardware: ports, magnetics, PHY, controller, heatsink, PCIe connector,
bracket. The descriptor rings and packet buffers are not on it — they are in host memory.

## In the host

*Hardware mode* shows the card on its own, the NIC asset. *In the host* shows the same card seated in
the system — PCIe slot and lanes, CPU, host memory — with DMA carrying each packet into a buffer in
host memory. That view is the `nic_host` composition, built by the same function as its own page
([`/axiobyte/networking/nic-host/`](../nic-host/), linked from the view); `host.js` only connects it to
this page's panel. Switching modes disposes one world and builds the other. Until v1.1.0 this page drew
its own host-memory panel beside the card (`networking/HostMemory.js`); that stand-in is retired.

On phones held upright the info panel is a bottom sheet: the selected part is framed in the space
above it, the sheet scrolls when its content is long, and choosing a camera preset closes it.

## Packet animation hooks

The foundation for the upcoming Packet flow mode. In the browser console:

```js
__AXIOBYTE__.demoRx()                   // port 1 → magnetics → PHY → controller → DMA → PCIe
__AXIOBYTE__.demoTx(2)
__AXIOBYTE__.animatePacket({ from: 'rj45-1', to: 'nic-controller', duration: 1200 })
__AXIOBYTE__.focus('rj45')              // or 'controller', 'pcie', any component id
__AXIOBYTE__.stats()                    // draw calls, triangles, part count
```

Host-side stages (descriptor ring, mempool, worker core, application) are defined in
`@axiobyte/three/domains/networking/dataplane.js` with `host: true`; on the card a route ends (or starts)
at the PCIe connector, and the host side is the *In the host* view.
