# AxioByte Studio — Concept Architecture

**The semantic layer above the rendering engines.**

**Status:** W11 decided and integrated · **Version:** 0.3 (three concept kinds; self-validated)
**Companions:** [`ARCHITECTURE.md`](ARCHITECTURE.md) (layers L2–L1: Shot IR, backends, layout, assets) · [`CONVENTIONS.md`](CONVENTIONS.md) · [`ROADMAP.md`](ROADMAP.md)

> This document describes layers **L7 → L3**. It never mentions Manim, Blender, geometry, or pixels.
> If a sentence here could not survive replacing the entire rendering stack, it is in the wrong file.

---

## 1. Position

AxioByte Studio is not an animation framework that happens to cover systems topics. It is a
**systems visualization framework** — a machine for turning a computer-science idea into the
specific sequence of images that makes that idea unavoidable.

The distinction is operational, not rhetorical. It means:

| An animation framework asks | A systems visualization framework asks |
|---|---|
| Does it look good? | Did the viewer understand? |
| Is the motion smooth? | Does the motion *mean* something? |
| Is the scene composed well? | Is the composition *true* to the system? |
| Can I animate this? | Should this be animated at all, and how? |
| What's on screen? | What misconception is this frame destroying? |

Every subsystem below exists to make the right-hand column mechanically checkable.

---

## 2. The stack

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ L7  PEDAGOGY          objectives · misconceptions · prerequisites ·      │
 │                       cognitive budget · assessment                      │  WHY
 ├──────────────────────────────────────────────────────────────────────────┤
 │ L6  CONCEPT SDK       ZeroCopy · NUMA · RSS · Raft · CacheMiss …         │
 │                       versioned, composable knowledge units              │  WHAT
 ├──────────────────────────────────────────────────────────────────────────┤
 │ L5  EDUCATIONAL       typed rules: concept → staging + assertions +      │
 │     GRAMMAR           narration contract.   ★ this is a compiler ★       │  HOW
 ├──────────────────────────────────────────────────────────────────────────┤
 │ L4  SEMANTIC RUNTIME  Actors (state machines) · Actions (transitions) ·  │
 │                       Motion · Camera · Layout relations                 │  WITH
 ├──────────────────────────────────────────────────────────────────────────┤
 │ L3  NARRATIVE         Episode · Act · Beat · Shot · cue-anchored time    │  WHEN
 ├══════════════════════════════════════════════════════════════════════════┤
 │ L2  SHOT IR           versioned · format-free · theme-free · tool-free   │  ABI
 ├──────────────────────────────────────────────────────────────────────────┤
 │ L1  BACKENDS          Manim · Blender · raster        (ARCHITECTURE.md)  │  PIXELS
 └──────────────────────────────────────────────────────────────────────────┘
```

Everything above the double line is this document. The double line is the ABI — the point at which
educational intent has been fully resolved into something a renderer can execute.

---

## 3. The structural correction: two axes, not one hierarchy

The brief proposes `Episode → Concept → Scene → Action → Shot → Render`. Building that literally
would cause a redesign within two years, because **Concept and Scene are not on the same axis.**

- A **Concept** (`ZeroCopy`) is a reusable, timeless knowledge unit. It belongs to no episode. It
  is used by many, in different orders, at different depths.
- A **Scene/Act/Beat** is a time-bounded segment of exactly one episode, anchored to one voiceover.

Making Concept a *parent* of Scene means concepts get authored inside episodes and cannot be
reused — which is precisely the failure the Studio exists to prevent. The correct model is two
axes that meet at the Shot:

```
   KNOWLEDGE AXIS                            NARRATIVE AXIS
   (reusable · timeless · versioned)         (one episode · timed · disposable)
   ═══════════════════════════════           ═════════════════════════════════

   Pedagogy                                  Episode
    objectives, misconceptions,               one voiceover, one thesis
    prerequisites                             (THE ONE PICTURE)
        │                                         │
        ▼                                         ▼
   Concept  ZeroCopy@2.1.0                   Act   "the copy tax"
    ├ actors it needs                             │
    ├ actions it performs                         ▼
    ├ invariants it teaches                  Beat  ◄── cue: a word start in the VO
    ├ misconceptions it refutes                   │
    └ staging template                            ▼
        │                                    Shot  ◄── the meeting point
        │                                         │
        └────────────► BIND ◄─────────────────────┘
                        │
                        │  Grammar resolves: which concept is in focus,
                        │  which actors instantiate, which actions fire,
                        │  which motions and camera moves apply
                        ▼
                    Shot IR  (L2)
```

**The Shot is where knowledge meets time.** A shot is the smallest unit that has both an
educational purpose (from the concept) and a position in the narration (from the beat).

Consequences of getting this right:

- A concept is authored once and used in Ep 2, Ep 10, and Ep 22 at different depths.
- An episode is a *playlist over the concept graph* plus a voiceover, not a container of knowledge.
- Deleting an episode destroys nothing reusable.
- A concept can be revised, and the system can report which episodes are now out of date (§10.4).

---

## 4. The governing analogy: this is a compiler

Treating the semantic layer as a compiler gives every subsystem a precise job and gives us a
vocabulary for reasoning about failure.

| Compiler | AxioByte Studio |
|---|---|
| Source language | **Concept SDK** — what you want to teach |
| Standard library | The concept graph and its shared actors/actions |
| Type system | **Actor states + Action signatures** — illegal combinations don't compile |
| Semantic analysis | **Invariant checking** — does this staging tell the truth? |
| Compiler passes | **Grammar rules**, applied in a defined order |
| Intermediate representation | **Shot IR** |
| Code generation | **Backends** (Manim, Blender) |
| Optimiser | **Cognitive load budget** — remove what does not teach |
| Linker | **Concept composition** — resolving prerequisites across an episode |
| Test suite | Golden frames, invariant assertions, narration contracts |
| Deprecation warnings | **Knowledge drift** reports when a concept is revised |

The most useful consequence: **a wrong visualization should be a compile error, not a review
comment.** A packet that moves during a zero-copy beat is not a stylistic slip — it is a type
error, and the build should refuse it.

---

## 5. Subsystem 1 — Concept SDK (L6)

### 5.0 Three kinds of concept

The Studio never thinks *"draw a packet."* It thinks *"teach Zero Copy,"* and the
renderer derives the actors, actions, camera, motion and timing from that. For this
to work, a Concept must be able to represent what computer science actually
contains — and a great deal of computer science is **relationships rather than
objects**.

So the SDK distinguishes three kinds, and the distinction is structural rather than
a matter of size:

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  ATOMIC CONCEPT            a thing that exists                           │
 │  packet · cpu · memory · pointer · cache · thread · nic · mbuf · queue    │
 │  Has a silhouette. Can be drawn. Owns a role in the visual language.      │
 └───────────────────────────────┬──────────────────────────────────────────┘
                                 │  participate in
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  INTERACTION CONCEPT       a relationship that IS the lesson             │
 │  zero_copy (pointer ↔ buffer) · false_sharing (thread ↔ cache_line)      │
 │  numa (core ↔ locality) · dma (nic ↔ memory) · rss (nic ↔ worker_core)   │
 │  Has NO silhouette. Cannot be drawn. Owns a staging template, a motion    │
 │  grammar, a camera language, misconceptions and assessment.              │
 └───────────────────────────────┬──────────────────────────────────────────┘
                                 │  compose into
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  COMPOSITE CONCEPT         a story built from the other two              │
 │  dpdk_rx_pipeline · ngfw_fast_path · tls_connection · kafka_replication  │
 │  Owns an order and a depth per member. Teaches by sequencing, not by      │
 │  staging anything itself.                                                 │
 └──────────────────────────────────────────────────────────────────────────┘
```

**The test that separates atomic from interaction** — and it is a removal test, not
a judgement call:

