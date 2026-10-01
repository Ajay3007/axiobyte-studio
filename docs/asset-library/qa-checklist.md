# Asset QA checklist

Copy this list into the review of every new asset (and every major version of an existing one).
An asset reaches `production` only when every applicable line is checked, with the evidence
named. "Not applicable" is allowed; it must say why. The bar is the NIC's.

Tools referred to below exist in the repository: `npm test -w @axiobyte/three`, `npm run build`,
`npm test -w @axiobyte/experiences` (the smoke test), `pytest` (including
`tests/unit/test_asset_library.py`), and for film use
`renderers/three/tools/check-determinism.mjs` and `render.mjs --stills`.

## Technical accuracy

- [ ] The asset realises an atomic concept in `concepts/library/`, and nothing it shows
      contradicts that concept's objectives or misconceptions.
- [ ] Terminology is the industry's own (a reviewer from the field would use the same words).
- [ ] Every visible structure is where it physically is — nothing shown on or in the asset that
      lives elsewhere in the system (the v1.1 lesson: descriptor rings are host memory, not PCB).
- [ ] Parts that are simplifications are called simplifications in their metadata
      (e.g. `'120-lead QFP (simplified)'`).

## Geometry

- [ ] Proportions and relative scale match the real object (checked against a datasheet or photo).
- [ ] No z-fighting, clipping or unintended intersections at any preset or during any action.
- [ ] Normals and topology render correctly under the shared lighting; no dark or inverted faces.
- [ ] Legible at the scale its quality tier is used at (hero: full-screen close-ups; standard:
      composition scale; micro: in quantity).
- [ ] Batched where repeated (instanced parts), so draw calls stay proportionate.

## Materials

- [ ] Built from the shared hardware kit (`core/hardware/Kit.js`, `materials.js`); new materials
      are added to the kit, not defined inside the asset.
- [ ] Colour follows the visual grammar: the asset's `role` in `design/language.yaml`, and no hue
      borrowed from another role; `never:` rules respected.
- [ ] Reads well under the shared lighting from every preset; sufficient contrast against the
      page background.

## Camera

- [ ] `overview` preset, plus the presets the asset's anatomy needs (front, top, rear, a named
      detail such as `pcie`), each fitted exactly to the geometry.
- [ ] Every preset frames correctly in landscape **and** portrait; a portrait `overview` variant
      where the asset is wide.
- [ ] Clicking any part gives a readable close-up.
- [ ] Camera moves ease and never pass through geometry.

## Interaction

- [ ] Every part is hoverable (tooltip) and selectable (highlight, push-in, inspect panel).
- [ ] Reset, Esc and the panel's close button return to a clean state (no leftover highlight,
      offset or panel).
- [ ] Asset actions (lifting, opening, exploding) are reversible and declared in part metadata.
- [ ] Picking respects occlusion — a part behind another is not selected through it.

## Semantics

- [ ] Every registry `part` has a metadata entry: `name`, `designator`, `category`, `summary`,
      `description`, `details` (checked by the registry test).
- [ ] Every registry `port` resolves to a real anchor on a declared part and connects to a known
      asset or concept (checked by the registry test).
- [ ] Anchors exist for every point a composition or animation will attach to.
- [ ] Labels and designators are consistent between the model, its metadata and its page.

## Animation (when the asset animates)

- [ ] Deterministic: driven by pushed-in time, no wall-clock reads; the film determinism check
      passes when the asset appears in a film.
- [ ] Pause, seek and reset safe: any time can be rendered directly, not only by playing up to it.
- [ ] Semantic, not decorative: every motion means something the concept teaches.
- [ ] Composable: triggered through named hooks or anchors, not by reaching into the asset's
      internals.

## Web page

- [ ] Dedicated route `/axiobyte/<domain>/<slug>/` from `experiences/<domain>/<slug>/`, with a
      complete `experience.json`.
- [ ] Follows the anatomy and the responsive requirements in [`web-page.md`](web-page.md),
      verified on phone portrait (320–430 px), landscape phone, tablet and desktop.
- [ ] No external runtime dependency: self-hosted fonts, no CDN, no third-party requests.
- [ ] Smoke test passes under `/axiobyte/`: parts registered, draw calls issued, no console
      errors, no failed or external requests.

## Engineering

- [ ] `npm test -w @axiobyte/three`, `npm run build`, `npm test -w @axiobyte/experiences` and
      `pytest` pass.
- [ ] The asset imports nothing from compositions, experiences or episodes; no episode names in
      its code or ids.
- [ ] Performance is proportionate: draw calls and triangles reported by the page's `stats()` are
      recorded in the review.

## Documentation

- [ ] Registry entry complete: id, version, status, quality, concept, parts, ports,
      implementations, route, experience, episodes, `known_limitations`.
- [ ] The page's README says what it shows, how it behaves and any deliberate simplification.
- [ ] Known limitations are written down — in the registry, not only in a review thread.
