"""s01e02 — the shots.

One staging function per act, named after the act it draws, so ``abs render`` can
verify that everything the storyboard declares is actually drawn. An act that is
cued and never staged is the quietest way for an episode to be wrong.

There are no coordinates, no colours, no aspect ratios and no durations here: the
target profile chooses the axis, the theme chooses the hues, the motion language
chooses the curves, and the voiceover chooses the timing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    FadeOut,
    GrowArrow,
    Indicate,
    RoundedRectangle,
    SurroundingRectangle,
    VGroup,
)

from axiobyte_studio.actions import COPY, DMA_WRITE, FORWARD, REFERENCE, Invariant, Scene
from axiobyte_studio.actors import MBUF, MEMORY_BUFFER, MEMPOOL, NIC, PACKET, POINTER, Salience
from axiobyte_studio.backends.manim import (
    StudioScene,
    build_episode_scenes,
    draw,
    rate_func,
)
from axiobyte_studio.backends.manim.components import cross, link, pill, tag, title_card
from axiobyte_studio.backends.manim.space import center_of, size_of
from axiobyte_studio.layout import Chain, Stack
from axiobyte_studio.motion import motion
from axiobyte_studio.timeline import CueTable, Timeline

EPISODE_ROOT = Path(__file__).resolve().parents[1]

#: The moment the argument turns. Before it, the episode is building the picture it
#: is about to destroy, so the invariant is scoped to begin here.
TURN = "zerocopy.instead"

TRADITIONAL = Stack(
    id="s01e02.traditional",
    children=(Chain(id="copy_path", items=("nic", "buffer_a", "buffer_b", "app")),),
)

#: When each modelled action happens: words of THIS episode's own voiceover, resolved like any
#: cue. The narration is the clock — the model's actions land where the voiceover says them.
ACTION_CUES = {
    "receive": "receives@5",  # "The NIC receives the packet into one buffer." — by DMA
    "copy": "copied@6",  # "Then those bytes are copied into another buffer"
    "copy_again": "copied@7",  # "They may be copied again before transmission."
    "dma": "DMA@21",  # "the NIC uses Direct Memory Access or DMA ... into a free buffer"
    "reference": "moment@23",  # "From this moment onward, every stage ... the same packet buffer"
    "forward": "receives@24",  # "The parser receives the mBuff."
}


def action_times() -> CueTable:
    """Resolve ``ACTION_CUES`` against this episode's voiceover."""
    timeline = Timeline.load(EPISODE_ROOT / "timeline" / "words.json")
    return CueTable.resolve(ACTION_CUES, timeline)


#: One layout for the whole zero-copy act, so what the narration says stays still never moves:
#: the pool; one of its elements magnified (its mbuf, its buffer) beside the NIC that writes the
#: buffer; and the processing stages the handle visits. ``wire`` is the gap the NIC's DMA crosses
#: (a slot, so the arrow has length on either axis); ``stages`` holds the four episode-local nodes.
ZEROCOPY = Stack(
    id="s01e02.zerocopy",
    children=(
        Chain(id="pool", items=("mempool",), weight=1.5),
        Chain(id="element", items=("mbuf", "buffer", "wire", "nic"), weight=3.6),
        Chain(id="stages", items=("stages",), weight=0.9),
    ),
)