> Take away one participant. If the lesson survives, it was never an interaction.

| Concept | Remove one side | What is left | Verdict |
|---|---|---|---|
| `zero_copy` | remove the pointer | "memory holds bytes" | not the lesson → **interaction** |
| `zero_copy` | remove the buffer | "a pointer is an address" | not the lesson → **interaction** |
| `false_sharing` | remove the thread | "memory is fetched in 64-byte lines" | not the lesson → **interaction** |
| `false_sharing` | remove the cache line | "two cores run concurrently" | not the lesson → **interaction** |
| `mempool` | remove… nothing to remove | it is one thing | **atomic** |

### 5.1 An Atomic Concept

A thing that exists and can be drawn. It owns a role in the visual language, a
silhouette, and — where legality is part of the lesson — a state machine.

```yaml
id: packet
kind: atomic
version: 1.2.0
domain: net
visual: { role: packet, silhouette: byte_cells, motion: packet.travel }
states: [on_wire, in_buffer, referenced, dropped, freed]
anchors: [first_byte, last_byte, header]
teaches:
  - "A packet is a finite run of bytes with a header and a payload."
```

An Atomic Concept teaches *what a thing is*. That is usually a single beat, often
`assumed` rather than taught at all.

### 5.2 An Interaction Concept ★

The relationship **is** the concept. It has no silhouette because a relationship
cannot be drawn — only its participants can, and the interaction is what happens
*between* them.

```yaml
id: false_sharing
kind: interaction
version: 1.0.0
domain: compute
between: [thread, cache_line]          # ≥2 atomic participants

# 1 — ITS OWN OBJECTIVE, unattainable by either participant alone.
pedagogy:
  objectives:
    - id: FS-1
      statement: >
        Two threads writing different variables that share one 64-byte line
        serialise on cache coherency, despite sharing no data.
      evidence: "Correct results, and a 10x slowdown, in the same shot."
  removal_test:                        # ★ REQUIRED — one entry per participant
    thread: "Without threads: memory is fetched in 64-byte lines. True, not the lesson."
    cache_line: "Without the line: two cores run concurrently. True, not the lesson."

# 2 — ITS OWN MISCONCEPTIONS.
  misconceptions:
    - id: FS-M1
      wrong: "It is a race condition."
      refute_by: "Show the results are correct AND the program is 10x slower."
      source: "recurring comment on kernel-performance threads"
    - id: FS-M2
      wrong: "Adding a lock would fix it."
      refute_by: "Add a lock; the line still ping-pongs, and it is now slower."

# 3 — ITS OWN VISUAL GRAMMAR.
visual_grammar:
  participants:
    thread: { salience: primary, count: 2 }
    cache_line: { salience: primary, count: 1 }
  invariant_on_screen: "the two variables are never on separate lines"
  never: ["drawing the threads as sharing a variable"]

# 4 — ITS OWN MOTION GRAMMAR.
motion_grammar:
  primary: lock.stutter                # the line ping-pongs
  participants: { thread: poll.metronome }
  reads_as: "two independent things, made dependent by geometry"

# 5 — ITS OWN CAMERA LANGUAGE.
camera:
  move: comparison                     # hold both cores in one frame
  intent: "the collision is only visible when neither core is inspected alone"
  never: [macro]                       # zooming into one core hides the point

# 6 — ITS OWN STORYBOARD TEMPLATE.
staging:
  template: race                       # two instances, same task, different geometry
  counter_concept: padded_variables    # the picture that makes it go away

# 7 — ITS OWN ASSESSMENT.
assessment:
  after_this_the_viewer_can:
    - "Predict which of two struct layouts will be slower, and say why."
    - "Explain why the fix is padding, not locking."

relations:
  requires: [thread, cache_line, cache_coherency]
  contrasts_with: [padded_variables]
  composes_into: [numa, lock_free_ring]
```

All seven blocks are **mandatory**. A file missing any of them is not an
Interaction Concept; it is two things on screen.

### 5.3 A Composite Concept

A story. It stages nothing itself — it sequences members, each at a declared depth.

```yaml
id: ngfw_fast_path
kind: composite
version: 1.0.0
domain: data_plane
composes:
  - { concept: packet,          kind: atomic,      depth: assumed }
  - { concept: rss,             kind: interaction, depth: brief }
  - { concept: batching,        kind: interaction, depth: brief }
  - { concept: zero_copy,       kind: interaction, depth: assumed }
  - { concept: conntrack,       kind: interaction, depth: full }
  - { concept: fast_slow_path,  kind: interaction, depth: full }
focus_order: [fast_slow_path, conntrack]
```

Nothing in that file re-implements RSS or zero-copy. That is the whole point: an
episode about NGFW fast path is **assembled**, not authored.

### 5.4 Why this preserves the one-idea-per-beat rule rather than weakening it

This is the part that makes Interaction Concepts a design principle rather than a
loophole, and it is worth stating precisely.

An Interaction Concept **requires** its participants. They are prerequisites, which
means by the time it is taught they are already `assumed` knowledge. So the count of
*novel* ideas in the beat is still exactly one — the relationship.

```
   beat teaching `false_sharing`
   ├─ thread       already taught → assumed → not a new idea
   ├─ cache_line   already taught → assumed → not a new idea
   └─ the collision                          ← the ONE new idea
```

Two actors hold `primary` salience; one concept holds focus. Those are different
counts, and conflating them is what made the original rule look broken.

**Consequence for the engine:** the salience check becomes *"the number of primary
actors equals the number of participants the focused concept declares"* — one for an
Atomic Concept, `len(between)` for an Interaction Concept. The rule gets stricter,
not looser: a beat can no longer have two primaries *by accident*, only by a
concept that declared exactly that.

### 5.5 The gates that keep it from becoming a loophole

Six checks, five of them mechanical:

| # | Gate | Enforced by |
|---|---|---|
| 1 | `between:` names ≥2 registered atomic concepts | schema |
| 2 | Every participant appears in `requires:` | schema |
| 3 | A `removal_test:` entry exists for **every** participant | schema |
| 4 | All seven blocks are present and non-empty | schema |
| 5 | Objectives cite no participant's objective verbatim | lint |
| 6 | The removal test is *true* — the residue really isn't the lesson | **human review** |

Gate 6 cannot be automated, and pretending otherwise would be the loophole. It is a
review question with a fixed form, which is the most a document can do.

Plus a health signal rather than a hard rule: **interaction concepts should stay a
minority of the SDK.** `abs concept stats` reports the ratio; a catalogue that is
mostly interactions has stopped distinguishing relationships from crowded frames.

### 5.6 What a Concept is, in general

Every kind shares a spine — id, kind, version, domain, pedagogy, relations — and
differs in what it owns:

| | Atomic | Interaction | Composite |
|---|---|---|---|
| Silhouette / role | ✓ | — | — |
| State machine | optional | — | — |
| Own objective | ✓ | ✓ **required** | ✓ |
| Misconceptions | optional | ✓ **required** | optional |
| Visual grammar | via role | ✓ **required** | — |
| Motion grammar | via signature | ✓ **required** | — |
| Camera language | — | ✓ **required** | — |
| Staging template | — | ✓ **required** | — |
| Assessment | — | ✓ **required** | ✓ |
| Members / order | — | `between` | `composes` |
| Can be drawn | ✓ | ✗ | ✗ |


---

## 6. Subsystem 2 — Actor System (L4)

### 6.1 The Actor contract

```
Actor
├─ identity      concept_id + instance_id, stable across every shot in an episode
├─ state         ★ typed state machine — illegal transitions are compile errors
├─ affordances   which Actions it may be the subject or object of
├─ anchors       named attachment points: nic.port[3], mbuf.buf_addr, cache.line[7]
├─ visual        role bindings only — never values     → Visual Language (theme resolves)
├─ motion        signature per verb                    → Motion Language (§9)
├─ camera        framing hints: subject box, macro target, natural orbit axis
├─ salience      how much attention it may claim       → cognitive budget
└─ invariants    what must remain true of this actor
```

