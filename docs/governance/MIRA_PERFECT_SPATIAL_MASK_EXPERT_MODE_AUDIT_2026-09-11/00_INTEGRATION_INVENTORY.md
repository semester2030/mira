# 00 — Current Perfect Integration Inventory

**Task:** `MIRA-PERFECT-SPATIAL-MASK-EXPERT-MODE-AUDIT-2026-09-11`  
**Mode:** READ-ONLY  
**Secrets:** presence only — no key values

---

## Auth / config presence

| Item | Presence | Source |
|------|----------|--------|
| `PERFECT_API_KEY` / `PERFECT_CORP_API_KEY` | PRESENT as env vars (values not read) | `render.yaml` `sync: false`; `.env.example` |
| Base URL | PRESENT | default + Render: `https://yce-api-01.makeupar.com/s2s/v2.0` |
| `SKIN_PROVIDER=perfect_corp` | PRESENT | `render.yaml`, `.env.example` |
| `PERFECT_CORP_FALLBACK_MOCK=false` | PRESENT (prod) | `render.yaml` |

## API version (exact)

| Claim | Evidence |
|-------|----------|
| **YouCam S2S `v2.0`** | `PERFECT_CORP_DEFAULT_BASE_URL` ends with `/s2s/v2.0` |
| Same in Render Blueprint | `PERFECT_BASE_URL` = `…/s2s/v2.0` |
| Provider readiness registry | `restVersion: 's2s/v2.0'` |
| Code comments | `perfect-corp.service.ts`: “YouCam S2S v2.0” |

**Skin Analysis V2.1:** zero source/config references. Status = **NOT_PROVEN / NOT USED**.

## Authentication method

`Authorization: Bearer <apiKey>` on Perfect REST calls (server-only).

## Endpoints used by MIRA

| Step | Method | Path |
|------|--------|------|
| File init | POST | `{base}/file/skin-analysis` |
| Bytes upload | PUT (presigned) | provider `requests[0].url` (observed host `yce-us.s3-accelerate.amazonaws.com`) |
| Task create | POST | `{base}/task/skin-analysis` |
| Task poll | GET | `{base}/task/skin-analysis/{taskId}` |

## Request schema (task create) — as implemented

```json
{
  "src_file_id": "<file_id>",
  "dst_actions": ["wrinkle","pore","texture","acne","moisture","oiliness","redness","age_spot"],
  "format": "json"
}
```

**Not sent:** `enable_mask_overlay`, Expert Mode fields, HD action IDs, multi-angle face set, mask format flags.

## Response handling (as implemented)

`extractConcerns()` reads only:

- `results.output[].type`
- `results.output[].ui_score`
- `results.output[].raw_score` (optional)

No mapper fields for `mask`, `mask_url`, `region_scores`, `coordinates`, `heatmap`, per-pixel arrays.

## Flow

`PerfectCorpService.analyzeSkin` → upload → task → poll → `mapYouCamResults`  
→ `PerfectCorpSkinAdapter` / orchestrator → Skin Intelligence  
→ `rawYouCam` ephemeral for spatial gate / undertone; **not** persisted full (`redactYouCamAudit`).

## Stored result fields (canonical)

Global scores / derived metrics: hydration, oiliness, pores, wrinkles, acne, darkSpots (`age_spot`), redness, concernScores map, skin type, recommendations.  
Optional `dark_circle` only if present in provider output — **not** in default `dst_actions`.
