# The NIC, mapped onto the asset standard

The NIC is the reference asset. This page maps what exists (as released in
`experiences-v1.1.0`, commit `d525fc9`) onto [the standard](README.md): what already meets it,
what is missing, what should move, and what belongs to the page rather than the asset. **Nothing
here changes the released NIC**; every change below is future work, sized and ordered.

## One asset, six representations — now one identity

Before the registry, the NIC existed under six unconnected names. `assets/library.yaml` (entry
`nic`) now states they are one asset:

| Representation | Where | Fidelity / tier |
| --- | --- | --- |
| Concept `nic` | `src/axiobyte_studio/concepts/library/atomic/nic.yaml` | knowledge (domain `io`) |
| Visual grammar `nic` | `src/axiobyte_studio/design/language.yaml` | role `nic`, silhouette `board` |
| Three.js model | `renderers/three/src/domains/networking/nic/` | `live`, **hero** |
| Manim actor `nic` | `src/axiobyte_studio/actors/library.py`, `backends/manim/shapes.py` | `flat` |
| Blender model `nic_board` + plate `nic_board__turntable@1.0.0` | `backends/blender/scripts/bake_plate.py`, `assets/plates/` | `plate` (simplified board) |
| Page | `experiences/networking/nic/` → `/axiobyte/networking/nic/` | the reference page |

## What is an asset, a part or a detail — the rule applied

