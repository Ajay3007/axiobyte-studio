"""Derive the transparent rendering asset from the canonical AxioByte logo.

Source (canonical, never modified):  assets/axiobyte-logo  (1080x1080 JPEG, supplied)
Output:                              renderers/three/src/brand/assets/axiobyte-logo-transparent.png

The supplied logo is the logo artwork composited over a dark background (a radial dark disc behind
the logo, lighter corners, a faint dot grid). Every logo pixel is P = a*F + (1-a)*B. This script
estimates B, then UN-BLENDS each pixel against it — the standard unpremultiply against a known
background:

    a = max over channels of (P - B) / (255 - B)      (the brightest channel's rise)
    F = B + (P - B) / a

Recomposited over a ground close to B, every pixel returns to its original colour — the A mark, its
two layered echoes, the wordmark, the rule and the tagline exactly as supplied; nothing is redrawn,
recoloured or simplified. Removed: the background (a dark radial disc and lighter corners) and its
grid dots (isolated specks, also where they sit on the echoes) — background treatment, not logo.

Run from the repository root:  python renderers/three/src/brand/assets/extract_logo.py
Deterministic: the same source gives the same PNG, byte for byte.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[5]
SOURCE = ROOT / "assets" / "axiobyte-logo"
OUTPUT = Path(__file__).with_name("axiobyte-logo-transparent.png")

ALPHA_FLOOR = 0.02  # below this, JPEG noise on the background: fully transparent
DOT_MAX_AREA = 40  # a grid dot is a few pixels; the faintest logo layer is tens of thousands
PAD = 8


def main() -> None:
    """Extract the transparent logo from the canonical source and write it next to this script."""
    p = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.float64)
    lum = p.max(axis=2)

    # The background's grid dots — also those that sit on the faint echoes — are isolated specks a
    # little brighter than their surroundings, away from the bright logo and its tagline: replace
    # each with its surroundings before un-blending.
    local = np.stack([ndimage.median_filter(p[..., c], size=9) for c in range(3)], axis=2)
    speck = ((p - local).max(axis=2) > 6) & (local.max(axis=2) < 70)
    labels, n = ndimage.label(speck)
    sizes = ndimage.sum(np.ones_like(lum), labels, index=np.arange(1, n + 1))
    near_logo = ndimage.binary_dilation(lum > 90, iterations=6)
    for i, size in enumerate(sizes, start=1):
        blob = labels == i
        if size <= DOT_MAX_AREA and not (blob & near_logo).any():
            p[blob] = local[blob]
    lum = p.max(axis=2)

    # The background field is radial — a dark disc behind the logo, lighter towards the corners.
    # Per ring (4 px) and per channel, the 10th percentile is the background wherever the logo
    # covers less than nine tenths of the ring (r >= 200 px); inside that, the inner echo fills the
    # rings, and the background is the value at r = 200 (the disc's own, flat out to r ~ 520).
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot(xx - (w - 1) / 2, yy - (h - 1) / 2)
    bins = (r // 4).astype(int)
    nbins = bins.max() + 1
    profile = np.zeros((nbins, 3))
    for i in range(nbins):
        ring = bins == i
        profile[i] = [np.percentile(p[..., c][ring], 10) for c in range(3)]
    inner = 200 // 4
    profile[:inner] = profile[inner]
    profile = ndimage.uniform_filter1d(profile, size=5, axis=0, mode="nearest")
    b = profile[bins]

    # Un-blend: alpha from the brightest channel's rise over the background; the colour by
    # unpremultiplying.
    rise = np.clip(p - b, 0, None)
    alpha = (rise / np.maximum(255 - b, 1)).max(axis=2)
    alpha[alpha < ALPHA_FLOOR] = 0

    # The isolated grid dots: tiny components with nothing logo-sized around them.
    labels, n = ndimage.label(alpha > 0)
    sizes = ndimage.sum(np.ones_like(alpha), labels, index=np.arange(1, n + 1))
    for i, s in enumerate(sizes, start=1):
        if s <= DOT_MAX_AREA:
            alpha[labels == i] = 0

    a = np.maximum(alpha, 1e-6)[..., None]
    f = np.clip(b + rise / a, 0, 255)
    rgba = np.dstack([f, alpha * 255]).round().astype(np.uint8)
    rgba[alpha == 0] = 0

    # Crop to the logo's own extent (every visible pixel), with a small transparent margin.
    ys, xs = np.nonzero(alpha)
    y0, y1 = max(0, ys.min() - PAD), min(rgba.shape[0], ys.max() + PAD + 1)
    x0, x1 = max(0, xs.min() - PAD), min(rgba.shape[1], xs.max() + PAD + 1)
    out = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
    out.save(OUTPUT, optimize=False, compress_level=9)
    name = OUTPUT.relative_to(ROOT)
    print(f"{name}: {out.width}x{out.height}, crop x {x0}-{x1} y {y0}-{y1} of the source")


if __name__ == "__main__":
    main()
