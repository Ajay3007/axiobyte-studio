"""Typography — the type ladder, resolved per target.

Sizes are absolute design pixels and shared across formats; only the wrap width
differs. See ``design/tokens/type.yaml`` for why.
"""

from __future__ import annotations

from axiobyte_studio.typography.style import TextStyle, TypeLadder, ladder, style

__all__ = ["TextStyle", "TypeLadder", "ladder", "style"]
