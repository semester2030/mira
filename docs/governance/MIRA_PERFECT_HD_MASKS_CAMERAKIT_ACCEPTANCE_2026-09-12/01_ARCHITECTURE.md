# CURRENT vs NEW architecture

## CURRENT (production Skin)

```
FaceCapturePanel (MediaPipe gates)
  → POST /ai/skin-analysis
  → PerfectCorpService (SD dst_actions, format:json, NO mask flags)
  → extractConcerns(type, ui_score[, raw_score])
  → MiraBeautyReport
  → ResultsSkinMapPanel = LANDMARK_TEMPLATE + educational zones
```

## NEW (technical acceptance — source only this task)

```
Exact image bytes (≥1080 short side)
  → POST /ai/skin-analysis-hd-masks
  → PerfectCorpService.analyzeSkinHdMasks
       HD-only dst_actions
       miniserver_args.enable_mask_overlay = false
  → parsePerfectHdMaskPayload
  → download mask_urls → dimension check vs source
  → PerfectHdMaskTechnicalViewerScreen (ORIGINAL / MASK / OVERLAY)
```

Legacy landmark map remains available on production Skin report path.
It is **not** used as evidence that Perfect located concerns.
