# AxioByte Studio — Concept Architecture

**The semantic layer above the rendering engines.**

**Status:** proposed, awaiting approval · **Version:** 0.2 (includes self-critique and refinement)
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

### 5.1 What a Concept is

A Concept is a **versioned, reusable unit of teachable knowledge** with everything needed to stage
it. It is data, not code.

```yaml
id: zero_copy
version: 2.1.0
title: "Zero-copy — a packet is just a pointer"
domain: data_plane
maturity: stable                    # draft | stable | deprecated

pedagogy:
  objectives:                       # testable, not aspirational
    - id: ZC-1
      statement: "Packet bytes are written once and never moved again."
      evidence: "The payload actor's position is constant from DMA to transmit."
    - id: ZC-2
      statement: "What is passed between stages is a reference, not the data."
      evidence: "Only the pointer actor changes owner."
  misconceptions:                   # ★ what learners actually get wrong (max 3)
    - id: ZC-M1
      wrong: "Zero-copy means no memory is used."
      refute_by: "Show the buffer allocated and occupied the whole time."
      source: "recurring YouTube comment, ep02 launch"
    - id: ZC-M2
      wrong: "The packet teleports between stages."
      refute_by: "Camera orbits the stationary payload while the pointer travels."
    - id: ZC-M3
      wrong: "The mbuf *is* the packet."
      refute_by: "Zoom into mbuf: metadata + buf_addr; the bytes are elsewhere."
  prerequisites:
    requires: [pointer, memory_buffer, dma]
    assumed:  [what_a_packet_is]     # not taught here; declared as audience baseline
  cognitive_load:
    novel_elements: 3                # mbuf, mempool, refcount
    budget_per_beat: 2

semantics:
  actors:   [packet, memory_buffer, mempool, mbuf, pointer, nic, cpu]
  actions:  [dma_write, allocate, reference, forward, release]
  invariants:                        # ★ THE LESSON IS AN INVARIANT
    - id: ZC-INV-1
      statement: "payload.address is constant across all forwarding actions"
      assert: "actor(payload).position unchanged over concept scope"
    - id: ZC-INV-2
      statement: "no copy action occurs after the zero-copy act begins"
      assert: "no action of type Copy in scope"

staging:
  template: contrast_then_invariance   # see §8.4
  counter_concept: copy_based          # the picture built first, to be destroyed
  camera: orbit_stationary_subject
  focus_actor: packet

relations:
  contrasts_with: [copy_based]
  requires:       [pointer, memory_buffer, dma]
  composes_into:  [ngfw_fast_path, dpdk_rx_path]
  refined_by:     [mbuf_chaining, refcount_sharing]
```

### 5.2 The three fields that make this more than documentation

**`invariants`** — the strongest idea in this architecture. For most systems concepts, *the lesson
is literally an invariant*: bytes don't move (zero-copy), at most one leader per term (Raft), one
instruction per cycle per warp (GPU), a lock is held by at most one thread. Writing the objective
as a machine-checkable assertion means the engine can verify **the episode teaches the truth**, not
just that it renders.

**`misconceptions`** — teaching is not only transmitting the right model; it is *destroying the
wrong one*. Each misconception carries a `refute_by` staging instruction, so the grammar can
guarantee the episode actively contradicts it rather than merely avoiding it.

**`cognitive_load`** — a hard budget on novel elements per beat. This is the same budget as the
layout system's `density_budget` from `ARCHITECTURE.md` §2.5a, viewed from the other side: the
layout budget asks *"will it fit and read?"*, the cognitive budget asks *"can a human absorb it?"*
The engine takes the **minimum of the two**. That unification is deliberate — one number, two
justifications, no contradiction possible.

### 5.3 The promotion rule (prevents ontology paralysis)

> **A concept enters the SDK on its *second* use, not its first.**

First time a topic appears, it is staged inline in the episode. When a second episode needs it, it
is promoted to a Concept with a version. This is the "rule of three" applied to knowledge, and it
is the guard against the single most likely failure of this design: spending six months building a
beautiful taxonomy of computer science and shipping no videos.

Corollary: **no speculative concepts.** The SDK grows from production, never from a planning
exercise. A concept with zero episodes is deleted.

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

### 12.1 Typed edges

The concept graph is a DAG with typed edges. Each edge type has different semantics for staging
and for prerequisite checking:

