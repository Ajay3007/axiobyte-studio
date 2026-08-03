"""s01e01 — the shots.

Written to test the Studio's central claim: that episode N+1 is cheaper than
episode N. This episode reuses `interrupt_driven`, `copy_based` and `polling`
authored for s01e02, adds one concept (`context_switch`), and reuses every actor,
every motion signature, the whole component library and both 3D tiers.

Its argument is the split frame the reference episode uses: where the packet is on
the left, what the core is doing on the right. The core's column is the point.
"""

from __future__ import annotations

from pathlib import Path

from manim import DOWN, UP, FadeIn, FadeOut, GrowArrow, Indicate

from axiobyte_studio.actions import COPY, DMA_WRITE, Invariant, Scene
from axiobyte_studio.actors import CPU, MEMORY_BUFFER, NIC, PACKET, THREAD, Salience
from axiobyte_studio.backends.manim import StudioScene, build_episode_scenes, draw, rate_func
from axiobyte_studio.backends.manim.components import cost_meter, link, pill, tag, title_card
from axiobyte_studio.layout import Chain, Pair, Stack
from axiobyte_studio.motion import motion

EPISODE_ROOT = Path(__file__).resolve().parents[1]
TURN = "kernel.arrives"

#: The split frame the whole film keeps: the machine above, the core's cost below.
MACHINE = Stack(
    id="s01e01.machine",
    children=(
        Chain(id="path", items=("nic", "kernel_buffer", "app_buffer"), weight=3.0),
        Pair(id="cost", a="core", b="meter", weight=2.0),
    ),
)


def build_scene(turn: float) -> Scene:
    """The kernel path: bytes copied at every boundary, on purpose.

    This episode is the counter-picture the rest of the pillar destroys, so its
    invariant forbids the thing s01e02 *introduces* — a reference. Nothing here is
    zero-copy; that is the lesson.
    """
    scene = Scene(id="s01e01", focus="context_switch")
    scene.cast(NIC, "1", label="NIC", rx_queues=4)
    scene.cast(MEMORY_BUFFER, "kernel", address="0x7f1000")
    scene.cast(MEMORY_BUFFER, "app", address="0x7f2000")
    scene.cast(PACKET, "1", address="0x7f1000", bytes=1500)
    scene.cast(THREAD, "app", salience=Salience.PRIMARY, label="your app")
    scene.cast(CPU, "1", salience=Salience.PRIMARY, cores=1)
    scene.require(
        Invariant(
            id="OP-1",
            statement="the kernel path copies; it never passes a reference",
            actor="packet#1",
            forbids=("reference",),
            after=turn,
        )
    )
    scene.apply(DMA_WRITE, "packet#1", at=20.0, into="kernel_buffer")
    scene.apply(COPY, "packet#1", at=64.0, into="app_buffer", address="0x7f2000")
    scene.verify()
    return scene


def stage_kernel(scene: StudioScene) -> None:
    """The packet arrives, and the core's work is torn in half."""
    layout = scene.solve_shot(MACHINE)
    cpu_hue = scene.theme.role("cpu").hue

    scene.at("kernel.arrives")
    scene.keyword("THE KERNEL PATH", role="cpu", run_time=0.4)
    # Tier-1 3D, reused straight from s01e02's work: a NIC that reads as hardware.
    board = draw(
        NIC.spawn("1", label="NIC"), layout.boxes["nic"], scene.target, scene.theme, fidelity="iso"
    )
    core = draw(
        CPU.spawn("1", cores=1), layout.boxes["core"], scene.target, scene.theme, fidelity="iso"
    )
    scene.add(board, core)

    scene.at("kernel.interrupt")
    flash = motion("interrupt.flash")
    stamp = pill("IRQ", scene.target, cpu_hue, scene.theme.role("cpu").surface)
    stamp.move_to(core.get_center()).set_z_index(9)
    scene.play(FadeIn(stamp, scale=1.2), run_time=flash.duration, rate_func=rate_func(flash))
    scene.play(Indicate(core, color=cpu_hue, scale_factor=1.04), run_time=0.3)
    scene.play(FadeOut(stamp), run_time=0.3)


def stage_copies(scene: StudioScene) -> None:
    """The same bytes, written again. Red means bytes actually moved."""
    layout = scene.solve_shot(MACHINE)
    copy_hue = scene.theme.role("copy").hue

    scene.at("copies.copies")
    scene.keyword("THE COPY TAX", role="copy", run_time=0.4)
    kernel = draw(
        MEMORY_BUFFER.spawn("kernel"), layout.boxes["kernel_buffer"], scene.target, scene.theme
    )
    app = draw(MEMORY_BUFFER.spawn("app"), layout.boxes["app_buffer"], scene.target, scene.theme)
    scene.add(kernel, app)

    copying = motion("copy.duplicate_translate")
    arrow = link(kernel, app, copy_hue)
    label = tag("copy", scene.target, copy_hue).next_to(arrow, UP, buff=0.12)
    scene.play(
        GrowArrow(arrow),
        FadeIn(label),
        run_time=scene.until("copies.cycles"),
        rate_func=rate_func(copying),
    )

    scene.at("copies.cycles")
    # The cost meter is derived from the ACTION's own cost model, so the number on
    # screen cannot contradict what another episode says about the same action.
    meter = cost_meter(COPY, layout.boxes["meter"], scene.target, scene.theme)
    scene.play(FadeIn(meter, shift=DOWN * 0.1), run_time=0.4)


def stage_switch(scene: StudioScene) -> None:
    """The application must be woken, and it wakes with a cold cache."""
    layout = scene.solve_shot(MACHINE)
    cpu_hue = scene.theme.role("cpu").hue

    scene.at("switch.wake")
    scene.keyword("THE SWITCH", role="cpu", run_time=0.4)
    card = title_card(
        "CONTEXT SWITCH",
        scene.target,
        scene.theme,
        cpu_hue,
        "saved state, a scheduler, and a cold cache",
    )
    scene.play(FadeIn(card), run_time=0.4)
    scene.play(FadeOut(card), run_time=0.4)

    thread = draw(
        THREAD.spawn("app", label="your app"), layout.boxes["core"], scene.target, scene.theme
    )
    scene.add(thread)
    stutter = motion("lock.stutter")
    scene.at("switch.caches")
    scene.play(
        Indicate(thread, color=cpu_hue, scale_factor=1.03),
        run_time=stutter.duration * 0.4,
        rate_func=rate_func(stutter),
    )
    scene.caption("Interrupts, copies, context switches. Together, the bottleneck.")
    scene.wait(0.6)


SCENES = build_episode_scenes(
    globals(),
    EPISODE_ROOT,
    acts=(stage_kernel, stage_copies, stage_switch),
    build=build_scene,
    turn_cue=TURN,
)
