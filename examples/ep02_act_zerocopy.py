"""Episode 02, the act where the copying stops — driven by the real voiceover.

    manim -qh --fps 60 examples/ep02_act_zerocopy.py ActZeroCopyWide
    manim -qh --fps 60 examples/ep02_act_zerocopy.py ActZeroCopyTall

Every cue below is a word start looked up in the reference episode's own
``timeline.json``, and the whole table resolves at import. That is THE ONE RULE:
if the voiceover is re-cut and a word disappears, this file fails immediately
rather than drifting a minute of film silently out of sync.

The cue names and words are taken verbatim from ``ep02_video_16x9.py``'s cue
table, so the timings here are the timings that shipped. What has changed is
everything around them: one act description now serves both formats, the toolkit
is engine code rather than 800 lines copied per episode, and the packet's
stillness is an invariant the build checks rather than a discipline the author
has to remember.
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
from axiobyte_studio.timeline import CueTable, Timeline

# ---------------------------------------------------------------------------
# THE VOICEOVER — the reference episode's own transcript, as the episode carries
# it. Resolved from the repo rather than one machine's filesystem: this file is
# in the README as something to run, and a README command that only works on the
# author's laptop is not an example of anything.
# ---------------------------------------------------------------------------

REPO = Path(__file__).resolve().parent.parent
VOICEOVER = REPO / "episodes" / "s01e02-zero-copy" / "timeline" / "words.json"

# ---------------------------------------------------------------------------
# THE CUE TABLE — read it top to bottom and you have read the act.
# Words and sentence indices are verbatim from ep02_video_16x9.py.
# ---------------------------------------------------------------------------

CUES = {
    "zc.title.high": "High@9",  # 42.42  the turn is announced
    "zc.title.different": "different@9",  # 44.89
    "zc.instead": "Instead@10",  # 46.27  the copies stop
    "zc.reference": "reference@10",  # 48.71  a pointer, not a copy
    "zc.stamp.zero": "zero@11",  # 50.85  ZERO COPY stamps on
    "zc.stamp.copy": "copy@11",  # 51.17
    "zc.question": "passed@12",  # 53.26  but what is passed?
    "zc.mbuf": "mBuff@13",  # 55.18  the answer
    "zc.metadata": "metadata@14",  # 57.82  what it holds
    "zc.attached": "attached@14",  # 58.74  tethered to the bytes
}

# ---------------------------------------------------------------------------
# THE SHOT — no format, no palette, no timing.
# ---------------------------------------------------------------------------

SHOT = Stack(
    id="s01e02.act_zerocopy",
    children=(
        Chain(id="machine", items=("nic", "mempool", "mbuf"), weight=3.0),
        Pair(id="evidence", a="packet", b="pointer", weight=2.0),
    ),
)


def build_scene() -> Scene:
    """Cast the act, and state as an invariant the thing it exists to teach."""
    scene = Scene(id=SHOT.id)
    scene.cast(NIC, "1", label="SmartNIC", rx_queues=6)
    scene.cast(MEMPOOL, "1", slots=8)
    scene.cast(MBUF, "1", buf_addr="0x7f3a4c00", refcount=1)
    scene.cast(PACKET, "1", salience=Salience.PRIMARY, address="0x7f3a4c00", bytes=1500)
    scene.cast(POINTER, "1")
    scene.require(
        Invariant(
            id="ZC-1",
            statement="packet bytes are written once and never moved again",
            actor="packet#1",
            unchanged=("address",),
            forbids=("copy",),
        )
    )
    scene.apply(DMA_WRITE, "packet#1", at=68.4, into="mempool#1")
    scene.apply(REFERENCE, "packet#1", at=96.2, by="mbuf#1")
    scene.apply(FORWARD, "packet#1", at=104.0, to="parser")
    scene.verify()
    return scene


class _ActZeroCopy(StudioScene):
    """The act, staged once. Subclasses differ only by which target they name."""

    def construct(self) -> None:
        timeline = Timeline.load(VOICEOVER)
        self.cues = CueTable.resolve(CUES, timeline)

        model = build_scene()
        layout = self.solve_shot(SHOT)
        drawn = self.stage(model, layout)
        pointer_hue = self.theme.role("pointer").hue
        mbuf_hue = self.theme.role("mbuf").hue

        # 42.42 — "a HIGH performance system does it DIFFERENTLY"
        self.at("zc.title.high")
        card = title_card(
            "A DIFFERENT WAY", self.target, self.theme, mbuf_hue, "stop moving the bytes"
        )
        self.play(FadeIn(card), run_time=0.5)
        self.at("zc.title.different")
        self.play(FadeOut(card), run_time=0.5)

        self.keyword("ZERO COPY", role="mbuf")

        # 46.27 — "INSTEAD of copying": the machine, and the bytes, at rest.
        self.at("zc.instead")
        for slot in ("nic", "mempool", "mbuf"):
            self.add(drawn[slot])
        arrival = motion("dma.smooth_beam")
        self.play(
            FadeIn(drawn["packet"], scale=1.05),
            run_time=arrival.duration,
            rate_func=rate_func(arrival),
        )

        # 48.71 — "...it passes a REFERENCE." The first pointer of the film.
        self.at("zc.reference")
        snap = motion("pointer.snap")
        self.add(drawn["pointer"])
        note = tag("a reference", self.target, pointer_hue)
        note.next_to(drawn["pointer"], UP, buff=0.2)
        self.play(
            FadeIn(drawn["pointer"], shift=LEFT * 0.2),
            FadeIn(note),
            run_time=snap.duration,
            rate_func=rate_func(snap),
        )

        # 50.85 — "This technique is called ZERO COPY."
        self.at("zc.stamp.zero")
        stamp = pill("ZERO COPY", self.target, mbuf_hue, self.theme.role("mbuf").surface)
        stamp.move_to(drawn["mbuf"].get_center())
        stamp.set_z_index(9)
        # "zero" and "copy" are 0.32 s apart. Ask the narration how long there is
        # rather than guessing a number that happens to fit this cut.
        self.play(FadeIn(stamp, scale=1.15), run_time=self.until("zc.stamp.copy"))
        self.at("zc.stamp.copy")
        self.play(
            Indicate(stamp, color=mbuf_hue, scale_factor=1.06),
            run_time=self.until("zc.question"),
        )

        # 53.26 — "But what exactly is being PASSED?"
        self.at("zc.question")
        self.play(FadeOut(stamp, shift=UP * 0.2), run_time=0.4)
        self.at("zc.mbuf")

        # 55.18 — "The answer is an mBuff." The pointer resolves to its carrier.
        tether = link(drawn["mbuf"], drawn["packet"], pointer_hue)
        self.play(GrowArrow(tether), run_time=snap.duration, rate_func=rate_func(snap))

        # 57.82 / 58.74 — "metadata ATTACHED to the packet."
        self.at("zc.metadata")
        self.caption("The mbuf holds the address. The bytes never move.")
        self.at("zc.attached")
        self.play(Indicate(tether, color=pointer_hue, scale_factor=1.04), run_time=0.4)
        self.wait(0.8)


class ActZeroCopyWide(_ActZeroCopy):
    """The YouTube cut."""

    target_id = "16x9"


class ActZeroCopyTall(_ActZeroCopy):
    """The Reels cut. Same act, same cues, same invariant."""

    target_id = "9x16"
    platform = "reels"