| Edge | Meaning | Staging consequence |
|---|---|---|
| `requires` | hard prerequisite | must be taught or declared assumed before use |
| `refines` | a specialisation | inherits staging template and visual identity |
| `composes_into` | is a part of | may appear backgrounded inside the composite |
| `contrasts_with` | ★ defined *against* | the counter-picture in `contrast_then_invariance` |
| `generalises` | the abstract form | may be substituted when depth is not needed |

`contrasts_with` is pedagogically essential and usually missing from such models. `ZeroCopy` is not
meaningful in isolation — it is meaningful *against* `CopyBased`. Episode 2 spends its first forty
seconds building the copy picture precisely so it can be destroyed. That is not narrative
decoration; it is how the concept is defined.

### 12.2 A composite concept

```yaml
id: ngfw_fast_path
version: 1.0.0
composes:
  - { concept: packet,      depth: assumed }
  - { concept: rss,         depth: brief    }
  - { concept: batching,    depth: brief    }
  - { concept: zero_copy,   depth: assumed  }   # taught in s01e02; referenced here
  - { concept: conntrack,   depth: full     }   # ★ the episode's actual subject
  - { concept: fast_slow_path, depth: full  }
focus_order: [fast_slow_path, conntrack]
```

```
                    ngfw_fast_path
                          │
      ┌────────┬──────────┼──────────┬──────────────┐
      ▼        ▼          ▼          ▼              ▼
   packet    rss      batching   zero_copy      conntrack
  (assumed) (brief)   (brief)   (assumed)        (full)
      │        │          │          │              │
      └────────┴──────────┴──────────┴──────────────┘
                          │
                  requires: pointer, memory_buffer, dma, hashing
                          │
                          ▼
              prerequisite closure check at plan time
```

### 12.3 Depth, and the rule that makes composition tractable

`depth` is the amount of teaching a composite owes a sub-concept:

| Depth | Meaning | Screen cost |
|---|---|---|
| `assumed` | viewer already knows it; may be referenced without explanation | seconds |
| `brief` | one beat, one image, no derivation | ~5 s |
| `full` | complete staging with objectives and misconception refutation | ~30–60 s |

**Exactly one concept is in focus per beat.** Every other concept present is backgrounded. This
single rule resolves what would otherwise be an intractable ambiguity — when three concepts compose,
whose grammar wins? — and it is simultaneously the correct pedagogical rule. Ambiguity resolution
and cognitive load turn out to be the same constraint.

### 12.4 Prerequisite closure is checked, not hoped

```
$ abs plan episodes/s01e10-ngfw-fast-path

concept closure:
  conntrack        requires flow_table       ✓ declared assumed
  conntrack        requires five_tuple       ✗ NOT taught, NOT declared assumed
                   ↳ either add a `brief` beat, or declare it assumed in episode.yaml
  fast_slow_path   requires zero_copy@>=2.0  ✓ taught in s01e02 (viewer path exists)
```

An episode that silently depends on untaught knowledge is the most common way technical education
fails. Here it does not compile.

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

### W11 · The Beat may be too small a unit for concept focus — **severity: medium, unresolved**

"Exactly one concept in focus per beat" is clean, but beats are 1–8 seconds. Some ideas genuinely
need two concepts held simultaneously — NUMA *is* the interaction of locality and topology; false
sharing *is* the interaction of cache lines and threads.

**Proposed, not yet adopted:** allow a beat to declare `focus: [a, b]` **only** when an explicit
`interaction` concept exists that names the pair — i.e. the interaction must itself be a concept
with its own objective, not an excuse to show two things. This preserves the constraint's purpose
(cognitive load) while admitting that some lessons are genuinely relational.

**I would like a decision on this one**, because it affects the concept schema.

### W12 · The IR must now carry semantic metadata — **severity: low**

Objectives, refutations, and concept ids need to reach the render layer for overlays, chapter
markers, and analytics.

**Refinement adopted:** `ir_version: 2` adds an optional `semantics` block, ignored by backends
that do not use it. Backwards compatible; no backend changes required.

---

## 17. What changed between v0.1 and v0.2 of this document

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

---

## 18. Decisions required

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

**Open question needing your judgement:**

7. **W11 — may a beat hold two concepts in focus** when an explicit `interaction` concept names the
   pair? I lean yes, because NUMA and false sharing are genuinely relational and forcing them apart
   would distort the teaching. But it weakens the cleanest constraint in the design, so it is your
   call.

No implementation begins until you approve. The next document after approval is the **Concept
Authoring Guide** — how a contributor writes a new concept, with `zero_copy` as the worked
reference.
