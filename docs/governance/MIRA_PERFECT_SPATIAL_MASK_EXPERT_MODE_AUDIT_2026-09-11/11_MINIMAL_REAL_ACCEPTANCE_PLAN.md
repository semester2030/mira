# 11 — Minimal Real Acceptance Plan (OWNER APPROVAL REQUIRED)

**REAL_PROVIDER_ACCEPTANCE_REQUIRED = YES**  
**Status:** NOT EXECUTED in this audit.

## Preconditions

1. Owner reviews this audit.  
2. Perfect answers questions in `09_PERFECT_TECHNICAL_QUESTIONS.md` (or console proves SKU).  
3. Owner explicitly approves **one** paid/credits-consuming test.  
4. Use **synthetic non-customer** face fixture only.  
5. No env mutation beyond temporary local/acceptance runtime if already entitled.  
6. No production deploy; no Phase 6.

## Minimum exact future test (single transaction)

1. Call existing MIRA adapter path (or isolated `PerfectCorpService`) once.  
2. If Perfect confirms flag: send **one** task with the **documented** spatial flag (e.g. `enable_mask_overlay: true` **only if Perfect confirms**).  
3. Capture **redacted** response shape keys only (presence of `mask_url` / `region_scores` / etc.) — never store face image.  
4. Run `detectSpatialCapability(raw)` → expect `5b-true-pixel` or `5b-true-regional` **only if fields present**.  
5. Record: HTTP statuses, task success, spatial field presence booleans, credit impact if visible.  
6. Immediately attempt delete if Perfect provides API.

## Pass criteria

- At least one concern returns provider spatial evidence (mask URL or region scores) **or**  
- Perfect error proves **not entitled** (document code/message safely).

## Fail / stop

- Any urge to invent polygons from global scores.  
- Expanding to multi-concern paid spam.  
- Enabling HD/180 without Perfect confirmation.
