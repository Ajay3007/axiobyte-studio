"""The Timeline Engine — the film is driven by the voiceover, never by guesses.

This is the Studio's inheritance from the reference episodes' **ONE RULE**: every
beat is a word start looked up in the voiceover's word-level timeline, and the whole
cue table is resolved *before anything renders*. A typo, or a re-cut voiceover that
no longer contains a word, fails immediately instead of drifting an entire episode
silently out of sync.

Nothing here knows what a frame is.
"""

from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from difflib import get_close_matches
from pathlib import Path
from typing import Any

from axiobyte_studio.core.errors import CueNotFoundError, TimelineError

#: Stripped from a word before comparison — ASCII punctuation plus the typographic
#: quotes and dashes transcription engines emit.
_PUNCTUATION = "\"'`.,?!;:()[]{}—–-…‘’“”"  # noqa: RUF001 - typographic chars are the point


def normalise(word: str) -> str:
    """Reduce a word to its comparable form.

    Case, surrounding punctuation and Unicode composition are all irrelevant to
    whether a cue matches; only the letters are.

    Args:
        word: A word as written in a cue, or as transcribed.

    Returns:
        The lowercase, punctuation-stripped, NFC-normalised form.
    """
    return unicodedata.normalize("NFC", word).strip().strip(_PUNCTUATION).lower()


@dataclass(frozen=True, slots=True)
class Word:
    """One transcribed word, with the timing that makes it usable as a cue."""

    text: str
    start: float
    end: float
    sentence: int
    confidence: float = 1.0

    @property
    def duration(self) -> float:
        """Seconds from the start of this word to its end."""
        return self.end - self.start


@dataclass(frozen=True, slots=True)
class Sentence:
    """One transcribed sentence — the namespace a cue's word is looked up in."""

    index: int
    text: str
    start: float
    end: float


@dataclass(frozen=True, slots=True)
class Pause:
    """A silence between words. Useful for landing a beat in a gap rather than on a word."""

    start: float
    end: float

    @property
    def duration(self) -> float:
        """Length of the silence, in seconds."""
        return self.end - self.start


