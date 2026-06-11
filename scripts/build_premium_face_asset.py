#!/usr/bin/env python3
"""Process raw face render → transparent 1200×1680 PNG for MIRA face map."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "premium_face_base.png"
TARGET_W, TARGET_H = 1200, 1680


def _is_magenta(r: int, g: int, b: int) -> bool:
    return (r > 110 and b > 110 and g < 130 and (r - g) > 35 and (b - g) > 35) or (
        r > 190 and b > 170 and g < 95
    )


def _flood_clear_background(img: Image.Image) -> Image.Image:
    """Remove solid backdrop connected to image edges."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    seeds = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ]
    for x, y in seeds:
        r, g, b, a = rgba.getpixel((x, y))
        if a == 0:
            continue
        if _is_magenta(r, g, b) or (r > 230 and g > 230 and b > 230):
            ImageDraw.floodfill(rgba, (x, y), (0, 0, 0, 0), thresh=48)
    return rgba


def _chroma_clear(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if _is_magenta(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return rgba


def _despill_magenta(img: Image.Image) -> Image.Image:
    """Remove magenta halos left on hair / skin edges."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            spill = r > 125 and b > 125 and g < 125 and (r - g) > 30 and (b - g) > 30
            if not spill:
                continue
            # Pull spill toward natural dark hair / transparent.
            nr = int(r * 0.22)
            ng = int(g * 0.18)
            nb = int(b * 0.20)
            na = max(0, a - 80) if (r + b) > 280 else max(0, a - 40)
            px[x, y] = (nr, ng, nb, na)
    return rgba


def _trim_transparent(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def _fit_canvas(img: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    scale = min(width / img.width, height / img.height) * 0.96
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = (width - new_w) // 2
    y = int(height * 0.02)
    canvas.paste(resized, (x, y), resized)
    return canvas


def build(src: Path) -> Path:
    raw = Image.open(src)
    cut = _flood_clear_background(raw)
    cut = _chroma_clear(cut)
    cut = _despill_magenta(cut)
    trimmed = _trim_transparent(cut)
    final = _fit_canvas(trimmed, TARGET_W, TARGET_H)
    final = _despill_magenta(final)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT, "PNG", optimize=True)
    print(f"Saved {OUT} ({final.size[0]}×{final.size[1]})")
    return OUT


if __name__ == "__main__":
    source = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else ROOT / "assets" / "images" / "premium_face_base_raw.png"
    )
    build(source)