def build_scene(turn: float) -> Scene:
    """Cast the episode, and state as an invariant the thing it exists to teach.

    Args:
        turn: When the prohibition begins, in seconds. Act one legitimately
            copies — that is the counter-picture — so the invariant starts here.

    Returns:
        The verified scene.
    """
    scene = Scene(id="s01e02", focus="zero_copy")
    scene.cast(NIC, "1", label="SmartNIC", rx_queues=6)
    scene.cast(MEMPOOL, "1", slots=8)
    scene.cast(MBUF, "1", buf_addr="0x7f3a4c00", refcount=1)
    scene.cast(PACKET, "1", address="0x7f3a4c00", bytes=1500)
    # zero_copy is an interaction between pointer and memory_buffer, so those two
    # hold primary attention — the relationship is only visible when both are.
    scene.cast(POINTER, "1", salience=Salience.PRIMARY)
    scene.cast(MEMORY_BUFFER, "1", salience=Salience.PRIMARY, address="0x7f3a4c00")
    scene.require(
        Invariant(
            id="OP-1",
            statement="packet bytes are written once and never moved again",
            actor="packet#1",
            unchanged=("address",),
            forbids=("copy",),
            after=turn,
        )
    )

    # Act one is a DIFFERENT WORLD, not an earlier chapter of this packet's life.
    # `copy_based` and `zero_copy` are contrasting interactions, so the counter
    # picture gets its own payload — which is why the zero-copy packet's address
    # is still 0x7f3a4c00 when act two draws it, matching the mbuf's buf_addr.
    # That identity is the entire lesson.
    # The NIC receives by DMA; the CPU then copies, twice. Only the copies are copies.
    at = action_times()
    scene.cast(PACKET, "trad", address="0x7f3a4c00", bytes=1500)
    scene.apply(DMA_WRITE, "packet#trad", at=at["receive"], into="kernel_buffer")
    scene.apply(COPY, "packet#trad", at=at["copy"], into="buffer_b", address="0x7f3a5400")
    scene.apply(COPY, "packet#trad", at=at["copy_again"], into="app", address="0x7f3a5800")

    # DMA writes the packet into a BUFFER (dma: nic <-> memory_buffer) — one the mempool
    # provides, but the pool is the allocation structure, not where the bytes are written.
    scene.apply(DMA_WRITE, "packet#1", at=at["dma"], into="memory_buffer#1")
    scene.apply(REFERENCE, "packet#1", at=at["reference"], by="mbuf#1")
    scene.apply(FORWARD, "packet#1", at=at["forward"], to="parser")
    scene.verify()
    return scene


# ---------------------------------------------------------------------------
# Shared drawing for both acts. Everything here is presentation: the ``e02:`` names exist only
# so the tests can find what was drawn — never identities in the model.
# ---------------------------------------------------------------------------


def _bytes_in(frame: Any, hue: str, count: int = 6) -> VGroup:
    """The packet's bytes, drawn inside a buffer frame — where they live."""
    width, height = frame.width, frame.height
    cell_w = min(width * 0.8 / (count * 1.3), height * 0.42)
    cells = VGroup(
        *[
            RoundedRectangle(
                width=cell_w,
                height=cell_w * 1.5,
                corner_radius=cell_w * 0.12,
                stroke_color=hue,
                stroke_width=1.2,
                fill_color=hue,
                fill_opacity=0.85,
            )
            for _ in range(count)
        ]
    ).arrange(RIGHT, buff=cell_w * 0.22)
    cells.move_to(frame.get_center() + DOWN * height * 0.08)
    cells.name = "e02:bytes"
    return cells


def _beside(arrow: Any, label: Any) -> Any:
    """Put an arrow's word beside it: above a horizontal arrow, to the right of a vertical one."""
    dx, dy, _ = arrow.get_end() - arrow.get_start()
    return label.next_to(arrow, RIGHT if abs(dy) > abs(dx) else UP, buff=0.12)


def _transfer(
    source: Any, destination: Any, hue: str, word: str, scene: StudioScene, inside: Any = None
) -> VGroup:
    """One transfer arrow with its word: DMA in the packet's colour, a copy in red.

    The word sits beside the arrow, or — where boxes touch and the arrow is short — inside the
    destination box (``inside``), under the bytes it brought.
    """
    arrow = link(source, destination, hue)
    word_mob = tag(word, scene.target, hue)
    if inside is None:
        _beside(arrow, word_mob)
    else:
        word_mob.move_to(inside.get_bottom() + UP * (word_mob.height * 0.9))
    group = VGroup(arrow, word_mob)
    group.name = f"e02:{word.lower().replace(' ', '_')}"
    return group


def _settle(scene: StudioScene, group: VGroup) -> None:
    """Hold an arrow and its word on screen as the one group they are, once they have appeared."""
    scene.remove(*group.submobjects)
    scene.add(group)


def _show(scene: StudioScene, group: VGroup, hue_motion: Any, run_time: float, *extra: Any) -> None:
    """Grow a transfer's arrow, fade in its word (and anything else), then hold it as one."""
    scene.play(
        GrowArrow(group[0]),
        FadeIn(group[1]),
        *extra,
        run_time=run_time,
        rate_func=rate_func(hue_motion),
    )
    _settle(scene, group)


# ---------------------------------------------------------------------------
# ACT 1 — the copy tax. The picture built first, so it can be destroyed.
# ---------------------------------------------------------------------------


