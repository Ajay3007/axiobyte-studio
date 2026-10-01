# The AxioByte Asset Library — standard

AxioByte is moving from episode-specific visualisations to a library of **reusable technical
assets** that episodes, interactive pages and future renderers compose. This document is the
standard every asset follows. It is deliberately small: it names what must be true now and marks
everything else as an extension point, to be built when a real asset needs it.

| Document | What it covers |
| --- | --- |
| **this file** | definitions, architecture, the asset contract, quality tiers, composition, renderers, lifecycle, naming, the registry |
| [`web-page.md`](web-page.md) | the dedicated public page every production asset gets |
| [`qa-checklist.md`](qa-checklist.md) | the acceptance checklist, copied into each asset's review |
| [`nic.md`](nic.md) | how the NIC — the reference asset — maps onto this standard |
| [`roadmap.md`](roadmap.md) | the first assets to build, in order, with their URLs |
| [`composition.md`](composition.md) | the decisions and minimum contract for the first composition: ownership, connections, many-to-one anchors, facing |
| [`../../assets/library.yaml`](../../assets/library.yaml) | the registry: every asset that exists |

## 1. The reference

**The NIC is the reference asset.** Its Three.js model
(`renderers/three/src/domains/networking/nic/`) and its page
([`/axiobyte/networking/nic/`](https://ajay3007.github.io/axiobyte/networking/nic/)) set the bar
for geometry, materials, technical realism, part structure, interaction, cameras, the page and
its responsive behaviour. The question this standard answers is: *how does the discipline the NIC
shows become repeatable for every asset?*

The order of authority, highest first:

```text
1. the production NIC
2. AxioByte's renderer-agnostic architecture (ARCHITECTURE.md, CONCEPT-ARCHITECTURE.md)
3. this standard
4. future assets
```

**Explicitly excluded: `renderers/three/src/domains/networking/HostMemory.js`.** It was written
for v1.1 as a *semantic correction* inside the NIC experience — to show that descriptor rings
and packet buffers live in host RAM, not on the card. It is release-specific visualisation code,
not a library asset: nothing here copies its geometry, layout, visual language, abstraction level
or interaction model, and nothing is kept compatible with it for its own sake. Host memory has
been **rebuilt from this standard** as the `host_memory` asset (see the roadmap), the NIC page
shows the card in the host through the `nic_host` composition, and the file has been **retired**
(it remains in the released `experiences-v1.1.0`).

## 2. What an asset is — and what it is not

| | What it is | Example | Lives in |
| --- | --- | --- | --- |
| **Concept** | what a thing *is*, renderer-free: objectives, misconceptions, relations | `nic`, `phy`, `descriptor_ring`, `dma` | `concepts/library/` |
| **Asset** | a reusable technical *thing* with its own identity, version, parts, ports, renderers and page | NIC, CPU, PCIe, descriptor ring, mbuf | its renderer implementations + `assets/library.yaml` |
| **Part** | a meaningful, inspectable piece of **one** asset: its own id, metadata and anchors, no life outside that asset | the NIC's PHY, controller, RJ45 ports, heatsink | the asset's implementation (part id + part metadata) |
| **Detail** | geometry that makes an asset real but carries nothing a viewer inspects | the NIC's passives, VRM, crystal, JTAG header | the asset's implementation, never registered |
| **Composition** | several assets connected through their ports, to show a system | NIC + PCIe + host memory + RX ring + mbuf + CPU | the scene that builds it (a world, a shot, a page) |
| **Experience** | an interactive web page for one asset or one composition | `/axiobyte/networking/nic/` | `experiences/<domain>/<slug>/` |
| **Episode** | a narrated film that uses assets and compositions | `s01e03-what-is-a-nic` | `episodes/<id>/` |

### Asset or part?

An **asset** is a technical thing that exists and matters on its own: it has its own identity and
version, declares parts and ports, has renderer implementations, takes part in more than one
composition or episode, and — once production-grade — has its own page. A **part** is a
meaningful piece of exactly one asset: it has an id, metadata and anchors, a viewer can inspect it,
and it is versioned, shown and composed *through* its asset. A **detail** is geometry below the
level of meaning — it makes the asset look real and is not selectable.

Something becomes an asset only when **all three** hold; otherwise it is a part:

1. **It exists on its own.** In real systems it is a separate thing — manufactured, plugged,
   allocated, created or moved independently — not a piece of something else. *A PCIe slot, a
   DIMM, an mbuf that leaves its pool: yes. A PHY soldered to a card, a slot inside a ring: no.*
2. **It relates to more than its parent.** It connects to, or moves between, at least two other
   assets or compositions, so it needs ports of its own. *A packet crosses NIC, rings and buffers;
   a heatsink only ever relates to its card.*
3. **Content studies it alone.** A page, shot or lesson inspects it independently of its parent.
   *A descriptor ring (head, tail, polling): yes. A NIC's bracket: never.*

Two tie-breakers:

- **Contained things that move are assets; contained things that are structure are parts.**
  mbufs leave their mempool, so they are assets placed in the pool; a ring's descriptor slots never
  leave, so they are parts of the ring.
- **When in doubt, start as a part.** A part *graduates* when real content meets criterion 3: the
  new asset gets its own registry entry and page, and the parent keeps the part and its id, so
  nothing public breaks.

What does **not** make something an asset: having its own concept (the PHY has one, and is a
part), being technically important (the NIC controller), or having geometry reused elsewhere (RJ45
jacks also sit on switches — shared geometry goes in the hardware kit, `core/hardware/parts/`, not
in the registry). A named system of several assets — a NUMA node is a CPU plus its local memory —
is a **composition**, not an asset.

### Asset and concept

Every asset realises exactly one **primary** atomic concept (`concept:` in the registry), and its
parts may realise others: the NIC realises `nic`, and its parts realise `phy` and `magnetics`. Many
concepts are never assets — interactions, composites, and atomic concepts realised only as parts.

The asset **id defaults to its primary concept's id** (`nic`, `descriptor_ring`). A second asset
realising the same concept takes a qualified id: a future SmartNIC realises `nic` too, and would be
`nic_smartnic` (the example ARCHITECTURE.md §6 already uses). The concept stays the meaning; the
asset is one concrete, versioned depiction of it.

### Keeping them apart

Two rules:

- **Nothing flows upward.** An asset never imports a composition, experience or episode; a
  composition never imports an experience or episode. Episode names never appear in asset names
  (ARCHITECTURE.md §6 rule 3), and episode-only behaviour — narration cues, film-only overlays,
  a film's on-screen simplifications — stays in the episode or in an option the asset does not
  default to.
- **Interactions are not assets.** DMA, RSS, polling and zero-copy are *interactions*
  (CONCEPT-ARCHITECTURE.md): they have no silhouette and no actor of their own, and they reach
  the screen through their participants. They get **compositions** — and a composition may get
  an experience page — but never an asset entry. The *DMA engine* (a block inside the NIC
  controller) is a part of the NIC; *DMA* (the transfer) is an interaction between the NIC and
  memory.

"Asset" in this library means the reusable thing above. ARCHITECTURE.md §6 uses "source assets"
for versioned *files* (models, fonts, baked plates); a library asset may own such files, and the
two are recorded separately.

## 3. Architecture

```text
                        KNOWLEDGE MODEL                          ASSET LIBRARY
        concepts/library/*.yaml  design/language.yaml            assets/library.yaml
        (what it is, objectives,  (role, silhouette,             (identity, parts, ports,
         misconceptions, anchors,  motion, never)                  quality, status, route,
         relations)                                               implementations, episodes)
                  │                        │                                │
                  └───────── each asset realises one primary concept ───────┘
                                               │
                           RENDERER IMPLEMENTATIONS of the same asset
             ┌─────────────────────────┬───────────────┴──────────┬─────────────────────┐
     Three.js  (live)           Manim  (flat, iso)          Blender  (plate)       future
     renderers/three/src/       src/axiobyte_studio/        backends/blender/
       domains/<domain>/<asset>/  actors/ + backends/manim/   (baked, versioned plates)
             │
             ▼
     COMPOSITION  — assets joined port-to-port (a world/scene, a shot, a page)
             │
     ┌───────┴────────────────────────────┐
     ▼                                    ▼
 EXPERIENCE  experiences/<domain>/<slug>/  EPISODE  episodes/<id>/
     │  (one Vite build, one release)          (score, shots, beats)
     ▼
 WEBSITE  /axiobyte/<domain>/<slug>/  (pins a released experiences tarball)
```

What each layer owns:

- **Knowledge model** — *what a thing is*: concept id, objectives, misconceptions, semantic
  anchors, relations. Already exists and is renderer-free.
- **Visual grammar** — *how it reads*: colour role, silhouette, motion, forbidden depictions
  (`never:`). Already exists and is theme- and renderer-free.
- **Asset** — *the concrete reusable thing*: its parts, its ports, its versions, which renderers
  implement it, where its page is. New with this standard (`assets/library.yaml`).
- **Renderer implementation** — geometry, materials, anchors in a renderer's own terms. The
  semantic contract (ids, parts, ports) is identical across renderers; nothing Three.js-specific
  enters the registry.

## 4. The asset contract

### Required now

Every asset in `assets/library.yaml` declares, and `tests/unit/test_asset_library.py` enforces:

| Field | Rule |
| --- | --- |
| `id` | snake_case, unique, permanent. Defaults to the primary concept's id (`nic`, `descriptor_ring`); a second asset of the same concept takes a qualified id (§2). |
| `title`, `summary` | human names; the summary says what the thing *is*, in one sentence. |
| `version` | semver of the asset **contract** — id, parts, ports. A new part is minor; a renamed or removed part/port is major. Geometry polish that changes no contract is a patch. |
| `status` | `concept · prototype · production · released · deprecated` (§8). |
| `released_in` | the experiences release that shipped the entry's current version (`experiences-vX.Y.Z`) — set exactly when `status` becomes `released`. An earlier version's release is kept in a comment on the entry. |
| `quality` | `hero · standard · micro` (§5). |
| `concept` | the primary atomic concept in `concepts/library/` — the asset's meaning lives there, not here. |
| `parts` | the semantic part ids (kebab-case) every implementation exposes and every part-metadata table is keyed by. |
| `ports` | structural composition interfaces (§6): `id` (snake_case), `at` (`part.anchor` references), and `connects_to` (an asset or concept id) once the counterpart exists. |
| `implementations` | per renderer: `path`, `fidelity` (`flat · iso · plate · live`), and the entry points that renderer needs. |
| `route`, `experience` | for published assets: the public page (§7). A released asset without a page is not released. |
| `episodes` | the episodes that use it — the reverse index ARCHITECTURE.md's asset rules need. |
| `known_limitations` | stated honestly; a limitation not written down is a defect. |

Every **renderer implementation** meets the contract the Three.js backend already defines in
`core/ComponentRegistry.js`, generalised:

- **Parts** — each part id resolves to an object that can be hit-tested, framed and highlighted.
- **Anchors** — each part names its anchors (`in`, `out`, `center`, and specific ones such as
  `dma`) in the part's local space; ports refer to these, never to coordinates.
- **Part metadata** — one table keyed by part id with the NIC's shape: `name`, `designator`,
  `category`, `summary`, `description`, `details`, `actions`. The same text drives tooltips,
  inspect panels, film callouts and future lessons.
- **Camera presets** — named, evaluated at use time, fitted exactly to the geometry
  (`overview` is mandatory; the others as the asset needs them).
- **Interaction** — `select`, `highlight`, `reset` work through the registry, not through
  asset-specific UI code. Asset actions (e.g. *Lift heatsink*) are declared in part metadata.
- **Determinism** — no wall-clock reads; time is pushed in. A film frame is a pure function of its
  index.
- **Self-contained** — no network fetches at runtime; fonts and textures ship with the build.

### Extension points — not required yet

Named so that nobody invents an incompatible version of them, and built only when a real asset
needs one:

| Extension | What it would add | Build it when |
| --- | --- | --- |
| `isolate` interaction | show one part alone, dim the rest | a second asset needs it on its page |
| animation hooks | named, semantic animations (`packet.enter`, `heatsink.lift`) with start/stop/seek | a composition drives an asset's animation from outside |
| exploded view | a named preset that separates parts along declared axes | a hero asset needs it for a shot or its page |
| port geometry | a mated port's `facing` (composition.md); later its size | `facing` with the first composition; size when a composition needs it |
| per-part relations | `part → concept` links (the NIC controller *contains* the DMA engine) | pages or lessons need to navigate from a part to a concept |
| material slots | named material roles an asset exposes for theming | a second theme exists |
| asset locks | episodes pin exact asset versions (`assets.lock`, ARCHITECTURE.md §6) | two episodes need different versions of the same asset |
| redirects | `redirect_from` routes for renamed pages | the first route is renamed |

## 5. Quality tiers

Quality describes **how much geometric and visual fidelity** an asset carries. It is independent
of *fidelity* in `design/language.yaml`, which lists *which representations* exist (flat, iso,
plate, live) — a hero asset can have a flat Manim representation too.

| Tier | For | Bar |
| --- | --- | --- |
| **Hero** | flagship pages, close-up and cinematic shots, thumbnails | Holds up full-screen at any preset: real proportions, real sub-parts (pins, fins, contacts, labels), materials from the shared kit, no visible shortcuts. The NIC. |
| **Standard** | system diagrams, normal shots, compositions | Reads correctly at composition scale with a recognisable silhouette and correct proportions; close-ups are not its job. |
| **Micro** | small concepts that appear in quantity: packets, descriptors, cache lines, mbufs | Minimal geometry, maximum legibility; its state (empty, filled, done) is carried by the visual grammar, not detail. |

The semantics are **the same in every tier**: a micro descriptor has the same id, parts, ports
and metadata discipline as a hero NIC. A tier is validated by the QA checklist's visual section
at the scales that tier is used at — no polygon budgets until performance data asks for them.

## 6. Composition: ports, not coordinates

Assets connect through **named ports**, each resolved to a part anchor:

```text
NIC.pcie_connector  (pcie-connector.out)
        │
        ▼
PCIe.endpoint ── lanes ── PCIe.root_complex
                               │
                               ▼
                    CPU.pcie_root_complex  (lands.pcie)
                    CPU.memory_interface   (lands.memory)   ← driven by the CPU's memory controller
                               │
                               ▼   memory channels across the motherboard, to DIMM slots
                    HostMemory.memory_interface  (dimm-*.edge)
                               │
                    the DMA transfer (an interaction) ends in HostMemory's packet-buffer region
```

A port is a named contract resolved to one or more anchor points (the PCIe root complex side is
eight lane anchors, the CPU side one land field); anchor names are each asset's own. The board
between two ports — PCIe lanes, memory channels, slots — belongs to whichever asset models it
(the PCIe asset models its lanes) or to a future board asset; a composition must not invent it.

Who owns what between asset, composition and episode, how connections resolve (including
many-to-one anchors) and how ports face each other: [`composition.md`](composition.md).

A composition states *what connects to what*; each asset knows *where* its own ports are. That is
what lets the same NIC sit in the interactive page, a film shot and a future Manim diagram
without hand-placed XYZ. Today compositions are built in code (`scene.js`, a storyboard); the
registry already records each asset's ports so that later work — a declarative composition, the
Shot IR driving Three.js — has a contract to build on. **No composition engine is built now.**

**Ports are structure, not data flow.** A port is where an asset physically or logically
*attaches* to another asset — a card's edge connector into a slot, a cable into a jack, a ring
into a memory region. What *moves* between assets (a packet, a DMA write, a poll) is not a port:
it is an interaction or a composition's path, defined in the concept library (`dma`, `polling`)
and built by the composition. So the NIC has no "DMA port": its DMA engine is inside the
controller part (anchor `nic-controller.dma`), and the DMA write leaves the card through
`pcie_connector`. `connects_to` is declared once the counterpart exists as an asset or concept,
and left out until then.

## 7. Naming and routes

- **Asset id** — snake_case, permanent: `nic`, `cpu`, `host_memory`, `descriptor_ring`, `mbuf`.
- **Slug** — the id in kebab-case: `descriptor_ring` → `descriptor-ring`. Always derived, never
  chosen separately.
- **Public URL** — `/axiobyte/<domain>/<slug>/`, built from `experiences/<domain>/<slug>/`.
  URLs carry no version: a page always shows the asset version in the pinned experiences release,
  and the page states that version.
- **Two kinds of domain.** The **knowledge domain** is where a concept sits in the taxonomy
  (`net`, `compute`, `memory`, `io`, `os`, `data_plane`); it belongs to the concept and drives
  actors and visual grammar. The **navigation domain** is where a reader finds the page — the
  first segment of the URL, declared in `experiences/domains.json`: `networking`, `computing`,
  `memory`, `io`, `dataplane` (and later `os`, …). They are recorded in different places (the
  concept's `domain`; the asset's `route`) and are not required to match. By default the
  navigation domain is the readable form of the knowledge domain (`net → networking`,
  `compute → computing`, `memory`, `io`, `data_plane → dataplane`); an asset departs from it only
  where readers look elsewhere. The one case today is the NIC — knowledge domain `io`, navigation
  domain `networking` — and its URL is public and therefore permanent.
- **Aliases** — other names readers use ("network adapter") go in page text and search
  keywords, not in URLs. One asset, one URL.
- **Deprecation** — a released URL is never removed. A renamed or superseded asset keeps its old
  route as a redirect (the `redirects` extension point, built with the first rename).

## 8. Lifecycle

```text
Concept ──► Prototype ──► Production ──► Released ──► Deprecated
```

| Status | Means | To enter it |
| --- | --- | --- |
| **concept** | an agreed idea, possibly with a registry entry | an atomic concept exists; id and navigation domain chosen |
| **prototype** | geometry exists; may be rough; not on the public site | parts and ports declared; one implementation renders |
| **production** | meets the standard; its page is built | the whole QA checklist passes, including the dedicated page |
| **released** | shipped in a tagged experiences release and served on the site | a release (`experiences-vX.Y.Z`) contains it and the website pin serves it |
| **deprecated** | superseded; still served for existing links | a successor exists; the route redirects or the page says what replaced it |

The dedicated webpage is an **acceptance criterion**, not an afterthought: an asset without its
page cannot be production.

## 9. The registry

`assets/library.yaml` is the smallest thing that answers *what assets exist, in which domain, at
which version, with which parts and ports, connecting to what, with which renderers, used by which
episodes, and where their pages are*. It is plain YAML in the repository — no database — and
`tests/unit/test_asset_library.py` checks every entry against the code: the concept exists, the
route follows §7 and its domain is declared, every implementation path exists, every part has
metadata, every port points at a declared part and a real anchor, published assets have a page,
episodes exist. An entry that drifts from the code fails CI.

Only assets that exist are registered; planned ones live in [`roadmap.md`](roadmap.md) until work
on them starts.

## 10. Adding an asset

1. Check the atomic concept exists (`concepts/library/`) and its visual grammar
   (`design/language.yaml`); add them first if not — the asset realises a concept, never the
   reverse.
2. Add a `prototype` entry to `assets/library.yaml`: id, concept, parts, ports, quality tier.
3. Build the implementation in its renderer's domain folder against the contract (§4), with
   part metadata in the NIC's shape.
4. Build its page under `experiences/<domain>/<slug>/` following [`web-page.md`](web-page.md).
5. Run [`qa-checklist.md`](qa-checklist.md); set `status: production` when it all passes.
6. Ship it in the next experiences release; set `status: released` and `released_in`.

An entry describes the asset's current version. When a released asset gains a new version, the entry
goes back to `production` (no `released_in`) until that version ships; the version that shipped, and
where, is recorded in a comment on the entry.
