# E02 — REBUILD THE VIDEO AS A REAL AXIOBYTE STUDIO FILM

We need to rebuild:

episodes/s01e02-zero-copy/

The current rendered E02 video is REJECTED.

Do NOT polish the current video.
Do NOT add more 2D Manim animations to the existing implementation.
Do NOT merely fix missing frames or timing.

The fundamental problem is visual architecture:

The current render is overwhelmingly flat 2D Manim:
- rectangles
- cards
- text panels
- flat labels
- repeated static compositions

It does not meaningfully use the AxioByte Studio assets/components that we have already built.

The result is visually weaker than the earlier manually created E02 video.

We need to rebuild E02 as a genuine AxioByte Studio educational film.

============================================================
## 1. ABSOLUTE IMMUTABLE INPUTS
============================================================

The following are LOCKED and MUST NOT be modified:

1. Existing voiceover audio 
2. Existing timeline.json / word-level timestamps
3. Existing sentence timings
4. Existing sentence ordering
5. Existing narration
6. Existing episode duration
7. Existing semantic meaning of the narration
8. Released AxioByte assets
9. Released asset registry semantics
10. NIC-host composition semantics
11. Website
12. Release artifacts
13. Git tags/releases

The supplied voiceover.mp3 and timeline.json is the authoritative voiceover  timing source.

Use the supplied:
voiceover.mp3

and the existing episode timing data timeline.json.

The voiceover MUST remain exactly as it is.

DO NOT:
- rewrite narration
- regenerate narration
- change audio
- retime audio
- stretch audio
- insert pauses
- remove pauses
- reorder sentences
- change sentence boundaries
- change word timing

The visual system must adapt to the existing narration.

============================================================
## 2. FIRST — AUDIT THE CURRENT SYSTEM
============================================================

Before changing code, inspect the repository and understand what already exists.

Inspect at minimum:

episodes/s01e02-zero-copy/
episodes/s01e03-what-is-a-nic/

renderers/three/
renderers/three/src/
renderers/three/test/

experiences/
assets/
assets/library.yaml

renderers/three/src/compositions/nic_host/

src/axiobyte_studio/backends/manim/

src/axiobyte_studio/backends/

tests/

Also inspect the existing E03 Three.js implementation because E03 is currently the strongest example of an actual AxioByte Studio film.

Study how E03 uses:
- actual AxioByte assets
- camera movement
- composition
- staging
- asset inspection
- highlights
- transitions
- 3D spatial relationships
- NIC-host composition
- DMA path
- semantic relationships

Do not blindly copy E03.
Use it to understand the intended production quality and renderer architecture.

============================================================
## 3. EXISTING AXIOBYTE ASSETS YOU SHOULD REUSE
============================================================

The following already exist and SHOULD be reused where appropriate.

Do not recreate them as flat rectangles.

Relevant existing assets/components include:

### NIC
Actual AxioByte NIC asset.

Use the real NIC geometry.

### NIC-host composition
Existing composition:

renderers/three/src/compositions/nic_host/

This already represents:

NIC
→ PCIe
→ CPU
→ Host Memory

and includes the DMA path.

Use this composition where the narration discusses the actual packet/data path.

### PCIe
Existing released PCIe asset.

Use the actual PCIe geometry when the visual needs to show:
- NIC connection
- PCIe link
- host-side connection

### CPU
Existing released CPU asset.

Use it where the narration needs to establish:
- CPU involvement
- CPU copy
- CPU processing
- CPU not copying packet data in zero-copy path

### Mempool
Existing modernized Mempool asset.

It now represents elements as:

[ MBUF | BUFFER ]

Use the actual Mempool asset.

Do NOT redraw the mempool as a generic 2D table.

### mbuf
Existing mbuf semantic/model/visual representation.

Use it where the narration explains metadata and buf_addr.

### Memory buffer
Existing memory-buffer representation.

Use it to show where the packet bytes actually reside.

### Pointer / handle
Use the existing pointer/handle visual language if available.

If a reusable 3D pointer/handle component exists, use it.

If it does not exist, do not silently invent a fake AxioByte asset.

### DMA / COPY / REFERENCE / TRANSMIT
Use existing AxioByte visual primitives/components where available.

These are interactions, not new assets.

