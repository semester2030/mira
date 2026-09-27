# MIRA — Interactive Skin Map Data-Contract Audit

**Date:** 2026-09-11  
**Mode:** FORENSIC — no fabricated spatial precision  
**Scope:** الدهون / الترطيب / المسام

---

## Classification (engine → UI)

| Metric (AR) | Engine id | Contract class | Evidence |
|-------------|-----------|----------------|----------|
| الدهون | `oiliness` | **E — GLOBAL SCORE ONLY** | Perfect Corp `type` + `ui_score` only |
| الترطيب | `moisture` → hydration | **E — GLOBAL SCORE ONLY** | Same |
| المسام | `pore` | **E — GLOBAL SCORE ONLY** | Same; dual scales exist (`pores` 0–5 vs `concernScores.pore` 0–100) but still global |

**Not present in production parser / observed responses:**

- A PIXEL MASK  
- B POLYGON / CONTOUR (from Perfect Corp)  
- C FACE LANDMARK REGION SCORE (from Perfect Corp)  
- D REGION NAME + SCORE ONLY (from Perfect Corp)

Client landmarks (MediaPipe) are used **only** for anatomical region outlines + hit-testing — not as measured oil/hydration/pore localization.

---

## Sources inspected

- `mira-api/src/ai/services/perfect-corp.service.ts` → `extractConcerns`
- `mira-api/docs/perfect_corp_spatial_capabilities.md`
- `mira-api/src/intelligence/pipeline/youcam-spatial-parser.ts` → `DEFAULT_HIGHLIGHT_ZONES` (heuristic)
- `mira-api/src/intelligence/pipeline/face-map-engine.ts` → `spatialConfidence: 'none'`
- Flutter: `results_skin_map_panel.dart`, `landmark_face_region_session.dart`, `SkinFaceMapEducationalZones`

---

## Truthful UI decision

| Allowed | Forbidden |
|---------|-----------|
| Global score banner + polarity legend | Local heatmaps implying measured hotspots |
| Educational common-zone hints labeled إرشادي | Claims «تحليل دقيق داخل المنطقة» |
| Landmark-aligned region outlines for explore/hit | Fake pixel pore density |
| Metric-distinct accent colors | Stacking three metric maps at once |

**Verdict implication:** A (full spatial closure) is **impossible** without a new ML/provider spatial contract → target **B**.

---

## Missing contract for Verdict A

```
region_scores[] | mask_url | coordinates | per-zone ui_score
spatialConfidence: regional | spatial
```

Until then, stop before inventing localization.
