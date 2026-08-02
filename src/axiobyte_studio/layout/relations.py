"""Semantic layout relations — how a shot describes arrangement without knowing the format.

A shot never says *where* something is. It says how things **relate**, and relations
have no orientation until a target profile gives them one. This is the whole reason
the reference episodes needed two 97 KB files and this Studio does not: ep02's own
docstring says *"the vertical flows of the portrait cut run left→right here"*, which
is the observation that a chain has no inherent axis.

Naming rule (``CONVENTIONS.md`` §14): a relation may never contain a direction.
``chain``, not ``row``. ``pair``, not ``columns``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum
from typing import ClassVar

from axiobyte_studio.core.errors import DesignError
from axiobyte_studio.layout.frame import Box, Target


class OverBudget(StrEnum):
    """What to do when a relation holds more than a target can show legibly.

    This is the one difference between formats that reflow alone cannot solve: a
    wide frame holds seven things, a tall one holds four. Rather than silently
    shrinking everything into mush, the shot declares its fallback.
    """

    ERROR = "error"
    """Refuse to solve. The default — an over-full frame should be a decision."""

    SPLIT = "split"
    """Play the relation as several sequential reveals inside the same beat."""

    CROP = "crop"
    """Show the first items and an ellipsis. For pools and queues, where
    "and many more" is the honest reading anyway."""


@dataclass(frozen=True, slots=True)
class Relation(ABC):
    """Base for every layout relation.

    Attributes:
        id: Name of the relation, used in errors and overrides.
        weight: Share of the parent box relative to sibling relations.
    """

    id: str
    weight: float = 1.0

    @property
    @abstractmethod
    def kind(self) -> str:
        """The relation kind, matching a key in a target's ``axis:`` map."""

    @property
    @abstractmethod
    def slots(self) -> tuple[str, ...]:
        """Names this relation will place, in order."""

    @abstractmethod
    def solve(self, box: Box, target: Target) -> dict[str, Box]:
        """Place this relation's slots inside a box.

        Args:
            box: The region this relation owns.
            target: The profile supplying axis and spacing.

        Returns:
            A box per slot name.
        """

    @property
    def over_budget(self) -> OverBudget:
        """Strategy when this relation exceeds a target's density budget."""
        return OverBudget.ERROR


@dataclass(frozen=True, slots=True)
class Chain(Relation):
    """An ordered sequence: a pipeline, a copy path, a set of stages.

    The single most useful relation in systems visualisation, and the one that
    carries the format difference. A chain is a *sequence*; whether it runs
    left-to-right or top-to-bottom is the frame's business, not the shot's.
    """

    items: tuple[str, ...] = ()
    strategy: OverBudget = OverBudget.ERROR

    @property
    def kind(self) -> str:
        """Relation kind."""
        return "chain"

    @property
    def slots(self) -> tuple[str, ...]:
        """The chain's items, in order."""
        return self.items

    @property
    def over_budget(self) -> OverBudget:
        """Declared fallback when the chain is too long for the frame."""
        return self.strategy

    def solve(self, box: Box, target: Target) -> dict[str, Box]:
        """Lay the items along the target's chain axis.

        Args:
            box: The region this chain owns.
            target: The profile supplying the axis.

        Returns:
            A box per item.
        """
        axis = target.axis_for("chain")
        parts = box.divide(len(self.items), axis, target.gap)
        return dict(zip(self.items, parts, strict=True))


@dataclass(frozen=True, slots=True)
class Pair(Relation):
    """Two things held in one frame because the contrast is the point.

    Pedagogically load-bearing: zero-copy is only meaningful against copy-based,
    NUMA-local only against NUMA-remote. A pair is a comparison, not a layout.
    """

    a: str = ""
    b: str = ""

    @property
    def kind(self) -> str:
        """Relation kind."""
        return "pair"

    @property
    def slots(self) -> tuple[str, ...]:
        """The two compared things."""
        return (self.a, self.b)

    def solve(self, box: Box, target: Target) -> dict[str, Box]:
        """Place the two sides according to the target's pair arrangement.

        Args:
            box: The region this pair owns.
            target: The profile supplying the arrangement.

        Returns:
            A box for each side.
        """
        arrangement = target.axis_for("pair")
        axis = "horizontal" if arrangement == "side_by_side" else "vertical"
        left, right = box.divide(2, axis, target.gap)
        return {self.a: left, self.b: right}