============================================================
## 4. IMPORTANT — DO NOT CREATE FAKE ASSETS
============================================================

If the required visual concept does not have an existing reusable AxioByte asset/component, determine whether it is:

A. an existing asset that should be reused

B. an episode-local conceptual object that is reasonable to create

C. a missing reusable AxioByte component

For example:

parser
classifier
firewall
routing

are NOT currently registered AxioByte hardware assets.

They can therefore be represented as episode-local conceptual processing stages.

They should NOT automatically become new global assets.

However, if some other required visual is actually a reusable hardware/system component and it does not exist, STOP before inventing it.

Report:

MISSING REUSABLE COMPONENT:
<name>

WHY IT IS NEEDED:
<reason>

WHERE IT IS NEEDED:
<sentences/shots>

WHAT IT SHOULD REPRESENT:
<description>

DO NOT create a fake approximation merely to make the episode render.

We will then decide whether to create that component separately.

============================================================
## 5. DEFAULT RENDERER POLICY
============================================================

Three.js should be the DEFAULT renderer for this episode.

The reason is simple:

E02 is explaining a spatial/dataflow concept involving:

NIC
memory
mbuf
buffer
mempool
DMA
CPU
processing stages
pointer/handle
transmit

These concepts benefit from:
- real 3D assets
- camera movement
- spatial continuity
- object persistence
- depth
- highlighting
- data movement
- inspection
- composition

Use Manim ONLY where it genuinely provides a better explanation.

Examples where Manim may still be appropriate:
- a very simple mathematical comparison
- a temporary conceptual 2D diagram
- a small annotation
- a concise formula/size comparison

But do NOT use Manim simply because it is easier.

The final film should visually feel like AxioByte Studio.

============================================================
## 6. VERY IMPORTANT VISUAL PRINCIPLE
============================================================

The central visual idea of this episode is:

THE BUFFER DOES NOT MOVE.

THE BYTES DO NOT MOVE THROUGH THE PROCESSING STAGES.

ONLY THE POINTER / HANDLE MOVES.

This must become visually obvious.

For the zero-copy section:

              BUFFER
                │
                │ stays here
                │
        ┌───────┴────────┐
        │ packet bytes   │
        └────────────────┘
                ▲
                │
              handle
                │
       parser → classifier
                → firewall
                → routing

Do NOT animate the packet/bytes travelling:

NIC → parser → classifier → firewall → routing

That would be semantically wrong.

Instead:

- buffer remains spatially stationary
- bytes remain inside the buffer
- a yellow pointer/handle travels between processing stages
- processing stages interact with the same buffer
- the pointer represents access to the existing bytes

This is the most important visual invariant in E02.

============================================================
## 7. USE THE VOICEOVER AS THE STORYBOARD
============================================================

There are 47 sentences.

Every sentence must have intentional visual coverage.

Do NOT allow long sections where the same static frame remains on screen while narration continues.

That was one of the major failures of the rejected render.

Before implementation, create:

episodes/s01e02-zero-copy/E02_VISUAL_PLAN.md

The plan must contain one row per sentence.

Columns:

sentence
start
end
narration_summary
visual_goal
assets_used
camera
animation
semantic_invariant

Example:

| sentence | visual | assets | invariant |
|----------|--------|--------|-----------|
| 5 | NIC performs DMA into buffer | NIC + memory buffer | DMA, not CPU copy |
| 6 | CPU copies buffer A → B | NIC/CPU + buffers | red COPY |
| 7 | CPU copies B → application | CPU + buffer | red COPY |
| 14 | mbuf metadata appears | mbuf | metadata ≠ packet bytes |
| 15 | buf_addr points to buffer | mbuf + buffer | pointer only |
| 21 | DMA lands in BUFFER half | NIC + Mempool | never into mbuf |
| 23 | same buffer persists | buffer + stages | only handle moves |

Every sentence must have a visual intention.

============================================================
## 8. REQUIRED NARRATIVE / VISUAL ARC
============================================================

Build the film as a sequence of meaningful visual shots.

Do not simply map every sentence to a new 2D card.

The film should have visual continuity.

------------------------------------------------------------
ACT 1 — TRADITIONAL PACKET HANDLING
------------------------------------------------------------

Sentences 1–13.

Establish the traditional model.

Use real/3D objects where possible.

