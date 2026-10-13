# AxioByte E02 — YouTube Publishing Package

**Episode:** s01e02-zero-copy: "Zero-copy — a packet is just a pointer"

**Video (frozen, accepted):** `episodes/s01e02-zero-copy/out/s01e02-zero-copy.three-final-cta-branded-v2.mp4`

- sha256 `e32e052e167e7c84…`
- H.264 High 1920×1080, 30 fps; AAC-LC 48 kHz mono
- 3:42.8 (222.8 s)
- −16.9 LUFS integrated

**Sources:**

- the narration (`timeline/words.json`) and the film's section boundaries (`three/storyboard.js`);
- the YouTube section of the frozen `social/caption.txt`;
- the brand policy (`docs/brand/AXIOBYTE_BRAND.md`). On YouTube the handle is **@theaxiobytes**.

This package replaces only the YouTube *metadata*. `caption.txt` stays frozen. Its YouTube chapter list was wrong (see *Chapters*), so use the one below.

---

## Title

```
Zero Copy Explained: Why a Packet Is Just a Pointer (DPDK mbuf & mempool)
```

- 73 characters, under YouTube's 100.
- This is the title already established in `caption.txt`, kept unchanged. It says exactly what the episode argues (the closing line: *"a packet is often best thought of not as a collection of bytes, but as a pointer to those bytes"*). It also names the two DPDK terms a technical viewer searches for.
- No superlatives and no claims the film doesn't make.

## Description

Paste everything inside the block. The first two lines are what YouTube shows before "…more".

```
What if a packet never had to move? In high-performance networking, the bytes are written into memory once — and from then on, only a pointer to them travels.

This episode shows, step by step, how zero-copy packet processing works in DPDK: why traditional networking copies packet bytes across system boundaries, what an mbuf actually is, how the mempool prepares buffers before any packet arrives, and why every processing stage can work on the same buffer.

WHAT YOU'LL LEARN
• The copy tax: in the traditional path, the NIC receives a packet into one buffer, then the CPU copies the bytes into another buffer for processing — and may copy them again before transmission. Every copy costs CPU cycles, memory bandwidth and cache.
• Zero copy: instead of copying the packet, pass a reference to it.
• The mbuf: a small metadata structure — packet length, protocol details and, most importantly, the address where the packet's bytes begin. Metadata, not the bytes.
• The mempool: before any packet arrives, DPDK allocates a collection of fixed-size packet buffers, ready to be used.
• DMA into the buffer: the NIC writes the incoming bytes straight from the wire into a free buffer from the mempool — no CPU involvement, no dynamic allocation, no copy.
• One buffer, every stage: the parser, classifier, firewall and routing logic each receive the same mbuf — a handle to the original buffer. Even a header change is made in place.
• Why it is cheap: passing a pointer is typically an 8-byte address on a 64-bit system, compared with copying hundreds or thousands of bytes for every packet — at millions of packets per second.
• Transmit: the NIC sends the packet from the exact same buffer, which then returns to the mempool for the next packet.

The packet buffer is allocated once and never copied. Only the handle moves.

CHAPTERS
0:00 The library analogy
0:17 The traditional packet path
0:46 Zero copy: the mbuf
1:10 The mempool
1:43 One buffer, every stage
2:16 Why it is cheap
3:03 Transmit from the same buffer
3:17 A packet is a pointer

ABOUT AXIOBYTE
Systems that power the Internet — explained from first principles. Linux kernel, DPDK, networking, distributed systems and performance engineering, one concept at a time.

Every concept has an axiom.

Follow AxioByte for more: subscribe to @theaxiobytes on YouTube · Instagram: @axiobyte

#ZeroCopy #DPDK #Networking #SystemsProgramming #PacketProcessing #HighPerformanceNetworking #ComputerSystems
```

**Grounding:** every technical statement above is said in the narration or shown in the film.