def stage_traditional(scene: StudioScene) -> None:
    """The traditional path: the NIC's DMA into a buffer, then the CPU copying, twice.

    Red is reserved for the CPU copying bytes, which is why its absence in act two is
    the argument. The NIC's own write is not a copy: it is drawn in the packet's
    colour, labelled DMA, on the sentence that says it.

    Args:
        scene: The scene being staged.
    """
    copy_hue = scene.theme.role("copy").hue
    dma_hue = scene.theme.role("packet").hue
    layout = scene.solve_shot(TRADITIONAL)
    copying, beam = motion("copy.duplicate_translate"), motion("dma.smooth_beam")

    scene.at("traditional.networking")
    scene.keyword("THE COPY TAX", role="copy", run_time=0.4)
    stages = {
        "nic": draw(NIC.spawn("t", label="NIC"), layout.boxes["nic"], scene.target, scene.theme)
    }
    for name in ("buffer_a", "buffer_b", "app"):
        stages[name] = draw(
            MEMORY_BUFFER.spawn(name), layout.boxes[name], scene.target, scene.theme
        )
    app_label = tag("application", scene.target, scene.theme.ink["secondary"])
    app_label.next_to(stages["app"][0], DOWN, buff=0.08)
    for mobject in (*stages.values(), app_label):
        scene.add(mobject)

    # Sentence 4 names the problem: the boundaries the bytes will cross, before any crosses.
    scene.at("traditional.copied")
    quiet = scene.theme.ink["secondary"]
    scene.play(
        *[
            Indicate(stages[k][0], color=quiet, scale_factor=1.02)
            for k in ("buffer_a", "buffer_b", "app")
        ],
        run_time=min(0.6, scene.until("traditional.receive")),
    )

    # Sentence 5: the NIC writes the packet into the first buffer — by DMA, not a copy.
    scene.at("traditional.receive")
    dma = _transfer(stages["nic"], stages["buffer_a"], dma_hue, "DMA", scene, stages["buffer_a"][0])
    received = _bytes_in(stages["buffer_a"][0], dma_hue)
    _show(scene, dma, beam, min(beam.duration, scene.until("traditional.copy")), FadeIn(received))

    # Sentences 6 and 7: the CPU copies the bytes, and copies them again. These are red.
    for source, destination, beat, nxt in (
        ("buffer_a", "buffer_b", "traditional.copy", "traditional.copy_again"),
        ("buffer_b", "app", "traditional.copy_again", None),
    ):
        scene.at(beat)
        copy = _transfer(
            stages[source], stages[destination], copy_hue, "copy", scene, stages[destination][0]
        )
        copied = _bytes_in(stages[destination][0], dma_hue)
        run = copying.duration if nxt is None else min(copying.duration, scene.until(nxt))
        _show(scene, copy, copying, run, FadeIn(copied))
    scene.wait(0.3)
    # Never sweep scene.mobjects: the chrome rides the camera through an updater
    # that closes over the scene, and Manim follows that reference when it caches.
    scene.clear_stage(run_time=0.4)


# ---------------------------------------------------------------------------
# ACT 2 — the turn. The copies stop, and the stillness reads as the point.
# ---------------------------------------------------------------------------

#: Which pool element stands for "a buffer the pool provides" — a drawing-time choice, the first,
#: as on the NIC-host walkthrough. Illustrative: no element is singled out in the model.
REPRESENTATIVE = 0
STAGES = ("parser", "classifier", "firewall", "routing")
#: The four stage beats, in narrated order.
STAGE_BEATS = tuple(f"zerocopy.{name}" for name in STAGES)


def _stage_nodes(scene: StudioScene, box: Any, handle_width: float) -> VGroup:
    """The four processing stages — this film's illustration, not assets — laid out in their box.

    A row when the box is wide, two by two when it is not; each with room on its right for the
    handle, so the handle never covers a stage's name.
    """
    hue = scene.theme.role("cpu").hue
    nodes = VGroup(*[pill(name, scene.target, hue, rung="row") for name in STAGES])
    width, height = size_of(box, scene.target)
    gap = handle_width * 1.5
    if width / max(height, 1e-6) > 3.0:
        nodes.arrange(RIGHT, buff=gap)
    else:
        nodes.arrange_in_grid(rows=2, cols=2, buff=(gap, height * 0.12))
    nodes.move_to(center_of(box, scene.target) + LEFT * handle_width * 0.6)
    room = (width * 0.96 - handle_width * 1.2, height * 0.96)
    if nodes.width > room[0] or nodes.height > room[1]:
        nodes.scale(min(room[0] / nodes.width, room[1] / nodes.height))
    nodes.name = "e02:stages"
    return nodes