The viewer should understand:

packet arrives
→ memory buffer
→ CPU copies
→ another buffer
→ application

Sentence 5:

NIC → buffer A

This is DMA.

It MUST NOT be shown as a red CPU copy.

Use a packet/data visualization entering buffer A.

Sentence 6:

buffer A → buffer B

This IS a CPU copy.

Use the established red COPY visual language.

Sentence 7:

buffer B → application

Again CPU copy.

Use red COPY.

The viewer should visually see that the bytes themselves are repeatedly copied.

Do NOT show three identical flat rectangles with arrows.

Use spatial composition and camera movement.

------------------------------------------------------------
ACT 2 — INTRODUCE mbuf
------------------------------------------------------------

Sentences 14–16.

Introduce the mbuf.

Use actual mbuf representation if available.

Show:

MBUF
metadata
buf_addr

Make the distinction extremely clear:

MBUF ≠ packet bytes

The mbuf stores metadata/reference information.

The actual packet bytes remain in the buffer.

Use camera focus/inspection rather than simply showing a text label.

Sentence 15:

buf_addr should visually point toward the buffer.

The visual language should communicate:

mbuf
   |
   | buf_addr
   ↓
BUFFER

Not:

mbuf = packet

------------------------------------------------------------
ACT 3 — MEMPOOL
------------------------------------------------------------

Sentences 17–20.

Use the actual AxioByte Mempool asset.

The Mempool element representation is:

[ MBUF | BUFFER ]

Use the real 3D Mempool.

Do NOT recreate it as a 2D grid.

Show multiple elements spatially.

Select/highlight one representative element.

Make the distinction:

MBUF = metadata
BUFFER = packet bytes

The pool itself is a preallocated collection.

Do not introduce runtime state such as:
FREE
IN USE
RETURNED

Those are NOT part of this visual model.

The representative element must be explicitly illustrative.

Use wording such as:

"one representative element"

if needed.

------------------------------------------------------------
ACT 4 — DMA INTO THE BUFFER
------------------------------------------------------------

Sentences 21–22.

This is one of the most important shots.

Use:

NIC
+
Mempool
+
representative [MBUF | BUFFER]

Show DMA from the NIC into the BUFFER half.

The DMA target MUST be:

BUFFER

NOT:

MBUF
NOT:
MEMPOOL

The bytes must visually appear inside the BUFFER portion.

The mbuf remains metadata.

This is the key transition:

Instead of copying packet bytes around,
the NIC writes them directly into the already allocated buffer.

The CPU should visibly NOT perform a copy.

Do not show a red arrow.

------------------------------------------------------------
ACT 5 — SAME BUFFER THROUGH PROCESSING
------------------------------------------------------------

Sentences 23–31.

Create a spatial row or spatial arrangement of episode-local processing stages:

PARSER
CLASSIFIER
FIREWALL
ROUTING

These are conceptual processing stages, not new AxioByte hardware assets.

The BUFFER remains physically stationary.

The bytes remain inside the buffer.

A yellow pointer/handle moves:

BUFFER
  ↑
handle
  ↓
PARSER
  ↓
CLASSIFIER
  ↓
FIREWALL
  ↓
ROUTING

But be careful:

Do NOT imply that the buffer moves from stage to stage.

Do NOT animate the packet itself moving between stages.

Do NOT make the mbuf travel.

The ONLY moving object is the pointer/handle.

Use a clearly distinct pointer/handle visual.

The pointer/handle should NOT use the mbuf color.

Processing stages may highlight temporarily while the handle visits them.

But after the handle leaves a stage:

the stage should return to its normal appearance.

Do not create permanent visited/in-use state.

------------------------------------------------------------
ACT 6 — IN-PLACE PROCESSING
------------------------------------------------------------

Sentences 30–31.

Show the packet header being modified in the SAME BUFFER.

For example:

before:
[ header | payload ]

after:
[ modified header | payload ]

But the underlying buffer remains the same object.

No red COPY.

No second buffer.

Make this visually obvious.

------------------------------------------------------------
ACT 7 — WHY ZERO COPY IS CHEAP
------------------------------------------------------------

Sentences 32–39.

Now pull the camera back.

The viewer should understand:

the packet bytes are not travelling.

Only a small handle/pointer travels.

