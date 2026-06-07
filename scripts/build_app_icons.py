#!/usr/bin/env python3
"""Build high-quality Mira launcher icons — emblem only, no text (readable at 60×60)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
SRC_FULL = ASSETS / "mira_logo_full.png"

BG = (255, 247, 250, 255)  # AppColors.background
PINK = (232, 111, 169, 255)  # AppColors.primary
GOLD = (212, 175, 55, 255)

# Emblem ends ~y=452; MIRA wordmark starts ~y=465
EMBLEM_BOTTOM_Y = 452
SUPERSAMPLE = 2


def _remove_checkerboard(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 235 and g > 235 and b > 235:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 155 and g > 155 and b > 155:
                if abs(r - g) < 24 and abs(g - b) < 24:
                    px[x, y] = (0, 0, 0, 0)
    return img


def _trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def _extract_emblem(full: Image.Image) -> Image.Image:
    """Crop circular emblem only — exclude MIRA wordmark and tagline."""
    top = full.crop((0, 0, full.width, EMBLEM_BOTTOM_Y))
    top = _remove_checkerboard(top)
    px = top.load()
    w, h = top.size
    # Drop faint vertical artifacts on the far right of the source PNG.
    for y in range(h):
        for x in range(int(w * 0.84), w):
            r, g, b, a = px[x, y]
            if a < 180:
                px[x, y] = (0, 0, 0, 0)
    # Remove stray white JPEG noise (keeps metallic highlights on dress).
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            if r > 245 and g > 245 and b > 245:
                px[x, y] = (0, 0, 0, 0)
    return _trim_alpha(top)


def _radial_bg(size: int) -> Image.Image:
    base = Image.new("RGBA", (size, size), BG)
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = overlay.load()
    cx = cy = size / 2
    max_r = size * 0.78
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            t = min(1.0, d / max_r)
            alpha = int(52 * (1 - t))
            px[x, y] = (PINK[0], PINK[1], PINK[2], alpha)
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ring)
    inset = int(size * 0.06)
    draw.ellipse(
        (inset, inset, size - inset, size - inset),
        outline=(GOLD[0], GOLD[1], GOLD[2], 28),
        width=max(2, size // 256),
    )
    out = Image.alpha_composite(base, overlay)
    return Image.alpha_composite(out, ring)


def _paste_emblem(
    canvas: Image.Image,
    emblem: Image.Image,
    *,
    width_ratio: float = 0.86,
) -> Image.Image:
    """Scale emblem by width so the wide lockup reads clearly on home screen."""
    size = canvas.width
    target_w = int(size * width_ratio)
    w, h = emblem.size
    scale = target_w / w
    new_w = target_w
    new_h = max(1, int(h * scale))
    em = emblem.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas = canvas.copy()
    canvas.paste(em, (x, y), em)
    return canvas


def _fit_foreground(emblem: Image.Image, size: int, width_ratio: float = 0.72) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target_w = int(size * width_ratio)
    w, h = emblem.size
    scale = target_w / w
    new_w = target_w
    new_h = max(1, int(h * scale))
    em = emblem.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(em, (x, y), em)
    return canvas


def _supersample_build(build_fn, out_size: int) -> Image.Image:
    big = build_fn(out_size * SUPERSAMPLE)
    return big.resize((out_size, out_size), Image.Resampling.LANCZOS)


def main() -> None:
    if not SRC_FULL.exists():
        raise FileNotFoundError(f"Missing {SRC_FULL}")

    full = _remove_checkerboard(Image.open(SRC_FULL))
    emblem = _extract_emblem(full)
    emblem.save(ASSETS / "mira_logo_icon.png", "PNG", optimize=True)
    print(f"wrote mira_logo_icon.png {emblem.size}")

    def build_launcher(sz: int) -> Image.Image:
        base = _radial_bg(sz)
        return _paste_emblem(base, emblem, width_ratio=0.86)

    launcher = _supersample_build(build_launcher, 1024)
    launcher_rgb = Image.new("RGB", launcher.size, BG[:3])
    launcher_rgb.paste(launcher, mask=launcher.split()[3])
    launcher_rgb.save(ASSETS / "app_icon.png", "PNG", optimize=True)
    print("wrote app_icon.png 1024×1024 (emblem only)")

    fg = _supersample_build(lambda sz: _fit_foreground(emblem, sz, 0.72), 1024)
    fg.save(ASSETS / "app_icon_foreground.png", "PNG", optimize=True)
    print("wrote app_icon_foreground.png (Android adaptive)")


if __name__ == "__main__":
    main()
