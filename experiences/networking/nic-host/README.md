# NIC to host memory — `/axiobyte/networking/nic-host/`

The page of the first **composition**, `nic_host`: four library assets — `nic`, `pcie`, `cpu` and
`host_memory` — placed and connected as one system, with DMA drawn over them as an interaction. It is
not an asset and adds no hardware; each asset is the same model as on its own page.

- Contract: [`assets/compositions/nic_host.yaml`](../../../assets/compositions/nic_host.yaml)
  (instances, explicit placement, connections, the DMA interaction), following
  [`docs/asset-library/composition.md`](../../../docs/asset-library/composition.md).
- Three.js implementation:
  [`renderers/three/src/compositions/nic_host/`](../../../renderers/three/src/compositions/nic_host/) —
  `composition.js` (builds the assets from their model entries, places them, resolves the connections,
  draws the routes and the DMA flow), `world.js` (engine, lights, registry, the system camera),
  `metadata.js` (what the composition says about its instances, routes and DMA) and `contract.json`
  (the runtime copy of the contract, kept identical by `tests/unit/test_compositions.py`).
- This folder is only the page: `index.html`, `main.js`, `app.js`, `UI.js`, `nic-host.css`.

## What it shows

- **The assets, placed at true scale.** The NIC stands in the PCIe slot (contact 1 on pin 1, its edge on
  the slot floor); the PCIe board's lanes run toward the CPU; host memory sits on the CPU's memory side.
  No board is drawn: the motherboard is not an asset.
- **Three connections.** The card's edge in the slot (a *mate*: the parts touch). **PCIe x8** — the eight
  lane vias bundled into the CPU's one PCIe land field. **Memory channels** — the CPU's memory land field
  fanning out to both modules' edge contacts. Both routes are schematic links, never copper.
- **DMA.** Packet-coloured pulses travel from the NIC's DMA engine, through its edge connector and the
  slot, along the lanes and the PCIe route, *under* the CPU package from the root-complex side to the
  memory-controller side, along the memory channels and into a posted packet buffer on the host-memory
  map. It passes under the package, never over the cores: no core copies the bytes.

## Interaction

| Input | Action |
| --- | --- |
| Hover / click a part | Highlight, tooltip, gentle zoom, the part's own metadata with its asset named |
| Click an asset's name | The whole asset highlighted and framed, with a link to its own page |
| Click a route or the DMA label | The connection or interaction highlighted and explained |
| Esc / × | Clear selection |

Views: **System**, **PCIe path**, **Memory path**, **DMA** — the composition's own system camera, not
any asset's. *DMA flow* shows or hides the interaction; *Reset camera* returns to the system view with
DMA on. With reduced motion the pulses stand still along the path. Phones held upright use the bottom
sheet of the asset pages.

## Console API

```js
__AXIOBYTE__.select('route.pcie')   // a part ('cpu.die'), an asset ('memory'), 'route.memory', 'interaction.dma'
__AXIOBYTE__.focus('memory-path')   // 'system' | 'pcie-path' | 'memory-path' | 'dma', or any id
__AXIOBYTE__.setDma(false)
__AXIOBYTE__.stats()                // instances, connections, draw calls, triangles
```
