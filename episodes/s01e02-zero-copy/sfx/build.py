"""E02 Zero Copy: the SFX layer, an audio post-production pass over the FROZEN master.

    node episodes/s01e02-zero-copy/sfx/lanes.mjs            # the storyboard's event times -> out/sfx/lanes.json
    python episodes/s01e02-zero-copy/sfx/build.py preview   # SFX stem + voiceover/SFX preview mix + report
    python episodes/s01e02-zero-copy/sfx/build.py video     # ...then the derivative MP4 (video stream copied)

What it does:

* Takes the frozen master's own audio (decoded, 48 kHz mono) as the voiceover bed and never alters it:
  the mix is `voiceover + SFX`, on both channels. The voiceover's samples are not gained, filtered,
  compressed, normalised or moved.
* Synthesises a small SFX vocabulary procedurally (numpy/scipy; seeded noise, so the same bytes every run).
  No third-party or licensed audio is used.
* Places each cue on the storyboard's own event time (out/sfx/lanes.json), never on a subtitle word.
* Levels each cue relative to the narration, ducks the SFX a further few dB under speech, and guards
  headroom by lowering only the SFX where the sum would approach full scale.
* `video`: muxes the new audio with the master's video stream COPIED (no re-encode): every frame is
  the master's.
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

EPISODE = Path(__file__).resolve().parents[1]
OUT = EPISODE / "out" / "sfx"
MASTER = EPISODE / "out" / "s01e02-zero-copy.three-final-cta-branded-v2.mp4"
DERIVATIVE = EPISODE / "out" / "s01e02-zero-copy.three-final-cta-branded-sfx-v1.mp4"
SR = 48_000

# ----------------------------------------------------------------------------------------- dsp helpers


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(round(seconds * SR))) / SR


def band(x: np.ndarray, lo: float, hi: float, order: int = 4) -> np.ndarray:
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x: np.ndarray, f: float, order: int = 4) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, f, btype="lowpass", fs=SR, output="sos"), x)


def highpass(x: np.ndarray, f: float, order: int = 4) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, f, btype="highpass", fs=SR, output="sos"), x)


def glide(t: np.ndarray, f0: float, f1: float) -> np.ndarray:
    """Phase of an exponential frequency glide f0 -> f1 over t."""
    f = f0 * (f1 / f0) ** (t / max(t[-1], 1e-9))
    return 2 * np.pi * np.cumsum(f) / SR


def fades(x: np.ndarray, fade_in: float, fade_out: float) -> np.ndarray:
    n = len(x)
    e = np.ones(n)
    a, b = int(fade_in * SR), int(fade_out * SR)
    if a:
        e[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if b:
        e[n - b :] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return x * e


def norm(x: np.ndarray) -> np.ndarray:
    return x / (np.abs(x).max() + 1e-12)


# ----------------------------------------------------------------------------------------- vocabulary
# Each sound is a function of a few parameters and a fixed seed: same bytes every run.


def crate(seed: int = 1) -> np.ndarray:
    """ANALOGY: a crate set down on the truck bed: a soft woody knock and a smaller settle."""
    rng = np.random.default_rng(seed)
    t = t_axis(0.5)
    body = np.sin(2 * np.pi * (62 + 40 * np.exp(-t * 30)) * t) * np.exp(-t * 16)
    knock = band(rng.normal(size=len(t)), 260, 1100) * np.exp(-t * 55)
    x = 0.9 * body + 0.35 * norm(knock)
    settle = np.zeros_like(x)
    k = int(0.085 * SR)
    settle[k:] = 0.35 * x[: len(x) - k]
    return fades(norm(x + settle), 0.002, 0.08)


def fold(seconds: float = 2.6, seed: int = 2) -> np.ndarray:
    """MAJOR TRANSITION: the analogy folds into the technical world: a rising band of air over a low pad."""
    rng = np.random.default_rng(seed)
    t = t_axis(seconds)
    air = np.zeros_like(t)
    centres = [350, 700, 1400, 2800, 5200]
    for i, fc in enumerate(centres):
        peak = 0.25 + 0.55 * i / (len(centres) - 1)
        env = np.exp(-(((t / seconds) - peak) ** 2) / 0.03)
        air += norm(band(rng.normal(size=len(t)), fc / 1.5, fc * 1.5)) * env * (1.0 - 0.12 * i)
    pad = (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 164.8 * t)) * np.sin(np.pi * t / seconds) ** 2
    return fades(norm(0.55 * norm(air) + 0.45 * norm(pad)), 0.4, 0.9)


def dma(seconds: float, rising: bool, seed: int, swell: float = 0.12) -> np.ndarray:
    """BLUE / DATA: a clean directional sweep with fine regular data ticks (bytes streaming, no CPU)."""
    rng = np.random.default_rng(seed)
    t = t_axis(seconds)
    f0, f1 = (1300, 2600) if rising else (2600, 1350)  # above the vowels: data, not voice
    tone = highpass(np.sin(glide(t, f0, f1)) + 0.2 * np.sin(2 * glide(t, f0, f1) + 0.3), 1000, 2)
    ticks = np.zeros_like(t)
    period = int(SR / 36)  # a steady, machine-regular stream
    blip = np.hanning(int(0.003 * SR))
    for start in range(int(0.05 * SR), len(t) - len(blip), period):
        ticks[start : start + len(blip)] += blip * (0.55 + 0.45 * rng.random())
    ticks = band(ticks * rng.normal(size=len(t)), 3800, 7500)
    air = highpass(rng.normal(size=len(t)), 6000) * 0.4
    x = 0.65 * norm(tone) + 0.3 * norm(ticks) + 0.08 * norm(air)
    return fades(norm(x), swell, min(0.45, seconds / 3))


def copy(seconds: float, variant: int) -> np.ndarray:
    """RED / COPY: the CPU moving bytes: a grainy, effortful transfer over a low working hum (a cost)."""
    rng = np.random.default_rng(10 + variant)
    t = t_axis(seconds)
    hum_f0, hum_f1 = (150, 118) if variant == 0 else (136, 104)
    hum = lowpass(signal.square(glide(t, hum_f0, hum_f1), duty=0.42), 900)
    grains = np.zeros_like(t)
    centre = 1250 if variant == 0 else 980
    g = int(0.026 * SR)
    pos = int(0.04 * SR)
    while pos < len(t) - g:
        burst = band(rng.normal(size=g), centre * 0.7, centre * 1.4) * np.hanning(g)
        grains[pos : pos + g] += burst * (0.5 + 0.5 * rng.random())
        pos += int(SR * rng.uniform(0.055, 0.105))  # irregular: work, not a clock
    land = np.zeros_like(t)
    lt = t_axis(0.25)
    k = len(t) - len(lt)
    land[k:] = np.sin(2 * np.pi * (180 + 60 * np.exp(-lt * 25)) * lt) * np.exp(-lt * 18)
    x = 0.35 * norm(hum) + 0.55 * norm(grains) + 0.35 * land
    return fades(norm(x), 0.06, 0.18)


def tick(freq: float, seconds: float = 0.14) -> np.ndarray:
    """YELLOW / POINTER arrival: a tiny, precise glassy tick."""
    t = t_axis(seconds)
    x = (np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(2 * np.pi * 2.01 * freq * t)) * np.exp(-t * 42)
    return fades(norm(x), 0.0015, 0.02)


def pointer(seconds: float, f0: float, f1: float, arrive: float | None, seed: int = 20) -> np.ndarray:
    """YELLOW / POINTER movement: a thin, light sweep (no data texture: no bytes travel), ending in a tick."""
    rng = np.random.default_rng(seed)
    t = t_axis(seconds)
    line = np.sin(glide(t, f0, f1)) * np.sin(np.pi * np.clip(t / seconds, 0, 1)) ** 1.5
    air = band(rng.normal(size=len(t)), 4500, 9000) * np.sin(np.pi * np.clip(t / seconds, 0, 1)) ** 2
    x = 0.8 * norm(line) + 0.12 * norm(air)
    if arrive is not None:
        tk = tick(arrive)
        x = np.concatenate([x, np.zeros(len(tk))])
        k = len(t) - int(0.01 * SR)
        x[k : k + len(tk)] += 0.9 * tk
    return fades(norm(x), 0.01, 0.05)


def run(hops: int, spacing: float, leg: float, pitches: list[float]) -> np.ndarray:
    """YELLOW / POINTER run: the handle passing every stage again: one tick per arrival, nothing else."""
    total = hops * spacing + 0.3
    x = np.zeros(int(total * SR))
    for i in range(hops):
        tk = tick(pitches[i]) * (0.75 + 0.25 * i / max(hops - 1, 1))
        k = int((i * spacing + leg) * SR)
        x[k : k + len(tk)] += tk
    return norm(x)


def appear(seed: int = 30) -> np.ndarray:
    """OBJECT APPEARS (the mbuf): a soft, clean bloom: a technical object coming into existence."""
    rng = np.random.default_rng(seed)
    t = t_axis(1.4)
    bend = 1 + 0.02 * (1 - np.exp(-t * 30))
    x = sum(a * np.sin(2 * np.pi * f * np.cumsum(bend) / SR) for f, a in [(392.0, 1.0), (587.3, 0.7), (784.0, 0.3)])
    x = x * (1 - np.exp(-t * 60)) * np.exp(-t * 3.2)
    breath = lowpass(rng.normal(size=len(t)), 2500) * np.exp(-t * 25)
    return fades(norm(0.9 * norm(x) + 0.1 * norm(breath)), 0.005, 0.3)


def pool(seed: int = 40) -> tuple[np.ndarray, np.ndarray]:
    """MEMORY / MEMPOOL: prepared storage settling into place: a low thud, then a short cascade of muted
    slots across the stereo field. Returns (left, right)."""
    rng = np.random.default_rng(seed)
    t = t_axis(1.5)
    thud = np.sin(2 * np.pi * (88 - 28 * (1 - np.exp(-t * 12))) * t) * np.exp(-t * 9)
    left, right = 0.6 * thud.copy(), 0.6 * thud.copy()
    g = int(0.007 * SR)
    for i in range(14):
        k = int((0.12 + i * 0.062) * SR)
        click = band(rng.normal(size=g), 1100, 2600) * np.hanning(g) * 0.55 * (1 - 0.045 * i)
        p = rng.uniform(-0.6, 0.6)
        left[k : k + g] += click * np.cos((p + 1) * np.pi / 4)
        right[k : k + g] += click * np.sin((p + 1) * np.pi / 4)
    peak = max(np.abs(left).max(), np.abs(right).max())
    return fades(left / peak, 0.004, 0.3), fades(right / peak, 0.004, 0.3)


def edit(seed: int = 50) -> np.ndarray:
    """MEMORY ACCESS (edited in place): two small precise clicks and a faint shimmer: a write, no motion."""
    rng = np.random.default_rng(seed)
    t = t_axis(0.45)
    x = np.zeros_like(t)
    g = int(0.006 * SR)
    for k, fc in [(0, 1700), (int(0.075 * SR), 2500)]:
        x[k : k + g] += band(rng.normal(size=g), fc * 0.7, fc * 1.4) * np.hanning(g)
    shimmer = np.sin(2 * np.pi * 3150 * t) * np.exp(-t * 14) * 0.25
    return fades(norm(norm(x) + shimmer), 0.001, 0.1)


def settle(seed: int = 60) -> np.ndarray:
    """MEMORY / RETURN: one element set back into the pool: a soft low settle and a single muted slot."""
    rng = np.random.default_rng(seed)
    t = t_axis(0.6)
    thud = np.sin(2 * np.pi * (78 - 20 * (1 - np.exp(-t * 14))) * t) * np.exp(-t * 11)
    g = int(0.007 * SR)
    click = np.zeros_like(t)
    k = int(0.05 * SR)
    click[k : k + g] = band(rng.normal(size=g), 1000, 2200) * np.hanning(g)
    return fades(norm(0.8 * thud + 0.35 * norm(click)), 0.003, 0.15)


def resolution() -> tuple[np.ndarray, np.ndarray]:
    """FINAL CONCEPT RESOLUTION: one quiet open chord that settles (D, A, D, F#): resolved, not triumphant.
    The same pitches on both sides (a small fixed phase offset only): it stays steady when a phone or
    a mono player sums the channels. Returns (left, right)."""
    t = t_axis(4.2)
    env = (1 - np.exp(-t * 6)) * np.exp(-t * 0.75)
    notes = [(293.66, 1.0), (440.0, 0.75), (587.33, 0.55), (739.99, 0.22)]
    left = sum(a * np.sin(2 * np.pi * f * t) for f, a in notes) * env
    right = sum(a * np.sin(2 * np.pi * f * t + 0.3) for f, a in notes) * env
    left, right = lowpass(left, 3000, 2), lowpass(right, 3000, 2)
    peak = max(np.abs(left).max(), np.abs(right).max())
    return fades(left / peak, 0.25, 1.2), fades(right / peak, 0.25, 1.2)


# ----------------------------------------------------------------------------------------- the cue sheet


@dataclass
class Cue:
    id: str
    at: float  # seconds (from the storyboard's lanes)
    source: str  # which lane / event the time comes from
    visual: str
    purpose: str
    family: str
    level: float  # dB relative to the narration reference (p95 400 ms RMS)
    priority: str  # major | semantic | minor
    pan: tuple[float, float] = (0.0, 0.0)  # start -> end, -1 left .. +1 right (on-screen direction)
    sound: object = None  # set below: mono array or (left, right)


def cues_from(lanes: dict) -> list[Cue]:
    L = lanes
    pointer_word = L["finale"]["from"] + 0.6  # finale.from = W('pointer', 45) - 0.6
    hop_pitches = [2093.0, 2349.3, 2637.0, 3136.0]  # C7 D7 E7 G7: the handle moving on, stage by stage
    cs = [
        Cue("C01", L["analogy"]["load1"] - 0.05, "analogy.load1 (W 'pack', s1)",
            "crates are loaded onto the truck bed",
            "make the analogy physical: moving the whole library is heavy, real work",
            "crate", -24, "minor", (0.25, 0.25), crate()),
        Cue("C02", L["analogy"]["toBytes"]["from"] + 0.9, "analogy.toBytes -> dissolve (S4)",
            "the crates fold into blue bytes; the scene becomes the technical floor (chapter 01)",
            "major transition: from the analogy into the system", "fold", -26, "major", (-0.2, 0.2), fold()),
        Cue("C03", L["dma"]["from"], "lanes.dma",
            "DMA: the NIC writes the packet into buffer A (blue line, bytes fill the buffer)",
            "BLUE = data/DMA: the bytes arrive once, by hardware, no CPU",
            "dma", -27, "semantic", (0.35, -0.2), dma(1.1, True, 3)),
        Cue("C04", L["copy1"]["from"], "lanes.copy1",
            "CPU COPY: bytes travel buffer A -> CPU -> buffer B on the red path",
            "RED = copy/cost: the first copy, heard as effortful work",
            "copy", -20, "semantic", (-0.35, 0.05), copy(1.7, 0)),
        Cue("C05", L["copy2"]["from"], "lanes.copy2",
            "COPIED AGAIN: bytes travel buffer B -> the application",
            "RED = copy/cost: the same family, a lower variation (the cost repeats)",
            "copy", -21, "semantic", (0.05, 0.45), copy(1.5, 1)),
        Cue("C06", L["reference"]["from"], "lanes.reference",
            "the first small yellow reference appears ('A REFERENCE')",
            "YELLOW = pointer: introduce the pointer's sound, alone and tiny",
            "pointer-tick", -30, "minor", (-0.35, -0.35), tick(2637.0)),
        Cue("C07", L["mbuf"]["from"], "lanes.mbuf",
            "the MBUF card appears (cyan)", "a technical object comes into existence: metadata, not bytes",
            "appear", -25, "semantic", (-0.25, -0.25), appear()),
        Cue("C08", L["pulse"]["from"], "lanes.pulse (from -> reach)",
            "buf_addr: a yellow pulse travels the reference from the mbuf to the packet buffer",
            "YELLOW = pointer: an address resolving to its bytes; a thin sweep, NOT a data sound",
            "pointer", -27, "semantic", (-0.35, 0.25),
            pointer(L["pulse"]["reach"] - L["pulse"]["from"], 1500, 2350, 3136.0)),
        Cue("C09", L["pool"]["from"] + 0.15, "lanes.pool (S17 act 2)",
            "the MEMPOOL grid rises: storage prepared before any packet arrives (chapter 03)",
            "MEMORY: reusable prepared storage settling into place", "pool", -23, "major", (0.0, 0.0), pool()),
        Cue("C10", L["zdma"]["from"], "lanes.zdma",
            "DMA -> BUFFER: the NIC writes the incoming bytes into the element's buffer",
            "BLUE = data/DMA: the same family as C03 (the bytes land once)",
            "dma", -28, "semantic", (0.3, -0.15), dma(1.1, True, 4)),
        *[
            Cue(f"C{11 + i}", L["stage"][i], f"lanes.stage[{i}] (W '{w}', s{24 + i})",
                f"the yellow handle moves {src} -> {dst}",
                "YELLOW = pointer: only the handle moves; the buffer and its bytes stay silent",
                "pointer", -29 if i else -27, "semantic", (pan0, pan1),
                pointer(0.42, 1700 + 120 * i, 2300 + 150 * i, hop_pitches[i], seed=21 + i))
            for i, (w, src, dst, pan0, pan1) in enumerate([
                ("passer", "the mbuf", "PARSER", -0.3, -0.05),
                ("classifier", "PARSER", "CLASSIFIER", -0.05, 0.12),
                ("firewall", "CLASSIFIER", "FIREWALL", 0.12, 0.3),
                ("routing", "FIREWALL", "ROUTING", 0.3, 0.45),
            ])
        ],
        Cue("C15", L["edit"]["from"], "lanes.edit (W 'modifies', s30)",
            "EDITED IN PLACE: the header bytes are rewritten where they sit",
            "MEMORY ACCESS: a write without motion", "edit", -29, "minor", (-0.3, -0.3), edit()),
        Cue("C16", L["runs"][0], "lanes.runs[0] (W 'pointer', s34)",
            "'Only the pointer is': the handle runs the pipeline once more; the buffer stands still",
            "YELLOW = pointer: ticks only, no sweep, no data texture", "pointer-run", -31, "minor", (-0.05, 0.45),
            run(4, 0.5, 0.42, hop_pitches)),
        Cue("C17", L["transmit"]["from"], "lanes.transmit (W 'transmits', s40)",
            "TRANSMIT: the NIC reads the same buffer by DMA; the blue token travels buffer -> NIC",
            "BLUE = data/DMA, the opposite direction: a real byte transfer, unlike the pointer",
            "dma", -30, "semantic", (-0.2, 0.1), dma(1.3, False, 5, swell=0.3)),
        Cue("C18", L["representative"]["to"] - 0.1, "lanes.representative.to (W 'returned', s41)",
            "BACK TO THE MEMPOOL: the element returns, ready for the next packet",
            "MEMORY: a quiet settle: storage reused", "settle", -26, "minor", (0.2, 0.2), settle()),
        Cue("C19", pointer_word - 0.35, "W('pointer', 45) = lanes.finale.from + 0.6",
            "'…a pointer to those bytes': the pool settles away; only the pointer and its bytes remain",
            "FINAL CONCEPT RESOLUTION: one quiet open chord under the closing line",
            "resolution", -23, "major", (0.0, 0.0), resolution()),
    ]
    return cs


# ----------------------------------------------------------------------------------------- mixing


def decode_master() -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(MASTER), "-map", "0:a", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def master_duration() -> str:
    """The master's container duration, as ffprobe reports it (e.g. "222.800000")."""
    return subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(MASTER)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def short_rms_db(x: np.ndarray, win: float) -> np.ndarray:
    w = max(1, int(win * SR))
    return 10 * np.log10(np.convolve(x**2, np.ones(w) / w, mode="same") + 1e-20)


def smooth_gain(target: np.ndarray, attack: float, release: float) -> np.ndarray:
    """One-pole smoothing of a gain curve (dB), faster when the gain falls than when it recovers."""
    out = np.empty_like(target)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    g = target[0]
    for i, v in enumerate(target):
        c = a if v < g else r
        g = c * g + (1 - c) * v
        out[i] = g
    return out


def pan_gains(n: int, p0: float, p1: float) -> tuple[np.ndarray, np.ndarray]:
    p = np.linspace(p0, p1, n)
    return np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)