The [asset-or-part test](README.md#asset-or-part) applied to everything the NIC's Three.js model
builds. An asset needs all three of: *exists on its own*, *relates to more than its parent*,
*content studies it alone*.

| Element | Classification | Reason |
| --- | --- | --- |
| NIC | **Asset** | A card bought and installed on its own; attaches to a network and to PCIe; its own page and episode. |
| PHY | **Part** | Has its own concept (`phy`), but on this card it is a chip soldered to the board; it relates only to the card's magnetics and controller. Could graduate if a switch or SFP composition needs a PHY studied alone. |
| MAC / NIC controller | **Part** | The card's heart, but not a separate thing in any system the library shows. Its internal blocks — MAC, RSS engine, queue contexts, DMA engine — are regions of this part (anchor `dma`), not parts of their own. |
| RJ45 ports (`rj45-1`, `rj45-2`) | **Part** | Soldered jacks with the card as their only parent. Switches have RJ45 jacks too: that is shared **geometry** (moved to the hardware kit when the switch is built), not a shared asset. |
| Magnetics | **Part** | Has a concept (`magnetics`) and a misconception to refute, but is always the port's companion; studied through the NIC. |
| PCIe edge connector | **Part** | The card's side of PCIe. The slot and lanes are the **PCIe asset** and the root complex is inside the **CPU asset**; the card and the slot meet at the NIC's `pcie_connector` port. |
| Heatsink | **Part** | Relates only to the chip under it. Its *Lift heatsink* action is part behaviour. |
| Bracket | **Part** | Mounting hardware; relates only to the card and the chassis. |
| PCB | **Part — not yet registered** | The board is taught in its own film chapter (“controlled impedance”, “every trace”), so it is a meaningful part; today it is built as the unselectable occluder. Registering it is a future minor version of the NIC. |
| Status LEDs | **Detail** (port LEDs belong to the RJ45 part) | Carry meaning only through the port's metadata (“two LEDs”); not inspected on their own. |
| Traces, silkscreen, passives, VRM, crystal, flash, JTAG header, sticker | **Detail** | Make the board real; nothing a viewer selects. |
| On-card RX/TX queue zones (`rx-queue`, `tx-queue`) | **Neither — removed** | Legacy pre-v1.1 conceptual zones; the rings are host memory. They were never parts, and the code that drew them is gone (see below). |

Nine registered parts, one missing part (the PCB), and no candidate asset inside the card: the
rule keeps the NIC a single asset with a rich part structure, which is what makes its page work.

## Against the contract

| Contract item | NIC today | Status |
| --- | --- | --- |
| Identity, version, status, quality | registry entry `nic`, hero. 1.0.0 was released in `experiences-v1.1.0`; the entry is now 1.1.0, which adds `pcie_connector`'s facing and is released in `experiences-v1.2.0` | **met** (new) |
| Concept link | `nic` | **met** |
| Parts | 9 semantic parts registered by `createNIC()`: `rj45-1/2`, `magnetics-1/2`, `phy`, `nic-controller`, `heatsink`, `pcie-connector`, `bracket` | **met** |
| Part metadata | `metadata.js` `NIC_METADATA`, the reference shape | **met** |
| Anchors | per part: `in`, `out`, `center`; `dma` on the controller | **met** |
| Ports | `network_port` (`rj45-*.in`) and `pcie_connector` (`pcie-connector.out`) — structural attachments only; the DMA engine is inside the controller (`nic-controller.dma`) and the DMA write is an interaction, not a port | **met** (declared in the registry; code has the anchors) |
| Camera presets | `overview` (with a portrait variant), `front`, `top`, `rear`, `pcie`; exact frustum fit; click push-in | **met** |
| Interaction | hover, select, highlight, reset, Esc; *Lift heatsink* action | **met** — `isolate` not built (extension point) |
| Animation hooks | heatsink lift, LEDs, signal paths, packet routes — present but not named as asset hooks | **partial** |
| Determinism | film frames byte-identical across sessions; baseline 6/6 | **met** |
| Self-contained | self-hosted fonts, no external requests (smoke test) | **met** |
| Page anatomy | brand, 3D view, views, controls, tooltip, inspect panel, fallback, phone behaviour | **met** — the reference |
| Page sections (overview, parts, concepts, relationships, usage, metadata) | not built | **missing** |
| Known limitations | recorded in the registry | **met** (new) |

## Where the code does not yet match the asset/composition/experience split

| File | Today | Should become | Size |
| --- | --- | --- | --- |
| `nic/NIC.js`, `Zones.js`, `Silkscreen.js`, `metadata.js` | **done.** The `queuesOnCard` option, `Zones.js`, the zone silkscreen, the `rx-queue`/`tx-queue` metadata and the `rx-queue`/`tx-queue` dataplane stages are removed. Nothing had drawn them since v1.1, so no rendering changed and no contract changed (they were never registry parts); the asset version is unchanged. `layout.js`'s `ZONES` stays: they are board areas the traces fan into and the film frames | — | — |
| `nic/scene.js` | mixes two layers: the asset's presets and its heatsink action (**asset**), and registration/resolvers (**shared scene plumbing**). The host-memory region and PCIe·DMA link it used to draw (**composition**) were removed when `nic_host` replaced them | the asset exports its presets and actions (e.g. `nic/asset.js`); `scene.js` keeps only plumbing | small |
| `networking/HostMemory.js` | **retired.** A v1.1 semantic correction, never an asset; it remains in the released `experiences-v1.1.0` | replaced by the `host_memory` asset, composed with the NIC in `nic_host` — the NIC page's *In the host* view | done |
| `networking/dataplane.js` | the receive/transmit path (`STAGES`, `RX_PATH`) across NIC, PCIe, host memory, CPU — a **composition** definition living in the Three.js domain | the first declarative composition, once two assets exist to compose | later |
| `nic/SignalPaths.js`, `AnimationDirector.js`, `video.js` | film-target animation: signal pulses on trace groups, packet flights, on-card lanes | signal paths become named NIC animation hooks (`signal.front`, `signal.core`, `signal.host`); packet flights stay composition-level | when a second film uses the NIC |
| `experiences/networking/nic/` (`app.js`, `UI.js`, styles) | page shell: selection, inspect panel, bottom sheet, view shift, presets | stays **experience-specific**; the reusable parts (panel, bottom-sheet framing, preset handling) are extracted into a shared asset-page shell when the **second** asset page is built, not before | with the second page |

## Outside the Three.js model

- **Concept anchors.** `nic.yaml` lists anchors `[rx_queue, tx_queue, port, dma_engine]`, written
  before the v1.1 correction. The NIC holds queue *contexts*; the rings are host memory. The
  registry's ports already use the corrected model; renaming the concept anchors touches the
  Manim actor and plan checks, so it is a knowledge-model change of its own.
- **Fidelity vocabulary.** `design/language.yaml` lists `fidelity: [flat, iso, plate]`, which
  predates the Three.js backend; the NIC's best representation, `live`, is missing there. The
  registry uses `live`; adding it to the visual-language registry (and its validator in
  `design/theme.py`) is a small follow-up.
- **Blender.** `nic_board` is a simplified box-level board, far below the Three.js model. A hero
  Blender NIC is Tier-3 work and not scheduled; until then the Three.js NIC is the hero
  representation for pages and films.
- **Page content.** The six page sections in [`web-page.md`](web-page.md) are the NIC page's
  largest gap; the NIC is the natural first page to build them, as the reference for every later
  page.
