"""Replaying baked plates — Tier-2 3D, at zero cost to an episode.

A plate is an image sequence, so playing one costs what showing a picture costs.
The Blender render happened once, offline, possibly years ago; the episode does not
need Blender installed and does not pay per frame.

The point of the tier is that it **composites**. A plate is drawn on the canvas with
its own alpha, and the 2D layer — pointers, labels, byte cells — sits on top in the
ordinary z-bands. Hero hardware underneath, the argument on top.
"""

from __future__ import annotations

from typing import Any

from manim import ImageMobject, Mobject

from axiobyte_studio.backends.blender.bake import Plate
from axiobyte_studio.backends.manim.space import center_of, size_of
from axiobyte_studio.core.errors import StudioError
from axiobyte_studio.layout.frame import Box, Target

#: Plates sit at the `zone` band — above the canvas, below every diagram element.
#: Hardware is the stage, not the argument.
Z_PLATE = 1


def frame(plate: Plate, index: int, box: Box, target: Target) -> ImageMobject:
    """One frame of a plate, fitted to a box.

    Args:
        plate: The baked plate.
        index: Which frame. Wraps, so a turntable loops naturally.
        box: Where it sits, in normalised frame coordinates.
        target: The format being rendered.

    Returns:
        The image, scaled to fit inside its box and centred in it.

    Raises:
        StudioError: The plate has no frames.
    """
    if not plate.frames:
        raise StudioError(
            f"Plate {plate.id!r} has no frames",
            fix="Re-bake it with `abs asset bake`.",
        )
    image = ImageMobject(str(plate.frames[index % len(plate.frames)]))

    width, height = size_of(box, target)
    # Fit inside, never fill: a plate that overflows its box breaks the layout
    # solver's guarantee exactly as a drawn shape would.
    scale = min(width / image.width, height / image.height)
    image.scale(scale)
    image.move_to(center_of(box, target))
    image.set_z_index(Z_PLATE)
    return image


class PlateSequence:
    """A plate, played as a sequence of frames inside a scene.

    Attributes:
        plate: The baked plate.
        box: Where it sits.
        target: The format being rendered.
    """

    def __init__(self, plate: Plate, box: Box, target: Target) -> None:
        self.plate = plate
        self.box = box
        self.target = target
        self._current: Mobject | None = None

    def show(self, scene: Any, index: int = 0) -> Mobject:
        """Place one frame, replacing whatever was showing.

        Args:
            scene: The Manim scene.
            index: Which frame.

        Returns:
            The frame now on screen.
        """
        image = frame(self.plate, index, self.box, self.target)
        if self._current is not None:
            scene.remove(self._current)
        scene.add(image)
        self._current = image
        return image

    def play(self, scene: Any, run_time: float, *, loops: float = 1.0) -> None:
        """Step through the plate over a window of time.

        The duration comes from the beat, not from the bake: a turntable baked at
        16 frames fills whatever window the narration leaves it. That is the same
        principle as stretching a motion signature — the voiceover decides how long
        there is, and the plate fits.

        Args:
            scene: The Manim scene.
            run_time: Seconds to fill.
            loops: How many times around. A turntable reads well at one.

        Raises:
            StudioError: The window is not positive.
        """
        if run_time <= 0:
            raise StudioError(
                f"A plate cannot play in {run_time}s",
                fix="Check the two cues around this beat.",
            )
        steps = max(1, int(len(self.plate.frames) * loops))
        dwell = run_time / steps
        for step in range(steps):
            self.show(scene, step)
            scene.wait(dwell)
