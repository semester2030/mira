# Fashion UX Forensic — Supporting Inventories
**Task:** MIRA-P5-FASHION-EXPERIENCE-UX-FORENSIC-2026-09-07  
**AUDIT ONLY — NO IMPLEMENTATION**

## Screen map
See main audit §1–§2.

## CTA inventory (result shell highlights)
- Chapter tabs (look/colors/play/wardrobe)
- Sticky hero collapse control
- Compare / history
- Recommendations / refresh / retake
- Wishlist hearts on pieces
- Recolor apply + chat
- Ask Mira PremiumButton + ActionChip questions
- Occasion analyze CTA (pre-result)

## Card inventory (result)
- OutfitLookResultHero container
- Embedded OutfitHarmonyPanel
- OutfitWhyThisWorksSection
- OutfitSkinHarmonyLink
- OutfitColorHarmonyPanel
- OutfitColorAlternativePanel
- OutfitPhotoColorSlider surfaces
- _PremiumInsightCard × up to 4 (palette/pieces/accessories/makeup)
- OutfitLuxuryPieceCard rows
- OutfitNextOccasionCard
- AskOutfitMiraSection PremiumCard
- Trust / untrusted cards

## Typography levels observed
AppTypography.titleMedium, labelLarge, bodySmall, labelSmall, headline via MiraAppBar; Playfair display elsewhere in brand.

## Spacing samples
6,8,10,12,14,16,18,20,22; radii 12,26,28; hero padding 18/20/18/22.

## Score semantic evidence
- Field: `OutfitAnalysis.compatibilityScore`
- UI: `BeautyScoreRing` label `درجة الإطلالة`
- Subtitle builder: `OutfitStylistCopy.scoreSubtitle`
- Verdict: `OutfitFashionTaxonomy.verdictForScore`
- Not: palette CIEDE2000 confidence

## Remediation waves
See main audit §34.
