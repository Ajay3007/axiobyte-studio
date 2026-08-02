"""The Design System — the single source of visual truth.

The registry says what a concept *means*; the theme says what that *looks like*.
Nothing outside ``themes/`` may contain a colour value.
"""

from __future__ import annotations

from axiobyte_studio.design.theme import (
    DEFAULT_THEME,
    ConceptVisual,
    Role,
    Theme,
    VisualLanguage,
    resolve,
    theme,
    visual_language,
)

__all__ = [
    "DEFAULT_THEME",
    "ConceptVisual",
    "Role",
    "Theme",
    "VisualLanguage",
    "resolve",
    "theme",
    "visual_language",
]
