from __future__ import annotations

import json
from pathlib import Path

import pytest

from axiobyte_studio.timeline import Timeline

# The reference episodes are the Studio's specification. They live outside this repo,
# so tests that use them are marked and skipped when absent.
REFERENCE_ROOT = Path(
    "/Users/dukhi8ma/Documents/dev/projects/Ajay3007.github.io/_learning/manim-scripts/axiobyte-system"
)


@pytest.fixture
def raw_timeline() -> dict:
    """A small synthetic timeline in the schema the transcription step emits."""
    sentences = [
        "Imagine you are moving an entire library.",
        "The NIC receives the packet into one buffer.",
        "It simply passes a reference to the packet.",
    ]
    words: list[dict] = []
    t = 0.0
    for index, text in enumerate(sentences):
        for token in text.split():
            words.append(
                {
                    "word": token,
                    "start": round(t, 3),
                    "end": round(t + 0.3, 3),
                    "sentence_index": index,
                    "confidence": 0.9,
                }
            )
            t += 0.4
        t += 0.5
    return {
        "meta": {"duration": round(t, 3), "engine": "synthetic"},
        "words": words,
        "sentences": [
            {
                "text": text,
                "start": min(w["start"] for w in words if w["sentence_index"] == i),
                "end": max(w["end"] for w in words if w["sentence_index"] == i),
            }
            for i, text in enumerate(sentences)
        ],
        "pauses": [],
    }


@pytest.fixture
def timeline(raw_timeline: dict) -> Timeline:
    """The synthetic timeline, parsed."""
    return Timeline.from_dict(raw_timeline)


@pytest.fixture
def ep02_timeline() -> Timeline:
    """The real Episode 02 timeline, or skip."""
    path = REFERENCE_ROOT / "ep02" / "timeline.json"
    if not path.exists():
        pytest.skip(f"reference episode not present at {path}")
    return Timeline.from_dict(json.loads(path.read_text(encoding="utf-8")), source=path)
