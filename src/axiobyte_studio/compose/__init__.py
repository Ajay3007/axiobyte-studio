"""Composition — assembling a film from clips that any mix of backends produced.

v0 joins shots in narrated order and lays the voiceover under them. Layer stacking
with depth, transitions and a shared LUT (ARCHITECTURE.md §2, subsystem 14) build
on the same shot windows later.
"""

from __future__ import annotations

from axiobyte_studio.compose.film import ComposeResult, compose_episode, verify_audio

__all__ = ["ComposeResult", "compose_episode", "verify_audio"]
