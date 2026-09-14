# Phase 9A — Face Result Inventory

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


## FaceIntelligenceReportDto (public)
analysisId, provider, formula/version pins, confidence, limitations[], language,
executiveSummaryAr/En, measurementEligible, eligibilityReasonCodes[],
shape{id, confidence, explanations}, findings[], notableFindings[], metrics[],
recommendations[], featureLayers[], retakeGuidanceAr/En, metadata

## Metrics catalog
facialThirdsBalance, eyeSpacingRatio, faceWidthHeightRatio, noseToFaceWidthRatio,
mouthToFaceWidthRatio, symmetryCautious, faceShape

## Sibling skin fields on MiraBeautyReport (not Face Intel)
overallBeautyScore (SVI), concerns, faceHealthMap, skinAgeEstimate, recommendedProducts, journey, etc.

## Displayed today
`FaceIntelligenceSection` + runtime notice; skin map separate; default long report mixes both.