- The copy path, mbuf, mempool, DMA, the four stages, in-place edits, 8 bytes on 64-bit, millions of packets per second, transmit from the same buffer, and return to the mempool are all spoken.
- The film's payoff card adds "tens–hundreds of Gbit/s". The narration says *"tens or even hundreds of gigabits per second on modern hardware"*. The description deliberately leaves that number out.

## Chapters

```
0:00 The library analogy
0:17 The traditional packet path
0:46 Zero copy: the mbuf
1:10 The mempool
1:43 One buffer, every stage
2:16 Why it is cheap
3:03 Transmit from the same buffer
3:17 A packet is a pointer
```

Verified against the frozen film:

| Chapter | Starts at (narration) | Section in the film | Length |
|---|---|---|---|
| 0:00 The library analogy | 0.0 s, sentence 0 | `00 THE LIBRARY ANALOGY` | 17.8 s |
| 0:17 The traditional packet path | 17.85 s, sentence 4 | `01 TRADITIONAL PACKET PATH` | 28.4 s |
| 0:46 Zero copy: the mbuf | 46.27 s, sentence 10 | `02 ZERO COPY · THE MBUF` | 24.4 s |
| 1:10 The mempool | 70.66 s, sentence 17 | `03 THE MEMPOOL` | 33.3 s |
| 1:43 One buffer, every stage | 103.95 s, sentence 23 | `04 ONE BUFFER · EVERY STAGE` | 32.9 s |
| 2:16 Why it is cheap | 136.87 s, sentence 32 | `05 WHY IT IS CHEAP` | 47.1 s |
| 3:03 Transmit from the same buffer | 183.94 s, sentence 40 | `06 TRANSMIT` | 13.5 s |
| 3:17 A packet is a pointer | 197.42 s, sentence 42 | `07 A PACKET IS A POINTER` (and the end card) | 25.4 s |

- Each start is the storyboard's section boundary (`sentenceStart`), rounded down to the second.
- Rounding down is correct: a chapter may begin a fraction early, but never after its first word.
- Frames taken from the MP4 on both sides of every boundary show the previous section's chapter label before it and the new one after.
- YouTube's rules are met: 8 chapters (at least 3), the first at 0:00, in ascending order, and every chapter at least 10 s long (the shortest is 13.5 s).

**What was wrong in `caption.txt`:**

- 0:46 → 0:55 was 9 s, which makes YouTube disable *all* chapters.
- The Mempool was listed at 1:13; it starts at 1:10.
- Transmit was listed at 3:07; it starts at 3:03.

## Hashtags

```
#ZeroCopy #DPDK #Networking #SystemsProgramming #PacketProcessing #HighPerformanceNetworking #ComputerSystems
```

