# E02 — Visual plan (Three.js rebuild)

Episode: `s01e02-zero-copy` — "Zero-copy — a packet is just a pointer".
Timing source: `timeline.json` (byte-identical to `timeline/words.json`, sha256 `e8a05f4b…`),
47 sentences, voiceover `voiceover.mp3` (byte-identical to the pinned recording, sha256
`b5d66919…`, 217.809 s). Sentence numbers are the timeline's own `sentence_index` (0–46).
Times are seconds, from the timeline, unrounded beyond two decimals.

**Status: PLAN ONLY — implementation is blocked (Phase 4).** Rows whose `assets_used` name a
component marked **MISSING** cannot be built from an existing AxioByte asset; see
"Phase 4 — component check" at the end. Nothing in this plan has been implemented.

Asset key:

| Mark | Meaning |
|---|---|
| **NIC**, **PCIe**, **CPU** | Released Three.js assets (`renderers/three/src/domains/…`) |
| **Mempool** | Three.js model, registry status *prototype*: 12 identical `[MBUF │ BUFFER]` tiles, one part (`elements`), anchors `first_slot`, `last_slot`, `center`; no per-element identity, nothing moves |
| **PacketAnimator** | Core Three.js primitive (`core/PacketAnimator.js`): glowing packet tokens between anchors |
| *local:* … | Episode-local conceptual geometry, permitted by the brief §11 (stages, handle, byte emphasis, markers) |
| **MISSING: mbuf (3D)** | Registered asset `mbuf` has **no Three.js implementation** (registry: "A Manim actor only") |
| **MISSING: packet buffer (3D)** | **No packet-buffer asset exists**; the roadmap lists it as "Part of host memory (`packet-buffer-region`) — undecided" |

Colour language (from `design/language.yaml` as used by the Mempool model): mbuf cyan
`#34d8e8`, memory/buffer violet `#b79cf0`, pointer yellow `#f5d14f`, CPU copy red, DMA in the
packet/accent colour — never red.