Use the real buffer/mbuf representation as the anchor.

When the narration compares pointer size vs packet payload, use an appropriate concise visual.

Do not turn the entire section into text cards.

The visual should build on the same 3D scene.

Show:

large packet/buffer
small handle

Then scale the idea conceptually to many packets.

Do not invent unsupported numerical performance claims.

------------------------------------------------------------
ACT 8 — TRANSMIT
------------------------------------------------------------

Sentences 40–42.

Show the NIC transmitting from the SAME BUFFER.

This is important:

The NIC reads from the existing buffer.

It does not require another CPU copy.

Use the existing NIC asset.

Use DMA/transmit visual language.

The same buffer must remain the source.

Do not introduce:
BUFFER A
BUFFER B
BUFFER C

unless they are actually needed by the narration.

------------------------------------------------------------
ACT 9 — PAYOFF
------------------------------------------------------------

Sentences 42–46.

Return to the core visual.

The final visual should communicate:

ONE BUFFER
ONE SET OF BYTES
ONE HANDLE / POINTER

No unnecessary copies.

No unnecessary packet movement.

The final sentence:

"A packet is a pointer to its bytes."

should have a strong visual payoff.

Ideally:

camera settles on the buffer containing the packet bytes

then the pointer/handle is highlighted

then the conceptual relationship is clear.

Do not finish on a generic text card.

============================================================
## 9. CAMERA / CINEMATIC REQUIREMENTS
============================================================

This is an educational technical film.

Use cinematic but technically disciplined camera movement.

Examples:

- establish shot
- slow push-in
- orbit around NIC
- move from NIC to memory
- focus on MBUF
- focus on BUFFER half
- pull back to Mempool
- follow DMA
- track the handle
- return to stationary buffer
- close-up for in-place header modification
- pull back for final system view

Avoid:
- random camera motion
- excessive spinning
- constant zooming
- flashy transitions
- UI-like card switching
- presentation-slide layouts

Camera movement should explain the system.

============================================================
## 10. ASSET CONTINUITY
============================================================

Once an important object is introduced, prefer keeping it spatially persistent.

For example:

NIC
Mempool
representative buffer
processing stages

should not constantly disappear and reappear as unrelated cards.

The viewer should build a mental model of the system.

Use:
- opacity
- focus
- camera movement
- highlighting
- temporary overlays

rather than destroying and recreating the scene for every sentence.

============================================================
## 11. NO FAKE 3D
============================================================

Do not create pseudo-3D rectangles and call them AxioByte assets.

If an actual asset exists, use its real renderer implementation.

Examples:

NIC → actual NIC
Mempool → actual Mempool
PCIe → actual PCIe
CPU → actual CPU

Episode-local conceptual geometry is acceptable for:

parser
classifier
firewall
routing
pointer/handle
packet-byte emphasis
temporary explanatory markers

provided they are clearly episode-local and not registered as global assets.

============================================================
## 12. DO NOT ADD DESCRIPTOR RING
============================================================

E02 does NOT teach descriptor rings.

Do not add:

Descriptor Ring
RX Ring
TX Ring
Host Memory

simply because they exist elsewhere in AxioByte.

Use only what the narration requires.

This is a zero-copy / mbuf / mempool explanation.

============================================================
## 13. DO NOT ADD RUNTIME STATE
============================================================

Do not visually model:

FREE
IN USE
RETURNED
ALLOCATED
RELEASED

as runtime states.

The episode is explaining the static conceptual relationship.

The Mempool is a preallocated collection.

Keep the visual semantics stable.

============================================================
## 14. DO NOT BREAK RELEASED ASSET SEMANTICS
============================================================

Do not modify:

assets/library.yaml
released asset metadata
NIC
PCIe
CPU
NIC-host semantics
Descriptor Ring semantics
Mempool registry semantics

unless the audit proves an actual bug.

If you discover a missing reusable asset/component:

STOP and report it.

Do not silently modify the global asset architecture.

============================================================
## 15. IMPLEMENTATION ARCHITECTURE
============================================================

Prefer creating a dedicated Three.js E02 film implementation.

For example, something along the lines of:

episodes/s01e02-zero-copy/three/

and/or:

renderers/three/src/episodes/s01e02_zero_copy/

Use the repository's existing conventions after inspecting them.

