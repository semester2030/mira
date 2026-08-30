# Fashion Advice Runtime Trace

## Canonical vision path (documented production)
```
Image
→ POST /ai/vision/outfit/analyze (AiGatewayController.analyzeVisionOutfit)
→ FashionAnalysisOrchestrator.analyze
→ VisionFashionAdapter / VisionOrchestrator
→ FashionVisionDocument (internal)
→ GarmentMappingEngine → CanonicalGarment[]
→ HTTP { garments, analysis, warnings, limitations, … }
```
**Does not call** OutfitIntelligenceService or StylingIntelligenceService.

## Parallel / adjacent paths
```
Legacy /ai/outfit-analysis → OutfitAnalysisService
Hybrid /ai/outfit-intelligence → LLM + deterministic fallback
Flutter: Vision result → DeterministicOutfitEngine / score engines / color harmony / catalog
Ask Mira (outfit): Consultation MCE LLM with outfit snapshot facts
Beauty Advisor /advisor/chat: Envelope claims only (skin-primary grounding today)
RecommendationsService: skin+outfit+occasion (separate)
```
