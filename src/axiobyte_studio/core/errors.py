"""The one exception family.

Every failure in the Studio raises a :class:`StudioError`. The rule from
``CONVENTIONS.md`` §4 is that an error message must carry its own fix: it names the
offending symbol, where it came from, and the concrete next action. An error a
user has to debug is a bug in the error.
"""

from __future__ import annotations

from typing import Any


class StudioError(Exception):
    """Base for every Studio failure.

    Args:
        message: What went wrong, in one line.
        fix: The concrete next action. Rendered on its own line.
        context: Extra key/value detail rendered between the two.
    """

    def __init__(
        self,
        message: str,
        *,
        fix: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> None:
        self.message = message
        self.fix = fix
        self.context = context or {}
        super().__init__(self._render())

    def _render(self) -> str:
        lines = [self.message]
        lines.extend(f"  {key}: {value}" for key, value in self.context.items())
        if self.fix:
            lines.append(f"  Fix: {self.fix}")
        return "\n".join(lines)


class TimelineError(StudioError):
    """The voiceover timeline could not be loaded or interpreted."""


class CueNotFoundError(TimelineError):
    """A cue names a word the voiceover does not contain.

    This is the single most valuable error in the Studio. It is what stops a
    re-cut voiceover from silently drifting a whole episode out of sync — the
    behaviour inherited from the reference episodes' "ONE RULE".
    """


class DesignError(StudioError):
    """A theme, target profile, or token could not be resolved."""


class RoleNotFoundError(DesignError):
    """A visual role was requested that the active theme does not define."""


class ConceptError(StudioError):
    """A concept is missing, malformed, or violates the visual language."""
