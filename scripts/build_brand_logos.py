#!/usr/bin/env python3
"""Rebuild Mira logos from scratch: emblem + single Arabic tagline only."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
ICON_OUT = ASSETS / "mira_logo_icon.png"
FULL_OUT = ASSETS / "mira_logo_full.png"
EMBLEM_SOURCE = ASSETS / "app_icon_foreground.png"

# Sync with lib/core/constants/brand_copy.dart
TAGLINE_AR = "ميرا… ذكاءٌ يُبرز جمالكِ"
TAGLINE_COLOR = (193, 140, 90, 255)
RENDER_SCALE = 2  # supersample for sharper text & edges


def _reshape_ar(text: str) -> str:
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        return get_display(arabic_reshaper.reshape(text))
    except ImportError:
        return text


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/SFArabic.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Geeza Pro.ttc",
    ):
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size=size)
            except OSError:
                pass
    return ImageFont.load_default()


def _trim_alpha(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def _load_emblem() -> Image.Image:
    if not EMBLEM_SOURCE.exists():
        raise FileNotFoundError(f"Missing emblem source: {EMBLEM_SOURCE}")
    return _trim_alpha(Image.open(EMBLEM_SOURCE).convert("RGBA"))


def _downscale(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    ratio = max_side / max(w, h)
    nw, nh = int(w * ratio), int(h * ratio)
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def _build_icon(emblem: Image.Image) -> Image.Image:
    e = emblem.copy()
    e.thumbnail((512 * RENDER_SCALE, 512 * RENDER_SCALE), Image.Resampling.LANCZOS)
    return _downscale(_trim_alpha(e), 512)


def _build_full(emblem: Image.Image) -> Image.Image:
    s = RENDER_SCALE
    pad_x, gap, pad_top, pad_bottom = 40 * s, 24 * s, 32 * s, 36 * s
    emblem_max = 360 * s

    emblem = emblem.copy()
    emblem.thumbnail((emblem_max, emblem_max), Image.Resampling.LANCZOS)

    tagline = _reshape_ar(TAGLINE_AR)
    font = _font(38 * s)
    measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    tb = measure.textbbox((0, 0), tagline, font=font)
    text_w = tb[2] - tb[0]
    text_h = tb[3] - tb[1]

    w = max(emblem.width, text_w) + pad_x * 2
    h = pad_top + emblem.height + gap + text_h + pad_bottom
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    ex = (w - emblem.width) // 2
    canvas.paste(emblem, (ex, pad_top), emblem)

    draw = ImageDraw.Draw(canvas)
    ty = pad_top + emblem.height + gap
    tx = (w - text_w) // 2
    draw.text((tx, ty), tagline, font=font, fill=TAGLINE_COLOR)

    trimmed = _trim_alpha(canvas)
    # Export ~2× Flutter display size for crisp scaling
    return _downscale(trimmed, 720)


def main() -> None:
    for p in (ICON_OUT, FULL_OUT):
        if p.exists():
            p.unlink()
            print(f"removed {p.name}")

    emblem = _load_emblem()
    icon = _build_icon(emblem)
    full = _build_full(emblem)

    icon.save(ICON_OUT, "PNG", optimize=True)
    full.save(FULL_OUT, "PNG", optimize=True)
    print(f"wrote {ICON_OUT.name} {icon.size}")
    print(f"wrote {FULL_OUT.name} {full.size} — tagline: {TAGLINE_AR!r}")


if __name__ == "__main__":
    main()
