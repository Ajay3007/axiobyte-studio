from __future__ import annotations

import re
from pathlib import Path

import pytest

from axiobyte_studio.core import DesignError, RoleNotFoundError
from axiobyte_studio.design import Theme, resolve, theme, visual_language

SRC = Path(__file__).resolve().parents[2] / "src" / "axiobyte_studio"
HEX = re.compile(r"#[0-9a-fA-F]{6}\b")


class TestTheme:
    def test_default_theme_loads(self):
        assert theme().id == "systems"

    def test_carries_the_reference_palette(self):
        t = theme()
        assert t.role("packet").hue == "#4AA8FF"
        assert t.role("memory").hue == "#B79CF0"
        assert t.role("pointer").hue == "#F5D14F"
        assert t.role("mbuf").hue == "#34D8E8"
        assert t.role("nic").hue == "#4DE6A0"
        assert t.role("cpu").hue == "#F0A431"
        assert t.role("copy").hue == "#FF5C55"
        assert t.role("idle").hue == "#65728A"

    def test_ground_and_ink_own_no_role(self):
        t = theme()
        assert t.ground["bg"] == "#090C13"
        assert t.ink["primary"] == "#EAF0F6"
        assert "bg" not in t.roles

    def test_copy_is_reserved(self):
        # Red means "bytes actually moved" and nothing else. The absence of red is
        # the argument in the zero-copy episode; a decorative use destroys it.
        assert theme().role("copy").reserved is True
        assert theme().role("packet").reserved is False

    def test_unknown_theme_lists_what_exists(self):
        with pytest.raises(DesignError) as exc:
            Theme.load("nonexistent")
        assert "available" in str(exc.value)
        assert "systems" in str(exc.value)

    def test_unknown_role_names_the_fix(self):
        with pytest.raises(RoleNotFoundError) as exc:
            theme().role("chartreuse")
        assert "systems.yaml" in str(exc.value)


class TestVisualLanguage:
    def test_loads(self):
        assert len(visual_language().concepts) >= 9

    def test_concept_owns_a_role_not_a_colour(self):
        packet = visual_language().concept("packet")
        assert packet.role == "packet"
        assert not HEX.search(str(packet))

    def test_unregistered_concept_refuses(self):
        # An actor may not render without a registry entry — that is what keeps the
        # visual language closed rather than aspirational.
        with pytest.raises(RoleNotFoundError) as exc:
            visual_language().concept("quantum_widget")
        assert "language.yaml" in str(exc.value)

    def test_never_rules_are_loaded(self):
        assert any("byte" in n for n in visual_language().concept("pointer").never)
        assert visual_language().concept("copy").never

    def test_memory_buffer_never_travels(self):
        assert visual_language().concept("memory_buffer").motion is None

    def test_hardware_declares_3d_fidelities(self):
        assert visual_language().concept("nic").fidelity == ("flat", "iso", "plate")


class TestResolution:
    def test_concept_resolves_through_both_layers(self):
        assert resolve("packet").hue == "#4AA8FF"
        assert resolve("mbuf").hue == "#34D8E8"

    def test_dma_borrows_the_nic_role(self):
        # DMA is the NIC acting autonomously; it does not get a hue of its own.
        assert resolve("dma").hue == resolve("nic").hue

    def test_every_registered_concept_resolves(self):
        # The contract test: the registry and the theme must agree completely.
        for name in visual_language().concepts:
            assert resolve(name).hue.startswith("#")


class TestNoRawHex:
    """CONVENTIONS.md §5 — colour values exist in exactly one place."""

    def test_no_hex_outside_themes(self):
        offenders = []
        for path in SRC.rglob("*"):
            if path.suffix not in {".py", ".yaml"} or "themes" in path.parts:
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if HEX.search(line):
                    offenders.append(f"{path.relative_to(SRC)}:{number}: {line.strip()}")
        assert not offenders, "raw hex outside design/themes/:\n" + "\n".join(offenders)