class Timeline:
    """A word-level voiceover timeline, indexed for cue lookup.

    Attributes:
        words: Every transcribed word, in spoken order.
        sentences: Every transcribed sentence, in spoken order.
        pauses: Silences between words, in spoken order.
        duration: Length of the voiceover in seconds.
        source: Path the timeline was loaded from, for error messages.
    """

    def __init__(
        self,
        words: list[Word],
        sentences: list[Sentence],
        pauses: list[Pause],
        duration: float,
        source: Path | None = None,
    ) -> None:
        self.words = words
        self.sentences = sentences
        self.pauses = pauses
        self.duration = duration
        self.source = source
        self._index: dict[str, list[Word]] = {}
        for word in words:
            self._index.setdefault(normalise(word.text), []).append(word)

    # -- construction -------------------------------------------------------

    @classmethod
    def load(cls, path: str | Path) -> Timeline:
        """Load a ``timeline.json`` produced by the transcription step.

        Args:
            path: Path to the timeline JSON.

        Returns:
            The parsed timeline.

        Raises:
            TimelineError: The file is missing, unreadable, or lacks required keys.
        """
        path = Path(path)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise TimelineError(
                f"No voiceover timeline at {path}",
                fix="Run `abs timeline transcribe <episode>` to generate it from the audio.",
            ) from exc
        except json.JSONDecodeError as exc:
            raise TimelineError(
                f"Voiceover timeline at {path} is not valid JSON",
                context={"parse error": str(exc)},
                fix="Re-run `abs timeline transcribe <episode>` to regenerate it.",
            ) from exc
        return cls.from_dict(raw, source=path)

    @classmethod
    def from_dict(cls, raw: dict[str, Any], source: Path | None = None) -> Timeline:
        """Build a timeline from an already-parsed mapping.

        Accepts the schema written by the reference episodes' WhisperX pipeline.

        Args:
            raw: The parsed timeline mapping.
            source: Where it came from, used in error messages.

        Returns:
            The parsed timeline.

        Raises:
            TimelineError: A required key is missing.
        """
        where = f" in {source}" if source else ""
        for key in ("meta", "words", "sentences"):
            if key not in raw:
                raise TimelineError(
                    f"Voiceover timeline{where} has no {key!r} section",
                    context={"found": ", ".join(sorted(raw)) or "nothing"},
                    fix="Regenerate it with `abs timeline transcribe <episode>`.",
                )

        words = [
            Word(
                text=str(w["word"]),
                start=float(w["start"]),
                end=float(w["end"]),
                sentence=int(w["sentence_index"]),
                confidence=float(w.get("confidence", 1.0)),
            )
            for w in raw["words"]
        ]
        sentences = [
            Sentence(
                index=i,
                text=str(s["text"]),
                start=float(s["start"]),
                end=float(s["end"]),
            )
            for i, s in enumerate(raw["sentences"])
        ]
        pauses = [
            Pause(start=float(p["start"]), end=float(p["end"])) for p in raw.get("pauses", [])
        ]
        duration = float(raw["meta"]["duration"])
        return cls(words, sentences, pauses, duration, source)

    # -- lookup -------------------------------------------------------------

    def word(self, text: str, sentence: int | None = None, occurrence: int = 0) -> float:
        """Return the START time of a spoken word — the atom every beat is anchored to.

        Args:
            text: The word as spoken. Case and punctuation are ignored.
            sentence: Restrict the search to one sentence. Strongly recommended:
                it makes a cue survive the same word appearing elsewhere.
            occurrence: Which occurrence to take when the word repeats within scope.

        Returns:
            The word's start time, in seconds from the beginning of the voiceover.

        Raises:
            CueNotFoundError: The word is not spoken in that scope. The message
                reports where it *is* spoken, or the nearest words that exist.
        """
        return self.find(text, sentence, occurrence).start

    def find(self, text: str, sentence: int | None = None, occurrence: int = 0) -> Word:
        """Like :meth:`word`, but returns the whole :class:`Word`.

        Args:
            text: The word as spoken.
            sentence: Restrict the search to one sentence.
            occurrence: Which occurrence to take when the word repeats within scope.

        Returns:
            The matching word.

        Raises:
            CueNotFoundError: The word is not spoken in that scope.
        """
        key = normalise(text)
        everywhere = self._index.get(key, [])
        hits = [w for w in everywhere if sentence is None or w.sentence == sentence]
        if len(hits) > occurrence:
            return hits[occurrence]
        raise self._not_found(text, key, sentence, occurrence, everywhere)

    def sentence(self, index: int) -> Sentence:
        """Return one sentence by index.

        Args:
            index: Zero-based sentence index.

        Returns:
            The sentence.

        Raises:
            CueNotFoundError: No sentence has that index.
        """
        if 0 <= index < len(self.sentences):
            return self.sentences[index]
        raise CueNotFoundError(
            f"Voiceover has no sentence {index}",
            context={"sentences": f"0..{len(self.sentences) - 1}"},
            fix="Check the sentence index in your cue table against timeline.json.",
        )

    def words_in(self, start: float, end: float) -> list[Word]:
        """Every word that begins inside a time window.

        This is what lets a beat be checked against what is actually being said
        during it — the narration contract of ``CONCEPT-ARCHITECTURE.md`` §11.3.

        Args:
            start: Window start, in seconds.
            end: Window end, in seconds.

        Returns:
            The words starting within ``[start, end)``, in spoken order.
        """
        return [w for w in self.words if start <= w.start < end]

    # -- diagnostics --------------------------------------------------------

    def _not_found(
        self,
        text: str,
        key: str,
        sentence: int | None,
        occurrence: int,
        everywhere: list[Word],
    ) -> CueNotFoundError:
        """Build the error that carries its own fix.

        Three cases, each with a different useful answer: the word exists but in
        another sentence; the word exists here but not that many times; or the word
        is not spoken at all and we should suggest what is.
        """
        where = f" in {self.source}" if self.source else ""
        scope = "the voiceover" if sentence is None else f"sentence {sentence}"
        context: dict[str, Any] = {}
        fix = ""

        if everywhere and sentence is not None:
            found_in = sorted({w.sentence for w in everywhere})
            context["spoken in sentence"] = ", ".join(
                f"{s} (t={next(w.start for w in everywhere if w.sentence == s):.2f}s)"
                for s in found_in[:5]
            )
            fix = f"Use sentence={found_in[0]}, or pick a word that is in sentence {sentence}."
        elif everywhere:
            context["occurrences"] = str(len(everywhere))
            fix = f"occurrence must be 0..{len(everywhere) - 1}."
        else:
            near = get_close_matches(key, self._index.keys(), n=4, cutoff=0.7)
            if near:
                context["did you mean"] = ", ".join(repr(n) for n in near)
            fix = (
                "The voiceover may have been re-cut. Run `abs timeline drift` to see "
                "what moved, then update the cue."
            )

        return CueNotFoundError(
            f"Voiceover{where} does not say {text!r} in {scope}"
            + (f" (occurrence {occurrence})" if occurrence else ""),
            context=context,
            fix=fix,
        )

    def __len__(self) -> int:
        """Number of transcribed words."""
        return len(self.words)

    def __repr__(self) -> str:
        """Short, diagnostic representation."""
        return (
            f"Timeline({len(self.words)} words, {len(self.sentences)} sentences, "
            f"{self.duration:.2f}s)"
        )