def stage_zerocopy(scene: StudioScene, model: Scene) -> None:
    """The bytes stop moving. A handle does all the travelling.

    One layout for the whole act, so nothing that the narration says stays still ever moves:
    the pool; one of its elements magnified — its mbuf, and the buffer that mbuf names — beside
    the NIC that writes that buffer; and the processing stages. The magnified element is one of
    the pool's, chosen to draw — an illustration, said so on screen. Its buffer holds the bytes;
    its mbuf holds the address. DMA writes the buffer; only the handle visits the stages.

    Args:
        scene: The scene being staged.
        model: The semantic scene: the pool, mbuf and buffer drawn here are its actors.
    """
    layout = scene.solve_shot(ZEROCOPY)
    theme, fmt = scene.theme, scene.target
    pointer_hue, mbuf_hue = theme.role("pointer").hue, theme.role("mbuf").hue
    copy_hue, packet_hue = theme.role("copy").hue, theme.role("packet").hue
    memory_hue = theme.role("memory").hue
    ink, quiet = theme.ink["primary"], theme.ink["secondary"]
    snap, beam = motion("pointer.snap"), motion("dma.smooth_beam")

    def fit(seconds: float, nxt: str) -> float:
        return max(0.08, min(seconds, scene.until(nxt)))

    actors = model.actors
    # The NIC is drawn as the NIC asset names itself, whatever label the model carries.
    nic = draw(NIC.spawn("1", label="NIC"), layout.boxes["nic"], fmt, theme)
    pool = draw(actors["mempool#1"], layout.boxes["mempool"], fmt, theme)
    mbuf = draw(actors["mbuf#1"], layout.boxes["mbuf"], fmt, theme)
    buffer = draw(actors["memory_buffer#1"], layout.boxes["buffer"], fmt, theme)
    buffer.name, mbuf.name, pool.name = "e02:buffer", "e02:mbuf", "e02:mempool"
    payload = _bytes_in(buffer[0], packet_hue)

    scene.at(TURN)
    card = title_card("A DIFFERENT WAY", fmt, theme, mbuf_hue, "stop moving the bytes")
    scene.play(FadeIn(card), run_time=0.4)
    scene.play(FadeOut(card), run_time=0.4)
    scene.keyword("ZERO COPY", role="mbuf", run_time=0.4)

    # The packet, in its buffer. The copy that would have followed does not happen.
    scene.add(buffer)
    scene.play(FadeIn(payload, scale=1.05), run_time=fit(beam.duration * 0.6, "zerocopy.reference"))
    # Under the buffer, not beside it: a tall frame keeps its right edge clear for the platform.
    struck = cross(buffer.get_bottom() + DOWN * 0.45, copy_hue, size=0.5)
    no_copy = tag("no copy", fmt, copy_hue).next_to(struck, RIGHT, buff=0.12)
    scene.play(FadeIn(struck), FadeIn(no_copy), run_time=fit(0.3, "zerocopy.reference"))

    # "passes a reference to it": a pointer to the buffer — held, a moment later, by the mbuf.
    scene.at("zerocopy.reference")
    # The pointer leaves the mbuf's own buf_addr field: that field IS the address.
    tether = link(mbuf[1][-1], buffer, pointer_hue)
    tether.name = "e02:buf_addr"
    note = _beside(tether, tag("a reference", fmt, pointer_hue))
    scene.play(
        FadeOut(struck),
        FadeOut(no_copy),
        GrowArrow(tether),
        FadeIn(note),
        run_time=fit(snap.duration * 2, "zerocopy.mbuf"),
    )

    # "The answer is an mBuff": the reference is the mbuf's.
    scene.at("zerocopy.mbuf")
    scene.play(FadeOut(note), FadeIn(mbuf), run_time=fit(0.5, "zerocopy.metadata"))
    scene.caption("The mbuf holds the address. The bytes never move.")

    scene.at("zerocopy.metadata")
    scene.caption("An mbuf is metadata, not the packet bytes.")
    scene.play(
        Indicate(mbuf[0], color=mbuf_hue, scale_factor=1.02), run_time=fit(0.6, "zerocopy.buf_addr")
    )

    scene.at("zerocopy.buf_addr")
    scene.caption("Its buf_addr is the buffer's address.")
    scene.play(
        Indicate(mbuf[1][-1], color=pointer_hue),
        Indicate(tether, color=pointer_hue, scale_factor=1.04),
        run_time=fit(0.6, "zerocopy.bytes_live"),
    )

    scene.at("zerocopy.bytes_live")
    scene.caption("The bytes live in the buffer.")
    scene.play(
        Indicate(payload, color=packet_hue, scale_factor=1.06), run_time=fit(0.6, "zerocopy.pool")
    )

    # "Before any packet even arrives": the pool, prepared up front, every buffer empty.
    scene.at("zerocopy.pool")
    scene.caption("A mempool: mbuf + buffer elements, set up in advance.")
    elements = pool[1]
    chosen = elements[REPRESENTATIVE]
    scene.play(FadeOut(payload), FadeIn(nic), FadeIn(pool), run_time=fit(0.7, "zerocopy.mempool"))
    # One of its elements, magnified below: the same mbuf + buffer pair, outlined alike.
    marks = VGroup(
        SurroundingRectangle(chosen, color=ink, buff=0.05, stroke_width=2),
        SurroundingRectangle(VGroup(mbuf, buffer), color=ink, buff=0.08, stroke_width=2),
    )
    example = tag("one element (outlined), for example", fmt, quiet)
    example.next_to(pool[0], UP, buff=0.08).align_to(pool[0], LEFT)
    illustrative = VGroup(marks, example)
    illustrative.name = "e02:illustrative"
    scene.play(FadeIn(illustrative), run_time=fit(0.5, "zerocopy.mempool"))

    scene.at("zerocopy.mempool")
    scene.play(
        Indicate(pool[0], color=memory_hue, scale_factor=1.02),
        run_time=fit(0.6, "zerocopy.warehouse"),
    )

    scene.at("zerocopy.warehouse")
    scene.play(
        Indicate(elements, color=quiet, scale_factor=1.02), run_time=fit(0.6, "zerocopy.dma")
    )

    # The NIC writes the packet by DMA into the BUFFER: the magnified element's buffer, the same
    # one whose half lights in the pool. The arrow ends on the buffer: never the pool or the mbuf.
    scene.at("zerocopy.dma")
    scene.caption("The NIC writes the bytes into the buffer, by DMA.")
    dma = _transfer(nic, buffer, packet_hue, "DMA", scene)
    landed = VGroup(_bytes_in(buffer[0], packet_hue), _bytes_in(chosen[1][0], packet_hue, count=4))
    landed.name = "e02:landed"
    # In the pool, the bytes take the place of the half's name; the legend still names it.
    named = [chosen[1][1].animate.set_opacity(0.0)] if len(chosen[1]) > 1 else []
    _show(scene, dma, beam, fit(beam.duration, "zerocopy.no_cpu"), FadeIn(landed), *named)
    payload = landed[0]

    scene.at("zerocopy.no_cpu")
    scene.caption("No CPU. No allocation. No copy.")

    # Every stage works on the same buffer. The stages are this film's illustration, not assets.
    scene.at("zerocopy.same_buffer")
    scene.caption("Every stage works on the same buffer.")
    # The handle is the mbuf's address, so it is the pointer's yellow: the mbuf itself stays put.
    handle = pill("mbuf", fmt, pointer_hue, theme.role("pointer").surface, rung="row")
    nodes = _stage_nodes(scene, layout.boxes["stages"], handle.width)
    handle.scale_to_fit_height(nodes[0].height * 0.85)
    handle.name = "e02:handle"
    scene.play(FadeOut(dma), FadeIn(nodes), run_time=fit(0.5, STAGE_BEATS[0]))

    # Only the handle moves: the mbuf's handle visits each stage in turn. The mbuf's reference to
    # the buffer pulses as it lands — the handle names the same buffer every time; the bytes stay.
    for index, beat in enumerate(STAGE_BEATS):
        scene.at(beat)
        nxt = STAGE_BEATS[index + 1] if index + 1 < len(STAGE_BEATS) else "zerocopy.handle"
        spot = nodes[index].get_right() + RIGHT * (handle.width / 2 + 0.08)
        pulse = Indicate(tether, color=pointer_hue, scale_factor=1.04)
        if index == 0:
            handle.move_to(spot)
            scene.play(
                FadeIn(handle),
                Indicate(nodes[index], color=ink, scale_factor=1.06),
                pulse,
                run_time=fit(snap.duration * 2, nxt),
            )
        else:
            # The snap is the handle's alone: a play-wide rate_func would stop each Indicate
            # half-way, leaving the visited stages marked — which would read as a state.
            scene.play(
                handle.animate(rate_func=rate_func(snap)).move_to(spot),
                Indicate(nodes[index], color=ink, scale_factor=1.06),
                pulse,
                run_time=fit(snap.duration * 2, nxt),
            )

    scene.at("zerocopy.handle")
    scene.caption("Each stage gets a handle: an address, not the bytes.")
    scene.play(
        Indicate(handle, color=pointer_hue, scale_factor=1.08),
        Indicate(tether, color=pointer_hue, scale_factor=1.03),
        run_time=fit(0.6, "zerocopy.never_moves"),
    )

    scene.at("zerocopy.never_moves")
    scene.caption("The buffer never moves.")
    scene.play(
        Indicate(buffer[0], color=memory_hue, scale_factor=1.02),
        run_time=fit(0.6, "zerocopy.in_place"),
    )

    # A header byte changes where it is: an edit inside the buffer, not a copy, not red.
    scene.at("zerocopy.in_place")
    scene.caption("A header is edited in place.")
    scene.play(
        Indicate(payload[0], color=ink, scale_factor=1.3), run_time=fit(0.8, "zerocopy.key_idea")
    )

    scene.at("zerocopy.key_idea")
    scene.caption("The packet isn't travelling. Only the pointer is.")

    scene.at("zerocopy.only_pointer")
    scene.play(
        Indicate(handle, color=pointer_hue, scale_factor=1.08),
        Indicate(tether, color=pointer_hue, scale_factor=1.03),
        run_time=fit(0.6, "zerocopy.cheap"),
    )

    scene.at("zerocopy.cheap")
    scene.caption("A pointer: 8 bytes. The payload: hundreds to thousands.")
    scene.play(
        Indicate(tether, color=pointer_hue, scale_factor=1.03),
        Indicate(payload, color=packet_hue, scale_factor=1.04),
        run_time=fit(0.6, "zerocopy.scale"),
    )

    scene.at("zerocopy.scale")
    scene.caption("Millions of packets a second.")

    scene.at("zerocopy.benefits")
    scene.caption("No copies: less CPU, bandwidth and cache.")

    # Transmit: the NIC reads the same buffer — a DMA read, not a copy.
    scene.at("zerocopy.transmit")
    scene.caption("The NIC transmits from the same buffer.")
    out = _transfer(buffer, nic, packet_hue, "DMA read", scene)
    _show(scene, out, beam, fit(beam.duration, "zerocopy.reuse"))

    # "returned to the mempool": narration only — the emphasis simply clears; no state is drawn.
    scene.at("zerocopy.reuse")
    scene.play(FadeOut(out), FadeOut(illustrative), run_time=fit(0.5, "zerocopy.once"))

    scene.at("zerocopy.once")
    scene.caption("Written once. Never copied.")

    scene.at("zerocopy.handle_passed")
    scene.play(
        Indicate(handle, color=pointer_hue, scale_factor=1.08), run_time=fit(0.6, "zerocopy.payoff")
    )

    # The payoff frame: still bytes in one buffer, the stages, one yellow handle, no red.
    scene.at("zerocopy.payoff")
    scene.caption("A packet is a pointer to its bytes.")
    scene.wait(0.8)


# ---------------------------------------------------------------------------
# The scenes. One class per format, GENERATED for every format the Studio ships —
# not only the two this episode declares. That is what makes "a new aspect ratio
# costs no episode change" true rather than aspirational: `abs render --target 1x1`
# works, and nothing in this file mentions 1:1.
# ---------------------------------------------------------------------------

SCENES = build_episode_scenes(
    globals(),
    EPISODE_ROOT,
    acts=(stage_traditional, stage_zerocopy),
    build=build_scene,
    turn_cue=TURN,
)
