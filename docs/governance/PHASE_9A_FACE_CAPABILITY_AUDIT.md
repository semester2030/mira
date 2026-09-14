# Phase 9A — Face Capability Audit

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


| Capability | Status | Evidence |
|------------|--------|----------|
| Single frontal image analyze | LIVE | multipart one `image` |
| Multi-image / profile | NOT_FOUND | — |
| Landmarks (on-device) | LIVE | MediaPipe 468 |
| Landmarks persisted public | PARTIAL | summary + anchors transport; not raw mesh in report |
| Geometry metrics | LIVE | thirds, ratios, symmetryCautious |
| Face shape | LIVE | oval/round/square/heart/oblong/diamond/triangle |
| Symmetry | LIVE cautious | metric `symmetryCautious` — no attractiveness |
| Proportions | LIVE | catalog metrics |
| Confidence/evidence | LIVE | contracts + eligibility |
| Attractiveness score | FORBIDDEN | ADR-FI-003 |
| Face age | NOT_FOUND (face); skinAgeEstimate is skin | sibling |
| Hair/makeup/eyewear recos | LIVE API | face-recommendation.engine |
| Medical diagnosis | NOT_FOUND / forbidden | limitations text |
