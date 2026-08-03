"""Scaffolding — the tool whose whole job is making episode N+1 cheaper.

The scaffold is DERIVED from the concepts, not templated: a beat per objective, an
act per concept, a cast per participant. Every line it writes is a line the author
did not, which is the compounding the Studio exists to produce.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

from axiobyte_studio.core import StudioError
from axiobyte_studio.storyboard import new_episode


@pytest.fixture
def scaffolded(tmp_path: Path):
    return new_episode(
        "s01e05-false-sharing",
        ["false_sharing", "padded_variables"],
        into=tmp_path,
        pillar="p01-high-performance-data-plane",
    )


class TestValidation:
    def test_a_malformed_id_is_refused(self, tmp_path):
        with pytest.raises(StudioError) as exc:
            new_episode("false-sharing", ["false_sharing"], into=tmp_path)
        assert "sNNeNN-kebab-slug" in str(exc.value)

    def test_an_episode_must_teach_something(self, tmp_path):
        with pytest.raises(StudioError, match="must teach something"):
            new_episode("s01e05-x", [], into=tmp_path)

    def test_an_unknown_concept_is_refused(self, tmp_path):
        with pytest.raises(StudioError, match="No concept named"):
            new_episode("s01e05-x", ["teleportation"], into=tmp_path)

    def test_a_composite_is_an_episode_not_a_concept_list(self, tmp_path):
        with pytest.raises(StudioError) as exc:
            new_episode("s01e09-ngfw", ["dpdk_rx_pipeline"], into=tmp_path)
        assert "A composite IS an episode's shape" in str(exc.value)

    def test_it_refuses_to_overwrite_authored_work(self, tmp_path, scaffolded):
        with pytest.raises(StudioError) as exc:
            new_episode("s01e05-false-sharing", ["false_sharing"], into=tmp_path)
        assert "would overwrite authored work" in str(exc.value)


class TestDerivedFromConcepts:
    def test_it_writes_the_four_authored_inputs(self, scaffolded):
        names = {f.name for f in scaffolded.files}
        assert names == {"episode.yaml", "picture.md", "beats.yaml", "episode.py"}

    def test_a_beat_per_objective_and_one_refutation(self, scaffolded):
        beats = yaml.safe_load(
            (scaffolded.root / "storyboard" / "beats.yaml").read_text(encoding="utf-8")
        )
        acts = {a["id"]: a for a in beats["acts"]}
        assert set(acts) == {"false_sharing", "padded_variables"}
        ids = [b["id"] for b in acts["false_sharing"]["beats"]]
        assert "false_sharing.fs_1" in ids  # from objective FS-1
        assert "false_sharing.refute" in ids

    def test_participants_become_the_assumed_knowledge(self, scaffolded):
        manifest = yaml.safe_load((scaffolded.root / "episode.yaml").read_text(encoding="utf-8"))
        # An interaction taught before its participants carries two new ideas, and
        # the closure check would reject it. The scaffold gets that right up front.
        assert set(manifest["assumed"]) == {"thread", "cache_line"}

    def test_the_picture_is_seeded_but_not_written(self, scaffolded):
        picture = (scaffolded.root / "picture.md").read_text(encoding="utf-8")
        assert "64-byte line" in picture  # seeded from the objective
        assert "It is a race condition" in picture  # seeded from the misconception
        assert "TODO" in picture  # the thesis is the one thing nothing can generate

    def test_the_keyword_never_truncates_mid_word(self, scaffolded):
        beats = (scaffolded.root / "storyboard" / "beats.yaml").read_text(encoding="utf-8")
        assert 'keyword: "FALSE SHARING"' in beats
        assert 'keyword: "PADDED VARIABLES"' in beats


class TestGeneratedCodeIsUsable:
    def test_it_imports_and_generates_a_scene_per_format(self, scaffolded):
        module_path = scaffolded.root / "shots" / "episode.py"
        spec = importlib.util.spec_from_file_location("_scaffolded", module_path)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert set(module.SCENES) >= {"16x9", "9x16", "1x1"}

    def test_it_stages_every_act_it_declares(self, scaffolded):
        source = (scaffolded.root / "shots" / "episode.py").read_text(encoding="utf-8")
        assert "def stage_false_sharing(" in source
        assert "def stage_padded_variables(" in source

    def test_it_passes_the_project_s_own_lint(self, scaffolded):
        # A scaffold that fails the repo's lint the moment it is written is not a
        # scaffold, it is a chore.
        result = subprocess.run(
            [sys.executable, "-m", "ruff", "check", str(scaffolded.root)],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout


class TestWhatItRefusesToInvent:
    def test_cues_are_left_as_todo(self, scaffolded):
        # A beat landing on a guessed moment is exactly what THE ONE RULE forbids.
        beats = (scaffolded.root / "storyboard" / "beats.yaml").read_text(encoding="utf-8")
        assert 'cue: "TODO@0"' in beats
        assert "THE ONE" in beats

    def test_the_todo_list_names_the_thesis_as_the_author_s(self, scaffolded):
        assert any("nothing can generate" in item for item in scaffolded.todo)
        assert any("voiceover" in item for item in scaffolded.todo)