def build(write_video: bool) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lanes_json = json.loads((OUT / "lanes.json").read_text())
    lanes, sentences = lanes_json["lanes"], lanes_json["sentences"]
    vo = decode_master()
    n = len(vo)

    # The narration reference: the loud end of speech (95th percentile of 400 ms RMS where speech is present).
    rms = short_rms_db(vo, 0.4)[:: SR // 100]
    ref_db = float(np.percentile(rms[rms > -50], 95))

    cues = cues_from(lanes)
    left, right = np.zeros(n), np.zeros(n)
    placed = []
    assets = OUT / "assets"
    assets.mkdir(exist_ok=True)
    for c in cues:
        s = c.sound
        stereo = isinstance(s, tuple)
        mono = (s[0] + s[1]) / 2 if stereo else s
        # Level: the cue's own loudest 100 ms sits `level` dB below the narration reference.
        cue_db = float(short_rms_db(mono, 0.1).max())
        gain = 10 ** ((ref_db + c.level - cue_db) / 20)
        k = int(round(c.at * SR))
        m = min(len(mono), n - k)
        if stereo:
            sl, sr_ = s[0][:m] * gain, s[1][:m] * gain
            gl, gr = pan_gains(m, *c.pan)
            sl, sr_ = sl * gl * np.sqrt(2), sr_ * gr * np.sqrt(2)
        else:
            gl, gr = pan_gains(m, *c.pan)
            sl, sr_ = mono[:m] * gain * gl * np.sqrt(2), mono[:m] * gain * gr * np.sqrt(2)
        left[k : k + m] += sl
        right[k : k + m] += sr_
        wavfile.write(assets / f"{c.id}-{c.family}.wav", SR, (np.stack([s[0], s[1]], 1) if stereo else mono).astype(np.float32) * 0.5)
        sent = next((x for x in sentences if x["start"] - 0.4 <= c.at <= x["end"] + 0.4), None)
        placed.append({**{k_: v for k_, v in c.__dict__.items() if k_ != "sound"}, "duration": m / SR,
                       "narration": sent["text"] if sent else "(no narration)"})

    # Ducking: a further 6 dB under speech (60 ms attack, 350 ms release).
    speech = (short_rms_db(vo, 0.05) > ref_db - 24).astype(float)
    duck = 10 ** (smooth_gain(-6.0 * speech, 0.06, 0.35) / 20)
    left, right = left * duck, right * duck

    # Headroom guard: lower ONLY the SFX where voiceover + SFX would pass -1 dBFS (or the voiceover's own
    # sample, where the voiceover alone is already above that). Smooth: a 10 ms look-around minimum, then a
    # 5 ms average, so the guard never clicks; the average of a widened minimum stays below the need.
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    limit = np.maximum(10 ** (-1 / 20), np.abs(vo))
    sfx_abs = np.maximum(np.abs(left), np.abs(right))
    over = np.maximum(np.abs(vo + left), np.abs(vo + right)) > limit
    need = np.ones(n)
    need[over] = np.clip((limit[over] - np.abs(vo[over])) / np.maximum(sfx_abs[over], 1e-12), 0, 1)
    guard = uniform_filter1d(minimum_filter1d(need, size=int(0.02 * SR) + 1), size=int(0.005 * SR) + 1)
    guard = np.minimum(guard, need)
    left, right = left * guard, right * guard
    active = sfx_abs > 10 ** (-60 / 20)
    guard_info = {
        "sfx_active_samples": int(active.sum()),
        "guarded_samples_while_sfx_active": int((active & (guard < 0.999)).sum()),
        "min_guard_db_while_sfx_active": float(20 * np.log10(guard[active].min() + 1e-12)) if active.any() else 0.0,
    }

    mix_l, mix_r = vo + left, vo + right
    stem = np.stack([left, right], 1).astype(np.float32)
    mix = np.stack([mix_l, mix_r], 1).astype(np.float32)
    wavfile.write(OUT / "sfx-stem.wav", SR, stem)
    wavfile.write(OUT / "preview-mix.wav", SR, mix)

    # Proof: the mix minus the SFX is the voiceover, sample for sample.
    resid = np.abs(mix.astype(np.float64) - stem.astype(np.float64) - vo[:, None]).max()
    report = {
        "samples": n,
        "seconds": n / SR,
        "narration_ref_dbfs": ref_db,
        "voiceover_peak_dbfs": 20 * np.log10(np.abs(vo).max()),
        "mix_peak_dbfs": 20 * np.log10(np.abs(mix).max()),
        "sfx_peak_dbfs": 20 * np.log10(np.abs(stem).max() + 1e-12),
        "headroom_guard": guard_info,
        "mix_minus_sfx_vs_voiceover_max_abs": float(resid),
        "cues": placed,
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=1, default=float))
    print(f"preview: {OUT / 'preview-mix.wav'}  ({len(cues)} cues, ref {ref_db:.1f} dBFS, "
          f"mix peak {report['mix_peak_dbfs']:.2f} dBFS, guard {guard_info}, "
          f"mix-sfx-vo residual {resid:.2e})")

    if write_video:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(MASTER), "-i", str(OUT / "preview-mix.wav"),
             "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", str(SR),
             # The master declares 222.800 s; its decoded AAC carries 256 extra samples (5 ms of silence at
             # the end of the end card). Keep the master's duration exactly.
             "-t", master_duration(), "-movflags", "+faststart", str(DERIVATIVE)],
            check=True,
        )
        print(f"video: {DERIVATIVE}")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode not in {"preview", "video"}:
        sys.exit("usage: build.py preview|video")
    build(write_video=mode == "video")