Three fields deserve comment.

**`state` as a typed machine.** This is what makes an Actor more than a shape:

```
Packet:  on_wire ──dma_write──► in_buffer ──reference──► referenced
                                    │                         │
                                    │                    release│
                                    ▼                         ▼
                                 dropped                    freed

  illegal: freed ──reference──► anything     ("use after free")
  illegal: dropped ──forward──► anything     ("forwarding a dropped packet")
```

An episode that animates a freed mbuf being dereferenced is making a **factual claim about DPDK
that is false**. The state machine turns that into a build failure. This is the mechanism behind
"never sacrifice truth for a nice shot."

**`anchors`.** The reference episodes reach into geometry (`mb.addr_row.val.get_left()`). Named
anchors replace that with meaning: `mbuf.buf_addr → packet.first_byte` is a semantic link that
survives any re-layout, any format, any backend.

**`salience`.** Each actor declares how much attention it may claim (`primary`, `supporting`,
`ambient`). A beat may contain at most one `primary`. This is what stops screens from becoming
busy, and it is enforced, not advised.

### 6.2 State machines are opt-in

Not every actor needs one. `Legend`, `Axis`, `Callout`, `Meter` have no meaningful lifecycle.
The rule: **a state machine exists only where legality is part of the lesson.** `Packet`, `Mbuf`,
`Lock`, `Node` (Raft), `CacheLine`, `Thread` have them. Decorative and structural actors do not.
Without this rule, the type system becomes bureaucracy.

### 6.3 Actor domains

Organised by system domain, mirroring the content roadmap — never by visual similarity:

| Domain | Actors |
|---|---|
| `net` | Packet, Header, Flow, FiveTuple, FlowTable, ConnTrack, Router, Switch, Firewall, Tunnel |
| `memory` | Memory, Buffer, CacheLine, Cache, HugePage, TLB, PageTable, Mbuf, Mempool, Pointer, NumaNode |
| `compute` | CPU, Core, WorkerCore, Thread, Process, Scheduler, Lock, Atomic, Interrupt, Register |
| `io` | NIC, PMD, DMA, Ring, Descriptor, Doorbell, Bus, Disk |
| `os` | KernelSpace, UserSpace, Boundary, Syscall, SkBuff, Driver, Socket, XDPHook |
| `dist` *(future)* | Node, Log, Term, Quorum, Replica, Partition, Clock |
| `data` *(future)* | Table, Index, BTree, Page, Transaction, WAL |
| `gpu` *(future)* | SM, Warp, Lane, Kernel, PredicateMask |
| `abstract` | Meter, Graph, Timeline, CodePanel, Callout, Legend, StackDiagram, SequenceDiagram |

Adding a domain adds a directory. It changes nothing else — that is the extensibility test.

---

## 7. Subsystem 3 — Action System (L4)

### 7.1 An Action is a typed state transition with a cost and a lesson

```
Action  Copy
├─ signature      Copy(src: Buffer, dst: Buffer, unit: Bytes)
├─ preconditions  src.state == filled ∧ dst.state == free
├─ effects        dst.state ← filled
├─ invariants     ★ src.content unchanged        (what must NOT change)
├─ cost           { cycles: ~1.2/byte, cache_lines: n/64, source: "…", confidence: order }
├─ motion         motion.copy.duplicate_translate
└─ negation       ★ how to depict this action NOT happening
```

Two fields are unusual and both are load-bearing.

**`invariants` — the lesson lives here.** For `Forward` under zero-copy the invariant is
`payload.address unchanged`. That single line is simultaneously: the educational objective, the
staging constraint, and the test. The concept, the picture, and the assertion stop being three
things that can drift apart.

**`negation` — teaching requires showing absence.** A huge fraction of systems education is
"and this *doesn't* happen": no copy, no interrupt, no context switch, no lock contention, no
remote memory access. The reference episode already does this by hand (a red cross, the label
"no copy"). Making negation a first-class property of every Action means "the absence of X" is
staged consistently across the entire catalogue, and the *absence itself* becomes recognisable
visual grammar.

### 7.2 The cost model

Actions carry approximate cost. Meters, latency bars, and "this is why it's slow" comparisons are
then **derived** rather than hand-drawn, which means numbers can never contradict each other
across episodes.

This is also a credibility liability if handled carelessly, so:

- Every cost carries a **source** and a **confidence band** (`exact | order | illustrative`).
- Default display mode is **relative**, not absolute ("~10× more expensive"), because relative
  claims survive hardware generations and absolute ones do not.
- An absolute number may only be shown on screen if `confidence: exact` **and** a source exists.
  Lint enforces this. Getting a number wrong in a systems video is expensive in a way that a
  slightly-off colour never is.

### 7.3 The action vocabulary

Deliberately small and shared. Actions are defined once and reused wherever the meaning genuinely
holds — an action reused across domains is a sign the vocabulary is right.

| Group | Actions |
|---|---|
| Data movement | Copy, Move, Transmit, Receive, DMAWrite, Forward, Redirect |
| Memory | Allocate, Release, Reference, Dereference, Evict, Prefetch, Pin |
| Control | Schedule, Wake, Sleep, Poll, Interrupt, ContextSwitch, Yield |
| Processing | Parse, Classify, Hash, Inspect, Match, Encrypt, Decrypt, Compress |
| Decision | Drop, Accept, Defer, Retry |
| Batching | Batch, Burst, Drain, Flush |
| Coordination *(dist)* | Propose, Vote, Commit, Replicate, Elect, Heartbeat |

---

## 8. Subsystem 4 — Story Engine (L3)

### 8.1 The narrative hierarchy

```
Episode        one voiceover · one thesis (THE ONE PICTURE) · a concept playlist
  └─ Act       a movement of the argument · one keyword on screen · 20–60 s
      └─ Beat  ★ the atom of meaning · anchored to a word start in the VO · 1–8 s
          └─ Shot   one framing · one concept in focus · one staging
              └─ Clip   one actor performing one verb over a time window
```

**The Beat is the atom.** Not the shot, not the scene. A beat is *one idea landing at one moment
in the narration*, and it is the unit at which everything is checked: cognitive budget, concept
focus, invariant scope, narration contract, retention analytics.

### 8.2 A shot describes intent, never geometry

```yaml
shot: s01e02.0120_pointer_not_copy
beat: zerocopy.payoff.pointer          # ← resolves to a word start in the VO
concept:
  focus: zero_copy@2.1.0               # exactly one concept in focus
  objective: ZC-1                      # which objective this shot serves
  refutes: ZC-M2                       # which misconception it destroys
cast:
  payload: packet#1                    # instance identity, stable across the episode
  handle:  mbuf#1
  ptr:     pointer#1
  stages:  [parser, firewall, router, tx]
intent: "prove the bytes never move by moving the camera instead"
```

There is no position, no colour, no duration, no aspect ratio, no easing. Those are all
*derived* — by the grammar, the layout solver, the theme, and the motion language. The author
writes what the shot is *for*.

### 8.3 Time is inherited, never invented

Unchanged from `ARCHITECTURE.md`, and now given its semantic justification: a beat is anchored to
a word start because **the beat is the moment an idea lands, and ideas land on words.** Duration is
not an aesthetic choice; it is the distance to the next idea.

### 8.4 Staging templates

Reusable narrative shapes, chosen by the concept, filled by the grammar:

| Template | Shape | Best for |
|---|---|---|
| `contrast_then_invariance` | build the wrong picture → destroy it → hold the right one still | ZeroCopy, Polling, XDP |
| `journey` | follow one instance through a pipeline | packet through NGFW, query through a DB |
| `cost_column` | accumulate a visible price for each step | kernel overhead, syscall cost |
| `zoom_hierarchy` | macro → meso → micro on one object | mbuf internals, cache line, page table |
| `race` | two instances, same task, different mechanism | NUMA local vs remote, batched vs per-packet |
| `state_machine` | an actor's lifecycle, made literal | TCP handshake, Raft election, conntrack |
| `ensemble` | N identical units acting together, then diverging | RSS queues, GPU warp, replica set |
| `recap` | compress the episode into one held frame | every closing act |

`contrast_then_invariance` is ep02's actual shape, generalised. `ensemble` was added as a result of
the extensibility stress test in §12 — it did not exist in the first draft.

---

## 9. Subsystem 5 — Motion Language (L4)

### 9.1 Motion is semantics, not decoration

The rule, stated as strongly as the colour rule:

> **One motion signature per idea, and nothing borrows a motion it does not own.**

A viewer who has watched five episodes should be able to identify what is happening from
peripheral vision, before reading a label. Colour identifies *what a thing is*; motion identifies
*what is happening to it*.

### 9.2 The signature table

| Concept | Curve | Duration | Secondary | Reads as |
|---|---|---|---|---|
| `dma` | smooth accel, no overshoot | long | continuous beam, steady pulse | autonomous, unhurried, no CPU |
| `pointer` | elastic snap | very short | gold pulse on arrival | free, instant, weightless |
| `copy` | linear translate + duplicate | medium | motion trail, source fades late | **expensive, physical, wasteful** |
| `interrupt` | sharp accel, hard stop | instant | flash + camera shake | violent, unscheduled, disruptive |
| `poll` | metronomic loop | rhythmic | no accent | tireless, deliberate, CPU-burning |
| `cache_miss` | stall then latency ripple | long pause | camera pulls back | the cost of going far away |
| `allocate` | ripple outward + settle | short | glow rises | something came into existence |
| `release` | collapse inward | short | glow drains | something ceased to exist |
| `lock_contention` | stutter, repeated blocked attempts | irregular | judder | waiting, wasted, frustrating |
| `batch` | N elements move as one rigid body | one motion for many | single accent | amortisation, made visible |
| `drop` | fall out of the plane, desaturate | short | no return | finality |

The `copy` and `pointer` rows are the entirety of Episode 2's argument, expressed as motion.
`batch` is the entirety of Episode 8's. When motion carries the thesis, narration becomes
confirmation rather than explanation — which is the actual 3Blue1Brown method.

### 9.3 Motion inherits, like a class hierarchy

`raft.message.travel` inherits from `packet.travel`, because a Raft RPC *is* a packet to a viewer's
eye. Inheritance is declared in the motion registry, so a new domain gets a consistent feel for
free and only overrides what is genuinely different.

---

## 10. Subsystem 6 — Camera Language (L4)

### 10.1 Every move must have an educational reason

A camera move without a stated intent is rejected at plan time. The intent is not a comment — it
is a required field naming which objective the move serves.

| Move | Educational intent | Use when | Never use when |
|---|---|---|---|
| `orbit` | **prove stillness** via parallax; reveal 3D structure | the subject must be shown not to move | text is on screen |
| `push_in` | narrow attention; signal "this is the thing" | one element now matters | the next beat is elsewhere |
| `pull_back` | reveal context, scale, or cost | showing what the detail was part of | the detail is still being read |
| `follow` | maintain identity through motion | one instance travels a pipeline | many things move at once |
| `macro` | reveal internal structure | zooming into an mbuf, a cache line | the outside still matters |
| `cross_section` | show hidden interior without moving | layered structures: stack, page table | a flat diagram would do |
| `exploded` | show composition and assembly order | hardware, packet headers, protocol stacks | parts have no spatial relation |
| `rack_focus` | shift attention without moving | two things co-present, one now matters | only one thing is on screen |
| `comparison` | hold two things in one frame | contrast is the point | the two are not comparable |
| `flythrough` | convey scale and topology | datacentre, NoC, large topologies | detail matters more than scale |

### 10.2 The anti-patterns are as important as the patterns

The right-hand column is enforced. Camera moves that fight the content are the most common way a
technically-correct animation fails to teach: orbiting while a viewer is reading, pushing in on
something about to exit, following one packet while the point is that a thousand arrive.

### 10.3 Camera moves are declared against actors, never coordinates

`orbit(payload, axis=natural)` — the actor supplies its own natural orbit axis and subject box.
This is what makes camera language survive the format-agnostic layout system: the camera targets a
*thing*, and the layout solver decides where that thing is in each aspect ratio.

### 10.4 Knowledge drift *(a platform feature, not an animation feature)*

Concepts are versioned. When a concept is revised — a better mental model, a corrected fact, a new
misconception discovered — the system reports **which shipped episodes are now inconsistent**, the
way a package manager reports affected dependents.

```
$ abs concept bump zero_copy --minor --reason "mbuf chaining was misleading"

zero_copy 2.1.0 → 2.2.0
  affected episodes:
    s01e02-zero-copy       shots 0120, 0180   objective ZC-1   ACTION NEEDED
    s01e10-ngfw-fast-path  shot  0340         composed use     review
    s01e13-vpp-vectors     shot  0090         assumed only     no action
```

No auto-fixing — the decision to re-cut, annotate, or accept is editorial. But **not knowing** is
what makes an educational catalogue rot, and this makes it visible.

---

## 11. Subsystem 7 — Educational Grammar (L5) ★

This is the centre of the architecture. It is the compiler pass that turns *what you want to teach*
into *what appears on screen*.

### 11.1 The production the brief describes, formalised

```
   RELATIONSHIP  ──►  VISUAL METAPHOR  ──►  MOTION  ──►  CAMERA  ──►  NARRATION
        │                                                                 │
        └──────────────────────────► LEARNING OBJECTIVE ◄─────────────────┘
                                            │
                                            ▼
                                   assertion (pass / fail)
```

Read left to right it is a *generator*. Read as the bottom loop it is a *verifier*. The grammar is
both, and that duality is the design.

### 11.2 A grammar rule

```
RULE  zero_copy.invariance                       priority: 100

WHEN    concept(zero_copy) in focus
        AND act.phase == "after_contrast"

GIVEN   payload : Packet     bound to concept.focus_actor
        handle  : Mbuf
        ptr     : Pointer
        stages  : [Stage]    length >= 3

THEN    staging:
          payload  → fixed(anchor = memory_region)     # receives no motion verb
          ptr      → traverse(stages, motion = pointer.elastic_snap)
          handle   → accompany(ptr, salience = supporting)
          camera   → orbit(payload, intent = "prove stillness")
          layout   → chain(stages)                     # axis chosen by target profile

ASSERT  payload.position    is constant over rule scope
        payload.address     is constant over rule scope
        count(visible actors bound to role `copy`) == 0
        salience(primary)   == 1

NARRATION_CONTRACT
        beat words ∩ {reference, pointer, handle, points, address} ≠ ∅
        severity: warn                                 # synonyms are unbounded

TEACHES   objective ZC-1, ZC-2
REFUTES   misconception ZC-M2
```

### 11.3 The five clauses, and why each exists

| Clause | Purpose | Failure it prevents |
|---|---|---|
| `WHEN` | Scoping — when this rule applies | Rules firing in the wrong act |
| `GIVEN` | Typed binding of concept roles to actors | Staging a concept with the wrong cast |
| `THEN` | The generated staging | Every episode inventing its own look for the same idea |
| `ASSERT` | Post-conditions on the *result* | A shot that contradicts what it claims to teach |
| `NARRATION_CONTRACT` | Binds picture to words | Correct visuals under the wrong sentence |

