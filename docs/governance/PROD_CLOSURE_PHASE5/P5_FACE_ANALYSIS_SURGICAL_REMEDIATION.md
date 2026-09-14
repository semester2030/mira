# PHASE 5 — FACE ANALYSIS INCIDENT REMEDIATION

**Task:** `MIRA-P5-FACE-ANALYSIS-SURGICAL-REMEDIATION-2026-09-07`  
**Mode:** IMPLEMENTATION + REGRESSION (+ device closure)  
**Forensic source:** `MIRA_P5_FACE_ANALYSIS_FORENSIC_2026-09-07`  
**Remediation performed:** YES (surgical)  
**Face Intelligence semantics:** UNCHANGED  
**Go-Live / Phase 6:** LOCKED / NOT APPROVED

---

## Forensic root cause (unchanged)

Physical iPhone reached production; BlazeFace passed; YouCam failed with
`error_lighting_dark` → `error_src_face_out_of_bound`; HTTP 503 exposed Nest
class name `Service Unavailable Exception`; Soft Laser began on button press.

---

## Files changed (surgical)

### Backend
- `mira-api/src/ai/face-gate/youcam-face-errors.ts` — capture taxonomy + immediate recapture tokens
- `mira-api/src/ai/mocks/perfect-corp-skin.provider.ts` — 400 capture / 503 provider; no InternalServerError leak
- `mira-api/src/ports/shared/provider-error.ts` — `message`/`category`/`requiresRecapture`/`userAction`
- `mira-api/src/ports/adapters/perfect-corp-skin.adapter.ts` — rethrow HttpExceptions
- `mira-api/src/ports/orchestrators/skin-analysis.orchestrator.ts` — capture codes → 400; createProviderError timeouts
- `mira-api/src/ports/orchestrators/fashion-analysis.orchestrator.ts` — timeout createProviderError (compile safety)
- `mira-api/src/common/filters/http-exception.filter.ts` — never leak framework class names; pass contract fields
- `mira-api/src/skin-analysis/skin-analysis.service.ts` — intelligence failure → safe Arabic 503
- `mira-api/src/ai/face-gate/phase5-face-analysis-surgical.schema-tests.ts` — new tests

### Flutter
- `lib/features/face_analysis_experience/presentation/analysis/contracts/face_analysis_journey.dart` — state machine + Soft Laser gate + error UX map
- `lib/features/face_analysis_experience/presentation/analysis/analysis_motion.dart` — export journey
- `lib/features/dashboard/presentation/screens/new_analysis_screen.dart` — SUBMITTING≠PROCESSING, copy, locks, recapture
- `lib/features/skin_analysis/presentation/blocs/*` — Submitting/Processing states; in-flight guard
- `lib/features/skin_analysis/domain/repositories/skin_analysis_repository.dart` — `onRemoteWaitStarted`
- `lib/features/skin_analysis/data/datasources/skin_analysis_api_data_source.dart` — retain capture on failure; remote-wait callback
- `lib/features/skin_analysis/data/repositories/skin_analysis_repository_impl.dart`
- `lib/core/utils/mira_api_error_message.dart` — scrub technical exceptions
- `lib/features/skin_analysis/presentation/live_face_map/widgets/live_face_analysis_overlay.dart` — ready copy
- `lib/features/skin_analysis/domain/image_quality/quality_confidence_mapper.dart` — ready copy
- `test/face_analysis_experience/phase5_face_analysis_surgical_test.dart`
- `test/face_analysis_experience/phase5_image_lifecycle_test.dart`

---

## Error taxonomy before / after

| Provider token | Before | After |
|----------------|--------|-------|
| `error_lighting_dark` | variant retries → often 503 `Service Unavailable Exception` | `CAPTURE_LIGHTING_TOO_DARK` → **400** capture_quality, recapture |
| `error_src_face_out_of_bound` | InternalServerError → classify internal_error → **503** class name | `CAPTURE_FACE_OUT_OF_BOUNDS` → **400**, immediate (no variant retry), recapture |
| Real provider outage | 503 (sometimes class name) | 503 with Arabic `message`, `userAction=retry` |
| Timeout | 504 object without message | 504 with Arabic timeout message |

---

## State machine before / after

| Before | After |
|--------|-------|
| idle / running / failed collapsed | explicit `submitting` vs `processing` (+ capture/service failure phases) |
| Soft Laser on button | Soft Laser only when `faceAnalysisAllowsSoftLaser` (processing/accepted/completed) |
| Ready implied provider ready | Copy: **تم التقاط الصورة** |

**Soft Laser truthful threshold (sync API):** local gates complete AND HTTP Face request dispatched (`onRemoteWaitStarted` immediately before `Dio.post`). Documented as remote-wait presentation group — not measurement.

---

## Retry / image lifecycle

- Success: delete capture path after success (unchanged privacy intent).
- Failure: **retain** original `imagePath` for retry when `requiresRecapture=false`.
- Recapture failures: UI clears capture; primary action **إعادة التصوير**.
- Missing file: force recapture (no silent retry of deleted file).
- Duplicate tap: `_submitLock` + bloc `_inFlight`.

---

## Tests

| Suite | Result |
|-------|--------|
| `phase5-face-analysis-surgical.schema-tests` | PASS |
| `phase1-ports.schema-tests` | PASS |
| `phase5_face_analysis_surgical_test.dart` | PASS |
| `phase5_image_lifecycle_test.dart` | PASS |
| `phase_9d_analysis_motion_test.dart` | PASS |
| `nest build` | PASS |
| `flutter analyze` (touched) | INFO only (async BuildContext); no new ERROR |

---

## Law #40 / #41

| Law | Result |
|-----|--------|
| #40 | **PASS** — Soft Laser remains decorative/presentation; copy no longer claims provider-ready |
| #41 | **PASS** — Soft Laser does not start in SUBMITTING; only after remote-wait threshold |

---

## Production deploy note

Backend taxonomy/filter changes require **deploy of mira-api** to take effect on
`mira-api-n4p3.onrender.com`. Client Soft Laser / scrubbing / lifecycle ship with
the app binary. Until API deploy: capture-quality may still arrive as 503 from
old build, but Flutter no longer shows Nest class names.

## Physical iPhone (this run)

- Device visible: `fayez’s iPhone` (`00008110-00191986268BA01E`).
- `flutter build ios --release -d <device>` failed: **CodeSign** nonzero (disk
  pressure / signing environment). Available disk was ~0–1 GB during packaging.
- Therefore: **REAL IPHONE SUCCESSFUL FACE ANALYSIS = NOT PROVEN** in this run.
- Owner action: free ≥10 GB, rebuild/install release, deploy mira-api, re-run CASE 1–4.

---

## Remaining debt

1. Free disk + codesigned release install on physical iPhone.
2. Deploy mira-api surgical changes to production.
3. After deploy: re-prove lighting_dark / face_out_of_bound as HTTP 400 on live.
4. Optional: streaming ACCEPTED event (not required; sync threshold documented).
5. Minor `use_build_context_synchronously` INFO on analysis screen.

---

## Phase 5 verdict (this package)

**CODE IMPLEMENTED · AUTOMATED TESTS PASS · DEVICE/PROD CLOSURE BLOCKED**  
Phase 6 LOCKED · Go-Live NOT APPROVED.
