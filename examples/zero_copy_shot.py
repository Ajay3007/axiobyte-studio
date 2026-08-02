"""A worked shot, rendered end to end from the semantic layer.

Run it:

    manim -s -ql --format=png examples/zero_copy_shot.py ZeroCopyWide
    manim -s -ql --format=png examples/zero_copy_shot.py ZeroCopyTall
    manim -qh --fps 60          examples/zero_copy_shot.py ZeroCopyWide

Read the two scene classes at the bottom and notice what is *not* in them: no
coordinates, no colours, no aspect ratio, no durations. One shot description
serves both formats; the target profile decides the axis, the theme decides the
hues, and the motion language decides how long a pointer takes to snap.

The `verify()` call is the point of the whole exercise. The shot declares that the
packet's bytes never move, and the build refuses to render a staging that
contradicts it.
"""

from __future__ import annotations

from axiobyte_studio.actions import (
    DMA_WRITE,
    FORWARD,
    INSPECT,
    REFERENCE,
    TRANSMIT,
    Invariant,
    Scene,
)
from axiobyte_studio.actors import MBUF, MEMPOOL, NIC, PACKET, POINTER, Salience
from axiobyte_studio.backends.manim import StudioScene, rate_func
from axiobyte_studio.layout import Chain, Pair, Stack
from axiobyte_studio.motion import motion

# ---------------------------------------------------------------------------
# THE SEMANTIC SHOT — no format, no palette, no timing.
# ---------------------------------------------------------------------------

SHOT = Stack(
    id="s01e02.shot_0120_pointer_not_copy",
    children=(
        Chain(id="pipeline", items=("nic", "mempool", "mbuf"), weight=3.0),
        Pair(id="verdict", a="packet", b="pointer", weight=2.0),
    ),
)


def build_scene() -> Scene:
    """Cast the shot and state, as an invariant, the thing it teaches."""
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
    scene.apply(INSPECT, "packet#1", at=118.0, by="firewall")
    scene.apply(TRANSMIT, "packet#1", at=184.0, via="nic#1")

    # If this raises, the shot contradicts what the episode claims to teach and
    # nothing renders. That is the whole design, in one line.
    scene.verify()
    return scene


# ---------------------------------------------------------------------------
# THE RENDER — identical for every format.
# ---------------------------------------------------------------------------


class _ZeroCopy(StudioScene):
    """Shared staging. Subclasses differ only by which target they name."""

    def construct(self) -> None:
        model = build_scene()
        layout = self.solve_shot(SHOT)
        drawn = self.stage(model, layout)

        self.keyword("ZERO COPY", role="mbuf")
        self.caption("A packet is not bytes. It is a pointer to bytes.")

        for slot in ("nic", "mempool", "mbuf"):
            if slot in drawn:
                self.add(drawn[slot])

        # The payload arrives once, with DMA's own signature: unhurried, no CPU.
        arrival = motion("dma.smooth_beam")
        if "packet" in drawn:
            self.play(
                drawn["packet"].animate.set_opacity(1.0),
                run_time=arrival.duration,
                rate_func=rate_func(arrival),
            )
            self.add(drawn["packet"])

        # ...and the pointer does all the travelling, weightlessly.
        snap = motion("pointer.snap")
        if "pointer" in drawn:
            self.add(drawn["pointer"])
            self.play(
                drawn["pointer"].animate.set_opacity(1.0),
                run_time=snap.duration,
                rate_func=rate_func(snap),
            )
        self.wait(0.6)


class ZeroCopyWide(_ZeroCopy):
    """The YouTube cut."""

    target_id = "16x9"


class ZeroCopyTall(_ZeroCopy):
    """The Reels cut. Same shot, same actors, same invariant."""

    target_id = "9x16"
    platform = "reels"
