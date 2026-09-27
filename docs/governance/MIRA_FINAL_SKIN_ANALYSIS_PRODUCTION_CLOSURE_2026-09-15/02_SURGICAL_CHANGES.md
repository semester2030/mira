# Surgical changes

1. `PerfectMaskSession.providersWithLegitimateResult` + lookup score-only fallback
2. Carousel filters to legitimate Perfect results only (DEAD ICONS = 0)
3. Score-only UI: hero + «لا يتوفر تعيين مكاني — النتيجة رقمية من Perfect فقط»
4. Skin Capture Mirror enabled via `skinInteractiveReportV1` (CameraKit absent)
5. Auto-analysis on capture; hide «بدء التحليل» confirmation CTA
6. FaceMeshQualityGate pose constants restored (hold controller compile)

NO new Perfect clients / mask services / renderers / Face Explorers / camera engines.
