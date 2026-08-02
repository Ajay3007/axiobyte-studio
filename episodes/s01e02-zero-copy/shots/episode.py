"""s01e02 — the shots.

One description, every format. There are no coordinates, no colours, no aspect
ratios and no durations in this file: the target profile chooses the axis, the theme
chooses the hues, the motion language chooses the curves, and the voiceover chooses
the timing.

Rendered through `abs render`, which runs the plan cascade first and refuses on any
error. There is no way to reach a frame here that skipped validation.
"""

from __future__ import annotations

from pathlib import Path

from manim import LEFT, UP, FadeIn, FadeOut, GrowArrow, Indicate

from axiobyte_studio.actions import DMA_WRITE, FORWARD, REFERENCE, Invariant, Scene
from axiobyte_studio.actors import MBUF, MEMPOOL, NIC, PACKET, POINTER, Salience
from axiobyte_studio.backends.manim import StudioScene, rate_func
from axiobyte_studio.backends.manim.components import link, pill, tag, title_card
from axiobyte_studio.layout import Chain, Pair, Stack
from axiobyte_studio.motion import motion
from axiobyte_studio.storyboard import Episode
from axiobyte_studio.timeline import CueTable

EPISODE_ROOT = Path(__file__).resolve().parents[1]

SHOT = Stack(
    id="s01e02.zerocopy",
    children=(
        Chain(id="machine", items=("nic", "mempool", "mbuf"), weight=3.0),
        Pair(id="evidence", a="packet", b="pointer", weight=2.0),
    ),
)


def build_scene() -> Scene:
    """Cast the act, and state as an invariant the thing it exists to teach."""
    scene = Scene(id=SHOT.id, focus="zero_copy")
    scene.cast(NIC, "1", label="SmartNIC", rx_queues=6)
    scene.cast(MEMPOOL, "1", slots=8)
    scene.cast(MBUF, "1", buf_addr="0x7f3a4c00", refcount=1)
    scene.cast(PACKET, "1", address="0x7f3a4c00", bytes=1500)
    # zero_copy is an interaction between pointer and memory_buffer, so those two
    # hold primary attention — the relationship is only visible when both are.
    scene.cast(POINTER, "1", salience=Salience.PRIMARY)
    scene.require(
        Invariant(
            id="OP-1",
            statement="packet bytes are written once and never moved again",
            actor="packet#1",
            unchanged=("address",),
            forbids=("copy",),
        )
    )
    scene.apply(DMA_WRITE, "packet#1", at=68.4, into="mempool#1")
    scene.apply(REFERENCE, "packet#1", at=96.2, by="mbuf#1")
    scene.apply(FORWARD, "packet#1", at=104.0, to="parser")
    return scene


class _Zerocopy(StudioScene):
    """The act, staged once. Subclasses differ only by which target they name."""

    def construct(self) -> None:
        episode = Episode.load(EPISODE_ROOT)
        assert episode.beatmap is not None and episode.timeline is not None
        self.cues = CueTable.resolve(episode.beatmap.cues, episode.timeline)

        model = build_scene()
        drawn = self.stage(model, self.solve_shot(SHOT))
        pointer_hue = self.theme.role("pointer").hue
        mbuf_hue = self.theme.role("mbuf").hue

        self.at("zerocopy.instead")
        card = title_card(
            "A DIFFERENT WAY", self.target, self.theme, mbuf_hue, "stop moving the bytes"
        )
        self.play(FadeIn(card), run_time=0.4)
        self.play(FadeOut(card), run_time=0.4)
        self.keyword("ZERO COPY", role="mbuf", run_time=0.4)

        for slot in ("nic", "mempool", "mbuf"):
            self.add(drawn[slot])
        # The payload arrives with DMA's curve, stretched to land exactly on the
        # word "reference". Guessing a duration that happens to fit this cut is
        # what makes a film fragile the moment the voiceover is re-recorded.
        arrival = motion("dma.smooth_beam").stretched(self.until("zerocopy.reference"))
        self.play(
            FadeIn(drawn["packet"], scale=1.05),
            run_time=arrival.duration,
            rate_func=rate_func(arrival),
        )

        self.at("zerocopy.reference")
        snap = motion("pointer.snap")
        self.add(drawn["pointer"])
        note = tag("a reference", self.target, pointer_hue).next_to(drawn["pointer"], UP, buff=0.2)
        self.play(
            FadeIn(drawn["pointer"], shift=LEFT * 0.2),
            FadeIn(note),
            run_time=snap.duration,
            rate_func=rate_func(snap),
        )
        stamp = pill("ZERO COPY", self.target, mbuf_hue, self.theme.role("mbuf").surface)
        stamp.move_to(drawn["mbuf"].get_center()).set_z_index(9)
        self.play(FadeIn(stamp, scale=1.15), run_time=self.until("zerocopy.mbuf"))

        self.at("zerocopy.mbuf")
        self.play(FadeOut(stamp, shift=UP * 0.2), run_time=0.4)
        tether = link(drawn["mbuf"], drawn["packet"], pointer_hue)
        self.play(GrowArrow(tether), run_time=snap.duration, rate_func=rate_func(snap))
        self.caption("The mbuf holds the address. The bytes never move.")
        self.play(Indicate(tether, color=pointer_hue, scale_factor=1.04), run_time=0.4)
        self.wait(0.8)


class Episode16x9(_Zerocopy):
    """The YouTube cut."""

    target_id = "16x9"


class Episode9x16(_Zerocopy):
    """The Reels cut. Same act, same cues, same invariant."""

    target_id = "9x16"
    platform = "reels"
