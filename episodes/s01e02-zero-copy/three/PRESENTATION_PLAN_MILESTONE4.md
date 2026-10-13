# E02 — Milestone 4 plan: Mempool → representative element → DMA (sentences 17–22)

## Narration (from `timeline/words.json`)

| # | Time | Words | Spoken idea |
|---|------|-------|-------------|
| 17 | 70.66–76.41 | "Before any packet even arrives, DPDK **allocates** (73.5) a large **collection** (74.5) of fixed-size packet buffers." | storage is prepared before any packet arrives |
| 18 | 77.15–78.83 | "This collection is called a **mempool**." | the collection has a name |
| 19 | 79.49–85.22 | "…a **warehouse** (80.4) filled with **thousands of empty packet containers** all **ready** (83.9) to be used." | many prepared, empty elements, waiting |
| 20 | 85.24–88.30 | "When the NIC **receives** (86.0) a packet, it **doesn't allocate new memory** (87.4)." | nothing is created when a packet arrives |
| 21 | 88.76–98.18 | "…the NIC uses Direct Memory Access or **DMA** (92.1) to **stream** (93.1) the incoming bytes straight from the wire **directly into a free buffer in the mempool** (95.8–97.4)." | the NIC writes the bytes straight into an element's buffer |
| 22 | 98.18–103.13 | "**no CPU** involvement, **no** dynamic memory **allocation**, **no** unnecessary **copies**." | no CPU, no allocation, no copy |

## Starting point (milestone 3, frozen)

The film ends sentence 16 on the mbuf → `buf_addr` → buffer A → bytes. The milestone 2 zero-copy core already supplies most of the model:

- the real Mempool asset, downstage of buffer A;
- its first element outlined as the representative, with a magnifier from that tile to an outline around the mbuf and buffer A. That pair is the element shown enlarged, so there is one buffer, never two;
- the zero-copy DMA landing in buffer A;
- the tile's BUFFER half lighting as the bytes land.

The audit found five problems:

- Five card collisions, with buffer A and with the NIC.
- The pool is filmed flat from above, like a UI grid, and rises while its print fills the bottom of the frame.
- During the DMA the representative tile is off screen, so the "enlarged" relationship is not visible when it matters.
- The NIC dominates sentence 22, at up to 28 % of the frame.
- One card says "buffers allocated up front", which edges toward the banned state words.

## Sentence by sentence

- **17.** "Before any packet even arrives": buffer A's bytes clear. The scene steps back to before arrival; nothing flies anywhere. The camera pulls back from the buffer. On "allocates… a large collection" the real Mempool rises into place downstage of the mbuf and buffer A: storage prepared up front. Card: `BEFORE ANY PACKET ARRIVES — storage prepared in advance`, on the empty floor right of the pool.
- **18.** The camera settles on the pool. Card: `MEMPOOL — each element: an mbuf + its buffer`, in the same zone, beside the pool and never over it. The highlighter lifts the pool briefly.
- **19.** The warehouse is the pool itself, filmed low and raking along its rows so the elements recede in depth: many prepared containers, empty and waiting. No new metaphor scene and no state labels. On "ready to be used" one element is singled out: its tile is outlined, and the magnifier rays open to the enlarged pair. Card: `ONE REPRESENTATIVE ELEMENT — shown enlarged for clarity`, on the empty floor left of the pool.
- **20.** "When the NIC receives a packet": the packet crosses the card again. The camera holds the NIC, the enlarged pair and the pool tile together. Nothing is created: the element already exists, outlined.
- **21.** "…DMA to stream the incoming bytes…": the blue DMA runs from the NIC into buffer A's payload, the enlarged element's BUFFER, and the bytes fill it. The tile's BUFFER half lights at the same moment, and the camera keeps the tile in frame so the two read as one element. The mbuf half stays metadata, and nothing lands on the mbuf or on the pool tray. Card: `DMA → BUFFER`, in the same zone as sentence 5's DMA card.
- **22.** "no CPU…": the camera includes the CPU, unlit, with no red, beside the filled buffer and the blue DMA. The chips `NO CPU · NO ALLOCATION · NO COPY` appear on their words, as one group in the zone where sentence 8's costs appeared: the answer stands where the problem stood.

## Distinctions kept

| | Shown as | Never shown as |
|---|---|---|
| Mempool | the real asset: a tray of identical element tiles, each `[MBUF \| BUFFER]` | the packet, a runtime allocator, or a free/used map |
| mbuf | metadata: the cyan record (enlarged) and the tile's left half | a container of bytes or a DMA target |
| BUFFER | buffer A (enlarged) and the tile's right half | a second, independent buffer |
| DMA | blue, NIC → buffer A's `dma_target` | landing on the mbuf, the pool or the tray |
| CPU | present, unlit, no red | taking part |

## Camera

Pull back from the buffer → settle on the pool → a low, raking glide along its rows (the warehouse) → widen to tile, magnifier and enlarged pair → NIC and pair, with the tile in shot → DMA into the buffer, with the tile still in shot → the CPU, idle, beside the filled buffer.

## Not in 17–22

No runtime state (free, used, allocated, recycled, returned, refcount changes), no descriptor ring, no host-memory or PCIe composition, no processing stages (sentence 23), and no asset changes.
