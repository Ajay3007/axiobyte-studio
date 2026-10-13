# E02 — Typography and mobile legibility audit (sentences 0–22)

Scope: explanatory overlay text only. Narration, audio, timing, sentence boundaries, assets, the semantic model, the analogy and the global renderer are unchanged. Sentences 23–46 are not built yet; their cues keep the old widgets until their milestone.

## Hierarchy (`three/typography.js`, episode-local)

All sizes are pixels on the 1920×1080 frame. The overlay is screen-space, so a size here is its projected height. There is no world-space text to convert.

| Role | Used for | Size | Ink |
|---|---|---|---|
| **Primary** | what a card names (`DMA`, `MEMPOOL`, `COST OF COPYING`, `ZERO COPY`, …) | 52 px, bold | `#F6F7FA` near-white |
| **Secondary** | list items (`CPU CYCLES` … `CACHE`, `NO CPU` … `NO COPY`) | 38 px, bold | `#F1F4F8` near-white |
| **Support** | a card's one-line explanation | 28 px, medium | `#D7DDE6` light (never mid-grey) |
| **Chapter** | chapter identifier (`01 \| TRADITIONAL PACKET PATH`) | 26 px, bold / semibold | index in the accent; label `#DCE2EA` |

Minimums enforced by tests: primary ≥ 48 px, secondary ≥ 34 px, support and chapter ≥ 26 px.

## Old versus new

| Element | Old | New |
|---|---|---|
| Card title | 36 px, `#ECE8DA` | 52 px, `#F6F7FA` |
| Card subtitle | 20 px, grey `#98A1AB` | 28 px, `#D7DDE6` |
| COST OF COPYING / ZERO COPY heading | 17 px, accent-coloured | 52 px, near-white on its own plate, with an accent underline (3×) |
| CPU CYCLES … / NO CPU … | 20 px chips, accent-coloured text, 9 % tint | 38 px (1.9×), near-white on an accent-tinted chip with a 2 px accent border |
| Chapter labels | 17 px, grey label | 26 px, light label |
| Card plate | rgba(11,14,18,0.80), 1 px hairline, 3 px accent edge, 22 px padding | rgba(8,10,14,0.90) with a drop shadow, 2 px accent border, 7 px accent edge, 30/24 px padding |
| Leader line | 1.25 px, 3.5 px dot | 2.5 px, 5 px dot |

## Colour and contrast

Colour carries **meaning**, light text carries **reading**. The semantic roles are unchanged: red for copying, blue for DMA and bytes, yellow for pointers, cyan for the mbuf, violet for the buffer. They now mark each annotation's accent edge, border, chip tint, leader and chapter index, and are never its only readable ink.

| Text, on its background | Old | New |
|---|---|---|
| Card title | 14.9 : 1 | **18.1 : 1** |
| Card subtitle | 7.0 : 1 (grey) | **14.2 : 1** |
| Red list items (sentence 8) | 6.4 : 1 (red on near-transparent) | **13.3 : 1** |
| Blue list items (sentence 22) | 8.0 : 1 | **12.4 : 1** |
| Chapter label, on the floor | 5.1 : 1 | **10.2 : 1** |

## Mobile readability

Effective on-screen size when the 1920 px frame is shown on a phone:

| | Landscape full-screen (≈ 844 px wide, ×0.44) | Portrait full-width (≈ 390 px wide, ×0.20) |
|---|---|---|
| Primary 52 px | ≈ 23 px | ≈ 10.6 px |
| Secondary 38 px | ≈ 17 px | ≈ 7.7 px |
| Support 28 px | ≈ 12 px | ≈ 5.7 px |

Simulated previews (Lanczos downscales) are in `out/typography-qa/*-phone-landscape-844.png`, `*-phone-portrait-390.png` and the two `sheet-*.png` files.

- **Landscape:** everything reads without effort.
- **Portrait:** titles, both headings and their list items remain readable. Subtitles are marginal. That is inherent to a 16:9 frame on a portrait phone at the targets given; the titles and list items carry each concept on their own.

