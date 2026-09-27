# Oiliness root cause + fix

## Root cause
Carousel was built only from `ResultMapVM.concerns` ← `report.mainConcerns`.
`hd_oiliness` is REAL in PerfectMaskSession ephemeral masks, but oiliness is often
absent from `mainConcerns`, so الدهون never appeared in the consumer carousel.

## Fix (canonical path only)
`ResultsSkinMapPanel._carouselConcerns()` now unions:
1. map concerns
2. PerfectMaskSession.providersWithMaskBytes() → consumerMetricIdForProvider

Selecting الدهون uses existing PerfectMaskSession.lookup → hd_oiliness mask + score.
No new oiliness service/renderer.
