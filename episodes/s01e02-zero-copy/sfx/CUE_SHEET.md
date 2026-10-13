# E02 Zero Copy — SFX cue sheet (experimental, v1)

An audio post-production pass over the **frozen** master. The film, its voiceover and its end card are not changed. The derivative only adds an SFX layer.

| | |
|---|---|
| Frozen master (input, untouched) | `out/s01e02-zero-copy.three-final-cta-branded-v2.mp4` (sha256 `e32e052e167e7c84…`) |
| Derivative (output) | `out/s01e02-zero-copy.three-final-cta-branded-sfx-v1.mp4` |
| Audio preview (voiceover + SFX) | `out/sfx/preview-mix.wav` (float, stereo); `out/sfx/preview-mix.m4a` (for listening) |
| SFX stem only | `out/sfx/sfx-stem.wav` |
| Each cue's sound, unlevelled | `out/sfx/assets/<cue>-<family>.wav` |
| Build report / masking data | `out/sfx/report.json`, `out/sfx/masking.json` |
| Source (this folder) | `lanes.mjs` (the storyboard's event times), `build.py` (synthesis, mix, mux), this sheet |

## Pipeline

```
node   episodes/s01e02-zero-copy/sfx/lanes.mjs          # storyboard lanes -> out/sfx/lanes.json (read-only build of the E02 storyboard)
python episodes/s01e02-zero-copy/sfx/build.py preview   # SFX stem + preview mix + report
python episodes/s01e02-zero-copy/sfx/build.py video     # + derivative MP4
```

1. **Timing.** Every cue time is taken from the storyboard's `lanes`: the same values that drive the animation, each anchored to a spoken word. None comes from the subtitle file. A frame from the master at every cue onset was checked by eye.
2. **Voiceover bed.** The master's own audio track, decoded to 48 kHz. It is never gained, filtered, compressed, normalised or moved. Mix = voiceover + SFX on both channels.
3. **SFX.** Synthesised procedurally in `build.py` (numpy/scipy, seeded noise), so every build gives the same samples.
   - No third-party, stock or licensed audio is used. There are no licensing questions.
4. **Levels.** Each cue's loudest 100 ms is set relative to the narration reference: the 95th percentile of 400 ms RMS over speech, −13.5 dBFS.
   - The SFX are then ducked a further **6 dB under speech** (60 ms attack, 350 ms release).
   - A headroom guard may lower only the SFX where the sum would pass −1 dBFS. It never acted.
5. **Mux.** The master's video stream is **copied** (`-c:v copy`, no re-encode). The new audio is AAC-LC 256 kb/s stereo at 48 kHz, trimmed to the master's exact 222.800 s.

## Vocabulary

There are 12 sound designs across 19 cues. Each family is one sound idea, with variations by parameter.

| Family | Meaning (E02 semantics) | Sound |
|---|---|---|
| `crate` | analogy: physical moving work | a soft woody knock and a smaller settle |
| `fold` | major transition, analogy → system | a rising band of air over a low A/E pad |
| `dma` | **BLUE: bytes / DMA**, a real data transfer | a clean sweep above the vowel range (1.3→2.6 kHz receiving, 2.6→1.35 kHz transmitting) with a regular high "data stream" tick texture |
| `copy` | **RED: CPU copy / cost** | a grainy, irregular, effortful transfer over a low working hum. Two variations (the second lower), the same family |
| `pointer`, `pointer-tick`, `pointer-run` | **YELLOW: pointer / handle / reference** | one thin sine line, a light air, a tiny glassy tick on arrival. **No data texture**: a pointer moving is never a data transfer. The run is ticks only |
| `appear` | a technical object appears (the mbuf) | a soft clean bloom (G, D, G) |
| `pool` | memory: prepared reusable storage | a low thud, then a short cascade of muted slots across the stereo field |
| `edit` | memory access, a write in place | two small precise clicks and a faint shimmer |
| `settle` | memory: an element returned | one soft low settle and a single muted slot |
| `resolution` | the concept resolves | one quiet open D chord (D A D F♯), same pitches on both channels (mono-safe) |

## Cue sheet

- **Level** is relative to the narration reference, before ducking.
- **Peak** is the cue's peak in the final SFX stem, in dBFS.
- **Speech margin** is how far the narration sits above the SFX in the speech band (300 Hz–4 kHz), on the quietest 10 % of speech frames inside the cue. Higher is safer.

| Cue | Time | Dur. | Visual event | Narration | Purpose | Family | Level | Peak | Fade in / out | Priority | Time source | Speech margin (dB) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | 0:05.13 | 0.50 s | crates are loaded onto the truck bed | “You pack all the books into a truck, drive them to a new building, unload them, and repe…” | make the analogy physical: moving the whole library is heavy, real work | `crate` | -24 dB | -32.8 | 2 ms / 80 ms | minor | `analogy.load1 (W 'pack', s1)` | 43.6 |
| C02 | 0:16.81 | 2.60 s | the crates fold into blue bytes; the scene becomes the technical floor (chapter 01) | “That's exactly what traditional packet processing does.” | major transition: from the analogy into the system | `fold` | -26 dB | -33.5 | 0.40 s / 0.90 s | major | `analogy.toBytes -> dissolve (S4)` | 10.9 |
| C03 | 0:29.72 | 1.10 s | DMA: the NIC writes the packet into buffer A (blue line, bytes fill the buffer) | “The network interface card, or NIC, receives the packet into one buffer.” | BLUE = data/DMA: the bytes arrive once, by hardware, no CPU | `dma` | -27 dB | -39.0 | 0.12 s / 0.37 s | semantic | `lanes.dma` | 15.5 |
| C04 | 0:31.96 | 1.70 s | CPU COPY: bytes travel buffer A -> CPU -> buffer B on the red path | “Then those bytes are copied into another buffer for processing.” | RED = copy/cost: the first copy, heard as effortful work | `copy` | -20 dB | -30.4 | 60 ms / 180 ms | semantic | `lanes.copy1` | 18.6 |
| C05 | 0:35.60 | 1.50 s | COPIED AGAIN: bytes travel buffer B -> the application | “They may be copied again before transmission.” | RED = copy/cost: the same family, a lower variation (the cost repeats) | `copy` | -21 dB | -30.1 | 60 ms / 180 ms | semantic | `lanes.copy2` | 18.7 |
| C06 | 0:48.71 | 0.14 s | the first small yellow reference appears ('A REFERENCE') | “Instead of copying the packet, it simply passes a reference to it.” | YELLOW = pointer: introduce the pointer's sound, alone and tiny | `pointer-tick` | -30 dB | -34.9 | 1.5 ms / 20 ms | minor | `lanes.reference` | 23.2 |
| C07 | 0:54.98 | 1.40 s | the MBUF card appears (cyan) | “The answer is an mBuff.” | a technical object comes into existence: metadata, not bytes | `appear` | -25 dB | -36.2 | 5 ms / 0.30 s | semantic | `lanes.mbuf` | 19.5 |
| C08 | 1:06.11 | 1.50 s | buf_addr: a yellow pulse travels the reference from the mbuf to the packet buffer | “It contains information like the packet length, protocol details, and most importantly, …” | YELLOW = pointer: an address resolving to its bytes; a thin sweep, NOT a data sound | `pointer` | -27 dB | -41.6 | 10 ms / 50 ms | semantic | `lanes.pulse (from -> reach)` | 13.4 |
| C09 | 1:13.37 | 1.50 s | the MEMPOOL grid rises: storage prepared before any packet arrives (chapter 03) | “Before any packet even arrives, DPDK allocates a large collection of fixed-size packet b…” | MEMORY: reusable prepared storage settling into place | `pool` | -23 dB | -35.9 | 4 ms / 0.30 s | major | `lanes.pool (S17 act 2)` | 44.1 |
| C10 | 1:33.05 | 1.10 s | DMA -> BUFFER: the NIC writes the incoming bytes into the element's buffer | “Instead, the NIC uses Direct Memory Access or DMA to stream the incoming bytes straight …” | BLUE = data/DMA: the same family as C03 (the bytes land once) | `dma` | -28 dB | -40.3 | 0.12 s / 0.37 s | semantic | `lanes.zdma` | 20.2 |
| C11 | 1:49.64 | 0.56 s | the yellow handle moves the mbuf -> PARSER | “The passer receives the mBuff.” | YELLOW = pointer: only the handle moves; the buffer and its bytes stay silent | `pointer` | -27 dB | -41.0 | 10 ms / 50 ms | semantic | `lanes.stage[0] (W 'passer', s24)` | 23.2 |
| C12 | 1:51.46 | 0.56 s | the yellow handle moves PARSER -> CLASSIFIER | “The passer receives the mBuff.” | YELLOW = pointer: only the handle moves; the buffer and its bytes stay silent | `pointer` | -29 dB | -43.9 | 10 ms / 50 ms | semantic | `lanes.stage[1] (W 'classifier', s25)` | 14.5 |
| C13 | 1:54.03 | 0.56 s | the yellow handle moves CLASSIFIER -> FIREWALL | “The firewall receives the same mBuff.” | YELLOW = pointer: only the handle moves; the buffer and its bytes stay silent | `pointer` | -29 dB | -42.9 | 10 ms / 50 ms | semantic | `lanes.stage[2] (W 'firewall', s26)` | 28.4 |
| C14 | 1:56.51 | 0.56 s | the yellow handle moves FIREWALL -> ROUTING | “The routing logic receives the same mBuff.” | YELLOW = pointer: only the handle moves; the buffer and its bytes stay silent | `pointer` | -29 dB | -42.3 | 10 ms / 50 ms | semantic | `lanes.stage[3] (W 'routing', s27)` | 26.5 |
| C15 | 2:10.26 | 0.45 s | EDITED IN PLACE: the header bytes are rewritten where they sit | “Even if a router needs to modify a header or change an address, it modifies the bytes ri…” | MEMORY ACCESS: a write without motion | `edit` | -29 dB | -29.0 | 1 ms / 0.10 s | minor | `lanes.edit (W 'modifies', s30)` | 33.4 |
| C16 | 2:22.52 | 2.30 s | 'Only the pointer is': the handle runs the pipeline once more; the buffer stands still | “Only the pointer is.” | YELLOW = pointer: ticks only, no sweep, no data texture | `pointer-run` | -31 dB | -35.5 | ticks, 1.5 ms / 20 ms | minor | `lanes.runs[0] (W 'pointer', s34)` | 32.8 |
| C17 | 3:07.28 | 1.30 s | TRANSMIT: the NIC reads the same buffer by DMA; the blue token travels buffer -> NIC | “Finally, when packet processing is complete, the NIC transmits the packet using the exac…” | BLUE = data/DMA, the opposite direction: a real byte transfer, unlike the pointer | `dma` | -30 dB | -42.7 | 0.30 s / 0.43 s | semantic | `lanes.transmit (W 'transmits', s40)` | 7.2 |
| C18 | 3:13.08 | 0.60 s | BACK TO THE MEMPOOL: the element returns, ready for the next packet | “After transmission, that buffer is returned to the mempool, ready to be reused for the n…” | MEMORY: a quiet settle: storage reused | `settle` | -26 dB | -37.7 | 3 ms / 0.15 s | minor | `lanes.representative.to (W 'returned', s41)` | 51.3 |
| C19 | 3:33.31 | 4.20 s | '…a pointer to those bytes': the pool settles away; only the pointer and its bytes remain | “That's why, in high-performance networking, a packet is often best thought of not as a c…” | FINAL CONCEPT RESOLUTION: one quiet open chord under the closing line | `resolution` | -23 dB | -34.3 | 0.25 s / 1.2 s | major | `W('pointer', 45) = lanes.finale.from + 0.6` | 13.7 |

**Count:** 19 cues in 3:42.8. There is **silence from 3:39.3 to the end**: the AxioByte end card gets no sound.

## Deliberately omitted

| Event | Why there is no sound |
|---|---|
| The truck driving, unloading, repeating; the second load (0:06–0:15) | One physical cue makes the analogy tangible. More would make the opening a cartoon |
| The bytes flying into the NIC port, and their path through the card (0:19–0:24) | It overlaps the fold transition (C02). The first meaningful data event is the DMA (C03) |
| COST OF COPYING / ZERO COPY / THE PAYOFF cost lists | Text appearing; the narration carries it |
| Camera moves, chapter labels, callout cards | Never sounded: that's the "sound on every animation" trap |
| The handle's second run, "The packet buffer never moves" (2:04.9) | It repeats C11–C14 within ten seconds. The silence on the still buffer is the point |
| The handle's third run, "Only the mbuf … was passed" (3:23.5) | The third repetition. The ending is reserved for the single resolution (C19) |
| "Millions of packets a second" handles (2:36–3:03) | Many handles at once would mean many sounds; the narration and picture carry the scale |
| The buffer's highlight pulses ("the same packet buffer", "never copied") | The bytes don't move, so they make no sound. This is the teaching distinction |
| The end card (3:39.3–3:42.8) | The frozen brand card stays silent. No brand sound was invented |

## What to listen for (the measurements can't judge these)

1. **C17 (transmit DMA, 3:07.3)** has the smallest speech margin (7.2 dB on the quietest speech fragments). It starts on "transmits"; its 0.3 s swell is meant to let the word through. Lower it, or drop it, if it competes.
2. **C02 (fold, 0:16.8)** is the biggest gesture, under "does. / In traditional networking". It should feel like a turn of the page, not a whoosh.
3. **C04/C05 (copies)** should read as *effort*: grainy, a little heavy. They should be clearly different from the clean DMA (C03) and the thin pointer (C08, C11–C14).
4. **C11–C14 (handle hops)** rise a step each (C, D, E, G). They should feel like progress, not like a melody.
5. **C19 (resolution)** sits under "…a pointer to those bytes. And that's the essence of zero copy." It should be felt rather than heard.

All 12 sounds can be auditioned on their own in `out/sfx/assets/`.
