#!/usr/bin/env python3
"""Recreate the OpenRouter composed banner.

Builds a 2400x1200 dark banner from OpenRouter's official white horizontal
wordmark SVG (wordmark-cloud.svg) plus a generated geometric motif, a radial
purple glow and a vertical vignette. Rasterises with rsvg-convert when asked.

Usage:
    python3 compose.py
    python3 compose.py --png ../../companies/openrouter/images/composed_banner.png

The only third-party asset is wordmark-cloud.svg, downloaded from:
    https://openrouter.ai/brand/logos/transparent/horizontal/svg/horizontal-cloud.svg
Everything else (background, motif, gradients, layout) is generated here.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORDMARK = HERE / "wordmark-cloud.svg"

# --- design tokens: edit these to iterate ---
WIDTH, HEIGHT = 2400, 1200
BACKGROUND = "#0A0A0C"
SHAPE_STROKE = "#2C2C35"
SHAPE_OPACITY = 0.7
CELL = 140  # grid spacing between shape centres
SHAPE = 78  # square/triangle size and circle diameter
STROKE_WIDTH = 2.4
GLOW_COLOR = "#7C3AED"  # approximate OpenRouter "grape"
GLOW_OPACITY = 0.38
WORDMARK_WIDTH = 980  # rendered width of the wordmark, in px
DEFAULT_SVG = HERE / "openrouter-composed-banner.svg"


def read_viewbox(svg: str) -> tuple[float, float]:
    match = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    if not match:
        raise ValueError(f"no viewBox found in {WORDMARK}")
    return float(match.group(1)), float(match.group(2))


def wordmark_inner() -> tuple[str, float, float]:
    svg = WORDMARK.read_text(encoding="utf-8")
    vb_w, vb_h = read_viewbox(svg)
    inner = re.sub(r"^<svg[^>]*>", "", svg).strip()
    inner = re.sub(r"</svg>\s*$", "", inner).strip()
    return inner, vb_w, vb_h


def motif() -> str:
    """Grid of outlined circles/squares/triangles; shape chosen by (r*5+c*3)%3."""
    half = SHAPE / 2
    shapes: list[str] = []
    rows = range(-CELL, HEIGHT + CELL, CELL)
    cols = range(-CELL, WIDTH + CELL, CELL)
    for r, row in enumerate(rows):
        offset = CELL / 2 if r % 2 else 0
        for c, col in enumerate(cols):
            cx = col + offset
            cy = row
            kind = (r * 5 + c * 3) % 3
            if kind == 0:
                shapes.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{half:.0f}"/>')
            elif kind == 1:
                shapes.append(
                    f'<rect x="{cx - half:.0f}" y="{cy - half:.0f}" '
                    f'width="{SHAPE}" height="{SHAPE}"/>'
                )
            else:
                shapes.append(
                    f'<path d="M{cx:.0f} {cy - half:.0f} '
                    f'L{cx - half:.0f} {cy + half:.0f} '
                    f'L{cx + half:.0f} {cy + half:.0f} Z"/>'
                )
    return (
        f'<g fill="none" stroke="{SHAPE_STROKE}" '
        f'stroke-width="{STROKE_WIDTH}" opacity="{SHAPE_OPACITY}">'
        + "".join(shapes)
        + "</g>"
    )


def build() -> str:
    inner, vb_w, vb_h = wordmark_inner()
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" '
        f'height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        "<defs>"
        '<radialGradient id="glow" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0%" stop-color="{GLOW_COLOR}" stop-opacity="{GLOW_OPACITY}"/>'
        '<stop offset="42%" stop-color="#5B21B6" stop-opacity="0.13"/>'
        f'<stop offset="100%" stop-color="{BACKGROUND}" stop-opacity="0"/>'
        "</radialGradient>"
        '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="{BACKGROUND}" stop-opacity="0.9"/>'
        f'<stop offset="30%" stop-color="{BACKGROUND}" stop-opacity="0"/>'
        f'<stop offset="70%" stop-color="{BACKGROUND}" stop-opacity="0"/>'
        f'<stop offset="100%" stop-color="{BACKGROUND}" stop-opacity="0.9"/>'
        "</linearGradient>"
        "</defs>",
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{BACKGROUND}"/>',
        motif(),
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#glow)"/>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#fade)"/>',
    ]
    scale = WORDMARK_WIDTH / vb_w
    tx = (WIDTH - WORDMARK_WIDTH) / 2
    ty = (HEIGHT - vb_h * scale) / 2
    parts.append(
        f'<g transform="translate({tx:.1f},{ty:.1f}) scale({scale:.4f})">{inner}</g>'
    )
    parts.append("</svg>")
    return "\n".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose the OpenRouter banner.")
    parser.add_argument("--out-svg", type=Path, default=DEFAULT_SVG)
    parser.add_argument(
        "--png",
        type=Path,
        default=None,
        help="Also rasterise to this PNG path (requires rsvg-convert).",
    )
    args = parser.parse_args()

    args.out_svg.write_text(build(), encoding="utf-8")
    print(f"wrote {args.out_svg}")

    if args.png:
        rsvg = shutil.which("rsvg-convert")
        if not rsvg:
            print("rsvg-convert not found; skipping PNG", file=sys.stderr)
            return 1
        subprocess.run(
            [rsvg, "-w", str(WIDTH), "-h", str(HEIGHT), str(args.out_svg), "-o", str(args.png)],
            check=True,
        )
        print(f"wrote {args.png}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
