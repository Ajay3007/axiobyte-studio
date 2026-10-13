# E02 — Milestone 3 plan: mbuf → buf_addr → packet buffer (sentences 13–16)

## Narration (from `timeline/words.json`)

| # | Time | Words |
|---|------|-------|
| 13 | 54.12–56.22 | "The answer is an **mBuff**." ("mBuff" at 55.18) |
| 14 | 56.24–59.62 | "Think of an mBuff as a **small metadata structure attached to the packet**." |
| 15 | 60.28–67.77 | "It contains information like the packet **length** (62.0), **protocol details** (62.5), and **most importantly** (63.9), the exact memory **address** (66.1) where the packet's payload **begins** (67.5)." |
| 16 | 68.39–70.66 | "Now let's look at **where those bytes live**." |

## Starting point (frozen, sentences 10–12)

The yellow reference already exists. It grew in sentence 10 into buffer A's address. Sentence 12 ("But what exactly is being passed?") ends looking at its empty tail.

The audit of the milestone 1 version of 13–16 found four problems:

- The mbuf is pushed to about 20 % of the frame in sentences 14–15.
- During `buf_addr` the packet buffer is off screen.
- A bead runs along the reference, which reads as something travelling.
- Three cards sit at fixed pixels.

## Sentence by sentence

1. **Sentence 13: the answer appears at the tail.** The camera holds on the reference's tail and buffer A's header. On "mBuff" the real mbuf asset settles into place exactly where the reference begins. The question "what is passed?" is answered by the object found at the far end of the reference. No bytes, no copy. The `MBUF` card ("metadata — not the packet's bytes") goes in the empty floor behind the mbuf.
2. **Sentence 14: small, and attached.** A gentle push toward the mbuf. The frame keeps the reference and buffer A's address end in view, because the narration says "attached to the packet". The mbuf stays small (target under about 10 % of the frame); its record (title band, three field strips) is what reads as metadata. The highlighter softly lifts the record.
3. **Sentence 15: the fields, then `buf_addr`.**
   - On "information… length" the camera comes closer to the fields, and `data_len` is marked: a thin cyan bar on its strip.
   - The asset has no protocol field, and changing the asset is out of scope. So "protocol details" lights nothing, and `refcount` is not passed off as protocol.
   - On "most importantly" the `data_len` mark gives way to the `buf_addr` mark (yellow), and the camera re-centres on the `buf_addr` strip and its socket.
   - On "address" a yellow trace lights the reference, from the socket to buffer A's `pointer_target`, as the camera pans along it toward the buffer. It arrives at the buffer's first byte on "payload begins".
   - Nothing travels: no bead, no bytes. The reference simply lights up.
   - The `buf_addr` card ("the address of the bytes") goes on the floor below the reference.
4. **Sentence 16: where the bytes live.** The camera pushes past the reference's arrowhead into buffer A. The payload's real byte cells become the largest, brightest thing in frame (highlighter on the header and payload). The mbuf stays in shot at the left edge, small and secondary, with the lit reference leading from it into the buffer. The `THE PACKET'S BYTES` card ("they live in the buffer") goes on the empty floor upstage of buffer A. The final frame shows the whole chain: mbuf → `buf_addr` → packet buffer → bytes. That is the state sentence 17 builds the Mempool around.

## mbuf versus packet buffer

| | mbuf | Packet buffer |
|---|---|---|
| Asset | the real `mbuf` asset (unchanged) | the real `packet_buffer` asset, buffer A (unchanged) |
| Colour | cyan record, with `buf_addr` in pointer yellow | violet frame, with byte cells in packet blue |
| Contains | `data_len`, `refcount`, `buf_addr` strips; no byte cells | header and payload byte cells |
| Role on screen | where the reference starts | where the reference ends, and where the bytes stay |

Nothing moves between them. Only the reference connects them: yellow, straight, world-space, from the `mbuf.fields:buf_addr` anchor to the `buffer_a.header:pointer_target` anchor.

## Camera progression

| Moment | Framing |
|---|---|
| End of 12 | the reference's empty tail and buffer A's header (frozen) |
| 13 | hold on tail and header; the mbuf arrives |
| 14 | push gently: mbuf, the reference and buffer A's address |
| 15 | closer on the fields; then the `buf_addr` strip and its socket; then a pan along the reference to the buffer's first byte |
| 16 | push into buffer A's payload, with the mbuf at the left edge |

Every move is motivated by the next thing the narration names. The single sideways move, the pan in sentence 15, follows the reference itself.

## How the viewer follows the relationship

They watch the reference. It exists before the mbuf does, from sentences 10–12. It is answered by the mbuf in sentence 13 and named in sentence 15, when it lights from `buf_addr` to the buffer. In sentence 16 they follow it into the bytes. Labels are tertiary: small cards in negative space, never over the mbuf, the buffer, the reference or the bytes.

## Not in 13–16

No Mempool, no descriptor ring, no host-memory composition, no processing-stage row, no new global asset, no asset changes.
