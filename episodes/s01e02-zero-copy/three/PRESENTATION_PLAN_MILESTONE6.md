# E02 — Milestone 6 plan: key idea → pointer → cheap → scale → benefits (sentences 31–39)

## Narration (`timeline/words.json`)

| # | Time | Words |
|---|------|-------|
| 31 | 133.01–136.87 | "They're still sitting exactly where the **NIC originally placed** them." |
| 32 | 136.87–139.26 | "This is the **key idea** behind zero copy." |
| 33 | 139.92–141.58 | "The packet **isn't travelling** through the system." |
| 34 | 142.08–143.10 | "Only the **pointer** is." |
| 35 | 143.70–146.03 | "Passing a pointer is incredibly **cheap**." |
| 36 | 146.05–155.94 | "…just an **8-byte** memory address on a 64-bit system, compared to copying **hundreds or even thousands of bytes** across system boundaries for every packet." |
| 37 | 155.94–158.79 | "Now imagine processing **millions** of packets every second." |
| 38 | 159.53–167.34 | "If every packet required multiple memory copies, the CPU would spend most of its time moving bytes instead of making **forwarding decisions**." |
| 39 | 168.06–183.94 | "…zero copy dramatically **reduces CPU overhead** (171.4), **lowers memory bandwidth** usage (173.1), **improves cache efficiency** (175.1), and enables applications like DPDK to achieve **tens or even hundreds of gigabits per second** (179.7)…" |

The narrated figures (8 bytes, hundreds to thousands of bytes, millions per second, tens to hundreds of Gbit/s) are the only numbers shown. Nothing is invented.

## Audit of the existing 31–39 (milestone 2 core)

- **Sentence 31.** Milestone 5's tags vanish and the slabs' tiny printed names return. The camera swings to the NIC, and during that move the `04` label (lower right) sits on the stage row: the known issue at about 134 s.
- **Sentences 32–39.** The `05` label and seven cards are the old small, fixed-pixel widgets. The benefit chips are tiny, in the top-left.
- **The bead.** From sentence 31 a bright bead travels the handle's line again. It reads as something moving along the reference, close to data movement.
- **Sentence 38** is an extreme close-up on the CPU and the stage row.
- **What works.** The handle reruns the stages on "Only the pointer is". From sentence 37, five yellow handle chips stream through the stages: a lightweight, illustrative scale device made of references, not buffers.

## Decisions

- **Stage names.** From the end of sentence 30 to the end of 39, the stages stay named by typography tags, the same tags as in milestone 5. The new tags take over from milestone 5's as those fade, at the same places, so the names never flicker. A tag is drawn only while its stage is on screen. The slabs' small printed names stay hidden throughout, so they never return as the primary labels.
- **The bead.** It is not restored. It reads as something travelling along the reference. Instead, on "key idea" and "only the pointer" the handle's line is traced: a soft yellow glow laid along it, which then stays. This is milestone 3's `buf_addr` language: a lit reference, with nothing moving along it.
- **Chapter labels.** `04` stays in its lower-right corner. Sentence 31's shot is composed so that corner stays clear of the stage row. `05 · WHY IT IS CHEAP` moves to the episode typography, in whichever corner its shots keep clear.
- **No red.** Sentence 38's hypothetical ("if every packet required multiple copies…") is told by the card and the CPU, not by a red copy animation.

## Sentence by sentence

| # | Visual concept | Buffer A | Handle / reference | Stages | Camera | Annotation | Colour | From the previous sentence |
|---|---|---|---|---|---|---|---|---|
| 31 | the bytes are where the NIC put them | bytes resident; the highlighter lifts them | at routing, its line lit | tagged where in frame | from milestone 5's composition, a gentle move that brings the NIC into frame beside buffer A, keeping the `04` corner clear | none (the picture answers) | blue | milestone 5's tags hand over with a crossfade; same buffer, same handle |
| 32 | the key idea: bytes stay, the reference moves | unchanged | the line **traced** (a static glow), the handle's own glow up | tagged | back to the steady buffer–pipeline composition | `THE KEY IDEA — the bytes stay where the NIC put them` | yellow emphasis; blue bytes | a gentle widening |
| 33 | the packet is not travelling | highlighter on its bytes | still | tagged | held | `THE PACKET ISN'T TRAVELLING` | blue | held |
| 34 | only the pointer is | still | the handle runs the stages; its line stays on buffer A | each lights as the handle passes | held | `ONLY THE POINTER IS` | yellow | held |
| 35 | cheap | still | the line stays traced | tagged | a slight push toward the handle | none (the narration says it; sentence 36 shows it) | yellow | push |
| 36 | 8 bytes against hundreds to thousands | still | — | tagged | held | `≈ 8 BYTES — an address, on a 64-bit system` beside the handle; then `HUNDREDS–THOUSANDS OF BYTES — the packet, which stays put` beside the buffer | yellow vs. blue | held |
| 37 | millions per second | still | the handle stays; illustrative handles stream through the stages | tagged | widen to the whole pipeline | `MILLIONS OF PACKETS A SECOND — illustrated: each one a handle` | yellow | widen |
| 38 | the CPU decides instead of moving bytes | still | the stream continues | tagged | the CPU with the stage row, not a close-up | `THE CPU DECIDES — instead of moving bytes` | neutral | move to the CPU |
| 39 | the benefits, exactly as narrated | still | the stream continues | tagged | the system, wide | one group `WHAT ZERO COPY GIVES`: `LESS CPU OVERHEAD`, `LESS MEMORY BANDWIDTH`, `BETTER CACHE EFFICIENCY`, `TENS–HUNDREDS OF GBIT/S`, each appearing near its word | blue | widen |

## Rules kept from milestones 3–5

- **One buffer, resident bytes.** Buffer A is the only packet buffer, and its bytes never move.
- **The handle.** It stays yellow and is never blue or byte-shaped.
- **The scale stream.** A handful of yellow handles, never buffers or bytes, and never thousands of objects.
- **No red** anywhere in 31–39.
- **Typography.** Every annotation uses `typography.js` and the zone system, clear of the buffer, the handle and its line, the stages, the chapter label and the moving handles.
