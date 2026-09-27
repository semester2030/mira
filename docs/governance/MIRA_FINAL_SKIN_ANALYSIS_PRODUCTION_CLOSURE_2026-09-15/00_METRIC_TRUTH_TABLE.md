# Metric truth table — Face Explorer (skinInteractiveReportV1)

| Metric AR | Consumer id | Provider | Mask | Score | Visual | Dead-icon risk AFTER |
|-----------|-------------|----------|------|-------|--------|----------------------|
| التصبغات | pigmentation | hd_age_spot | YES* | YES | PerfectMaskOverlay | 0 (legit gate) |
| المسام | pores | hd_pore | YES*+sub | YES | PerfectMaskOverlay | 0 |
| الحبوب | acne | hd_acne | YES* | YES | PerfectMaskOverlay | 0 |
| الدهون | oiliness | hd_oiliness | YES* | YES | PerfectMaskOverlay | 0 |
| التجاعيد | wrinkles | hd_wrinkle | YES*+sub | YES | PerfectMaskOverlay | 0 |
| الاحمرار | redness | hd_redness | YES* | YES | PerfectMaskOverlay | 0 |
| الملمس | texture | hd_texture | YES* | YES | PerfectMaskOverlay | 0 |
| الترطيب | hydration | hd_moisture | YES* | YES | PerfectMaskOverlay | 0 |
| الإشراق | radiance | hd_radiance | YES* | YES | PerfectMaskOverlay | 0 |
| الهالات | dark_circle | hd_dark_circle | YES* | YES | PerfectMaskOverlay | 0 |
| انتفاخ العين | eye_bag | hd_eye_bag | YES* | YES | PerfectMaskOverlay | 0 |
| الجفن العلوي | droopy_upper | hd_droopy_upper_eyelid | YES* | YES | PerfectMaskOverlay | 0 |
| الجفن السفلي | droopy_lower | hd_droopy_lower_eyelid | YES* | YES | PerfectMaskOverlay | 0 |
| الصلابة | firmness | hd_firmness | YES* | YES | PerfectMaskOverlay | 0 |
| تحت العين | tear_trough | hd_tear_trough | YES* | YES | PerfectMaskOverlay | 0 |
| نوع البشرة | skin_type | hd_skin_type | N/A | separate | NOT in carousel | N/A |

\*When materialization succeeds for the session. Carousel uses `providersWithLegitimateResult()` (bytes OR score). Score-only → explicit non-spatial copy, no fake map.