The episode should consume:

- existing asset builders
- existing composition builders
- existing renderer utilities
- existing camera utilities
- existing highlighter/selection utilities
- existing AxioByte visual language

Do not duplicate asset geometry inside E02.

If an existing composition can be reused, reuse it.

If a composition needs a new presentation wrapper, create the wrapper at episode level.

Keep domain assets separate from episode-specific storytelling.

============================================================
## 16. TIMELINE IMPLEMENTATION
============================================================

The timeline.json is authoritative.

Do not hard-code a completely separate timing system.

Use the sentence/word timing information to drive the visual progression.

Every major visual event should be tied to the appropriate sentence timing.

Examples:

Sentence 5:
DMA starts around sentence 5 timing.

Sentence 6:
CPU COPY A → B.

Sentence 7:
CPU COPY B → application.

Sentence 21:
DMA into BUFFER.

Sentence 23:
same buffer / handle.

Sentence 28:
handle reaches processing.

Sentence 30:
in-place modification.

Sentence 40:
NIC transmit.

Sentence 46:
final payoff.

Do not use arbitrary historical timestamps from the old broken implementation.

============================================================
## 17. VISUAL DENSITY REQUIREMENT
============================================================

The film must not contain long periods where:

- nothing changes
- the same flat card remains
- only narration continues
- a generic title remains on screen

Every sentence does not necessarily need a hard cut.

Instead, visual progression can happen through:

- camera movement
- object introduction
- highlight
- pointer movement
- DMA animation
- opacity
- inspection
- spatial transition
- scale
- focus
- state-independent emphasis

The important thing is that the narration has corresponding visual information.

============================================================
## 18. 16:9 AND 9:16
============================================================

The composition must be designed for:

16:9
1920×1080

and checked for:

9:16

Do not simply crop the 16:9 composition.

Ensure important objects remain visible.

The central educational relationship must survive portrait rendering:

MBUF
BUFFER
HANDLE
PROCESSING STAGES

Avoid placing critical information only at extreme horizontal edges.

============================================================
## 19. TESTS
============================================================

Add focused tests for the new E02 visual implementation.

At minimum test:

1. timeline loads correctly
2. all 47 sentences have visual coverage
3. voiceover duration is unchanged
4. timeline.json is unchanged
5. NIC asset is the actual AxioByte NIC
6. Mempool asset is the actual AxioByte Mempool
7. Mempool elements contain MBUF + BUFFER representation
8. DMA terminates at BUFFER
9. DMA never targets MBUF
10. CPU copies are only shown for traditional path
11. zero-copy path has no red CPU copy
12. buffer remains spatially stationary during processing
13. only handle/pointer moves through stages
14. handle does not use mbuf visual identity
15. processing stages do not accumulate runtime state
16. bytes remain associated with BUFFER
17. transmit reads from the same buffer
18. no Descriptor Ring is introduced
19. no Host Memory asset is introduced
20. no SmartNIC label remains
21. no fake global assets are introduced
22. deterministic render behavior

If possible, add a semantic test that fails if the implementation starts animating packet bytes from:

buffer → parser → classifier → firewall → routing

because that would violate the episode's core concept.

============================================================
## 20. VISUAL QA
============================================================

Render representative frames throughout the entire 217.809s episode.

Do not only inspect the first and last frame.

Inspect approximately:

0%
5%
10%
20%
30%
40%
50%
60%
70%
80%
90%
95%
100%

Also inspect important semantic moments:

- traditional DMA
- first CPU copy
- second CPU copy
- mbuf introduction
- buf_addr
- mempool
- DMA into BUFFER
- parser
- classifier
- firewall
- routing
- pointer/handle
- in-place modification
- transmit
- final payoff

Verify that:

- actual 3D assets are visible
- camera framing is intentional
- no major asset is hidden
- no text overlaps
- no object is clipped
- no accidental flat-card takeover occurs
- no long dead/static section exists
- the buffer remains stationary
- only the handle moves during zero-copy processing
- the final scene is visually strong

============================================================
## 21. IMPORTANT: DO NOT REPEAT THE PREVIOUS FAILURE
============================================================

The following implementation is NOT acceptable:

NIC rectangle
↓
buffer rectangle
↓
text card

or:

