# E02 — Milestone 7 plan: transmit → reuse → handle passed → final payoff (sentences 40–46)

## Narration (`timeline/words.json`)

| # | Time | Words |
|---|------|-------|
| 40 | 183.94–190.37 | "Finally, when packet processing is complete, the NIC **transmits** (187.3) the packet using the **exact same memory buffer**." |
| 41 | 191.15–196.88 | "After transmission, that buffer is **returned to the mempool** (193.2), ready to be **reused** for the next incoming packet." |
| 42 | 197.42–199.69 | "The packet buffer was **allocated only once**." |
| 43 | 200.15–201.13 | "It was **never copied**." |
| 44 | 201.69–207.04 | "Only the mBuff, the **handle** to that data, was **passed** (204.7) from one component to another." |
| 45 | 207.04–214.80 | "…a packet is often best thought of not as a collection of bytes, but as a **pointer to those bytes** (213.7–214.5)." |
| 46 | 215.81–217.86 | "And that's the **essence of zero copy**." (The film holds 1.5 s past the voiceover, to 219.3 s.) |

## Audit of the existing 40–46

The milestone 2 core already gets the model right:

- **Transmit.** A blue DMA read runs from buffer A's `read` anchor back across the card to the RJ45 port, carrying a blue byte cluster. The buffer keeps its bytes.
- **Return to the pool.** The representative outline clears on "returned".
- **Handle passed.** The handle reruns the stages on "passed".

What is wrong is the presentation:

- Every card and both chapter titles use the old small, fixed-pixel widgets.
- The slabs' tiny printed names and the travelling bead are back from sentence 40, after their milestone 6 windows end.
- The shots are bottom-heavy and pushed in, with buffer A at about 540–600 px wide against 362 px in sentence 39.
- The final frame is the stage row, the pool's edge and a card. It doesn't resolve.

## Decisions

- **Two motions, two colours.**
  - *Blue:* only the transmit DMA read in sentence 40 moves bytes, from the buffer out through the card's port, as a DMA read does. The buffer keeps its bytes.
  - *Yellow:* only the handle moves, rerunning the stages on "passed".
- **The bead** is not restored. From sentence 40 to the end, nothing travels along the handle's line. On "pointer to those bytes" the line is traced instead, with the same static glow as sentences 32–36.
- **The slabs' printed names** stay hidden to the end. In sentence 44, where the stages matter ("from one component to another"), they are named by the episode's tags. They are context elsewhere.
- **No new bytes and no second buffer.** Sentences 42–46 are a recap of this packet's life, so the buffer keeps showing its bytes as what the pointer points to. Reuse (sentence 41) is shown on the pool: the enlargement folds back into its tile, which the highlighter lifts. There are no state labels.
- **No red** anywhere in 40–46.

## Sentence by sentence

| # | Visual intent | Buffer A | Bytes | Handle | NIC | Camera | Annotation | Colour | Transition |
|---|---|---|---|---|---|---|---|---|---|
| 40 | the same buffer goes out | holds | a blue cluster rides the DMA read from the buffer to the RJ45 port; the buffer keeps its own | at routing, line lit, no bead | controller lit as the read lands | the NIC and buffer A together, centred, at sentence 39's scale | `TRANSMIT — the NIC reads the same buffer · no copy` | blue | 39's wide system eases to the NIC and buffer |
| 41 | returned, to be reused | holds | still | still | — | the mbuf, buffer A and the pool | `BACK TO THE MEMPOOL — reused for the next packet`; the enlargement folds back into its tile on "returned" and the pool is lifted | violet (pool) | gentle move down to the pool |
| 42 | set up once | holds | still | still | — | held | `SET UP ONCE — before any packet arrived` | violet | held |
| 43 | never copied | lifted | still | still | — | held | `NEVER COPIED` | blue | held |
| 44 | only the handle was passed | holds | still | runs the stages on "passed", each stage lighting as it passes | — | milestone 5's buffer-and-pipeline composition | stage tags + `ONLY THE HANDLE WAS PASSED` | yellow | move back to the pipeline |
| 45 | a pointer to those bytes | lifted on "pointer" | still | line **traced** (static glow) from "pointer" to the end | — | held, slight push | `A PACKET IS A POINTER — to its bytes` | yellow + blue | held |
| 46 | the essence of zero copy: the final frame | holds the bytes | still | at routing, its line traced to the buffer | in frame as context | a clean, centred final composition: buffer A, the mbuf, the handle and its line; nothing else is framed | the pointer card holds; `ZERO COPY` stays with it | blue + yellow | slow push to the end of the hold |

Chapter titles `06 · TRANSMIT` (40–41) and `07 · A PACKET IS A POINTER` (42 to the end) move to the episode typography, in the lower-right corner.

Every shot is checked with the milestone 6 framing helper: subject centre within ±80 px, nothing clipped, no bottom-heavy frame, and buffer A's apparent width continuous with sentence 39 (no jump above 1.6× across a shot change).
