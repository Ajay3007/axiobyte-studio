# The dedicated asset page

Every production asset gets its own public page. The page is not a demo: it is **the public,
interactive representation of the reusable asset**, and building it is part of the asset's
acceptance (see [README.md](README.md) §8). The NIC page —
[`/axiobyte/networking/nic/`](https://ajay3007.github.io/axiobyte/networking/nic/),
`experiences/networking/nic/` — is the reference.

## One standard, many pages

Every asset page is **the common standard below plus an experience designed for that asset**. The
standard fixes what every page must *do* and how well; it does not fix one layout. The NIC sets
the bar for inspection quality, camera work, responsiveness, educational clarity and polish — it
is not a template to reproduce mechanically. A descriptor ring's page may centre on its head and
tail moving; a packet's on what it carries; a CPU's on its cores and caches. Each page chooses its
own presets, modes and actions to suit its asset; each must meet every capability below, as well
as the NIC does.

## URL and files

```text
/axiobyte/<domain>/<slug>/            public URL (never versioned, never removed)
experiences/<domain>/<slug>/          index.html · main.js · app.js · UI.js · experience.json · README.md
```

`slug` is the asset id in kebab-case, `domain` is its navigation domain (README.md §7), and the folder
is discovered by the existing Vite build: adding a page adds a folder, not a build step. The
website's `/axiobyte/` hub and `/axiobyte/<domain>/` pages list it from the release manifest with
no website change.

## Required capabilities

What every asset page must do, shown with how the NIC page does it — the NIC's layout is one good
realisation of these capabilities, not the required one:

```text
┌──────────────────────────────────────────────────────────────┐
│ BRAND  AxioByte · <Domain> (→ hub)                           │
│        <Asset title> / <one-line subtitle>                   │
│                                                              │
│                    3D VIEW  (full viewport)                  │
│             orbit · pan · zoom · hover · click               │
│                                                    INSPECT   │
│                                                    PANEL     │
│  VIEWS  Overview · <presets>          MODES · Reset camera   │
└──────────────────────────────────────────────────────────────┘
```

| Capability | Required behaviour | How the NIC page does it |
| --- | --- | --- |
| **3D view** | the asset from its `overview` preset, intro move then still; orbit, pan, zoom | `camera.intro('overview')` |
| **Brand** | domain kicker linking back to the `/axiobyte/` hub; the asset's title and subtitle | "AxioByte · Networking", "3D NIC" |
| **Views** | one button per camera preset; the active one marked | Overview, Front, Top, Rear, PCIe |
| **Controls** | Reset camera always; modes only when a second mode exists (unbuilt modes shown disabled, never hidden-then-broken) | Hardware mode, In the host (the card in the `nic_host` composition), Packet flow (soon) |
| **Hover** | highlight plus a tooltip naming the part (`name`, `designator · category`) | |
| **Select** | highlight, gentle camera push toward the part, inspect panel | |
| **Inspect panel** | from part metadata: designator and category, name, summary, description, details table, the part's place on the asset's main path, part actions | "On the receive path", *Lift heatsink* |
| **Clear** | Esc, the panel's close button and Reset all clear the selection | |
| **Fallback** | a readable message when WebGL is unavailable | `#fallback` |

## Required sections that the NIC page does not have yet

The asset standard adds content every production page must eventually carry. The NIC page will
gain it in a future experiences release; nothing here changes the released page. The PCIe page
(`experiences/io/pcie/`) was the first to carry them, then the CPU page (`experiences/computing/cpu/`)
and the Host Memory page (`experiences/memory/host-memory/`), each in an *About* panel that shares the inspect panel's place — written in each page
for now; generating them waits until several production pages have proved the pattern.

| Section | Content | Source of truth |
| --- | --- | --- |
| **Overview** | what the asset is and where it sits in a system, in two or three sentences | concept objectives + registry `summary` |
| **Parts** | every semantic part, as a list that selects the part in the 3D view | registry `parts` + part metadata |
| **Technical concepts** | the concepts the asset embodies, with their objectives and the misconceptions they refute | `concepts/library/` |
| **Relationships** | its ports and what they connect to, linking to those assets' pages when they exist | registry `ports` |
| **Usage in systems** | the compositions, experiences and episodes that use it | registry `episodes` + composition pages |
| **Asset metadata** | id, version, quality tier, status, renderers, the experiences release that shipped it | `assets/library.yaml` |

Placement is a design decision for the first page that builds them, bounded by one rule: **the
3D view stays the page's first and primary surface**. The NIC page is a full-viewport
application; the new sections must not turn it into a scrolling article with a model on top. A
panel or drawer opened from the brand block is the expected shape; the decision is recorded in
the page's README when it is made.

Section content comes from the registry and the concept library at build time, not from text
written into each page — that is what keeps a hundred asset pages consistent.

## Responsive and accessibility requirements

All proven on the NIC page in v1.1 and required everywhere:

- **Portrait framing** — presets are evaluated at use time, and the `overview` preset has a
  portrait variant when the asset is wide.
- **Narrow screens** — controls wrap at 320 px; nothing overflows.
- **Phones held upright** — the inspect panel is a bottom sheet capped at about 40vh; the selected
  part is framed in the space above it; long content scrolls, with a fade that says so; choosing a
  preset closes the sheet.
- **Side panels** — on wide screens and short landscape screens the view slides so the part stays
  beside the panel.
- **Reduced motion** — `prefers-reduced-motion` makes camera moves instant and stops ambient
  animation.
- **Offline** — fonts are self-hosted, nothing is fetched from another origin at runtime, and
  every URL in the build is relative so it serves under any mount.
- **Keyboard** — Esc clears the selection; every control is a real button with focus styles.

## Acceptance for the page

The page part of [`qa-checklist.md`](qa-checklist.md): the smoke test loads it under `/axiobyte/`
with the asset's parts registered, draw calls issued, no console errors, no failed or external
requests; the phone and desktop matrix passes; `experience.json` describes the asset (`concept`,
`title`, `summary`, `episode`, `tags`); and the page's README says what it shows and how it
behaves.
