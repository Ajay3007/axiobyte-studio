# E02 — Milestone 2 composition audit (sentences 5–12)

Rule: **physical assets own their space; explanatory graphics own negative space.**

Method: frames of the real film were sampled at 29 moments between 28.6 s and 52.8 s, once with the
film's cameras and once with every camera lowered to 60 % of its elevation. At each frame:

- every asset's world box is projected through the live camera, as a convex hull;
- the NIC is the whole card;
- the DMA and copy paths and the moving byte groups are projected the same way;
- each active annotation is redrawn alone, without its leader line, and its pixel bounds are measured.

The same check now runs as a unit test, `renderers/three/test/s01e02-composition.test.js`. It drives
the film's camera director in Node every 0.25 s and checks each annotation's layout rectangle.

## Collisions found (before) and how each was corrected

| Moment | Asset | Annotation | Collision? | Correction |
|--------|-------|------------|------------|------------|
| s5 DMA (31.0 s) | NIC | `DMA` card at fixed (1180, 140) | **yes**: on the PCB's far end | Card moved to zone `left`, the floor left of buffer A and in front of the bracket, centred on the zone. It now ends before the camera starts moving into sentence 6. |
| s6 copy 1 (32.6–34.6 s) | NIC | `CPU COPY` card at fixed (118, 150) | **yes**: on the bracket and RJ45s | Card moved to zone `cpu_side`, the open floor upstage-right of the CPU, past the NIC's right end. |
| s6 | NIC | chapter label (top-left) | **yes** | Label moved to its own lower-left title region from sentence 5. |
| s7 copy 2 (36.2–37.5 s) | NIC, DMA path | chapter label | **yes**: on the PCB and the blue path | Label in the lower-left region. |
| s7 | copy-2 path | `COPIED AGAIN` (first zoned attempt) | **yes**: the run floats at the routing height | Zone moved upstage, behind the run line; card centred on the zone. |
| s8 cost (39.4–42.2 s) | NIC | `CPU CYCLES / MEMORY BANDWIDTH / CACHE` chips at fixed (118, 150) | **yes**: on the bracket and heatsink | Replaced by one group, `COST OF COPYING` plus three chips, in zone `upstage_right`, the empty floor right of the NIC. Each chip appears on its spoken word. |
| s8 | copy-2 path, bytes | cost group during the shot's blend | **yes**: transient, at 38.6 s | Group starts at "CPU" (39.0 s); the blend into the wide shot is shortened to 1.4 s. |
| s8–s9 | NIC | chapter label | **yes** | Label in the lower-left region. |
| s10 reference (48–51 s) | — | `A REFERENCE` at fixed (1180, 150) | no, but placed by fixed pixels | Moved to zone `before_a`, the floor between the NIC's front edge and buffer A. |
| s11–s12 | — | `02 · ZERO COPY · THE MBUF` | no | Unchanged; its window runs to sentence 16, out of scope. |

**After:** 0 collisions in 29 frames with the film's cameras, and 0 in 29 frames with the lowered
cameras.

## NIC scale

Why the NIC dominates:

- **Physical footprint, not instance scale.** The instance is at scale 1. The card is 17.3 × 8.9
  units, against the CPU's 4 × 4, a buffer's 6.2 × 2.1 and the Application's 4.4 × 2.3: about ten
  times the CPU's floor area.
- **Placement.** It stands directly upstage of the host row, so every front-high camera puts it
  across the top of the frame. The shots for sentences 6 and 7 never framed it; it simply filled the
  top half behind the CPU.
- **Why not scale or move it.** Either would change the frozen opening, where the NIC rises and the
  packet crosses the card. The camera is the smallest correction.

Correction:

- **Sentences 6–8:** steeper views, plus an upward composition (`frame[1]` 0.10–0.13) that slides
  the NIC off the top of the frame.
- **Sentence 8:** the NIC controller is no longer forced into the wide shot's framing box.

NIC's share of the frame, measured as the whole card's projected hull clipped to the frame:

| Shot | Before | After |
|---|---|---|
| s5 DMA (the NIC is the subject) | 23 % | 23 % |
| s6 copy 1 | 20 % | 15 % |
| s7 copy 2 | 11 % | 11 % |
| s8 cost, wide | 21 % | 16 % |

## Hierarchy per shot

| Shot | Primary | Secondary | Tertiary |
|------|---------|-----------|----------|
| s5 | bytes and the DMA path into buffer A | NIC, buffer A | `DMA` card (left floor) |
| s6 | bytes A → CPU → B | CPU, buffers A and B | `CPU COPY` card (upstage-right of the CPU) |
| s7 | bytes B → CPU → application | CPU, buffer B, application | `COPIED AGAIN` card |
| s8 | repeated copies, all byte groups | CPU, buffers, application; NIC cropped as context | `COST OF COPYING` group |
| s10–12 | the reference and buffer A | mbuf | `A REFERENCE` card |

## Not changed

- No asset geometry, registry entry, asset dimension or NIC transform was changed.
- Sentences 0–4 are byte-identical. Chapter 01's label keeps its original top-left placement during
  sentence 4 and starts fading out exactly at sentence 5.
- Sentence 4's own overlay still has the old overlaps, chapter label ∩ NIC and `BUFFER A` ∩ buffer A.
  That is the frozen opening and was left as approved.
