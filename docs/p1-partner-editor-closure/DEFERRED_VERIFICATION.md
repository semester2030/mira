# DEFERRED_VERIFICATION — MIRA P1

Owner acceptance judgment: **P1_ACCEPTED_WITH_DEFERRED_VERIFICATION**  
These items are **not** current close blockers and are **not** recorded as PASS or RESOLVED.

---

## P1-DV-01 — إثبات حفظ الحقول (FIELD ROUNDTRIP)

| Field | Value |
|---|---|
| Status | **DEFERRED_BY_OWNER** |
| Type | Verification gap (not a newly proven application defect) |
| Deferral reason | Owner accepted P1 and authorized moving to the next phase |
| Future close criteria | Independent proof that each required field’s **request payload**, **server value**, and **reopened UI** match the edited value without relying on UI-only success or bypassing the shared acceptance evaluator; availability must be exercised **alone** (no companion field nudge) |
| Test references | `mira-api/scripts/p1-rc13-field-coverage.mjs`; `evaluateFieldRoundtrip` / `evaluateFieldCoverageMatrix` in `mira-api/scripts/p1-rc13-acceptance-lib.mjs`; `FIELD_ROUNDTRIP_MATRIX.csv`; `FIELD_SAVE_COVERAGE.md` |

Notes: Remaining work is completing independent request/server/reopen attribution for fields whose harness still leans on UI outcomes or evaluator bypass, and isolating availabilityJson without moving another control.

---

## P1-DV-02 — المطابقة والحذف والمسح

| Field | Value |
|---|---|
| Status | **DEFERRED_BY_OWNER** |
| Type | Verification gap (not a newly proven application defect) |
| Deferral reason | Owner accepted P1 and authorized moving to the next phase |
| Future close criteria | Full product **variant** exact-match against independently fixture-built expected values (not inferred from live actual); service optional answer **add → edit → clear** with save + server read + reopen after **each** step |
| Test references | `mira-api/scripts/p1-rc13-browser-e2e.mjs` (`RC13-12-product-exact-delete`, `RC13-12-service-exact-clear`); `evaluatePublicProductExact` / `evaluatePublicServiceExact` / `exactVariantsMatch` in `mira-api/scripts/p1-rc13-acceptance-lib.mjs`; helpers in `mira-api/scripts/p1-rc13-acceptance-helpers.mjs` |

---

## P1-DV-03 — الوسائط وإعادة المحاولة

| Field | Value |
|---|---|
| Status | **DEFERRED_BY_OWNER** |
| Type | Verification gap (not a newly proven application defect) |
| Deferral reason | Owner accepted P1 and authorized moving to the next phase |
| Future close criteria | Prove image **actually loaded** (decode/natural dimensions) on reopen; capture **owner identity before retry**; do not coerce media-read failure into `mediaCount=0`; single-file upload path must end with **exactly one** media row |
| Test references | `mira-api/scripts/p1-rc13-browser-e2e.mjs` (`RC13-14-legacy-product`, `RC13-14-legacy-service`, `RC13-14-legacy-*-retry`); `evaluateLegacyUploadAcceptance` / `evaluateLegacyRetryAcceptance` in `mira-api/scripts/p1-rc13-acceptance-lib.mjs` |

---

## Policy
- Do not mark these IDs PASS/RESOLVED without new independent evidence.
- Do not restate them as blockers for the current P1 acceptance or next-phase start.
- Raw RC13 evidence remains historical; do not rewrite prior run results to claim these closed.
