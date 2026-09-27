# Presentation parameters

## BEFORE (all metrics including pigment/acne)
- opacity: 0.58
- tintAlpha: 0.96
- softPresence: opacity*0.38 capped 0.26
- alphaMode: sourceAlpha (srcIn only)
- pigment color: #D45A8A
- acne color: #D46B8A

## AFTER — pigmentation only
- opacity: 0.72
- tintAlpha: 1.0
- softPresence: 0.18 capped 0.16
- alphaMode: luminanceGate floor=72 gain=1.35
- color: #B83280 (AppColors.analysisPigmentation)

## AFTER — acne only
- opacity: 0.74
- tintAlpha: 1.0
- softPresence: 0.16 capped 0.15
- alphaMode: luminanceGate floor=72 gain=1.45
- color: #E0673A (AppColors.analysisAcne)

## AFTER — other metrics
- PerfectMaskPresentationProfile.standard (unchanged from prior universal path)
