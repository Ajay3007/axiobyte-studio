# PCIe — `/axiobyte/io/pcie/`

The dedicated page of the **PCIe asset** (`pcie` in [`assets/library.yaml`](../../../assets/library.yaml)):
an interactive, procedural 3D model of the host side of a PCI Express link — an x8 slot on a section of
system board, its eight lanes of differential pairs, and the vias that take them toward the CPU's root
complex.

The model is not here: it lives in the Three.js backend's I/O domain
([`renderers/three/src/domains/io/pcie/`](../../../renderers/three/src/domains/io/pcie/)). This folder is
only the page: `index.html` (layout and the About content), `main.js` (boot, WebGL check, fonts),
`app.js` (picking, selection, camera, the console API), `UI.js` (tooltip, the part/About panel) and
`pcie.css` (the page's additions to the shared styles).

## What it shows

- **Physical parts** — the `slot` (98 contacts at 1.0 mm pitch, the key after contact 11), the
  `sideband` (contacts 1–11: power, reset, management; the reference clock just after the key), and
  `lane-0` … `lane-7`, each a pair on side B and a pair on side A, length-matched and dropping
  through vias. The contacts are laid out exactly as an x8 card's fingers, so the NIC fits.
- **One logical part** — the `link`: the eight lanes as one x8 link. It is drawn as an overlay in
  the interface accent, not as copper, and only while it is inspected (*Show link*), so the logical
  never reads as hardware.
- **Detail** — the board, stitching vias, mounting holes and silkscreen, which are not selectable.

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Right-drag / two-finger drag | Pan |
| Scroll / pinch | Zoom |
| Hover | Highlight and tooltip |
| Click | Select, gentle zoom, info panel with where the part sits (card → slot → lane → root complex) |
| Esc / × | Clear selection |

Camera presets: Overview, Top, Slot, Lanes, Side. *Show link* inspects the logical link. *About PCIe*
opens the asset page's sections — what PCIe is, its parts (each selectable), lanes and the link, the
endpoint and root complex, where AxioByte uses it, and the asset's registry metadata.

Phones held upright use the same bottom-sheet behaviour as the NIC page: the selected part is framed
above the sheet, the sheet scrolls, choosing a preset closes it. On any layout where the panel sits
at the side the image slides aside, because this asset's lanes run under that side of the screen.

## Console API

```js
__AXIOBYTE__.select('lane-3')   // or 'slot', 'sideband', 'link'
__AXIOBYTE__.focus('slot')      // any preset or part id
__AXIOBYTE__.stats()            // draw calls, triangles, lanes, contacts
```
