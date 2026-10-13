# s01e02 — Presentation plan: the opening (sentences 0–4)

A presentation design note for the Three.js film. It adds no asset, concept or architecture: the
truck, the buildings and the crates are episode-local geometry in `three/analogy.js`.

## 1. Narrative purpose

The voiceover opens on an analogy, not on hardware:

| # | Time | Narration | What it must do |
|---|---|---|---|
| 0 | 0.03–4.39 | "…moving an entire library every time someone wants to read a single book." | Set the scene: a lot of cargo, one small thing wanted. |
| 1 | 5.04–11.20 | "You pack all the books into a truck, drive them to a new building, unload them, and repeat…" | Show the cost physically: the same cargo, carried, unloaded, carried again. |
| 2 | 11.82–13.60 | "Sounds ridiculously inefficient, right?" | Let the viewer judge it: see the whole repetition at once. |
| 3 | 14.64–17.83 | "That's exactly what traditional packet processing does." | Turn the metaphor: the cargo is data. |
| 4 | 17.85–27.24 | "…a packet travels from the hardware … the actual bytes are copied across system boundaries." | Reveal the computer that the metaphor described, and hand over to the technical story. |

The episode's main character is the data. The opening makes the viewer follow one piece of it
before any hardware appears.

## 2. The metaphor

- **Library building** (the first dock), **new building** (the second), and one more (the repeat).
- **Book crates** on the dock: the cargo, i.e. the bytes. Kraft-brown, eight of them.
- **One crate, edged in the packet's blue**: "a single book" — the piece of data the story follows.
- **The truck**: a flatbed, so the crates stay visible while it drives.

Moving a crate is always a physical arc from one surface to another, never a cut.

## 3. Camera progression (one continuous move, no slide cuts)

wide establishing as the truck drives in → closer on the crates as they are packed →
travel with the drive → the unload at the new building → the repeat → high pull-back over all
three buildings ("inefficient") → push into the marked crate → macro as it opens into bytes →
pull back as the scene transforms → the NIC, the packet crossing its card → the host side.

## 4. Package → bytes

On sentence 3 the marked crate, already on its last dock, shrinks away while six byte cells — the
packet's colour, in exactly the arrangement the film's packet token uses — grow out of it and lift.
The crate *becomes* the packet. No label says so; the colour and the shape carry it.

## 5. Into the NIC

On sentence 4 the analogy folds flat into the floor grid (the technical space), the real NIC rises
in the same place, and the six cells fly into the NIC's network port (`rj45-1`, its `in` anchor) —
where they are handed, at the same position and in the same arrangement, to the film's packet
token, which crosses the card exactly as before. The NIC reads as "here is what that looked like
inside a computer", not "here is a NIC".

## 6. Existing assets after the transition

The real NIC (its own world and geometry), then — as in milestone 1 — the real CPU and two
packet_buffer instances, followed later by the real mbuf and Mempool. Nothing of theirs changes.

## 7. Episode-local only

Truck, wheels, road, buildings, docks, crates, the marked crate's edge, the byte cells of the
transformation, and presentation markers (`e02.analogy.*`) the camera frames. No registry entry,
no concept, no route.

## 8. Continuity

- One world: the analogy stands where the NIC will stand, so the reveal is a transformation in
  place, not a cut to somewhere else.
- One object followed throughout: the marked crate → its bytes → the packet token → (later) the
  bytes in buffer A.
- One clock: every beat sits on a spoken word ("pack", "drive", "unload", "repeat", "packet"), and
  every frame is a pure function of time.
