# Perfect Corp Spatial Capabilities Audit

**Project:** Mira · Mira Intelligence Layer  
**Date:** June 2026  
**Auditor:** Mira Engineering (code + S2S v2.0 contract review)  
**API base:** `https://yce-api-01.makeupar.com/s2s/v2.0`

---

## 1. APIs Currently Used by Mira

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/file/skin-analysis` | POST | Upload image → `file_id` |
| `/task/skin-analysis` | POST | Create analysis task with `dst_actions` |
| `/task/skin-analysis/{taskId}` | GET | Poll until `task_status: success` |

**Configured `dst_actions` (default):**

`wrinkle`, `pore`, `texture`, `acne`, `moisture`, `oiliness`, `redness`, `age_spot`

**Parser:** `mira-api/src/ai/services/perfect-corp.service.ts` → `extractConcerns()`

---

## 2. Available Spatial Outputs (Production)

| Output type | Present in Mira today? | Evidence |
|-------------|------------------------|----------|
| Global concern scores (`type` + `ui_score`) | **Yes** | Every `results.output[]` item |
| Raw score (`raw_score`) | Sometimes | Parsed when present |
| Face regions / zone scores | **No** | Not in parser; not observed in responses |
| Regional scores (`region_scores`) | **No** | Gate checks; not returned |
| Skin masks / segmentation maps | **No** | No `mask`, `mask_url` fields |
| Coordinates / bounding boxes | **No** | No `bounds`, `coordinates` |
| Landmarks | **No** | No `landmarks` field |
| Heatmaps | **No** | No `heatmap` field |
| Left/right cheek differentiation | **No** | No lateral data |
| Pixel-level localization | **No** | — |

### Sample response shape (observed)

```json
{
  "results": {
    "output": [
      { "type": "oiliness", "ui_score": 42 },
      { "type": "moisture", "ui_score": 55 },
      { "type": "pore", "ui_score": 48 }
    ]
  }
}
```

**Conclusion:** Perfect Corp currently acts as a **global scoring engine** for Mira — not a spatial localization engine.

---

## 3. Confidence Level Classification

| Level | Technical signal | User label (Arabic) | Mira mode |
|-------|------------------|---------------------|-----------|
| **Low** | Global scores only | ثقة منخفضة — استرشادي | `educational` |
| **Medium** | `region_scores` / zones in API | ثقة متوسطة — تحليل مناطقي | `regional` |
| **High** | `mask`, `coordinates`, `landmarks` | ثقة عالية — تحليل مكاني | `spatial` |

**Current production status:** `confidence: low` · `spatialConfidence: none`

Gate implementation: `spatial-spike.ts` · `detectSpatialCapability()`

---

## 4. Technical Limitations

1. **S2S task response** returns aggregate metrics per concern — not per face zone.
2. **No raw YouCam payload** is persisted today; gate runs on optional `rawYouCam` passthrough.
3. **`dst_actions`** list does not include mask/segmentation actions in current config.
4. **Child / low-quality photos** can produce unreliable global scores (see child-safety guard Phase 3).
5. **Heuristic zone mapping** (T-Zone ↔ oiliness) is scientifically common but **not user-specific localization**.

---

## 5. Recommended Implementation Path

### Now (implemented)

| Decision | Action |
|----------|--------|
| OPTION B — global only | **Educational Face Map** — soft purple highlights on common zones |
| No fake precision | No red dots · no «المشكلة هنا بالضبط» |
| UX transparency | Confidence badge + disclaimer on every map |
| Architecture | `face-map-engine.ts` → `FaceHealthMapPayload` |

### When Perfect Corp upgrades

| New API field | Mira action |
|---------------|-------------|
| `region_scores` | Auto-switch to `regional` · confidence **medium** |
| `mask_url` / `coordinates` | Auto-switch to `spatial` · confidence **high** |
| New `dst_actions` | Re-run this audit · update `PERFECT_CORP_DEFAULT_DST_ACTIONS` |

### Before Phase 6

1. Re-poll Perfect Corp console for new endpoints / mask actions.
2. Store anonymized raw task JSON (server-only) for one release cycle to detect new fields.
3. Pass `rawYouCam` from `PerfectCorpService.analyzeSkin()` into `buildBeautyReport()`.

---

## 6. Product Rules (Non-Negotiable)

| Rule | Status |
|------|--------|
| Never show «التجاعيد هنا» without spatial evidence | ✓ Enforced |
| Never show left cheek worse than right without data | ✓ Enforced |
| Educational map uses «غالباً» / «منطقة شائعة» | ✓ Enforced |
| Medical-grade claims on low-confidence map | ✗ Forbidden |

---

## 7. Files Reference

| File | Role |
|------|------|
| `perfect-corp.service.ts` | YouCam integration |
| `perfect-corp.config.ts` | `dst_actions` + base URL |
| `spatial-spike.ts` | Spatial gate |
| `face-map-engine.ts` | Educational + spatial map builder |
| `face_health_map.interface.ts` | API contract |
| `spatial-gate-result.md` | Short gate verdict |

---

**Verdict:** Proceed with **Educational Face Map (confidence: low)**. Defer **Real Spatial Map** until Perfect Corp returns verifiable regional or mask data.