`NARRATION_CONTRACT` is only possible because of the word-level timeline. It checks that the words
being spoken *during this beat* actually concern this concept. It is a **warning, not an error** —
natural language paraphrase is unbounded, and a grammar that fails builds over synonyms would be
turned off within a month.

### 11.4 The critical design decision: generate *or* constrain?

This is where an architecture like this most easily becomes an over-abstracted cathedral, so it is
decided explicitly.

```
   pure generation                                        pure constraint
   ("the grammar draws it")                              ("the grammar checks it")
   ├──────────────────────┼──────────────────────────────────────────────┤
   soulless, generic          ★ WE ARE HERE ★                just a linter
   research project        scaffold + refine + assert       no reuse gained
```

**The grammar generates a correct default staging; the author refines it; the assertions survive
refinement.**

- `abs stage <shot>` emits a complete, correct, plain shot from the concept.
- The author then refines it — timing, secondary elements, the one flourish that makes it sing.
- The `ASSERT` clauses continue to hold over the refined result. Refinement can make a shot better;
  it cannot make it untrue.

This preserves the thing that makes ep02 good — a human deciding that the bytes must sit still for
two minutes — while removing the thing that makes it expensive: rebuilding the vocabulary each time.

### 11.5 Rule ordering and conflicts

Rules are pure functions over the shot, applied in priority order, each producing a new staging.
Two rules that write the same property conflict, and conflicts are **errors at plan time**, never
silent last-write-wins. Resolution is explicit: raise a priority, narrow a `WHEN`, or declare an
override in the episode with a reason.

---

## 12. Subsystem 8 — Concept Composition (L6)

### 12.1 The knowledge graph

Composition is what makes the SDK an asset rather than a filing cabinet. Every
concept, of every kind, composes — and the three kinds compose in one direction:

```
        atomic ──participates in──►  interaction ──composes into──►  composite
          ▲                               │                               │
          └───────────── requires ────────┴──────── requires ─────────────┘
```

An episode is a **traversal of that graph**, not a container of knowledge. Delete an
episode and nothing reusable is lost.

### 12.2 Typed edges

| Edge | From → to | Meaning | Staging consequence |
|---|---|---|---|
| `requires` | any → any | hard prerequisite | must be taught, or declared assumed, before use |
| `between` | interaction → atomic | its participants | they hold primary salience together |
| `composes` | composite → any | its members | sequenced at a declared depth |
| `refines` | any → same kind | a specialisation | inherits template and identity |
| `contrasts_with` | any → same kind | defined *against* | the counter-picture (§8.4) |
| `generalises` | any → any | the abstract form | may be substituted when depth is not needed |

`contrasts_with` remains pedagogically load-bearing: `zero_copy` is meaningful only
against `copy_based`, and `false_sharing` only against `padded_variables`.

### 12.3 Reuse is the measure

```
        dpdk_rx_pipeline                    ngfw_fast_path
         (composite)                         (composite)
              │                                   │
    ┌────┬────┼────┬─────┐              ┌────┬────┼────┬────────┐
    ▼    ▼    ▼    ▼     ▼              ▼    ▼    ▼    ▼        ▼
   dma  zero polling rss batching      rss  batching zero  conntrack
        copy                                          copy
    └────┴────┴────┴─────┴──────────────┴────┴────────┴────────┘
                              │
                    the SAME interaction concepts
                    ── authored once, versioned, reused ──
                              │
              ┌───────┬───────┼───────┬───────┐
              ▼       ▼       ▼       ▼       ▼
           packet  memory  pointer  nic   worker_core
                      (atomic)
```

`rss`, `batching` and `zero_copy` appear in both composites and are implemented in
neither. That is the compounding the Studio exists to produce: by Episode 20, a new
episode should be mostly a *selection* from this graph.

### 12.4 Depth, and the rule that makes composition tractable

`depth` is the amount of teaching a composite owes a member:

| Depth | Meaning | Screen cost |
|---|---|---|
| `assumed` | the viewer already knows it; reference without explanation | seconds |
| `brief` | one beat, one image, no derivation | ~5 s |
| `full` | complete staging with objectives and misconception refutation | ~30–60 s |

**Exactly one concept is in focus per beat**, whatever its kind. Every other concept
present is backgrounded. When three concepts compose, the focused one's grammar
wins and there is no ambiguity to resolve — and because an Interaction Concept's
participants are prerequisites, the count of *new* ideas in the beat is still one.

### 12.5 Prerequisite closure is checked, not hoped

```
$ abs plan episodes/s01e10-ngfw-fast-path

concept closure:
  conntrack        [interaction] requires flow_table    ✓ declared assumed
  conntrack        [interaction] requires five_tuple    ✗ NOT taught, NOT assumed
                   ↳ add a `brief` beat, or declare it assumed in episode.yaml
  fast_slow_path   [interaction] requires zero_copy@>=2.0
                                                        ✓ taught in s01e02
  false_sharing    [interaction] between: [thread, cache_line]
                   thread                               ✗ never taught in this season
                   ↳ an interaction cannot be taught before its participants
```

The last check is new and specific to the hierarchy: **an Interaction Concept may
not be taught before its participants.** That is the mechanism behind §5.4 — if a
participant is not already known, the beat carries two new ideas and the cognitive
budget is genuinely violated.


---

## 13. Interaction diagrams

### 13.1 Authoring an episode, end to end

```
 AUTHOR                STORY ENGINE         GRAMMAR            RUNTIME          BACKEND
   │                        │                  │                  │                │
   │ picture.md ───────────►│                  │                  │                │
   │ (THE ONE PICTURE)      │                  │                  │                │
   │                        │                  │                  │                │
   │ script.md + vo.wav ───►│                  │                  │                │
   │                   transcribe → words.json │                  │                │
   │                        │                  │                  │                │
   │ concept playlist ─────►│                  │                  │                │
   │                        ├─ closure check ─►│                  │                │
   │                        │◄─ missing prereq─┤                  │                │
   │ (resolve) ────────────►│                  │                  │                │
   │                        │                  │                  │                │
   │                   beats ← cues            │                  │                │
   │                        ├─ per beat ──────►│                  │                │
   │                        │              stage(concept)         │                │
   │                        │                  ├─ bind actors ───►│                │
   │                        │                  ├─ apply motion ──►│                │
   │                        │                  ├─ apply camera ──►│                │
   │                        │◄─ default shot ──┤                  │                │
   │◄── scaffold shots ─────┤                  │                  │                │
   │                        │                  │                  │                │
   │ refine (the craft) ───►│                  │                  │                │
   │                        ├─ re-assert ─────►│                  │                │
   │                        │◄─ pass / FAIL ───┤                  │                │
   │                        │                  │                  │                │
   │                        └── Shot IR ──────────────────────────────────────────►│
   │                                                              per target × theme│
   │◄──────────────────────── frames ───────────────────────────────────────────────┤
```

### 13.2 `abs plan` — the validation cascade

Ordered cheapest-first, so the most common mistakes fail in milliseconds:

```
  1. CUES          every cue resolves to a word start                    ← ep01/ep02's ONE RULE
  2. CLOSURE       every concept's prerequisites taught or declared
  3. TYPES         every action's preconditions hold in actor state
  4. INVARIANTS    every concept invariant holds over its scope          ← "is it TRUE?"
  5. FOCUS         exactly one concept and one primary actor per beat
  6. BUDGET        min(cognitive_load, layout_density) not exceeded
  7. GRAMMAR       all ASSERT clauses pass
  8. NARRATION     narration contracts (warn only)
  9. LAYOUT        solvable in every declared target, no unsafe collisions
 10. IMPLS         every (concept, verb, backend) pair has an implementation
 11. ASSETS        every asset pinned and present
                              ↓
                     RenderPlan (nothing has rendered yet)
```

