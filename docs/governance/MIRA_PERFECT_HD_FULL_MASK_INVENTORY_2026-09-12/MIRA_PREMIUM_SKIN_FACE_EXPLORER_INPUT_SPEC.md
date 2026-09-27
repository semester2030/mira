# MIRA Premium Skin Face Explorer — Input Spec

**Status:** SPEC ONLY — do not implement premium UI in this package.  
**Authority:** Real Perfect HD inventory on MIRA account (2026-09-12).

## Primary selector (Face Explorer — spatial)

| Metric | providerType | spatialMode | Notes |
|--------|--------------|-------------|-------|
| التصبغات | hd_age_spot | PROVIDER_PIXEL_MASK | Hardest proven case |
| المسام | hd_pore | PROVIDER_SUBREGION_MASKS | forehead/nose/cheek/whole |
| التجاعيد | hd_wrinkle | PROVIDER_SUBREGION_MASKS | 6 regions + whole |
| الاحمرار | hd_redness | PROVIDER_PIXEL_MASK | |
| الملمس | hd_texture | PROVIDER_PIXEL_MASK | whole subcategory |
| الحبوب | hd_acne | PROVIDER_PIXEL_MASK | whole subcategory |
| الترطيب | hd_moisture | PROVIDER_PIXEL_MASK | Real mask — no fake hydration heatmap |

## Secondary selector (optional spatial)

| Metric | providerType | spatialMode |
|--------|--------------|-------------|
| الدهون | hd_oiliness | PROVIDER_PIXEL_MASK |
| الإشراق | hd_radiance | PROVIDER_PIXEL_MASK |
| الهالات | hd_dark_circle | PROVIDER_PIXEL_MASK |
| انتفاخ العين | hd_eye_bag | PROVIDER_PIXEL_MASK |
| جفن علوي | hd_droopy_upper_eyelid | PROVIDER_PIXEL_MASK |
| جفن سفلي | hd_droopy_lower_eyelid | PROVIDER_PIXEL_MASK |
| تحت العين | hd_tear_trough | PROVIDER_PIXEL_MASK |
| الصلابة | hd_firmness | PROVIDER_PIXEL_MASK |

Keep eye concerns **independent** — never merge into one “eye problem.”

## Separate component (not Face Explorer spatial map)

| Metric | providerType | Why |
|--------|--------------|-----|
| نوع البشرة | hd_skin_type | Zone masks exist (whole/t_zone/u_zone) but product role is informational skin-type; optional technical zone inspect only |

## Must NOT appear as spatial maps

- Any SCORE_ONLY concern (none in this inventory)
- Landmark concern polygons
- Synthetic heatmaps
- Skin Age consumer claims (`skin_age` out of scope)

## UX rules for next implementation

1. Large face photo + elegant metric chips.
2. Tap metric → show **that** provider mask only (clear previous mask; no stale overlay).
3. Manual offset/rotation/warp = 0.
4. No cheek L/R landmark buttons.
5. raw_score vs ui_score preserved separately in data layer; consumer claims redesign is out of scope here.
6. Masks ephemeral — History independent of signed Perfect URLs.
