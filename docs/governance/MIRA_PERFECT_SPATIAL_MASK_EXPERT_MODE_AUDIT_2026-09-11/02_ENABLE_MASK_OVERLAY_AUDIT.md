# 02 — enable_mask_overlay Audit

**Search:** entire MIRA workspace (source + docs + env examples).  
**Match count for `enable_mask_overlay`:** **0**

| Question | Answer |
|----------|--------|
| SUPPORTED BY CURRENT CONTRACT | **UNKNOWN** (flag never appears in MIRA contract or observed payloads) |
| CURRENTLY SENT | **NO** |
| CURRENT VALUE | **NOT PRESENT** |
| CURRENT RESPONSE HANDLING | **NOT IMPLEMENTED** |

## Related spatial keys (defensive gate only)

`spatial-spike.ts` *would* detect if a future payload contained e.g. `mask`, `mask_url`, `coordinates`, `region_scores`.  
That is **forward-looking detection**, not evidence that Perfect returns them today.

## Observed production-shaped contract (repo evidence)

Spatial capability docs + gate result: global `type` + `ui_score` only; no masks observed in MIRA’s documented/production parser path.

## Audit rule obeyed

This audit **did not** enable the flag or send a paid request.
