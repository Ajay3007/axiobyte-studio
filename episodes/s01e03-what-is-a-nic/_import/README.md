# 3D NIC · AxioByte

An interactive, fully procedural 3D model of a dual-port 10GBASE-T PCIe network interface card, built with Three.js and Vite. Every part is real geometry: the PCB outline, traces, gold fingers, RJ45 jacks, heatsink fins, bracket and SMD parts. There are no photo textures. Canvas textures are used only for printed markings: silkscreen, chip labels and the MAC sticker.

It is the first scene of the AxioByte visualization engine and is structured so later lessons (packet flow, DMA, descriptor rings, DPDK mempools, RSS, NUMA) plug into the same parts.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve dist/ locally
```

## Deploy to GitHub Pages

`vite.config.js` uses a relative base (`./`). The same build therefore works at either URL shape with no changes:

- **User site:** repo named `Ajay3007.github.io`, served at `https://Ajay3007.github.io/`.
- **Project site:** any other repo name, e.g. `nic-3d`, served at `https://Ajay3007.github.io/nic-3d/`.

The included workflow `.github/workflows/deploy.yml` builds and publishes on every push to `main`. To set it up:

1. Push the project to GitHub. Make sure `package-lock.json` is committed, because the workflow runs `npm ci`.
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site URL appears in the workflow summary.

If you prefer an absolute base, build with `BASE_PATH`:

```bash
BASE_PATH=/ npm run build          # user site (Ajay3007.github.io)
BASE_PATH=/nic-3d/ npm run build   # project site (repo "nic-3d")
```

To do the same in CI, add `env: { BASE_PATH: /nic-3d/ }` to the build step.

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| Hover | Highlight and tooltip |
| Click | Select, gentle zoom, info panel |
| Esc | Clear selection |

Camera presets: Overview, Front, Top, Rear, PCIe. The heatsink's info panel has a Lift heatsink action that reveals the PHY underneath.

## Architecture

```
src/
  engine/        rendering core: renderer, lights, stage, camera presets, tweens (scene-agnostic)
  hardware/      procedural models
    parts/       reusable part vocabulary: createIC, createResistor, createCapacitor,
                 createInductor, createMosfet, createPolymerCap, header, crystal, LED, screws
    nic/         NIC model: layout.js (single source of truth, cm), PCB, traces, ports,
                 heatsink, chips, bracket, zones, metadata
  interaction/   ComponentRegistry (the contract), Highlighter, InteractionManager (raycast)
  concepts/      dataplane.js: RX/TX stages, independent of any 3D model
  animation/     LedController, PacketAnimator
  scenes/        nicScene.js: glues the model into the engine (registration, presets, actions)
  ui/            DOM tooltip, info panel, controls
```

The layers build on each other in this order: engine, hardware, interaction, concepts, animation, UI. Each layer only talks to the ones below it.

- **ComponentRegistry** is the contract every future feature uses. Each component has an `id`, `meta` (`{ id, name, category, description, … }`), hit meshes, a bounding object for camera framing, and named anchors (`in`, `out`, `center`, `dma`) for animations.
- **Performance.**
  - Passives are batched into `InstancedMesh`es, one per sub-part per package.
  - Geometries and materials are cached per build in `Kit`.
  - Traces are merged into a single mesh.
  - Picking runs at most once per frame and only after the pointer or camera moves.
  - The whole card renders in about 190 draw calls.
- **Accessibility.** `prefers-reduced-motion` makes camera moves instant and keeps LEDs steady.

## Packet animation hooks

These hooks are the foundation for the upcoming Packet flow mode. Try them in the browser console:

```js
__AXIOBYTE__.demoRx()                   // port 1 → magnetics → PHY → controller → DMA → PCIe → RX queue
__AXIOBYTE__.demoTx(2)
__AXIOBYTE__.animatePacket({ from: 'rj45-1', to: 'nic-controller', duration: 1200 })
__AXIOBYTE__.focus('rj45')              // or 'controller', 'pcie', any component id
__AXIOBYTE__.stats()                    // draw calls, triangles, part count
```

In code:

```js
import { RX_PATH, hardwareRoute } from './concepts/dataplane.js';
await packets.animateRoute(hardwareRoute(RX_PATH, { port: 1 }));
```

Host-side stages (descriptor ring, mempool, worker core, application) are already defined in `concepts/dataplane.js` with `host: true`. They are ready for their own scenes.

## Adding a new hardware model

1. Build it from `hardware/parts` inside a new `hardware/<device>/` folder, using a `Kit`.
2. Return `{ root, components: [{ id, object, meta, anchors }] }`.
3. Add a scene module under `scenes/` that registers the components and defines camera presets.

Hover, selection, the info panel, camera focus and packet animation then work without further changes.

## Video mode

The same NIC also drives a timeline-driven 1920x1080 film, *"What Is a NIC?"*,
built from the recorded voiceover in `content/nic/`:

```bash
npm run video    # preview with transport controls and audio  -> /video.html
npm run render   # final/nic-video.mp4  (1080p, 30 fps, H.264 + AAC)
```

The interactive page is unchanged. Both modes build the card through
`src/scenes/nicWorld.js`, so there is one model, one set of camera presets and
one packet system across both. See **[README-video.md](README-video.md)**.