@dataclass(frozen=True, slots=True)
class Cluster(Relation):
    """A group whose members have no order: a mempool, a set of cache lines.

    The shape is the frame's decision. A pool must read as *plural* at a glance,
    which is why a cluster never collapses below its declared minimum.
    """

    items: tuple[str, ...] = ()
    strategy: OverBudget = OverBudget.CROP

    _SHAPES: ClassVar[dict[str, float]] = {
        "grid_wide": 0.45,
        "grid_square": 1.0,
        "grid_narrow": 2.2,
    }

    @property
    def kind(self) -> str:
        """Relation kind."""
        return "cluster"

    @property
    def slots(self) -> tuple[str, ...]:
        """The cluster's members."""
        return self.items

    @property
    def over_budget(self) -> OverBudget:
        """Clusters crop by default — "and many more" is honest for a pool."""
        return self.strategy

    def solve(self, box: Box, target: Target) -> dict[str, Box]:
        """Arrange members in a grid whose proportions suit the frame.

        Args:
            box: The region this cluster owns.
            target: The profile supplying the grid shape.

        Returns:
            A box per member.
        """
        shape = target.axis_for("cluster")
        ratio = self._SHAPES.get(shape, 1.0)
        count = len(self.items)
        columns = max(1, min(count, round((count / ratio) ** 0.5) or 1))
        rows = -(-count // columns)

        row_boxes = box.divide(rows, "vertical", target.gap)
        placed: dict[str, Box] = {}
        for index, name in enumerate(self.items):
            row = row_boxes[index // columns]
            in_row = min(columns, count - (index // columns) * columns)
            placed[name] = row.divide(in_row, "horizontal", target.gap)[index % columns]
        return placed


@dataclass(frozen=True, slots=True)
class Ensemble(Relation):
    """N identical units that act as one, then diverge.

    Added because the GPU stress test in ``CONCEPT-ARCHITECTURE.md`` §15.2 broke
    every other relation. It then turned out that RSS queues, a DPDK burst, a GPU
    warp and a Raft replica set are all the same shape — which is the best evidence
    the vocabulary sits at the right level.
    """

    unit: str = ""
    count: int = 0
    strategy: OverBudget = OverBudget.CROP

    @property
    def kind(self) -> str:
        """Relation kind."""
        return "ensemble"

    @property
    def slots(self) -> tuple[str, ...]:
        """Generated member names, ``unit[i]``."""
        return tuple(f"{self.unit}[{i}]" for i in range(self.count))

    @property
    def over_budget(self) -> OverBudget:
        """Ensembles crop by default; 32 lanes never all fit."""
        return self.strategy

    def solve(self, box: Box, target: Target) -> dict[str, Box]:
        """Lay the units in a tight strip along the ensemble axis.

        Members sit flush — an ensemble reads as one object, so it takes a much
        smaller gap than a chain, whose separation is the point.

        Args:
            box: The region this ensemble owns.
            target: The profile supplying the axis.

        Returns:
            A box per unit.
        """
        axis = target.axis_for("ensemble")
        parts = box.divide(self.count, axis, target.gap * 0.15)
        return dict(zip(self.slots, parts, strict=True))


@dataclass(frozen=True, slots=True)
class Stack(Relation):
    """Several relations packed against each other in one frame.

    The composition relation. Children keep their own relation kinds, so a stack of
    a chain and a pair reflows correctly in every format without further thought.
    """

    children: tuple[Relation, ...] = field(default_factory=tuple)

    @property
    def kind(self) -> str:
        """Relation kind."""
        return "stack"

    @property
    def slots(self) -> tuple[str, ...]:
        """Every slot of every child, in order."""
        return tuple(slot for child in self.children for slot in child.slots)

    def solve(self, box: Box, target: Target) -> dict[str, Box]:
        """Divide the box among children by weight, then solve each.

        Args:
            box: The region this stack owns.
            target: The profile supplying axis and spacing.

        Returns:
            The merged placements of every child.

        Raises:
            DesignError: The stack has no children.
        """
        if not self.children:
            raise DesignError(
                f"Stack {self.id!r} has no children",
                fix="Add at least one relation, or drop the stack.",
            )
        axis = target.axis_for("stack")
        boxes = box.weighted_divide([c.weight for c in self.children], axis, target.gap)
        placed: dict[str, Box] = {}
        for child, child_box in zip(self.children, boxes, strict=True):
            placed.update(child.solve(child_box, target))
        return placed


# ---------------------------------------------------------------------------
# Non-positional relations. These place nothing; they declare meaning that the
# grammar, the camera and lint all read.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Anchor:
    """A semantic link between two things — a pointer to the bytes it addresses.

    Carries no geometry. The link is drawn between whatever boxes the solver gave
    its endpoints, which is what lets ``mbuf.buf_addr → packet.first_byte`` survive
    a re-layout, a format change, and a backend swap.
    """

    source: str
    target: str
    kind: str = "pointer"


@dataclass(frozen=True, slots=True)
class Focus:
    """What this beat is about.

    Exactly one focus per beat. The camera frames it, lint counts it, and the
    cognitive budget is measured against everything that is *not* it.
    """

    slot: str
    intent: str = ""
