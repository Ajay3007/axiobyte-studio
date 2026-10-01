# CPU — `/axiobyte/computing/cpu/`

The dedicated page of the **CPU asset** (`cpu` in [`assets/library.yaml`](../../../assets/library.yaml)):
an interactive, procedural 3D model of a generic desktop processor package — the heat spreader, the
substrate, the silicon die and the contact lands underneath — with the inside of the die drawn as four
conceptual regions.

The model is not here: it lives in the Three.js backend's computing domain
([`renderers/three/src/domains/computing/cpu/`](../../../renderers/three/src/domains/computing/cpu/)). This
folder is only the page: `index.html` (layout and the About content), `main.js` (boot, WebGL check, fonts),
`app.js` (modes, picking, selection, camera, the console API), `UI.js` (tooltip, the part/About panel) and
`cpu.css` (the page's additions to the shared styles).

## What it shows

- **Physical parts** — the `ihs` (integrated heat spreader, laser-marked as an educational model), the
  `substrate` (with its socket-key notches, pin-1 mark and capacitors), the `die` and the `lands` on the
  underside. The lands carry two labelled fields: where the memory channels and the PCIe lanes leave the
  package — the asset's two structural ports, `memory_interface` and `pcie_root_complex`.
- **Conceptual regions** — `cores`, `cache`, `memory-controller` and `io` (PCIe root complex), drawn on the
  die only while the lid is lifted, and labelled *Conceptual* everywhere. They are a teaching layout, not
  any product's floorplan; the page makes no vendor claim and no core-count claim.
- **Detail** — capacitors, the sealant bead, the marking and the pin-1 triangle, which are not selectable.

## Modes

| Mode | What happens | What can be picked |
| --- | --- | --- |
| Package | The CPU as it ships | heat spreader, substrate |
| Inside | The lid lifts and slides aside; the regions appear on the die | lid, substrate, die, the four regions |
| Underside | The package turns over; the memory and PCIe fields appear | substrate, lands |

Selecting a part switches to the mode that shows it and frames the part once the motion has finished.
With reduced motion the modes switch instantly.

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| Hover | Highlight and tooltip |
| Click | Select, gentle zoom, info panel with where the part sits (heat path, memory hierarchy, or cores → root complex → PCIe → card) |
| Esc / × | Clear selection |

Camera presets: Overview, Top, Side (the Inside mode opens on the die). *About* opens the asset page's
sections — what a CPU is, its physical structure, what is inside (each part selectable), a core, cache,
the memory interface, PCIe and I/O (linking to the PCIe and NIC pages), the asset's registry metadata, and
its limitations.

Phones held upright use the same bottom-sheet behaviour as the NIC and PCIe pages: the selected part is
framed above the sheet, the sheet scrolls, choosing a preset closes it. Where the panel sits at the side
the image slides aside.

## Console API

```js
__AXIOBYTE__.select('io')          // or 'ihs', 'substrate', 'lands', 'die', 'cores', 'cache', 'memory-controller'
__AXIOBYTE__.setMode('underside')  // 'package' | 'inside' | 'underside'
__AXIOBYTE__.focus('top')          // any preset or part id
__AXIOBYTE__.stats()               // draw calls, triangles, lands
```
