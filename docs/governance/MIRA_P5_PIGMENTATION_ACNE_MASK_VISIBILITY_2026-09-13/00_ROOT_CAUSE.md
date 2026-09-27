# Root cause — pigmentation + acne visibility

## Measured Perfect hd_acne RGBA (ephemeral session, 1200×1680)
- nonzero_pct ≈ 99.99%
- Dominant pixel: RGBA(61,61,61,92) ≈ 2,015,759 px (face-wide gray wash)
- Lesion-like pixels: A=255 with high luminance peach/white — only dozens of px
- median alpha of nonzero = 92; max = 255

## Canonical renderer before calibration
- ColorFilter.srcIn(tint) keeps Perfect **alpha only**, discards RGB intensity
- Universal opacity 0.58 + soft presence → pink wash over nearly the whole face
- Lesions (A=255) only ~2.8× wash (A=92); wash + pink-on-skin → locations not obvious in <1s
- analysisPigmentation (#D45A8A) ≈ analysisAcne (#D46B8A) → poor metric differentiation

## Pigmentation (hd_age_spot)
- Same Perfect HD spot-family encoding pattern (RGB intensity over soft coverage)
- Same universal srcIn path → same failure mode
- (No age_spot bytes in the sampled ephemeral session; acne measurement + HD spot encoding apply)

## Fix (presentation only)
- Metric profiles: luminanceGate for pigment/acne only
- Gate floor 72 suppresses gray wash (61) → presentation alpha 0
- Perfect A=0 → presentation 0
- Lesion high-luminance pixels remain/boosted
- Distinct Design System colors; other metrics keep standard profile unchanged
