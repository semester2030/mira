#!/usr/bin/env python3
"""Build launcher icons and polished transparent logos from Mira emblem source."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
SRC_ICON = ASSETS / "mira_logo_icon.png"
SRC_FULL = ASSETS / "mira_logo_full.png"

BG = (255, 247, 250, 255)  # AppColors.background
PINK = (232, 111, 169, 255)  # AppColors.primary


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
                px[x, y] = (r, g, b, 0)
                continue
            if r > 160 and g > 160 and b > 160:
                if abs(r - g) < 22 and abs(g - b) < 22:
                    px[x, y] = (r, g, b, 0)
    return img


def _trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def _fit_square_canvas(
    emblem: Image.Image,
    size: int,
    *,
    bg: tuple[int, int, int, int] | None = None,
    padding_ratio: float = 0.14,
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    pad = int(size * padding_ratio)
    inner = size - pad * 2
    emblem = emblem.copy()
    emblem.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - emblem.width) // 2
    y = (size - emblem.height) // 2
    canvas.paste(emblem, (x, y), emblem)
    return canvas


def _radial_bg(size: int) -> Image.Image:
    base = Image.new("RGBA", (size, size), BG)
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = overlay.load()
    cx = cy = size / 2
    max_r = size * 0.72
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            t = min(1.0, d / max_r)
            alpha = int(38 * (1 - t))
            px[x, y] = (PINK[0], PINK[1], PINK[2], alpha)
    return Image.alpha_composite(base, overlay)


def main() -> None:
    for src in (SRC_ICON, SRC_FULL):
        if src.exists():
            cleaned = _remove_checkerboard(Image.open(src))
            cleaned.save(src)
            print(f"polished {src.name}")

    icon_src = _trim_alpha(_remove_checkerboard(Image.open(SRC_ICON)))

    # Launcher: 1024 square with soft brand background + emblem
    launcher = _radial_bg(1024)
    emblem = icon_src.copy()
    emblem.thumbnail((720, 720), Image.Resampling.LANCZOS)
    x = (1024 - emblem.width) // 2
    y = (1024 - emblem.height) // 2
    launcher.paste(emblem, (x, y), emblem)
    launcher_rgb = Image.new("RGB", launcher.size, BG[:3])
    launcher_rgb.paste(launcher, mask=launcher.split()[3])
    launcher_rgb.save(ASSETS / "app_icon.png", "PNG", optimize=True)
    print("wrote app_icon.png")

    # Android adaptive foreground — transparent, safe padding
    fg = _fit_square_canvas(icon_src, 1024, bg=None, padding_ratio=0.18)
    fg.save(ASSETS / "app_icon_foreground.png", "PNG", optimize=True)
    print("wrote app_icon_foreground.png")

    # Optional: compact full lockup for in-app (max width)
    full = _trim_alpha(_remove_checkerboard(Image.open(SRC_FULL)))
    max_w = 1200
    if full.width > max_w:
        ratio = max_w / full.width
        full = full.resize((max_w, int(full.height * ratio)), Image.Resampling.LANCZOS)
    full.save(SRC_FULL, "PNG", optimize=True)
    print("wrote mira_logo_full.png")


if __name__ == "__main__":
    main()
