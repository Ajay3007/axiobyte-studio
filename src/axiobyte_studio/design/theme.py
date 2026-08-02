"""Themes and the Visual Language Registry.

Two separable things, deliberately kept apart:

* The **registry** (``language.yaml``) says which concept owns which role, how it
  moves, and what it may never do. It is theme-independent and close to permanent.
* A **theme** (``themes/*.yaml``) supplies values for those roles. It is swappable.

Switching theme changes what a packet looks like. It can never change what a packet
means. That separation is the whole reason the visual language survives a restyle.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import yaml

from axiobyte_studio.core.errors import DesignError, RoleNotFoundError

_DESIGN_DIR = Path(__file__).parent
_THEMES_DIR = _DESIGN_DIR / "themes"
DEFAULT_THEME = "systems"


def _load_yaml(path: Path) -> dict[str, Any]:
    """Read a YAML mapping, failing with a message that names the file."""
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DesignError(
            f"Missing design file {path.name}",
            context={"expected at": str(path)},
            fix="Restore the file, or check the theme name you asked for.",
        ) from exc
    except yaml.YAMLError as exc:
        raise DesignError(
            f"{path.name} is not valid YAML",
            context={"parse error": str(exc)},
        ) from exc
    if not isinstance(data, dict):
        raise DesignError(f"{path.name} must contain a mapping at the top level")
    return data


@dataclass(frozen=True, slots=True)
class Role:
    """The resolved appearance of one idea.

    Attributes:
        name: The role name, as used by the visual language.
        hue: The role's colour.
        surface: A darker fill for panels belonging to this role, when the theme
            defines one.
        reserved: Whether this role may only be used for its exact meaning.
    """

    name: str
    hue: str
    surface: str | None = None
    reserved: bool = False


class Theme:
    """A resolved set of values for every role the visual language declares.

    Attributes:
        id: Theme identifier, matching its filename.
        version: Theme semver. A change that alters an existing actor's look is a
            major bump and requires golden-frame re-approval.
        ground: Canvas colours, which own no meaning.
        ink: Type colours, which own no meaning.
    """

    def __init__(self, raw: dict[str, Any], source: Path) -> None:
        self.id: str = str(raw.get("id", source.stem))
        self.version: str = str(raw.get("version", "0.0.0"))
        self.source = source
        self.ground: dict[str, str] = dict(raw.get("ground", {}))
        self.ink: dict[str, str] = dict(raw.get("ink", {}))
        reserved = set(raw.get("reserved", []))
        self._roles: dict[str, Role] = {
            name: Role(
                name=name,
                hue=str(spec["hue"]),
                surface=str(spec["surface"]) if "surface" in spec else None,
                reserved=name in reserved,
            )
            for name, spec in raw.get("roles", {}).items()
        }

    @classmethod
    def load(cls, name: str = DEFAULT_THEME) -> Theme:
        """Load a theme by name.

        Args:
            name: Theme id, matching a file in ``design/themes/``.

        Returns:
            The loaded theme.

        Raises:
            DesignError: No theme by that name exists.
        """
        path = _THEMES_DIR / f"{name}.yaml"
        if not path.exists():
            available = sorted(p.stem for p in _THEMES_DIR.glob("*.yaml"))
            raise DesignError(
                f"No theme named {name!r}",
                context={"available": ", ".join(available) or "none"},
                fix=f"Use one of the above, or add design/themes/{name}.yaml.",
            )
        return cls(_load_yaml(path), path)

    def role(self, name: str) -> Role:
        """Resolve one role.

        Args:
            name: The role name.

        Returns:
            The role's resolved values.

        Raises:
            RoleNotFoundError: This theme does not define that role.
        """
        try:
            return self._roles[name]
        except KeyError:
            raise RoleNotFoundError(
                f"Theme {self.id!r} does not define the role {name!r}",
                context={"defines": ", ".join(sorted(self._roles))},
                fix=(
                    f"Add {name!r} to {self.source.name}, or bind the concept to an "
                    "existing role in design/language.yaml."
                ),
            ) from None

    @property
    def roles(self) -> dict[str, Role]:
        """Every role this theme defines, by name."""
        return dict(self._roles)

    def __repr__(self) -> str:
        """Short, diagnostic representation."""
        return f"Theme({self.id!r} v{self.version}, {len(self._roles)} roles)"


@dataclass(frozen=True, slots=True)
class ConceptVisual:
    """How one concept is always drawn, independent of any theme.

    Attributes:
        name: The concept id.
        role: Which role owns its appearance.
        silhouette: The invariant shape family.
        motion: The motion signature it always moves with.
        states: Visual treatment per actor state.
        never: Lint-enforced prohibitions.
        fidelity: Which representations exist — flat, iso, plate.
    """

    name: str
    role: str
    silhouette: str
    motion: str | None = None
    states: dict[str, str] | None = None
    never: tuple[str, ...] = ()
    fidelity: tuple[str, ...] = ("flat",)


class VisualLanguage:
    """The registry of which concept owns which role, and what it may never do."""

    def __init__(self, raw: dict[str, Any], source: Path) -> None:
        self.version: str = str(raw.get("version", "0.0.0"))
        self.source = source
        self._concepts: dict[str, ConceptVisual] = {
            name: ConceptVisual(
                name=name,
                role=str(spec["role"]),
                silhouette=str(spec.get("silhouette", "inherit")),
                motion=None if spec.get("motion") in (None, "none") else str(spec["motion"]),
                states=dict(spec["states"]) if "states" in spec else None,
                never=tuple(str(n) for n in spec.get("never", [])),
                fidelity=tuple(str(f) for f in spec.get("fidelity", ["flat"])),
            )
            for name, spec in raw.get("concepts", {}).items()
        }

    @classmethod
    def load(cls) -> VisualLanguage:
        """Load the registry from ``design/language.yaml``.

        Returns:
            The loaded visual language.
        """
        path = _DESIGN_DIR / "language.yaml"
        return cls(_load_yaml(path), path)

    def concept(self, name: str) -> ConceptVisual:
        """Resolve one concept's visual identity.

        Args:
            name: The concept id.

        Returns:
            Its invariant visual identity.

        Raises:
            RoleNotFoundError: The concept is not registered. An actor may not
                render without an entry — that is what keeps the language closed.
        """
        try:
            return self._concepts[name]
        except KeyError:
            raise RoleNotFoundError(
                f"Concept {name!r} has no entry in the visual language registry",
                context={"registered": ", ".join(sorted(self._concepts))},
                fix=(
                    f"Add {name!r} to design/language.yaml with a role, a silhouette "
                    "and its `never:` rules, before giving it an actor."
                ),
            ) from None

    @property
    def concepts(self) -> dict[str, ConceptVisual]:
        """Every registered concept, by name."""
        return dict(self._concepts)

    def __repr__(self) -> str:
        """Short, diagnostic representation."""
        return f"VisualLanguage(v{self.version}, {len(self._concepts)} concepts)"


@cache
def visual_language() -> VisualLanguage:
    """The process-wide visual language registry."""
    return VisualLanguage.load()


@cache
def theme(name: str = DEFAULT_THEME) -> Theme:
    """A process-wide cached theme.

    Args:
        name: Theme id.

    Returns:
        The loaded theme.
    """
    return Theme.load(name)


def resolve(concept: str, theme_name: str = DEFAULT_THEME) -> Role:
    """Resolve a concept all the way to its drawable values.

    This is the only sanctioned path from an idea to a colour, and it goes through
    both layers: the registry decides which role the concept owns, the theme decides
    what that role looks like.

    Args:
        concept: The concept id, e.g. ``"packet"``.
        theme_name: Which theme to resolve against.

    Returns:
        The resolved role.

    Raises:
        RoleNotFoundError: The concept is unregistered, or the theme lacks its role.
    """
    return theme(theme_name).role(visual_language().concept(concept).role)