Steps 2–8 do not exist in any animation framework. They are what makes this an educational one.

### 13.3 One beat, resolved

```
BEAT  zerocopy.payoff.pointer        t = 143.82 s   (word "pointer", sentence 41)
  │
  ├─ concept in focus ......... zero_copy@2.1.0
  ├─ objective ................ ZC-1  "bytes are written once and never move"
  ├─ refutes .................. ZC-M2 "the packet teleports"
  │
  ├─ GRAMMAR fires ............ zero_copy.invariance (priority 100)
  │     ├─ payload → fixed()                    ← the whole lesson, in one line
  │     ├─ ptr     → traverse(stages)
  │     ├─ camera  → orbit(payload)             ← motion proves stillness
  │     └─ layout  → chain(stages)              ← axis from target profile
  │
  ├─ RUNTIME binds ............ packet#1, mbuf#1, pointer#1, 4 stages
  │     ├─ state check: packet#1 is `referenced`      ✓ legal
  │     └─ action Forward: invariant payload.address unchanged   ✓
  │
  ├─ ASSERT ................... position constant ✓ · no `copy` role visible ✓
  │                             · exactly 1 primary ✓
  ├─ NARRATION ................ "pointer" ∈ contract terms ✓
  │
  └─ EMIT ..................... Shot IR → 16:9 · 9:16 · 1:1
```

---

## 14. Worked example: `ZeroCopy` from objective to frame

```
 OBJECTIVE      ZC-1  "Packet bytes are written once and never moved again."
      │
      ▼
 RELATIONSHIP   ownership changes ≠ location changes
      │              (the entire concept, in five words)
      ▼
 METAPHOR       a library book that is *borrowed*, not *shipped*
      │              (the hook the episode already opens with)
      ▼
 ACTORS         payload:Packet(fixed) · ptr:Pointer(mobile) · handle:Mbuf(carrier)
      │
      ▼
 ACTIONS        DMAWrite(once) · Reference(×4) · Forward(×4) · Transmit(same bytes)
      │              invariant on every Forward: payload.address unchanged
      ▼
 MOTION         payload: none, for two minutes  ← the argument
                ptr:     elastic snap, gold pulse
                copy:    absent — and its absence is staged (`negation`)
      │
      ▼
 CAMERA         orbit(payload) — the camera moves so the payload is *seen* not to
      │         push_in(mbuf.buf_addr) at the reveal
      ▼
 LAYOUT         chain(stages) — horizontal in 16:9, vertical in 9:16, same shot
      │
      ▼
 NARRATION      "…not as bytes, but as a pointer to those bytes."
      │
      ▼
 ASSERTION      payload.position constant ∧ zero `copy` actors ∧ ZC-M2 refuted
      │
      ▼
 UNDERSTANDING  the closing line is not a claim — it is a description of the screen
```

The final row is the test of the whole architecture. When narration merely *describes what the
viewer already sees*, the concept has been taught by the picture. Every subsystem above exists to
make that outcome reproducible rather than lucky.

---

## 15. Extensibility stress test

An architecture that only fits the domain it was designed for is not extensible; it is
retrospective. So: two concepts as far from packets as the roadmap goes, walked through the model.

### 15.1 `RaftLeaderElection` (Distributed Systems)

| Layer | Resolution | Reused? |
|---|---|---|
| Actors | `Node`(state machine: follower→candidate→leader), `Log`, `Term`, `Message`, `Timer`, `Quorum` | **new domain**, same contract |
| Invariant | *"at most one leader per term"* — **the lesson is an invariant, again** | pattern holds |
| Actions | `Timeout`, `Propose`, `Vote`, `Elect`, `Replicate`, `Heartbeat` | new verbs, existing groups |
| Motion | `message.travel` **inherits** `packet.travel`; `timer` = countdown ring | inheritance pays off |
| Camera | `comparison` (5 nodes co-present), `rack_focus` (attention to the split vote) | unchanged |
| Template | `state_machine` + `ensemble` | unchanged |
| Misconception | *"the most up-to-date log wins"* (no — quorum wins, subject to a log constraint) | pattern holds |

**Verdict: fits.** A new actor domain, verbs slotting into existing groups, motion inherited.

### 15.2 `WarpDivergence` (GPU) — this one found a gap

| Layer | Resolution |
|---|---|
| Actors | `SM`, `Warp`(32 `Lane`s), `PredicateMask`, `Instruction` |
| Invariant | *"a warp issues one instruction per cycle"* — divergence means lanes idle |
| Motion | masked lanes → `idle` role; cost meter doubles | 
| **Gap found** | **32 lanes must move in lockstep as one semantic unit, then split.** No existing layout relation expresses "N identical units acting as one, then diverging." `chain`/`cluster`/`pair` all fail. |

**Fixes adopted from this finding:**
1. New layout relation **`ensemble(n, unit)`** — N identical actors treated as one addressable
   group, with `diverge`/`reconverge` operations.
2. New staging template **`ensemble`** (added to §8.4).
3. `batch` motion generalised: "N move as one rigid body" already existed for DPDK bursts and turns
   out to be the same primitive as a GPU warp. **RSS queues, DPDK burst, GPU warp, and a Raft
   replica set are one relation.** That is strong evidence the abstraction is at the right level.

The value of this test is precisely that it failed once. A stress test that passes everything was
not a test.

### 15.3 The standing rule

> **Before building a new pillar, walk two of its concepts through this model and record what
> breaks.** Extend the vocabulary first, then write episodes. Never the reverse.

---

## 16. Self-critique

Presented as findings against the design above, ordered by how much damage each could do.

### W1 · The grammar can produce competent, forgettable output — **severity: high**

Scaffolding removes cost but can also remove the spark. ep02 is good because a human decided the
bytes would sit still for two minutes; no rule set would have invented that.

**Refinement adopted:** §11.4 is now explicit — grammar generates a *plain correct default*, the
author refines, assertions survive. Additionally: **the generated staging is never shipped
directly.** `abs stage` output is marked `scaffold: true`, and shipping requires a human edit. The
framework's job is to make the first 80% free, not to make the last 20% unnecessary.

### W2 · Ontology paralysis — **severity: high**

The concept graph is infinitely expandable and produces no videos. This is the most likely way the
project dies: six months of beautiful taxonomy, zero episodes.

**Refinement adopted:** the promotion rule (§5.3) — a concept enters the SDK on its *second* use.
No speculative concepts. A concept with zero episodes is deleted. Add a CI check: `concepts with
0 episodes` must be empty.

### W3 · Framework complexity exceeds solo capacity — **severity: high**

Nine subsystems here, fifteen in `ARCHITECTURE.md`. One part-time maintainer.

**Refinement adopted — the honest MVP slice.** Only three of these nine are needed to make
Episode 3 cheaper than Episode 2:

1. **Actor System** (§6) — kills the per-episode toolkit rewrite
2. **Action System** (§7) — gives invariants, which give truth-checking
3. **Motion Language** (§9) — gives consistency across episodes

The other six ship as **data-only, no codegen** at first: Concept SDK as YAML documentation the
grammar does not yet read; Grammar as *assertions only* (a linter, no generation); Story Engine as
the existing act/beat structure; Camera and Composition as conventions. Generation arrives in
Phase 2 only if the assertions have already proven useful. **A grammar that can only check is
worth building; a grammar that must generate is a research project.**

### W4 · The cost model is a credibility liability — **severity: medium**

A wrong number in a systems video is remembered and quoted against you.

**Refinement adopted:** §7.2 — provenance and confidence mandatory; relative claims by default;
absolute numbers only with `confidence: exact` and a source; lint-enforced.

### W5 · Misconceptions are unbounded and unsourced — **severity: medium**