- These are the YouTube hashtags from `caption.txt`, kept: seven, all on-topic.
- YouTube shows the first three above the title (#ZeroCopy #DPDK #Networking).
- The Instagram set (`#CPlusPlus`, `#AxioByte`) is not used. The episode doesn't teach C++.

**Optional tags** (YouTube Studio → Tags; these are search terms, not hashtags):

```
zero copy, zero-copy networking, DPDK, DPDK mbuf, mbuf, mempool, packet buffer, packet processing, DMA, high performance networking, networking internals, systems programming
```

## Thumbnail

**Files:**

- `episodes/s01e02-zero-copy/out/youtube/thumbnail.png` (1280×720; upload this one)
- `episodes/s01e02-zero-copy/out/youtube/thumbnail.jpg` (the same at quality 0.92, if a smaller file is preferred)
- Previews: `thumbnail-preview-640x360.png`, `-320x180.png`, `-168x94.png`

**Regenerate** with `node episodes/s01e02-zero-copy/social/youtube/thumbnail.mjs`. It is deterministic: headless Chrome, the self-hosted Barlow Semi Condensed, and colours read from `systems.yaml`. The drawing is in `thumbnail.html`. Renders are never committed, so the PNG/JPG live in the gitignored `out/` and the source lives here.

**Concept:** **ZERO COPY**, with one supporting line, **ONLY THE POINTER MOVES**. Below them:

- the packet's **BYTES** (blue) arrive by DMA into **ONE BUFFER** (violet) and stay there;
- the **handle** (yellow) passes from stage to stage: PARSER → CLASSIFIER → FIREWALL → ROUTING, the four stages the narration names;
- dashed yellow references run from every stage back to that same buffer.

**Colours:** the episode's semantic roles: blue = bytes / DMA, violet = the buffer, yellow = the handle / pointer. There is no red, because nothing is copied. The brand palette isn't used for technical objects.

**Logo: deliberately not on the thumbnail.**

- YouTube shows the channel avatar beside every thumbnail, so the brand is already present.
- The only canonical asset is the full lockup with its tagline, which becomes illegible clutter at thumbnail scale.
- The mark-only ∀ asset is a future brand task that hasn't been done.
- No logo was redrawn or approximated.

## Upload Checklist

Nothing has been uploaded. Do the upload by hand in YouTube Studio.

- [ ] **Video file:** `episodes/s01e02-zero-copy/out/s01e02-zero-copy.three-final-cta-branded-v2.mp4`. Before uploading, check `shasum -a 256` starts `e32e052e167e7c84`.
- [ ] **Title:** as above.
- [ ] **Description:** paste the whole Description block. It already contains the chapters and the hashtags.
- [ ] **Chapters:** after processing, open the video and check the chapter markers appear on the progress bar. If they don't, check that the CHAPTERS lines were pasted unchanged and start at `0:00`.
- [ ] **Hashtags:** in the description, as above. Don't add hashtags to the title.
- [ ] **Thumbnail:** upload `out/youtube/thumbnail.png`.
- [ ] **Audience:** "No, it's not made for kids". This is technical systems-programming education for adult and student developers. No age restriction is needed.
- [ ] **Category / language:** Education; video language English.
- [ ] **Visibility:** upload as **Private** (or Unlisted) first. Watch the processed HD version end to end, check the chapters, the thumbnail and the end card, then switch to **Public** or schedule it.
- [ ] **Playlist:** none exists in this repository's records. If there is a series playlist for the AxioByte systems episodes (E01 "kernel slow" precedes this one), add it there. Otherwise consider creating one, for example "AxioByte Systems — High-Performance Networking".
- [ ] **Captions:** upload `episodes/s01e02-zero-copy/out/youtube/s01e02-zero-copy.en.srt`. In Studio: the video → **Subtitles** → **English** → **Add** → **Upload file** → **With timing**.
  - Generated from the voiceover's word timings by `node episodes/s01e02-zero-copy/social/youtube/subtitles.mjs` (deterministic).
  - Every narrated word is included, in order, with three transcription fixes: "mBuff" → "mbuf" (7×), "passer" → "parser", and "no CPU…" capitalised.
  - 65 cues, at most two lines of 42 characters each, with no overlaps.
  - If YouTube's automatic English track also appears, unpublish it so viewers get the corrected one.
- [ ] **End screen:**
  - The film already ends with the AxioByte end card: 3.5 s of logo, "FOLLOW AXIOBYTE FOR MORE" and @theaxiobytes, from 3:39.3.
  - YouTube end-screen elements need at least the last 5 s, so they would overlap the last ~1.5 s of the film and then sit on top of the card's logo and text.
  - Recommendation: **no end-screen elements**, or at most one small subscribe element placed in a top corner, clear of the centred logo, call and handle.
- [ ] **Cards:** optional. A card linking E01 near 0:17 (the traditional packet path) would fit, if E01 is on the channel.
- [ ] **Final check before Public:** title spelling, description renders with its bullet points, chapters visible, thumbnail correct, audience setting saved, comments setting as wanted.
