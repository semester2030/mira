#!/usr/bin/env python3
"""Generate luxury fashion catalog PNGs for MIRA recommendation cards."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "fashion"
SIZE = (280, 360)


def _hex(color: str) -> tuple[int, int, int]:
    c = color.lstrip("#")
    return tuple(int(c[i : i + 2], 16) for i in (0, 2, 4))


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _shade(base: tuple[int, int, int], delta: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, int(v + delta * 255))) for v in base)


def _canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", SIZE, (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    # soft studio backdrop
    for y in range(SIZE[1]):
        t = y / SIZE[1]
        c = (
            _lerp(252, 245, t),
            _lerp(252, 246, t),
            _lerp(255, 250, t),
            255,
        )
        draw.line([(0, y), (SIZE[0], y)], fill=c)
    return img, draw


def _shadow(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) // 2
    cy = y1 + 8
    draw.ellipse([cx - 70, cy - 8, cx + 70, cy + 18], fill=(0, 0, 0, 28))


def _save(img: Image.Image, rel: str) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, quality=92)


def draw_blazer(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (70, 90, 210, 280))
    body = [(78, 88), (202, 88), (214, 290), (66, 290)]
    draw.polygon(body, fill=base)
    draw.polygon(body, outline=_shade(base, -0.18))
    draw.polygon([(140, 88), (108, 170), (140, 155)], fill=_shade(base, 0.08))
    draw.polygon([(140, 88), (172, 170), (140, 155)], fill=_shade(base, 0.04))
    draw.ellipse([132, 178, 148, 194], fill=_shade(base, -0.25))
    _save(img, path)


def draw_top(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (80, 110, 200, 250))
    draw.polygon([(95, 105), (185, 105), (198, 250), (82, 250)], fill=base)
    draw.arc([95, 95, 185, 145], 200, 340, fill=_shade(base, -0.15), width=3)
    draw.line([(140, 105), (140, 250)], fill=_shade(base, -0.1), width=2)
    _save(img, path)


def draw_skirt(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (70, 150, 210, 300))
    draw.polygon([(95, 145), (185, 145), (220, 305), (60, 305)], fill=base)
    for i in range(6):
        x = 95 + i * 18
        draw.line([(x, 145), (x + 8, 305)], fill=_shade(base, -0.06), width=2)
    _save(img, path)


def draw_trousers(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (80, 140, 200, 310))
    draw.polygon([(95, 135), (185, 135), (190, 190), (150, 310), (130, 310), (90, 190)], fill=base)
    draw.line([(140, 135), (140, 310)], fill=_shade(base, -0.12), width=2)
    _save(img, path)


def draw_cape(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (50, 100, 230, 290))
    draw.polygon([(140, 85), (55, 120), (35, 300), (245, 300), (225, 120)], fill=base)
    draw.arc([110, 80, 170, 130], 200, 340, fill=_shade(base, -0.12), width=3)
    _save(img, path)


def draw_cardigan(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (70, 95, 210, 285))
    draw.rounded_rectangle([72, 92, 208, 285], radius=18, fill=base)
    for x in (108, 140, 172):
        draw.line([(x, 110), (x, 270)], fill=_shade(base, -0.08), width=3)
    _save(img, path)


def draw_shawl(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (60, 120, 220, 280))
    draw.polygon([(60, 130), (220, 150), (200, 280), (80, 260)], fill=base)
    draw.line([(60, 130), (220, 150)], fill=_shade(base, -0.1), width=4)
    _save(img, path)


def draw_bag(path: str, color: str, clutch: bool = False) -> None:
    img, draw = _canvas()
    base = _hex(color)
    if clutch:
        _shadow(draw, (85, 150, 195, 230))
        draw.rounded_rectangle([88, 155, 192, 225], radius=14, fill=base)
        draw.arc([118, 130, 162, 165], 200, 340, fill=_shade(base, -0.2), width=4)
    else:
        _shadow(draw, (75, 130, 205, 260))
        draw.rounded_rectangle([82, 145, 198, 255], radius=20, fill=base)
        draw.arc([108, 105, 172, 155], 200, 340, fill=_shade(base, -0.25), width=5)
        if "tote" in path:
            draw.rectangle([82, 145, 198, 165], fill=_shade(base, -0.08))
    _save(img, path)


def draw_heels(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (70, 180, 210, 290))
    # left shoe
    draw.polygon([(75, 220), (130, 220), (145, 255), (70, 255)], fill=base)
    draw.polygon([(130, 220), (130, 175), (138, 175), (145, 255)], fill=_shade(base, -0.12))
    # right shoe
    draw.polygon([(150, 225), (205, 225), (220, 260), (145, 260)], fill=base)
    draw.polygon([(205, 225), (205, 180), (213, 180), (220, 260)], fill=_shade(base, -0.12))
    _save(img, path)


def draw_pearls(path: str) -> None:
    img, draw = _canvas()
    _shadow(draw, (90, 150, 190, 210))
    for i, x in enumerate(range(108, 173, 16)):
        y = 168 + (i % 2) * 6
        draw.ellipse([x, y, x + 14, y + 14], fill=(245, 240, 232))
        draw.ellipse([x + 3, y + 2, x + 9, y + 8], fill=(255, 255, 255, 180))
    draw.line([(115, 175), (165, 175)], fill=(200, 190, 170), width=2)
    _save(img, path)


def draw_necklace(path: str) -> None:
    img, draw = _canvas()
    _shadow(draw, (80, 160, 200, 230))
    draw.arc([90, 130, 190, 230], 200, 340, fill=(180, 180, 190), width=4)
    draw.ellipse([132, 198, 148, 214], fill=(210, 210, 220))
    for x in (108, 124, 156, 172):
        draw.ellipse([x, 176, x + 8, x + 8 if False else 184], fill=(190, 190, 200))
    _save(img, path)


def draw_bracelet(path: str) -> None:
    img, draw = _canvas()
    _shadow(draw, (70, 170, 210, 230))
    draw.arc([85, 165, 195, 235], 30, 150, fill=(210, 210, 225), width=10)
    for a in range(0, 120, 15):
        rad = math.radians(30 + a)
        cx = 140 + int(52 * math.cos(rad))
        cy = 200 + int(28 * math.sin(rad))
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 255, 255))
    _save(img, path)


def draw_scarf(path: str, color: str) -> None:
    img, draw = _canvas()
    base = _hex(color)
    _shadow(draw, (60, 130, 220, 290))
    draw.polygon([(120, 95), (170, 110), (150, 300), (90, 280)], fill=base)
    draw.polygon([(120, 95), (95, 280), (110, 290), (130, 120)], fill=_shade(base, -0.06))
    _save(img, path)


def draw_watch(path: str) -> None:
    img, draw = _canvas()
    _shadow(draw, (95, 150, 185, 230))
    draw.rounded_rectangle([108, 165, 172, 215], radius=16, fill=(201, 169, 98))
    draw.ellipse([118, 175, 162, 205], fill=(250, 248, 242))
    draw.line([(140, 185), (140, 178)], fill=(40, 40, 40), width=2)
    draw.line([(140, 185), (152, 192)], fill=(40, 40, 40), width=2)
    draw.rectangle([130, 155, 150, 165], fill=(180, 150, 80))
    _save(img, path)


def draw_sunglasses(path: str) -> None:
    img, draw = _canvas()
    _shadow(draw, (70, 170, 210, 220))
    draw.rounded_rectangle([78, 175, 128, 210], radius=12, fill=(60, 40, 28, 220))
    draw.rounded_rectangle([152, 175, 202, 210], radius=12, fill=(60, 40, 28, 220))
    draw.line([(128, 190), (152, 190)], fill=(50, 35, 25), width=4)
    draw.line([(78, 190), (58, 182)], fill=(50, 35, 25), width=3)
    _save(img, path)


def main() -> None:
    draw_blazer("tops/blazer_beige.png", "#D4C4A8")
    draw_top("tops/corset_cream.png", "#F5E6D3")
    draw_top("tops/satin_top_black.png", "#1A1A1A")
    draw_skirt("bottoms/skirt_silk_beige.png", "#E8DCC8")
    draw_trousers("bottoms/trousers_navy.png", "#1E2A4A")
    draw_skirt("bottoms/skirt_classic_black.png", "#141414")
    draw_cape("outerwear/cape_elegant_ivory.png", "#F7F2EA")
    draw_cardigan("outerwear/cardigan_soft_gray.png", "#C8C4BE")
    draw_shawl("outerwear/shawl_wedding.png", "#EDE4F0")
    draw_bag("bags/clutch_silver.png", "#C0C0C8", clutch=True)
    draw_bag("bags/bag_black_leather.png", "#1C1C1C")
    draw_bag("bags/tote_casual_beige.png", "#D9CDB8")
    draw_heels("heels/heels_nude.png", "#E3C4A8")
    draw_heels("heels/heels_black.png", "#111111")
    draw_pearls("jewelry/pearl_earrings.png")
    draw_necklace("jewelry/silver_necklace.png")
    draw_bracelet("jewelry/diamond_bracelet.png")
    draw_scarf("scarves/silk_scarf_beige.png", "#E5D5BC")
    draw_watch("jewelry/watch_gold.png")
    draw_sunglasses("jewelry/sunglasses_tortoise.png")
    print(f"Generated fashion assets under {OUT}")


if __name__ == "__main__":
    main()
