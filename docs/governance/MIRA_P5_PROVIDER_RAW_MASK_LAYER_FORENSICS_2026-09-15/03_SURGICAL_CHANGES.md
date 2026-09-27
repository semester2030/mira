# Surgical changes (after forensic proof)

1. All Face Explorer `PerfectMaskPresentationProfile.softPresenceFactor/Cap = 0`
   (standard, pigmentation, acne, pores, oiliness, wrinkles, redness, texture, hydration)
2. Face Explorer chrome / stage = `#000000` (`faceOnlyBlack`); `atmosphereForConcern` unused
3. `SkinFaceExplorerLayerIsolation` internal dart-defines (L0–L5)

Not removed (provider pixels, not MIRA drawPath):
- Perfect firmness / radiance / texture / eye overlay PNGs via PerfectMaskOverlay

Legacy WrinkleLinePainter / landmark polygons: not in Face Explorer tree
(`skinInteractiveReportV1` → ResultsSkinMapPanel only).