## Protected regions and placement

Every annotation is checked against the projected convex hulls of the NIC (the whole card), the CPU, buffers A and B, the Application, the mbuf and the Mempool. It is also checked against the DMA, copy and reference paths, the moving byte groups, and the title-safe frame (112…1808 × 76…1004). Checks are frame by frame, with the film's own camera, for sentences 4–22. The larger cards needed these placement changes, all inside the composition system:

| Annotation | Change |
|---|---|
| Chapter 01 label | Lower-left corner only, from sentence 5. It is no longer shown during sentence 4's reveal, where it had sat on the NIC (an overlap present since the original opening). |
| `BUFFER A` (sentence 4) | Fixed position → the floor zone upstage-left of buffer A (it had sat on buffer A). |
| `CPU COPY`, `COPIED AGAIN` | Shifted right into open floor, clear of the NIC's corner. |
| `A REFERENCE` (sentence 10) | → the floor left of buffer A. |
| `BEFORE ANY PACKET ARRIVES`, `ONE REPRESENTATIVE ELEMENT` | Set on two lines, wording unchanged. The representative card moved to the floor right of the pool and ends shortly after sentence 20 begins (the magnifier outline continues). |
| `DMA → BUFFER` | Stands just upstage of its zone (offset from its real height). |
| `COST OF COPYING` | Same zone, lifted to clear the copy-2 run and its byte groups. |
| `ZERO COPY` | Zone moved further right of the CPU (the group is about 370 px wide). The CPU stays fully visible and idle. |
| `MEMPOOL` | Zone moved further from the pool's edge. |

**Camera:** one change. The sentence 19 warehouse shot gains a slight downward frame offset (`frame: [0, −0.06]`), so the pool clears the `03` chapter title. Asset scale, camera language and the other shots are untouched.

## Tests

`renderers/three/test/s01e02-typography.test.js` (7 tests) checks:

- the hierarchy and minimums;
- every string every annotation actually draws, captured on a recording canvas, at its role's size, with nothing below 26 px;
- no sentence 0–22 annotation left on the old 16–22 px widgets;
- contrast: ≥ 7 : 1 on the plate, ≥ 4.5 : 1 for chapter labels on the floor;
- plate opacity, border, accent edge and padding;
- safe-frame containment and no overlap with hardware, paths or bytes, every 0.25 s for sentences 4–22 (more than 200 annotation-frames);
- COST OF COPYING and ZERO COPY anchored to their zones, at their size;
- deterministic layout and drawn output across builds.

Existing tests: three filters were updated to tell cards from chapter titles, which now report their own rectangles and are checked too. The chapter labels' hard-coded 17 px rectangles were replaced by their real layouts. The milestone 2 chapter-label check now starts at the label's true start. No assertion was relaxed.

**Width estimate.** Card sizes come from a deterministic per-character width estimate, so layout never depends on a canvas. In the browser, with the real font, every one of the 43 strings fits its estimate (margin 0–19 %, mostly 5–12 %). Nothing clips.

## Frames inspected

Full-resolution and phone-scale frames at 24.6, 30.4, 33.4, 36.8, 41.2, 49.3, 56.5, 66.6, 69.5, 74.6, 78.2, 85.0, 93.4 and 102.6 s, plus `out/s01e02-zero-copy.three-typography-qa.mp4` (sentences 8–22, 37.0–103.5 s, with audio).

## Remaining

- **Lowered cameras (60 % elevation, a stress test; not the film's cameras).** `DMA` (sentence 5) and `BUFFER A` (sentence 4) now touch nearby hardware. No placement in their shots is clean at both heights with the larger cards; fixing it would mean changing approved camera work. At the film's own cameras both are clear.
- **Fade edges.** In the first or last 0.2 s of a card's fade, at low opacity, three cards briefly touch an outline: the NIC card's exit, `BUFFER A`'s exit, and the representative card's entrance. This matches the standard the milestone tests have always used.
- **Sentences 23–46** still use the old widgets. They should adopt `typography.js` when built.