Any concept has infinite possible wrong models; inventing them from an armchair produces
plausible-sounding fiction rather than what learners actually believe.

**Refinement adopted:** cap of 3 per concept; every entry requires a `source` field naming real
evidence (a comment, a forum thread, a support question); entries without a source are `draft` and
cannot be cited by a grammar rule.

### W6 · No real signal about whether anyone learned anything — **severity: high, and the deepest**

Everything above optimises a *proxy* for understanding: internal consistency, truth, cognitive
budget. None of it observes a learner. A framework can be perfectly self-consistent and still fail
to teach.

**Refinement adopted — close the loop with data you already have.** Because every beat is anchored
to a word start, **audience-retention curves map directly onto beats.** A retention cliff at
t=97 s is not an anonymous drop-off; it is beat `mempool.alloc.explain`, teaching objective ZC-3,
using staging template `zoom_hierarchy`.

```
$ abs analyze retention s01e02

 beat                          t        retention   Δ      concept        template
 zerocopy.payoff.pointer     143.8s      71%      +1%    zero_copy      contrast
 mempool.alloc.explain        97.2s      74%     -11%    mempool        zoom_hierarchy  ← cliff
 hook.library.imagine          1.5s      98%       —     —              hook
```

Aggregated across the catalogue this yields something genuinely rare: **empirical evidence about
which staging templates teach and which lose people.** It is the only feedback in this architecture
that comes from outside the architecture, and over twenty episodes it is worth more than the rest
of the pedagogy layer combined. Honest caveat: retention conflates boredom, confusion, and
satisfaction, so it is a signal to investigate, never a verdict.

### W7 · Over-fitted to packet-shaped domains — **severity: medium**

Every primitive was derived from data-plane content.

**Partly confirmed** by §15: Raft fitted cleanly, GPU divergence did not, and the gap produced the
`ensemble` relation. **Refinement adopted:** the standing rule in §15.3 — stress-test two concepts
from any new pillar *before* building it.

### W8 · Two sources of truth for appearance — **severity: medium**

Grammar `THEN` clauses and the Visual Language Registry could disagree about what a packet looks
like.

**Refinement adopted:** strict layering, lint-enforced — a grammar rule may reference **roles and
relations only**, never values, never colours, never sizes. The grammar decides *what is staged*;
the visual language decides *what it looks like*; the theme decides *what colour that is*. Three
layers, one direction.

### W9 · Narration contracts are brittle — **severity: low**

Natural language paraphrase is unbounded; strict matching would be turned off within a month.

**Refinement adopted:** contracts are term *sets* with synonyms, and severity is `warn`, never
`error`. They are a nudge toward saying the thing while showing it, not a gate.

### W10 · Knowledge drift creates an unbounded maintenance tail — **severity: low**

Every concept revision potentially invalidates the back catalogue.

**Refinement adopted:** drift is a **report**, never an auto-fix (§10.4), and severity is graded —
`ACTION NEEDED` only when a revised objective is directly taught, `review` for composed use, `no
action` for assumed use. Most revisions will touch nothing.

### W11 · Concept focus vs. relational lessons — **RESOLVED**

Raised as: "exactly one concept in focus per beat" is clean, but NUMA *is* the
interaction of locality and topology, and false sharing *is* cache lines meeting
threads. Forcing them apart distorts the teaching.

**Resolved by architectural decision, 2 Aug 2026: Option C, and stronger than
proposed.** Interaction Concepts are a first-class *concept kind*, not an exemption —
see §5.0–5.5. The default rule is unchanged and, in fact, tightened:

- One concept in focus per beat, always. An Interaction Concept **is** one concept.
- An interaction requires its participants, so they are prerequisites and already
  known. The count of *new* ideas per beat remains exactly one (§5.4).
- The salience check gets **stricter**: primaries must equal the participant count
  the focused concept declares, so a beat can no longer acquire two primaries by
  accident — only by a concept that declared precisely that.
- Seven mandatory blocks and a per-participant removal test (§5.2, §5.5) make the
  loophole expensive to open and cheap to audit.

Validating the decision against its own examples surfaced three real problems, all
resolved in §17: `consensus` was placed in two tiers, `polling` is defined by
contrast rather than by relation, and the engine's `language.yaml` conflates
"drawable" with "teachable".

### W12 · The IR must now carry semantic metadata — **severity: low**

Objectives, refutations, and concept ids need to reach the render layer for overlays, chapter
markers, and analytics.

**Refinement adopted:** `ir_version: 2` adds an optional `semantics` block, ignored by backends
that do not use it. Backwards compatible; no backend changes required.

---

---

## 17. Validation of the concept hierarchy

The decision was integrated, then tested against itself. Six checks; four pass, two
found real problems that are resolved below.

### 17.1 Every proposed Interaction Concept, put through the removal test

| Concept | Participants | Remove one → what remains | Verdict |
|---|---|---|---|
| `zero_copy` | pointer ↔ buffer | "memory holds bytes" / "a pointer is an address" | ✅ interaction |
| `false_sharing` | thread ↔ cache_line | "64-byte fetches" / "cores run concurrently" | ✅ interaction |
| `numa` | core ↔ memory_locality | "cores exist" / "memory has addresses" | ✅ interaction |
| `dma` | nic ↔ memory | "a NIC receives" / "memory is written" | ✅ interaction |
| `rss` | nic ↔ worker_core | "a NIC has queues" / "cores exist" | ✅ interaction |
| `conntrack` | packet ↔ flow_table | "a packet has a 5-tuple" / "a table holds rows" | ✅ interaction |
| `context_switch` | thread ↔ core | "threads exist" / "a core runs code" | ✅ interaction |
| `tcp_congestion` | sender ↔ receiver ↔ network | any one alone is not congestion | ✅ interaction, **3 participants** |
| `tls_handshake` | client ↔ server | "a client connects" / "a server listens" | ✅ interaction |
| `polling` | worker_core ↔ nic_queue | "a core spins" / "a queue fills" | ⚠️ **see 19.3** |

Nine of ten pass cleanly. `tcp_congestion` confirms that `between:` must accept
**more than two** participants — the schema says `≥2`, and that was not accidental.

### 17.2 ⛔ Finding 1 — `consensus` was placed in two tiers at once

The decision lists **Consensus** under *Interaction Concepts* ("Leader ↔ Followers")
**and** under *Composite Concepts*. A concept cannot be both: an interaction owns a
staging template and stages itself; a composite owns an order and stages nothing.

**Resolution — they are two different concepts and both are needed:**

```yaml
id: leader_election          # INTERACTION
kind: interaction
between: [node, term]
objectives:
  - "At most one leader per term, decided by quorum rather than by merit."

id: consensus                # COMPOSITE
kind: composite
composes:
  - { concept: leader_election, kind: interaction, depth: full }
  - { concept: log_replication, kind: interaction, depth: full }
  - { concept: quorum,          kind: interaction, depth: brief }
  - { concept: split_brain,     kind: interaction, depth: brief }
```

This is not a technicality. "Consensus" as a single teachable unit is exactly the
kind of thing that produces a vague, forgettable video; as a composite of four
sharply-defined interactions it becomes an episode with four landings. **The
hierarchy caught a content problem, not just a schema problem** — which is the best
evidence available that it is carrying weight.

**General rule adopted:** when a name reads naturally as both, it is a composite,
and the interaction inside it needs its own narrower name.

### 17.3 ⚠️ Finding 2 — `polling` is a contrast, not an interaction

`polling` passes the removal test only weakly. Its participants (a core, a queue)
are real, but the *lesson* is not about their relationship — it is that polling
replaces something else. "100% CPU is a feature" only means anything against
interrupt-driven receive.

That is `contrasts_with`, which the model already has, not `between`.