| sentence | start | end | narration_summary | visual_goal | assets_used | camera | animation | semantic_invariant |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.03 | 4.39 | Moving a whole library to read one book | Cold open: the system at rest, packet bytes shown as a block of data | NIC; PacketAnimator | Slow establishing push-in on the NIC | Idle LEDs; a packet token rests at the port | Sets up "moving everything" without a fake library prop |
| 1 | 5.04 | 11.20 | Pack, drive, unload, repeat | The data block is lifted and carried repeatedly (metaphor in data terms) | NIC; PacketAnimator; **MISSING: packet buffer (3D)** | Track the token | Token hops between two placeholder positions, twice | Movement = cost; no claim yet about copies |
| 2 | 11.82 | 13.60 | Inefficient, right? | Hold on the repeated motion, slight pull-back | NIC | Gentle pull-back | Motion slows | — |
| 3 | 14.64 | 17.83 | That is traditional packet processing | Title the counter-picture: the traditional path | NIC; CPU | Pull back to reveal NIC → host side | CPU fades in beside the NIC | Establishes CPU as the copier for act 1 |
| 4 | 17.85 | 27.24 | Hardware → kernel → application; bytes copied across boundaries | Lay out three buffer positions (kernel buffer, processing buffer, application) and the boundaries between them; nothing moves yet | NIC; CPU; **MISSING: packet buffer (3D)** ×2; *local:* application marker, boundary planes | Slow lateral dolly across the path | Boundaries draw in | Setup only — no copy is shown on this sentence |
| 5 | 27.24 | 31.36 | The NIC receives the packet into one buffer | DMA: packet bytes enter buffer A | NIC; PacketAnimator; **MISSING: packet buffer (3D)** | Follow the packet from the NIC to buffer A | Token flies NIC → buffer A in the DMA colour; bytes appear inside A | DMA ≠ CPU copy: never red |
| 6 | 31.86 | 34.77 | Bytes copied into another buffer | CPU copies A → B | CPU; **MISSING: packet buffer (3D)** ×2 | Short pan A → B | Red COPY: a duplicate of the bytes travels from A to B; A keeps its bytes | Red = CPU copy, and only here and in 7 |
| 7 | 35.55 | 37.45 | Copied again before transmission | CPU copies B → application | CPU; **MISSING: packet buffer (3D)**; *local:* application marker | Pan B → application | Second red COPY | Red = CPU copy |
| 8 | 38.10 | 42.42 | Every copy costs CPU, bandwidth, cache | Three copies of the same bytes now exist; the CPU is busy | CPU; **MISSING: packet buffer (3D)** ×2 | Pull back to see all copies at once | CPU cores pulse; red copies glow | Cost is per copy |
| 9 | 42.42 | 45.53 | High-performance networking does it differently | Turn: the copies fade, one buffer remains | **MISSING: packet buffer (3D)** | Push-in on the one remaining buffer | Copies dissolve (no state label) | Transition only |
| 10 | 46.27 | 49.33 | Pass a reference instead of copying | A reference reaches the buffer instead of a copy | **MISSING: packet buffer (3D)**; *local:* pointer/handle | Hold on the buffer | Yellow pointer grows toward the buffer | Reference ≠ copy; no red |
| 11 | 49.77 | 51.47 | Called zero copy | Name the idea over the stationary buffer | **MISSING: packet buffer (3D)**; overlay title (existing `titles.js` widget) | Static | Title fades in, out | — |
| 12 | 51.94 | 53.60 | What is being passed? | The pointer's origin is still unseen | *local:* pointer/handle | Pan up the pointer to its source | Pointer tail glows | — |
| 13 | 54.12 | 56.22 | The answer is an mbuf | The mbuf appears at the pointer's tail | **MISSING: mbuf (3D)** | Arrive on the mbuf | mbuf materialises; its buf_addr is the pointer's origin | The reference belongs to the mbuf |
| 14 | 56.24 | 59.62 | mbuf = small metadata structure | Inspect the mbuf: fields, no bytes | **MISSING: mbuf (3D)** | Inspection close-up on the mbuf | Fields highlight one by one | MBUF ≠ packet bytes |
| 15 | 60.28 | 67.77 | Length, protocol details, and the payload's address | buf_addr points to the buffer | **MISSING: mbuf (3D)**; **MISSING: packet buffer (3D)**; *local:* pointer | Rack focus mbuf → buffer along the pointer | buf_addr field glows yellow; pointer pulses to the buffer | buf_addr is an address, not the bytes |
| 16 | 68.39 | 70.66 | Where do the bytes live? | The buffer, with its bytes inside | **MISSING: packet buffer (3D)**; *local:* byte emphasis | Push-in on the buffer | Bytes glow inside it | Bytes live in the BUFFER |
| 17 | 70.66 | 76.41 | Before any packet, DPDK allocates fixed-size buffers | The Mempool appears: preallocated elements | **Mempool** | Pull back from the buffer to the whole pool | Pool fades in around the scene | Allocated up front; no runtime state |
| 18 | 77.15 | 78.83 | Called a mempool | Name the pool | **Mempool** | Slow orbit over the pool | Pool part highlight (whole part) | — |
| 19 | 79.49 | 85.22 | A warehouse of empty containers | One representative element, explicitly illustrative | **Mempool** (`first_slot` anchor); *local:* "one representative element" marker | Push-in on `first_slot` | Marker outlines one tile; MBUF/BUFFER halves called out | Illustrative only — no identity, no FREE/IN USE |
| 20 | 85.24 | 88.30 | The NIC doesn't allocate new memory | NIC re-enters beside the pool | NIC; **Mempool** | Pull back to frame NIC + pool | NIC fades in | No allocation on receive |
| 21 | 88.76 | 98.18 | NIC DMAs the bytes straight into a buffer in the pool | DMA lands in the representative element's BUFFER half | NIC; **Mempool**; PacketAnimator; *local:* byte emphasis in the BUFFER half | Follow the DMA from the NIC to the tile | Token flies NIC → BUFFER half; bytes appear there | DMA → BUFFER; never MBUF, never the pool as a whole |
| 22 | 98.18 | 103.13 | No CPU, no allocation, no copies | The CPU stays idle while the bytes sit in the buffer | CPU; NIC; **Mempool** | Hold wide | CPU dims; no red anywhere | Zero-copy path: no red |
| 23 | 103.95 | 108.72 | Every stage works with the same buffer | Bring in the four stages around the stationary buffer | **MISSING: packet buffer (3D)** (or the Mempool tile's BUFFER half, see Phase 4); *local:* parser, classifier, firewall, routing | Pull back to frame buffer + stages | Stages fade in; buffer does not move | Buffer stationary |
| 24 | 109.50 | 111.32 | The parser receives the mbuf | Handle visits the parser | *local:* handle, parser; **MISSING: mbuf (3D)** as the handle's referent | Track the handle | Handle moves to the parser; parser highlights, then returns to normal | Only the handle moves |
| 25 | 111.34 | 113.25 | The classifier receives the same mbuf | Handle → classifier | *local:* handle, classifier | Track | Same | Same handle, same buffer |
| 26 | 113.87 | 115.81 | The firewall receives the same mbuf | Handle → firewall | *local:* handle, firewall | Track | Same | Same |
| 27 | 116.39 | 119.24 | Routing receives the same mbuf | Handle → routing | *local:* handle, routing | Track | Same | Same |
| 28 | 119.24 | 123.71 | Each gets only a handle to the original buffer | Show the handle's line back to the one buffer from every stage | *local:* handle; **MISSING: packet buffer (3D)** | Pull back: all four stages, one buffer | Faint reference lines from each stage converge on the buffer | Handle = address, not bytes |
| 29 | 124.23 | 126.61 | The buffer never moves | Hold on the buffer, unmoved | **MISSING: packet buffer (3D)** | Static lock-off | Buffer outline steady; stages dim | Buffer stationary |
| 30 | 126.63 | 132.42 | A header edit happens in place | Header bytes change inside the same buffer | **MISSING: packet buffer (3D)** with header/payload regions | Close-up on the header | Header cells re-colour in place; payload untouched | In place; no second buffer; no red |
| 31 | 133.01 | 136.87 | Bytes still where the NIC placed them | Reveal the NIC alongside the unchanged buffer | NIC; **MISSING: packet buffer (3D)** | Pull back to NIC + buffer | DMA path faintly re-traced | Same location since DMA |
| 32 | 136.87 | 139.26 | The key idea | Wide shot of the whole arrangement | NIC; **Mempool**; *local:* stages, handle | Wide | Everything at rest | — |
| 33 | 139.92 | 141.58 | The packet isn't travelling | Bytes stay; emphasise their stillness | **MISSING: packet buffer (3D)** | Hold | Bytes glow steadily | Bytes do not move |
| 34 | 142.08 | 143.10 | Only the pointer is | Handle pulses and moves once | *local:* handle | Track the handle | Handle hop | Only the pointer moves |
| 35 | 143.70 | 146.03 | Passing a pointer is cheap | Size contrast begins | *local:* handle; **MISSING: packet buffer (3D)** | Side-by-side framing | Handle and buffer shown at true relative scale | — |
| 36 | 146.05 | 155.94 | 8-byte address vs hundreds–thousands of bytes | Scale comparison: tiny handle, large payload | *local:* handle, size bars; **MISSING: packet buffer (3D)** | Slow push between the two | Size bars grow (8 B vs payload) | Only the narration's figures; no new claims |
| 37 | 155.94 | 158.79 | Millions of packets a second | Many handles, one pool | **Mempool**; *local:* handles | Pull back over the pool | Many handles flicker across many tiles | No per-element state |
| 38 | 159.53 | 167.34 | With copies, the CPU would just move bytes | Contrast: ghost of act 1's red copies at scale | CPU; **MISSING: packet buffer (3D)** | Cut to the CPU | Faint red copy ghosts (act-1 language, clearly hypothetical) | Red only for CPU copies |
| 39 | 168.06 | 183.94 | Removing copies cuts CPU, bandwidth, cache cost | Ghosts fade; the CPU frees up | CPU; NIC; **Mempool** | Slow orbit back to the system | Red ghosts dissolve; CPU calms | No unsupported numeric claims on screen |
| 40 | 183.94 | 190.37 | The NIC transmits from the same buffer | DMA read: same buffer → NIC | NIC; **Mempool** (or **MISSING: packet buffer (3D)**); PacketAnimator | Follow the bytes from the buffer to the NIC | Token leaves the BUFFER half toward the NIC in the DMA colour | Transmit = DMA read from the same buffer; no CPU copy |
| 41 | 191.15 | 196.88 | The buffer goes back to the pool for reuse | The emphasis on the representative element clears | **Mempool** | Pull back over the pool | Marker fades; nothing labelled free/returned | No runtime state |
| 42 | 197.42 | 199.69 | Allocated only once | The pool, unchanged since sentence 17 | **Mempool** | Hold wide | Brief pool highlight | — |
| 43 | 200.15 | 201.13 | Never copied | No red anywhere | **Mempool** | Hold | — | No red |
| 44 | 201.69 | 207.04 | Only the mbuf, the handle, was passed | The handle again, beside its mbuf | *local:* handle; **MISSING: mbuf (3D)** | Push-in on the mbuf and handle | Handle highlight | Handle = mbuf reference |
| 45 | 207.04 | 214.80 | A packet is a pointer to its bytes | Payoff: one buffer, its bytes, one yellow handle pointing at them | **MISSING: packet buffer (3D)**; **MISSING: mbuf (3D)**; *local:* handle | Settle on the buffer, then rack to the handle | Handle highlights; the reference glows | One buffer, one set of bytes, one handle |
| 46 | 215.81 | 217.86 | The essence of zero copy | Hold the payoff frame through the end of the voiceover | Same as 45 | Static | Hold | — |

## Coverage

All 47 sentences (0–46) have a visual intention above. 26 of them depend on at least one
component marked **MISSING**: the packet buffer in sentences 1, 4–11, 15–16, 23, 28–31, 33,
35–36, 38, 40 and 45; the mbuf in sentences 13–15, 24, 44 and 45.

## Phase 4 — component check

Run against `assets/library.yaml`, `renderers/three/src/` and `docs/asset-library/roadmap.md`.

| Required visual | Exists in Three.js? | Verdict |
|---|---|---|
| NIC | Yes, released | Reuse |
| PCIe | Yes, released | Reuse if the shot needs the link (not required by the narration) |
| CPU | Yes, released | Reuse |
| Mempool with `[MBUF │ BUFFER]` elements | Yes, prototype; 12 identical tiles, one part | Reuse for the pool shots |
| Packet tokens | Yes, `core/PacketAnimator.js` | Reuse |
| Overlay titles and captions | Yes, `video/overlay/widgets/` | Reuse |
| **mbuf** (fields, buf_addr) | **No**: registered asset, Manim actor only | **MISSING REUSABLE COMPONENT** |
| **Packet buffer** holding bytes, with header/payload | **No**: no asset; roadmap says "undecided" | **MISSING REUSABLE COMPONENT** |
| Parser, classifier, firewall, routing | No, and not assets | Episode-local (allowed) |
| Pointer/handle | No reusable 3D pointer | Episode-local (allowed by §11) |
| Application (act 1) | No, and not hardware | Episode-local marker |

Both missing components are reusable system components already named in the asset library, so
the brief (§4, §14, §23) requires stopping before building them. Implementation has not begun.
