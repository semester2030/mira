# MIRA — Perfect HD Masks + CameraKit Acceptance

**Task:** `MIRA-PERFECT-HD-MASKS-CAMERAKIT-ACCEPTANCE-2026-09-12`  
**Date:** 2026-09-12

## STATUS: **BLOCKED**

### Blocking reasons (proven)

1. **Perfect Mobile CameraKit 2.5.0 = NOT AVAILABLE** in MIRA repo  
   - No `PerfectLibCameraKit` iOS framework / Android AAR  
   - Not in `pubspec.yaml` / Podfile  
   - Cannot become primary capture gate without SDK binary + license from Perfect console  

2. **Real HD provider acceptance incomplete**  
   - Local one-shot `run-hd-mask-acceptance.ts` against stock fixture returned `fetch failed` (same class of local→Perfect network failure seen in Phase 3C)  
   - Render MCP workspace not selected in this session — cannot run Render one-off without owner workspace confirmation  
   - New endpoint `POST /api/v1/ai/skin-analysis-hd-masks` is **implemented in source** but **not deployed** (NO GO-LIVE / NO PHASE 6)

3. Therefore physical iPhone cannot yet show **real Perfect masks** end-to-end in this session.

---

## What WAS implemented (ready for next owner-approved run)

| Piece | Status |
|-------|--------|
| HD-only `dst_actions` + no SD mix assert | DONE |
| `enable_mask_overlay: false` (independent masks) | DONE |
| Parser: `raw_score`, `ui_score`, `mask_urls`, `output_mask_name`, pore/wrinkle subcats | DONE + tests PASS |
| Mask download + dimension vs source alignment check | DONE (service) |
| Technical viewer (no landmark outlines) | DONE Flutter route `/dev/perfect-hd-mask-viewer` |
| Settings entry | DONE |
| Legacy landmark map | PRESERVED (not used as mask evidence) |
| Persistent face/mask storage | 0 (ephemeral response only) |

### Exact HD request body (new path)

```json
{
  "src_file_id": "<id>",
  "dst_actions": [
    "hd_age_spot","hd_pore","hd_wrinkle","hd_redness",
    "hd_texture","hd_acne","hd_moisture","hd_oiliness"
  ],
  "miniserver_args": { "enable_mask_overlay": false },
  "format": "json"
}
```

API: `https://yce-api-01.makeupar.com/s2s/v2.0` (unchanged S2S v2.0)

### Current camera path (unchanged primary)

Flutter `camera` + MediaPipe/`FaceMeshQualityGate` → capture file → `POST /ai/skin-analysis` (SD scores)  
HD technical path is separate: `POST /ai/skin-analysis-hd-masks`

### Gate classification (for future CameraKit primary)

| Gate | Class |
|------|-------|
| cheek completeness / midline | REMOVE_FROM_PRIMARY |
| centerX/Y, yaw/pitch/roll, scale | KEEP_AS_SECONDARY until CameraKit wired |
| debug HUD | KEEP_FOR_DEBUG_ONLY |

---

## Owner next steps (minimum)

1. Confirm Render workspace for MCP / or deploy API with HD endpoint on existing service (owner-approved).  
2. Obtain Perfect **CameraKit 2.5.0** SDK + license → native bridge.  
3. Re-run **one** HD acceptance from Render network with ≥1080 short-side capture.  
4. Open Settings → «عارض Perfect HD Masks (تقني)» on iPhone against live API.

## PASS gate fields (this run)

See `99_FINAL_RESPONSE.md`.
