# NIC to host memory — `/axiobyte/networking/nic-host/`

The page of the first **composition**, `nic_host`: six library assets — `nic`, `pcie`, `cpu`,
`host_memory`, the RX descriptor ring (`rx_ring`, a `descriptor_ring`) and a mempool (`pool`) — placed
as one system, the first four connected, with DMA drawn over them as an interaction. It is
not an asset and adds no hardware; each asset is the same model as on its own page.

- Contract: [`assets/compositions/nic_host.yaml`](../../../assets/compositions/nic_host.yaml)
  (instances, explicit placement, connections, residence, references, the DMA interaction), following
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
  memory-controller side, along the memory channels and into the packet-buffer region of the host-memory
  map — the interaction's target, `nic → memory.packet-buffer-region`. It passes under the package, never
  over the cores: no core copies the bytes.
- **The RX descriptor ring.** The descriptor-ring asset, at its own size, lying in front of the memory
  map beneath its label ("resides in host memory · descriptor region"). The contract says it *resides*
  in host memory's descriptor region and its descriptors *refer* to the packet-buffer region; neither is
  drawn as a link, and the DMA path does not pass through it. Host memory is built without its own
  illustrative ring here, so there is one ring. Selecting it, or its descriptors, works like any asset.
- **The mempool — a prototype.** The mempool asset (`status: prototype`, no page of its own), at its own size, lying in front of host memory's left end beside
  the ring, beneath its label ("resides in host memory · packet-buffer region"). Its twelve tiles are its
  one part, `elements`, each an mbuf with its buffer; no individual mbuf or buffer is instantiated. Host
  memory is built without its illustrative buffers here, and the DMA path ends at the packet-buffer
  region itself — not on the pool, which no interaction names. Its panel and the About text name it as a
  prototype: it ships inside this composition without being released as an asset
  ([`docs/asset-library/README.md`](../../../docs/asset-library/README.md) §8).

## Receive path

*Receive path* starts a six-step walkthrough of one received packet, told over the system above:
**descriptor** (a descriptor holds a free buffer's address) → **buffer** (that buffer, in the
packet-buffer region) → **pool element** (where it comes from: an mbuf with its buffer) → **DMA** (the
NIC writes the bytes into the buffer the descriptor named) → **mbuf** (software's metadata record for
the same buffer) → **done**. Steps 1–3 are the state before the packet arrives; step 4 is the arrival.
Back, Next and Exit step through it; selecting a part, *Reset camera* or *Receive path* again ends it.

It is presentation only (`renderers/three/src/compositions/nic_host/walkthrough.js`): it frames, outlines
and highlights existing parts, and shows the DMA flow for its step. It adds no component, no
relationship and no line between assets, and leaves the contract and the DMA path as they are. The
descriptor and pool element it outlines — the ring's representative slot and the pool's first element —
are an illustrative pair chosen to explain, not a static binding: the page says so beside every step.

## Interaction

| Input | Action |
| --- | --- |
| Hover / click a part | Highlight, tooltip, gentle zoom, the part's own metadata with its asset named |
| Click an asset's name | The whole asset highlighted and framed, with a link to its own page |
| Click a route or the DMA label | The connection or interaction highlighted and explained |
| Esc / × | Clear selection |
| Receive path | Start or end the walkthrough (Back · Next · Exit) |

Views: **System**, **PCIe path**, **Memory path**, **DMA** — the composition's own system camera, not
any asset's. *DMA flow* shows or hides the interaction; *Reset camera* returns to the system view with
DMA on. With reduced motion the pulses stand still along the path. Phones held upright use the bottom
sheet of the asset pages.

## Console API

```js
__AXIOBYTE__.select('route.pcie')   // a part ('cpu.die'), an asset ('memory'), 'route.memory', 'interaction.dma'
__AXIOBYTE__.focus('memory-path')   // 'system' | 'pcie-path' | 'memory-path' | 'dma', or any id
__AXIOBYTE__.setDma(false)
__AXIOBYTE__.walk.start()           // the receive path; also walk.next(), .back(), .exit(), .state()
__AXIOBYTE__.stats()                // instances, connections, draw calls, triangles
```
