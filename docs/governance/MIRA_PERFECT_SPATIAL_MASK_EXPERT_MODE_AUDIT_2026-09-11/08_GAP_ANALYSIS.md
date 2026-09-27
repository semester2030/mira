# 08 — Gap Analysis

## Target UX blocked today

> Tap التصبغات → show actual detected pigmentation locations

Equivalent for pores / wrinkles / texture / acne / redness / hydration / sebum.

## Proven gaps (each with evidence)

| Gap | Proven? | Evidence |
|-----|---------|----------|
| Response is global score only | **YES** | `extractConcerns`; `perfect_corp_spatial_capabilities.md`; `spatial-gate-result.md` → `5b-fallback` / `spatialConfidence: none` |
| Request never asks for masks | **YES** | Task body = `src_file_id` + `dst_actions` + `format: json` only |
| `enable_mask_overlay` absent | **YES** | Repo-wide **0** matches; not sent |
| Mask/region mapper not implemented for real data | **YES** | Parser ignores spatial fields; educational zones are heuristics |
| API version is v2.0 not proven V2.1 | **YES** | Config / Render / comments |
| Expert Mode not configured | **YES** | **0** Expert Mode integration |
| HD actions not requested | **YES** | SD-only `dst_actions` |
| Account entitlement for masks/Expert/HD/180 | **NOT PROVEN** | Prior audits: license/plan owner verification; no entitlement artifact for spatial SKUs |
| Whether Perfect *product* can return masks for this account | **NOT PROVEN** | Docs ≠ entitlement; no mask fields in observed MIRA contract |

## What does *not* close the gap

- Flutter landmark polygons / educational T-zone heuristics  
- Thicker overlays or metric colors  
- Forward-looking `spatial-spike` detectors without provider fields

## REAL_PROVIDER_ACCEPTANCE_REQUIRED

**YES** — only after owner approval, and only if Perfect confirms the exact request flag/SKU.  
Minimum future test: see `11_MINIMAL_REAL_ACCEPTANCE_PLAN.md`.