**Resolution:** `polling` is an Interaction Concept `between: [worker_core, nic_queue]`
whose **defining edge is `contrasts_with: [interrupt_driven]`**, and whose staging
template is `contrast_then_invariance`. Both mechanisms apply; the contrast is what
makes it teachable and the interaction is what makes it stageable.

**Rule adopted:** if the removal test passes only weakly, check whether the concept
is really defined by contrast. If so it is still an interaction, but its
`contrasts_with` is mandatory rather than optional.

### 17.4 ⛔ Finding 3 — the code conflates "drawable" with "teachable"

The engine as built has `design/language.yaml` registering `dma` as a drawable
concept with `role: nic` and `silhouette: beam`. Under this decision, **`dma` is an
Interaction Concept** (nic ↔ memory) — and an Interaction Concept has no silhouette,
because a relationship cannot be drawn.

The registry is currently doing two incompatible jobs.

**Resolution — two registries, one namespace:**

```
design/language.yaml     ← ATOMIC CONCEPTS ONLY.
                           "what a thing looks like": role, silhouette, states.
                           packet, memory_buffer, mempool, mbuf, pointer, nic, cpu

concepts/*.yaml          ← ALL THREE KINDS.
                           "what a thing teaches": objectives, misconceptions,
                           grammar, assessment.
```

An Interaction Concept appears only in the second, and reaches the screen through
its participants. `dma`'s beam is not DMA — it is how the *transfer between* a NIC
and memory is drawn, which belongs in `dma`'s `motion_grammar`, not in a silhouette.

Concrete migration, deferred until implementation resumes:

| Currently in `language.yaml` | Correct home |
|---|---|
| packet, memory_buffer, mempool, mbuf, pointer, nic, cpu, idle | stays — atomic |
| **dma** | moves to `concepts/dma.yaml` as an interaction |
| **copy** | moves to `concepts/copy_based.yaml` as an interaction (packet ↔ buffer) |

Note that `copy` has the same problem, and it matters more: red is a *reserved
role*, and reserving a role for an interaction rather than a thing is what makes
"the absence of red" the argument in Episode 02. The role stays in the theme; the
concept moves.

### 17.5 The one-idea-per-beat rule survives — checked, not assumed

| Beat teaches | Participants | Already known? | New ideas |
|---|---|---|---|
| `packet` (atomic) | — | — | 1 |
| `zero_copy` (interaction) | pointer, buffer | prerequisites → yes | **1** |
| `false_sharing` (interaction) | thread, cache_line | prerequisites → yes | **1** |
| `false_sharing` *taught before threads* | thread, cache_line | **no** | **2** ⛔ rejected by §12.5 |

The rule holds because participants are prerequisites. The final row is the case the
new closure check exists to catch, and it is the only way the budget can be
genuinely violated.

### 17.6 The hierarchy against the extensibility stress test

Re-running §15 under the three kinds:

| Domain | Atomic | Interaction | Composite |
|---|---|---|---|
| Data plane | packet, mbuf, mempool, nic, core | zero_copy, dma, rss, batching, false_sharing, numa | dpdk_rx_pipeline, ngfw_fast_path |
| Distributed | node, log, term, quorum | leader_election, log_replication, split_brain | consensus, kafka_replication |
| GPU | warp, lane, predicate_mask, sm | warp_divergence *(lane ↔ branch)* | gpu_kernel_launch |
| Compilers | ir_node, register, basic_block | register_pressure *(live_range ↔ register_file)* | ssa_construction |

Every domain populates all three tiers, and — worth noting — **the interaction tier
is where the interesting content lives in every one of them.** `warp_divergence` and
`register_pressure` are both relationships; neither is expressible as an object.
That is the strongest evidence that the decision generalises rather than fitting
Pillar 1.

### 17.7 What the decision changes in the engine, when implementation resumes

| Component | Change | Size |
|---|---|---|
| `design/language.yaml` | atomic concepts only; `dma` and `copy` move out | small |
| `concepts/` | new directory, three schemas | new |
| `Scene.check_salience()` | "exactly 1 primary" → "primaries == participants of the focused concept" | small |
| `abs plan` closure check | add "an interaction may not precede its participants" | small |
| `Concept` model | `kind` discriminator; seven required blocks for interactions | new |
| Grammar | rule scoping by concept kind | new |

Nothing already built is invalidated. The actors, actions, motion, layout, chrome
and Manim backend all sit *below* the concept layer and are unaffected — which is
itself a validation of the L7→L1 split.

---

## 18. What changed, and when

| # | Change | Driven by |
|---|---|---|
| 1 | Two-axis model replaces the linear hierarchy | §3 structural analysis |
| 2 | Invariants elevated to *the* representation of a lesson | worked example |
| 3 | `negation` added to the Action contract | ep02's "no copy" cross |
| 4 | Cognitive budget unified with layout density budget | avoiding two contradictory numbers |
| 5 | `ensemble` relation and staging template added | W7 / §15.2 GPU stress test |
| 6 | Grammar positioned as *scaffold + assert*, not generator | W1 |
| 7 | Promotion rule: concepts enter the SDK on second use | W2 |
| 8 | Honest MVP slice: 3 of 9 subsystems for Episode 3 | W3 |
| 9 | Cost provenance and confidence bands mandatory | W4 |
| 10 | Retention-to-beat analytics as the real feedback loop | W6 |
| 11 | Strict layering: grammar references roles, never values | W8 |
| 12 | Narration contracts downgraded to warnings | W9 |

### v0.3 — the concept hierarchy (2 Aug 2026)

| # | Change | Driven by |
|---|---|---|
| 13 | Three concept kinds: atomic, interaction, composite | architectural decision on W11 |
| 14 | Interaction Concepts: seven mandatory blocks, removal test per participant | the same decision |
| 15 | Salience check tightened to "primaries == declared participants" | §5.4 |
| 16 | Closure check: an interaction may not be taught before its participants | §12.5 |
| 17 | `consensus` split into an interaction and a composite | validation §17.2 |
| 18 | `polling` reclassified as contrast-defined | validation §17.3 |
| 19 | `language.yaml` restricted to atomic concepts | validation §17.4 |

---

## 19. Decisions required

**Approve or amend:**

1. **The two-axis model** (§3) — knowledge and narrative as separate axes meeting at the Shot.
   This is the load-bearing structural decision; everything else follows from it.
2. **Invariants as the canonical form of a lesson** (§5.2, §7.1) — the strongest idea here, and the
   one that makes truth mechanically checkable.
3. **Grammar as scaffold-plus-assertions, not generator** (§11.4) — the decision that keeps this
   from becoming a research project.
4. **The promotion rule** (§5.3) — concepts earn their place on second use. The guard against
   ontology paralysis.
5. **The MVP slice** (W3) — Actors, Actions, Motion as code; the other six as data and lint only.
6. **Retention-to-beat analytics** (W6) as a Phase-2 deliverable — the only real learning signal.

**Decided:**

7. ~~W11 — may a beat hold two concepts in focus?~~ **Resolved 2 Aug 2026.** Interaction Concepts
   are a first-class concept kind with seven mandatory blocks and a removal test; the one-concept-
   per-beat rule is unchanged and the salience check is now stricter. See §5.0–5.5 and §17.

**Newly needing approval, following that decision:**

8. **The three-kind hierarchy** — atomic / interaction / composite, with `kind` as a discriminator
   on every concept file — §5.0.
9. **`consensus` splits** into `leader_election` (interaction) and `consensus` (composite), and the
   general rule that a name reading naturally as both is a composite — §17.2.
10. **`language.yaml` becomes atomic-only**, with `dma` and `copy` migrating to `concepts/` as
    interactions — §17.4. This is the one change that touches code already written.

No implementation begins until you approve. The next document after approval is the **Concept
Authoring Guide** — how a contributor writes a new concept, with `zero_copy` as the worked
reference.
