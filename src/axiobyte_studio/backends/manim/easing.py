"""Motion curves — the Studio's named vocabulary mapped onto Manim's rate functions.

A curve name is semantic (``elastic_out`` means "a pointer snaps"), so the mapping
lives here rather than in an episode. Swapping the backend swaps this file and
nothing else.
"""

from __future__ import annotations

from collections.abc import Callable

from manim import rate_functions as rf

from axiobyte_studio.core.errors import DesignError
from axiobyte_studio.motion.signature import Motion

_CURVES: dict[str, Callable[[float], float]] = {
    "linear": rf.linear,
    "ease_in": rf.ease_in_sine,
    "ease_out": rf.ease_out_sine,
    "ease_in_out": rf.ease_in_out_sine,
    "ease_in_expo": rf.ease_in_expo,
    "elastic_out": rf.ease_out_elastic,
    "stutter": rf.double_smooth,
}


def rate_func(motion: Motion) -> Callable[[float], float]:
    """The Manim rate function for a motion signature.

    Args:
        motion: The resolved signature.

    Returns:
        A rate function.

    Raises:
        DesignError: The curve has no mapping in this backend.
    """
    try:
        return _CURVES[motion.curve]
    except KeyError:
        raise DesignError(
            f"The Manim backend has no curve for {motion.curve!r}",
            context={"motion": motion.name, "maps": ", ".join(sorted(_CURVES))},
            fix="Add it to backends/manim/easing.py, or use an existing curve.",
        ) from None


def curves() -> list[str]:
    """Every curve name this backend can render."""
    return sorted(_CURVES)
