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

from manim import DOWN, LEFT, RIGHT, UP, FadeIn, FadeOut, GrowArrow, Indicate

from axiobyte_studio.actions import COPY, DMA_WRITE, FORWARD, REFERENCE, Invariant, Scene
from axiobyte_studio.actors import MBUF, MEMORY_BUFFER, MEMPOOL, NIC, PACKET, POINTER, Salience
from axiobyte_studio.backends.manim import StudioScene, draw, rate_func
from axiobyte_studio.backends.manim.components import cross, link, pill, tag, title_card
from axiobyte_studio.layout import Chain, Pair, Stack
from axiobyte_studio.motion import motion
from axiobyte_studio.storyboard import Episode
from axiobyte_studio.timeline import CueTable

EPISODE_ROOT = Path(__file__).resolve().parents[1]

#: The moment the argument turns. Before it, the episode is building the picture it
#: is about to destroy, so the invariant is scoped to begin here.
TURN = "zerocopy.instead"

TRADITIONAL = Stack(
    id="s01e02.traditional",
    children=(Chain(id="copy_path", items=("nic", "buffer_a", "buffer_b")),),
)

ZEROCOPY = Stack(
    id="s01e02.zerocopy",
    children=(
        Chain(id="machine", items=("nic", "mempool", "mbuf"), weight=3.0),
        Pair(id="evidence", a="packet", b="pointer", weight=2.0),
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

    scene.apply(DMA_WRITE, "packet#1", at=20.0, into="kernel_buffer")
    # Act one copies, on purpose. The invariant does not begin until the turn.
    scene.apply(COPY, "packet#1", at=25.4, into="buffer_b", address="0x7f3a5400")
    scene.apply(COPY, "packet#1", at=26.3, into="app", address="0x7f3a5800")

    scene.apply(REFERENCE, "packet#1", at=96.2, by="mbuf#1")
    scene.apply(FORWARD, "packet#1", at=104.0, to="parser")
    scene.verify()
    return scene


# ---------------------------------------------------------------------------
# ACT 1 — the copy tax. The picture built first, so it can be destroyed.
# ---------------------------------------------------------------------------


def stage_traditional(scene: StudioScene) -> None:
    """The traditional path: the same bytes, copied at every boundary.

    Red is reserved for bytes actually moving, which is why its absence in act two
    is the argument. This act is where the audience learns what red means.

    Args:
        scene: The scene being staged.
    """
    copy_hue = scene.theme.role("copy").hue
    layout = scene.solve_shot(TRADITIONAL)

    scene.at("traditional.networking")
    scene.keyword("THE COPY TAX", role="copy", run_time=0.4)

    stages = {
        "nic": draw(NIC.spawn("t", label="NIC"), layout.boxes["nic"], scene.target, scene.theme),
        "buffer_a": draw(
            MEMORY_BUFFER.spawn("a"), layout.boxes["buffer_a"], scene.target, scene.theme
        ),
        "buffer_b": draw(
            MEMORY_BUFFER.spawn("b"), layout.boxes["buffer_b"], scene.target, scene.theme
        ),
    }
    for mobject in stages.values():
        scene.add(mobject)

    scene.at("traditional.copied")
    copying = motion("copy.duplicate_translate")
    for source, destination in (("nic", "buffer_a"), ("buffer_a", "buffer_b")):
        arrow = link(stages[source], stages[destination], copy_hue)
        label = tag("copy", scene.target, copy_hue).next_to(arrow, UP, buff=0.14)
        scene.play(
            GrowArrow(arrow),
            FadeIn(label),
            run_time=copying.duration * 0.4,
            rate_func=rate_func(copying),
        )
    scene.wait(0.3)
    # Never sweep scene.mobjects: the chrome rides the camera through an updater
    # that closes over the scene, and Manim follows that reference when it caches.
    scene.clear_stage(run_time=0.4)


# ---------------------------------------------------------------------------
# ACT 2 — the turn. The copies stop, and the stillness reads as the point.
# ---------------------------------------------------------------------------


def stage_zerocopy(scene: StudioScene, model: Scene) -> None:
    """The bytes stop moving. A pointer does all the travelling.

    Args:
        scene: The scene being staged.
        model: The semantic scene, passed rather than stored — Manim
            pickles a scene's attributes for its render cache, so the
            renderer must not accumulate arbitrary state.
    """
    drawn = scene.stage(model, scene.solve_shot(ZEROCOPY))
    pointer_hue = scene.theme.role("pointer").hue
    mbuf_hue = scene.theme.role("mbuf").hue
    copy_hue = scene.theme.role("copy").hue

    scene.at(TURN)
    card = title_card(
        "A DIFFERENT WAY", scene.target, scene.theme, mbuf_hue, "stop moving the bytes"
    )
    scene.play(FadeIn(card), run_time=0.4)
    scene.play(FadeOut(card), run_time=0.4)
    scene.keyword("ZERO COPY", role="mbuf", run_time=0.4)

    for slot in ("nic", "mempool", "mbuf"):
        scene.add(drawn[slot])

    # The staged ABSENCE of the copy action — its own declared `negation`.
    struck = cross(drawn["mempool"].get_center() + DOWN * 0.1, copy_hue, size=0.8)
    no_copy = tag("no copy", scene.target, copy_hue).next_to(struck, RIGHT, buff=0.2)
    scene.play(FadeIn(struck), FadeIn(no_copy), run_time=0.3)

    arrival = motion("dma.smooth_beam").stretched(scene.until("zerocopy.reference"))
    scene.play(
        FadeOut(struck),
        FadeOut(no_copy),
        FadeIn(drawn["packet"], scale=1.05),
        run_time=arrival.duration,
        rate_func=rate_func(arrival),
    )

    scene.at("zerocopy.reference")
    snap = motion("pointer.snap")
    scene.add(drawn["pointer"])
    note = tag("a reference", scene.target, pointer_hue).next_to(drawn["pointer"], UP, buff=0.2)
    scene.play(
        FadeIn(drawn["pointer"], shift=LEFT * 0.2),
        FadeIn(note),
        run_time=snap.duration,
        rate_func=rate_func(snap),
    )
    stamp = pill("ZERO COPY", scene.target, mbuf_hue, scene.theme.role("mbuf").surface)
    stamp.move_to(drawn["mbuf"].get_center()).set_z_index(9)
    scene.play(FadeIn(stamp, scale=1.15), run_time=scene.until("zerocopy.mbuf"))

    scene.at("zerocopy.mbuf")
    scene.play(FadeOut(stamp, shift=UP * 0.2), run_time=0.4)
    tether = link(drawn["mbuf"], drawn["packet"], pointer_hue)
    scene.play(GrowArrow(tether), run_time=snap.duration, rate_func=rate_func(snap))
    scene.caption("The mbuf holds the address. The bytes never move.")
    scene.play(Indicate(tether, color=pointer_hue, scale_factor=1.04), run_time=0.4)
    scene.wait(0.8)


class _Ep02(StudioScene):
    """Both acts, in order. Subclasses differ only by which target they name."""

    def construct(self) -> None:
        episode = Episode.load(EPISODE_ROOT)
        assert episode.beatmap is not None and episode.timeline is not None
        self.cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)

        model = build_scene(turn=self.cues[TURN])
        stage_traditional(self)
        stage_zerocopy(self, model)


class Episode16x9(_Ep02):
    """The YouTube cut."""

    target_id = "16x9"


class Episode9x16(_Ep02):
    """The Reels cut. Same acts, same cues, same invariant."""

    target_id = "9x16"
    platform = "reels"
