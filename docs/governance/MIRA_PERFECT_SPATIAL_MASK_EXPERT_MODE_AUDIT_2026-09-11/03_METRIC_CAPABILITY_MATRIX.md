# 03 — Metric Capability Matrix (CURRENT MIRA EVIDENCE)

Legend for **CURRENT KNOWN CONTRACT** (what MIRA code + documented observed responses prove):

| Code | Meaning |
|------|---------|
| SCORE_ONLY | Global `ui_score` only |
| REGION_SCORE | Per-zone scores from Perfect |
| MASK_IMAGE | Provider mask asset |
| OVERLAY_IMAGE | Provider overlay asset |
| HEATMAP | Heatmap field |
| PER_PIXEL_RAW_DATA | Per-pixel raw skin data |
| UNKNOWN | Not proven either way for Perfect’s full catalog |

**Important:** “Documented somewhere at Perfect” ≠ “MIRA entitled” ≠ “MIRA uses”.

## Default `dst_actions` (MIRA requests)

`wrinkle, pore, texture, acne, moisture, oiliness, redness, age_spot`

| Concern | MIRA id | CURRENT CONTRACT (proven) | Docs say feature exists | Account entitled | Code uses spatial output |
|---------|---------|---------------------------|-------------------------|------------------|--------------------------|
| Pigmentation / age spots | `age_spot` | **SCORE_ONLY** | UNKNOWN (not in MIRA docs as mask) | **NOT PROVEN** | NO |
| Pores | `pore` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |
| Wrinkles | `wrinkle` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |
| Texture | `texture` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |
| Acne | `acne` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |
| Redness | `redness` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |
| Hydration | `moisture` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |
| Sebum / oil | `oiliness` | **SCORE_ONLY** | UNKNOWN | **NOT PROVEN** | NO |

## Related but not in default request

| Concern | Status |
|---------|--------|
| Dark circles (`dark_circle`) | Mapper *can* normalize if present; **not** in default `dst_actions` → **SCORE_ONLY if returned, else unavailable**. Spatial: **NOT PROVEN**. |
| Radiance / firmness / eye_bag | Appear in mocks / intelligence models; **not** proven as Perfect S2S `dst_actions` for MIRA. |

## Desired-experience classification (section 10)

| Metric | Class for *desired* pixel map |
|--------|-------------------------------|
| All eight default concerns | **D — SCORE_ONLY** (proven today) |
| Whether Perfect *can* supply A/B with upgrade | **E — UNKNOWN** until Perfect answers + optional owner-approved acceptance |

Do **not** visualize D/E as true localization.
