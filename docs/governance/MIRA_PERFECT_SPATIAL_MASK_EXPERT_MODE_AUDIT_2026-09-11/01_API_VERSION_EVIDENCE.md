# 01 — API Version Evidence

## Proven in MIRA

| Fact | Evidence path |
|------|----------------|
| Base URL path segment `s2s/v2.0` | `mira-api/src/ai/config/perfect-corp.config.ts` |
| Render production URL `…/s2s/v2.0` | `render.yaml` → `PERFECT_BASE_URL` |
| Service comment “S2S v2.0” | `mira-api/src/ai/services/perfect-corp.service.ts` |
| Docs audit titled S2S v2.0 | `mira-api/docs/perfect_corp_spatial_capabilities.md` |
| Beauty readiness `restVersion` | `seed-registry.ts` → `'s2s/v2.0'` |

## Not proven

| Claim | Repo search result |
|-------|--------------------|
| Skin Analysis **V2.1** in use | **0** matches for `s2s/v2.1` / Skin Analysis V2.1 as Perfect API |
| Alternate Perfect Skin product path | Makeup VTO docs appear for Beauty try-on planning only — separate from Skin Analysis |

## Verdict line

**CURRENT PERFECT API VERSION (MIRA):** `YouCam S2S v2.0` (`…/s2s/v2.0`)  
**SKIN ANALYSIS V2.1:** `NOT_PROVEN` as available-to-MIRA; **AVAILABLE_NOT_USED** only if Perfect later confirms V2.1 exists for this account (docs ≠ entitlement).
