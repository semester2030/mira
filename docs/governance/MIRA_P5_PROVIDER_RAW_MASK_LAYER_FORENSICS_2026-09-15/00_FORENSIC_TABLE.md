# Forensic table — Face Explorer (Skin Interactive Report)

Authority: code render tree of `ResultsSkinMapPanel` + inventory 2026-09-12.
Legacy `BeautyReportFaceMap` / `WrinkleLinePainter` / landmark polygons are **NOT** in this tree.

| Metric | Perfect Raw Mask | output_mask_name | Current MIRA Source | Perfect Pixels | Polygon | Landmark | Generated Lines | Surface Tint | Verdict |
|--------|------------------|------------------|---------------------|----------------|---------|----------|-----------------|--------------|---------|
| hd_age_spot | YES (PNG 1200×1680) | often null; mask_urls YES | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_pore (+subregions) | YES | e.g. hd_pore_output_* | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_wrinkle (+subregions) | YES | e.g. hd_wrinkle_output_* | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_redness | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_texture | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_acne | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_moisture | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_oiliness | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_radiance | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_dark_circle | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_eye_bag | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_droopy_upper_eyelid | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_droopy_lower_eyelid | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_firmness | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_tear_trough | YES | mask_urls | PerfectMaskOverlay | YES | NO | NO | NO | NO* | PERFECT_RAW_ONLY |
| hd_skin_type | YES (zone) | separateComponent | not Face Explorer overlay | — | — | — | — | — | SCORE_ONLY / separate |
| all / skin_age | NO | — | none | NO | NO | NO | NO | NO | SCORE_ONLY |

\*Before cleanup: `standard.softPresence` double-paint + chrome `#0A0A0B`. After: softPresence=0, chrome `#000000`.

## Contour / line sources (Face Explorer)

| Artifact | PerfectMaskOverlay? | MIRA Path in Face Explorer? | Verdict |
|----------|---------------------|----------------------------|---------|
| Texture giant contours | YES | NO | **PERFECT** |
| Radiance face oval | YES | NO | **PERFECT** |
| Firmness horizontal lines | YES | NO | **PERFECT** |
| Tear-trough curves | YES | NO | **PERFECT** |
| Eyelid outlines | YES | NO | **PERFECT** |

No second analysis. Contours that look “manual” are Perfect PNG pixels (or prior softPresence), not MIRA `drawPath` concern layers.
