# Host memory — `/axiobyte/memory/host-memory/`

The dedicated page of the **Host Memory asset** (`host_memory` in
[`assets/library.yaml`](../../../assets/library.yaml)): the computer's main memory, shown in two layers kept
visibly apart — the physical memory modules, and a logical map of the address space they provide, with a
descriptor ring and packet buffers allocated in it.

The model is not here: it lives in the Three.js backend's memory domain
([`renderers/three/src/domains/memory/host-memory/`](../../../renderers/three/src/domains/memory/host-memory/)).
It is built to the Asset Library standard from scratch; it replaced the v1.1 `networking/HostMemory.js`, which has
been retired. This folder is only the page: `index.html` (layout and the About
content), `main.js` (boot, WebGL check, fonts), `app.js` (modes, picking, selection, camera, the console API),
`UI.js` (tooltip, the part/About panel) and `host-memory.css` (the page's additions to the shared styles).

## What it shows

- **Physical parts** — `dimm-0` and `dimm-1`, two generic memory modules: DRAM packages on both faces, the SPD
  chip, decoupling capacitors, the off-centre key notch, the latch notches, and 144 gold edge contacts per face.
  The contact edges are the asset's structural port, `memory_interface` — where the memory channels from the CPU
  arrive (through motherboard slots, which are not part of this asset).
- **Logical parts** — `address-space` (the map itself: the physical address space, low addresses on the left),
  and the regions allocated in it: `descriptor-region` (a ring of eight descriptors, head and tail marked, each
  pointing at a buffer), `packet-buffer-region` (twelve fixed-size buffers, eight posted, four free) and
  `other-memory` (kernel, applications, page cache, free pages). The map says on itself that it is a logical view
  and not to scale, and it is drawn as labelled tiles — never as a board or a chip.
- **Detail** — the DRAM packages, SPD chip, capacitors, contacts and markings, which are not selectable.

Nothing moves between assets here: there is no CPU, no NIC and no DMA in the scene. The pointers from descriptors
to buffers are addresses held in memory, drawn straight in the pointer colour, not transfers.

## Modes

| Mode | What happens | What can be picked |
| --- | --- | --- |
| Allocation (opens here) | The modules, with the address map laid out in front of them | everything |
| Physical | The map folds away; the modules alone | the two modules |

Selecting a logical part switches to Allocation and frames the part once the map has unfolded. The *Map* view
does the same. With reduced motion the map appears and folds instantly.

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| Hover | Highlight and tooltip |
| Click | Select, gentle zoom, info panel with where the part sits (CPU → channel → module, or driver → ring → NIC) |
| Esc / × | Clear selection |

Camera presets: Overview (with a portrait variant), Modules, Map. *About* opens the asset page's sections —
what host memory is, the physical modules and the allocated regions (each selectable), descriptor rings and
packet buffers, where it sits (linking to the CPU page), PCIe and DMA (linking to the PCIe and NIC pages, as a
conceptual relationship), the asset's registry metadata, and what is simplified.

Phones held upright use the same bottom-sheet behaviour as the NIC, PCIe and CPU pages: the selected part is
framed above the sheet, the sheet scrolls, choosing a preset closes it. Where the panel sits at the side the
image slides aside.

## Console API

```js
__AXIOBYTE__.select('descriptor-region')  // or 'dimm-0', 'dimm-1', 'address-space', 'packet-buffer-region', 'other-memory'
__AXIOBYTE__.setMode('physical')          // 'physical' | 'allocation'
__AXIOBYTE__.focus('map')                 // any preset or part id
__AXIOBYTE__.stats()                      // draw calls, triangles, contacts, slots, buffers
```
