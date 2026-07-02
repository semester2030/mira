#!/usr/bin/env python3
"""Generate professional fashion color catalog with LAB/HSV for Delta-E matching."""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "fashion" / "colors.json"

# (id_suffix, name_en_suffix, name_ar_suffix, lightness 0-100, saturation 0-100)
SHADE_STEPS = [
    ("pale", "pale", "فاتح جداً", 88, None),
    ("light", "light", "فاتح", 76, None),
    ("soft", "soft", "ناعم", 66, None),
    ("mid", "medium", "متوسط", 54, None),
    ("deep", "deep", "غامق", 42, None),
    ("dark", "dark", "غامق جداً", 28, None),
]

# hue_deg, base_en, base_ar, sat_scale (None = neutral)
HUE_FAMILIES = [
    (0, "red", "أحمر", 72),
    (12, "rust", "صدأ", 65),
    (22, "terracotta", "تراكوتا", 58),
    (32, "orange", "برتقالي", 78),
    (42, "amber", "كهرماني", 82),
    (48, "gold", "ذهبي", 68),
    (55, "yellow", "أصفر", 75),
    (68, "lime", "ليموني", 62),
    (85, "olive", "زيتوني", 48),
    (100, "sage", "مريمي", 38),
    (125, "green", "أخضر", 52),
    (145, "emerald", "زمردي", 58),
    (165, "teal", "تركواز", 52),
    (185, "cyan", "سماوي", 55),
    (200, "sky", "سماوي فاتح", 48),
    (215, "azure", "أزرق سماوي", 55),
    (225, "blue", "أزرق", 62),
    (240, "cobalt", "كوبالت", 58),
    (255, "navy", "كحلي", 48),
    (275, "indigo", "نيلي", 52),
    (290, "purple", "بنفسجي", 55),
    (310, "plum", "برقوقي", 48),
    (325, "magenta", "أرجواني", 58),
    (345, "rose", "وردي", 52),
    (355, "pink", "زهري", 45),
    (15, "coral", "مرجاني", 62),
    (30, "peach", "خوخي", 55),
    (38, "nude", "نود", 28),
    (35, "beige", "بيج", 22),
    (40, "camel", "جملي", 38),
    (28, "brown", "بني", 42),
    (20, "chocolate", "شوكولاتي", 35),
    (330, "blush", "وردي محايد", 38),
    (300, "lavender", "لافندر", 35),
    (280, "lilac", "ليلكي", 32),
    (0, "burgundy", "نبيتي", 42),
    (350, "wine", "خمري", 48),
]

NEUTRALS = [
    ("black_pure", "black", "أسود", 8, 0, 0),
    ("black_soft", "soft black", "أسود ناعم", 16, 0, 0),
    ("charcoal", "charcoal", "فحمي", 24, 0, 0),
    ("gray_dark", "dark gray", "رمادي غامق", 34, 0, 0),
    ("gray_mid", "gray", "رمادي", 52, 0, 0),
    ("gray_light", "light gray", "رمادي فاتح", 72, 0, 0),
    ("silver", "silver", "فضي", 78, 0, 0),
    ("white_pure", "white", "أبيض", 98, 0, 0),
    ("ivory", "ivory", "عاجي", 94, 38, 12),
    ("cream", "cream", "كريمي", 92, 42, 18),
    ("pearl", "pearl", "لؤلؤي", 95, 35, 8),
    ("off_white", "off white", "أبيض عاجي", 90, 30, 10),
]


def srgb_to_linear(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_lab(r: int, g: int, b: int) -> list[float]:
    rl, gl, bl = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
    y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
    z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t) + (16 / 116)

    xn, yn, zn = 0.95047, 1.0, 1.08883
    fx, fy, fz = f(x / xn), f(y / yn), f(z / zn)
    l = (116 * fy) - 16
    a = 500 * (fx - fy)
    bb = 200 * (fy - fz)
    return [round(l, 1), round(a, 1), round(bb, 1)]


def hsl_to_rgb(h: float, s: float, l: float) -> tuple[int, int, int]:
    s /= 100
    l /= 100
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        rp, gp, bp = c, x, 0
    elif h < 120:
        rp, gp, bp = x, c, 0
    elif h < 180:
        rp, gp, bp = 0, c, x
    elif h < 240:
        rp, gp, bp = 0, x, c
    elif h < 300:
        rp, gp, bp = x, 0, c
    else:
        rp, gp, bp = c, 0, x
    return (
        int(round((rp + m) * 255)),
        int(round((gp + m) * 255)),
        int(round((bp + m) * 255)),
    )


def rgb_to_hsv(r: int, g: int, b: int) -> list[int]:
    r_, g_, b_ = r / 255, g / 255, b / 255
    mx, mn = max(r_, g_, b_), min(r_, g_, b_)
    d = mx - mn
    if d == 0:
        h = 0
    elif mx == r_:
        h = 60 * (((g_ - b_) / d) % 6)
    elif mx == g_:
        h = 60 * (((b_ - r_) / d) + 2)
    else:
        h = 60 * (((r_ - g_) / d) + 4)
    s = 0 if mx == 0 else int(round(d / mx * 100))
    v = int(round(mx * 100))
    return [int(round(h)) % 360, s, v]


def make_entry(
    cid: str,
    name: str,
    name_ar: str,
    r: int,
    g: int,
    b: int,
) -> dict:
    hexv = f"#{r:02X}{g:02X}{b:02X}"
    return {
        "name": name,
        "nameAr": name_ar,
        "hex": hexv,
        "lab": rgb_to_lab(r, g, b),
        "hsv": rgb_to_hsv(r, g, b),
    }


def build_catalog() -> dict[str, dict]:
    colors: dict[str, dict] = {}

    for cid, name, name_ar, l, h, s in NEUTRALS:
        if s == 0:
            gray = int(round(l / 100 * 255))
            r = g = b = gray
        else:
            r, g, b = hsl_to_rgb(h, s, l)
        colors[cid] = make_entry(cid, name, name_ar, r, g, b)

    for hue, base_en, base_ar, sat in HUE_FAMILIES:
        for suffix_en, name_en_s, name_ar_s, light, _ in SHADE_STEPS:
            sat_adj = max(12, min(92, sat + (54 - light) // 8))
            r, g, b = hsl_to_rgb(hue, sat_adj, light)
            cid = f"{base_en}_{suffix_en}"
            name = f"{base_en} {name_en_s}".strip()
            name_ar = f"{base_ar} {name_ar_s}".strip()
            if cid in colors:
                continue
            colors[cid] = make_entry(cid, name, name_ar, r, g, b)

    # Legacy ids used across app — keep stable aliases
    legacy = {
        "beige_linen": "beige_soft",
        "cream_soft": "cream",
        "navy_deep": "navy_deep",
        "ivory_warm": "ivory",
        "gray_soft": "gray_light",
        "silver_metal": "silver",
        "gold_warm": "gold_mid",
        "nude_heel": "nude_soft",
        "pearl_white": "pearl",
        "brown_tortoise": "brown_deep",
        "blush_lilac": "blush_soft",
        "emerald_deep": "emerald_deep",
        "teal_satin": "teal_deep",
        "forest_green": "green_deep",
        "ruby_red": "burgundy_deep",
    }
    for old_id, new_id in legacy.items():
        if new_id in colors:
            colors[old_id] = dict(colors[new_id])

    return colors


def main() -> None:
    colors = build_catalog()
    payload = {"version": 2, "colors": colors}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Wrote {len(colors)} colors → {OUT}")


if __name__ == "__main__":
    main()