ZERO COPY
[MBUF]
[BUFFER]
[PARSER]
[CLASSIFIER]
[FIREWALL]
[ROUTING]

with minor animations.

That is exactly what we are trying to eliminate.

We need:

REAL AXIOBYTE ASSETS
+
REAL 3D SPATIAL COMPOSITION
+
CAMERA MOVEMENT
+
DATAFLOW VISUALIZATION
+
SEMANTIC CONTINUITY
+
TIMELINE-DRIVEN STORYTELLING

============================================================
## 22. DO NOT MODIFY THE VOICEOVER
============================================================

This requirement is absolute.

The final render MUST use the supplied existing voiceover.

Do not generate a new voiceover.

Do not edit it.

Do not change its timing.

Do not change timeline.json.

Visuals must conform to the narration.

============================================================
## 23. STOP CONDITION
============================================================

If implementation reaches a point where a required visual cannot be built correctly using:

- an existing AxioByte asset
- an existing renderer/component
- or reasonable episode-local conceptual geometry

STOP.

Do not fake it.

Report the missing component.

Example:

BLOCKED — MISSING AXIOBYTE COMPONENT

Component:
<name>

Required for:
Sentences <x-y>

Reason:
<technical reason>

Existing alternatives considered:
<...>

Recommended component:
<...>

Then stop implementation.

============================================================
## 24. FINAL REPORT
============================================================

At the end, report:

### A. Visual architecture
What renderer was used and why.

### B. Existing assets reused
List every AxioByte asset/component reused.

### C. Episode-local geometry
List what was created only for E02.

### D. Missing components
If none:
NONE.

If any:
report them and STOP as specified.

### E. Sentence coverage
Confirm all 47 sentences have intentional visual coverage.

### F. Major visual shots
List the major shots and their purpose.

### G. Semantic validation
Explicitly verify:

- DMA ≠ CPU copy
- MBUF ≠ packet bytes
- BUFFER contains packet bytes
- Mempool contains MBUF+BUFFER elements
- DMA enters BUFFER
- buffer remains stationary
- handle/pointer moves
- parser/classifier/firewall/routing receive the handle conceptually
- in-place modification
- transmit from same buffer
- no Descriptor Ring
- no Host Memory
- no runtime state model

### H. Voiceover
Confirm unchanged.

### I. Timeline
Confirm unchanged.

### J. Render
Provide:
- resolution
- fps
- frame count
- duration
- renderer
- output path

### K. Tests
Report:
- focused tests
- full pytest
- lint
- type checks
- staging checks
- determinism

### L. Visual QA
Report 16:9 and 9:16 results.

### M. Git
DO NOT commit.
DO NOT push.
DO NOT tag.
DO NOT release.

Report git status and changed files only.

============================================================
## 25. EXECUTION ORDER
============================================================

Follow this order exactly:

PHASE 1
Audit current E02 and existing AxioByte assets.

PHASE 2
Inspect E03 Three.js film architecture.

PHASE 3
Create E02_VISUAL_PLAN.md covering all 47 sentences.

PHASE 4
Check whether every required visual can be represented with existing assets/components.

If a required reusable component is genuinely missing:
STOP and report it.

PHASE 5
Implement the Three.js E02 film using existing assets.

PHASE 6
Integrate the supplied timeline/voiceover timing without modifying either.

PHASE 7
Run semantic tests.

PHASE 8
Render representative frames and perform visual QA.

PHASE 9
Render the complete production-quality E02.

PHASE 10
Perform final audit.

Do NOT commit/push/release.

============================================================
## FINAL OBJECTIVE
============================================================

The finished E02 should feel like:

"An AxioByte Studio technical film explaining zero-copy networking."

It should NOT feel like:

"A Manim presentation with some rectangles explaining zero copy."

The viewer should be able to understand the entire idea visually:

Traditional path:
bytes are copied.

Zero-copy path:
bytes stay in the same buffer.

The NIC writes into the buffer.

The mbuf describes the buffer.

The mempool provides preallocated MBUF+BUFFER elements.

The CPU does not copy the bytes.

The same bytes remain stationary.

Only the handle/pointer moves between parser, classifier, firewall and routing.

The NIC eventually transmits from that same buffer.

The final visual payoff is:

A packet is a pointer to its bytes.

Build the film around that visual idea.