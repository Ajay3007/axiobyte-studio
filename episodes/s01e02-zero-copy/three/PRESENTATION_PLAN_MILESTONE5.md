# E02 — Milestone 5 plan: same buffer → pipeline → handle → in place (sentences 23–30)

## Narration (`timeline/words.json`)

| # | Time | Words |
|---|------|-------|
| 23 | 103.95–108.72 | "From this moment onward, every **stage** of packet processing works with the **same packet buffer** (107.8–108.4)." |
| 24 | 109.50–111.32 | "The **parser** (109.6, transcribed "passer") receives the mBuff." |
| 25 | 111.34–113.25 | "The **classifier** (111.5) receives the **same** mBuff." |
| 26 | 113.87–115.81 | "The **firewall** (114.0) receives the same mBuff." |
| 27 | 116.39–119.24 | "The **routing** logic (116.5) receives the same mBuff." |
| 28 | 119.24–123.71 | "Each component only receives a **handle** (121.2) that **points to the original packet buffer** (122.0–123.4)." |
| 29 | 124.23–126.61 | "The packet buffer **never moves** (125.2)." |
| 30 | 126.63–132.42 | "Even if a **router** needs to **modify a header** or change an address, it **modifies** (130.3) the bytes **right there in place** (131.4–132.2)." |

The narration's handle *is* the mBuff, passed by reference: what goes from stage to stage is a reference, never the bytes.

## What exists (milestone 2 core) and what changes

These already exist and stay:

- buffer A holding the bytes;
- four episode-local stage slabs, downstage-right of buffer A, registered as presentation markers and never as assets;
- the yellow `HANDLE` chip, hopping stage to stage on each spoken name, with a straight yellow line to buffer A's header at all times;
- the in-place recolour of three header bytes on "modifies".

The audit found:

- the stage names are printed on the slabs at about 16 px on screen;
- the four cards and the `04` label use the old small, fixed-pixel widgets, with three collisions;
- four cuts between stage pairs in sentences 24–27;
- an extreme close-up for sentence 30 that loses the pipeline;
- a bright bead travelling the handle's line from sentence 28.

## Sentence by sentence

| # | Visual intent | Packet buffer | Handle / reference | Stages | Camera | Annotation | Colour |
|---|---|---|---|---|---|---|---|
| 23 | the anchor: one buffer, from now on | buffer A, bytes resident; highlighter lift ("same buffer") | the mbuf's `buf_addr` reference holds | the four slabs rise into place, unnamed until spoken | out of sentence 22 to one steady composition: buffer A, the four stages and the mbuf | `THE SAME BUFFER — every stage works with it`, on the floor left of buffer A | blue (buffer) |
| 24 | parser | unchanged, still | the handle is born at the mbuf and goes to PARSER, its yellow line pointing back at buffer A's header | `PARSER` tag appears in front of its slab; the slab glows yellow while the handle is there | steady | stage tag | yellow on the slab; neutral tag |
| 25 | classifier | unchanged | handle → CLASSIFIER, line still to the same header | `CLASSIFIER` tag | steady | stage tag | same |
| 26 | firewall | unchanged | handle → FIREWALL | `FIREWALL` tag | steady | stage tag | same |
| 27 | routing | unchanged | handle → ROUTING | `ROUTING` tag | steady | stage tag | same |
| 28 | the handle is a reference | unchanged | the handle and its line are the subject; the line stays lit to the buffer; **no bead travels it** | all four tagged | a gentle push toward the handle, with buffer A and all stages kept in frame | `A HANDLE — an address, not the bytes`, beside the routing stage | yellow |
| 29 | the buffer never moves | stationary (the camera holds; no orbit) | the handle runs the pipeline once more, while the buffer stands still | each slab lights as the handle passes | static | `THE BUFFER NEVER MOVES`, on the floor left of buffer A | blue |
| 30 | in place | the three first header bytes are rewritten where they lie, recoloured and never moved; buffer A stays where it is | the handle sits at ROUTING ("a router"), its line on the header being edited | all tagged | a slight push toward buffer A that keeps the routing stage and the handle in frame: the final image holds buffer, bytes, pipeline and handle | `EDITED IN PLACE — same buffer · same bytes · no copy` | blue (the bytes); yellow (the handle) |

## Rules kept

- **One physical buffer:** buffer A. There is never a second buffer, payload or byte group at a stage.
- **Bytes:** blue byte cells exist only inside the buffers. The stages never hold bytes.
- **Handle:** pointer yellow; a chip printed `HANDLE` with a line to the buffer. It is never blue and never byte-shaped.
- **No red:** no copy path and no copy glow in 23–30.
- **Stages:** episode-local slabs, never registered as assets.
- **Annotations:** every annotation in 23–30, the stage tags included, uses `typography.js` (stage names at the secondary 38 px size, as tags in front of their slabs) and the annotation-zone system, kept clear of the buffer, the handle and its line, the stages, the chapter title and the bytes.
- **Camera:** one steady composition for 24–29, instead of four cuts. Buffer A stays in frame throughout.

## Scope notes

- The slabs' small printed names are hidden while the tags name them (23–30), and return as before from sentence 31. Milestone 6 decides how sentences 31–46 label them.
- The handle's travelling bead is suppressed through sentence 30. Its use from sentence 31 is left to milestone 6.
- The `04 · ONE BUFFER · EVERY STAGE` title moves to the episode typography. Its window runs to the end of sentence 31, so that sentence's title shares the new style.
