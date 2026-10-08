# Descriptor ring — `/axiobyte/memory/descriptor-ring/`

The dedicated page of the **Descriptor Ring asset** (`descriptor_ring` in
[`assets/library.yaml`](../../../assets/library.yaml)): the circular array of descriptors a driver allocates in
host memory for one NIC queue. Each descriptor holds a buffer's address and a status — never the packet bytes.

The model is not here: it lives in the Three.js backend's memory domain
([`renderers/three/src/domains/memory/descriptor-ring/`](../../../renderers/three/src/domains/memory/descriptor-ring/)).
This folder is only the page: `index.html` (layout and the About content), `main.js` (boot, WebGL check, fonts),
`app.js` (picking, selection, camera, the console API), `UI.js` (tooltip, the part/anchor/About panel) and
`descriptor-ring.css` (the page's additions to the shared styles).

## What it shows

- **The part** — `descriptors`: eight descriptor slots, D0 to D7, arranged in a ring and used clockwise (seen from
  above), with arrows printed outside the ring for the order of use and the wrap from the last back to the first.
  Each slot carries a field card — *buffer address →* in the pointer's colour, *length · status* — a schematic
  layout with no values, so no descriptor is shown filled, posted or done. One part: picking any slot selects the
  descriptors; a single descriptor is a slot of that part, never a part or asset of its own.
- **The anchors** — `head` and `tail`, printed on the base inside the ring, each pointing out at its slot (D2 and
  D6). They are positions, not parts — indices kept in NIC registers and driver variables — and they are
  inspectable so the page can explain them. Their positions are illustrative; nothing moves.
- **Detail** — the schematic base and what is printed on it (the ring's name, "never the packet bytes", the order
  of use, "logical view · not to scale"). Not selectable.

No buffers, mbufs, NIC, PCIe or DMA are drawn. The ring may reside in host memory's `descriptor-region` and its
descriptors refer to `packet-buffer-region` (registry `resides_in` and `refers_to`); the page explains both in
About. The [NIC to host memory](../../networking/nic-host/) system composes one ring, `rx_ring`, with both declared.

## Views and controls

Camera presets: **Overview** (with a portrait variant), **Ring** (from above), **Descriptor** (one representative
descriptor, D0, up close). The page has no modes — the ring has no second state to show — so the controls are the
views and *Reset camera*.

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| Hover | Highlight and tooltip |
| Click | Select, gentle zoom, info panel with where it sits |
| Esc / × | Clear selection |

*About* opens the asset page's sections — what a descriptor ring is, its part and anchors (each selectable), what a
descriptor holds, head and tail, where it lives (linking to the Host Memory page), what it refers to and how that
differs from DMA (linking to the NIC to host memory system), the concept, the asset's registry metadata, and its
scope. Phones held upright use the same bottom-sheet behaviour as the other asset pages; where the panel sits at the
side the image slides aside. With reduced motion, camera moves are instant; there is no ambient animation.

## Console API

```js
__AXIOBYTE__.select('descriptors')   // or 'head', 'tail'
__AXIOBYTE__.focus('descriptor')     // any preset ('overview', 'ring', 'descriptor') or 'descriptors' / 'head' / 'tail'
__AXIOBYTE__.stats()                 // descriptors, draw calls, triangles
```
