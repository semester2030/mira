# Face Intelligence Runtime States

Wire field: `faceIntel.runtime` (upload) and `miraReport.faceIntelligenceRuntime` (response).

| Status | Meaning | User-visible |
|--------|---------|--------------|
| `AVAILABLE` | Inputs ready; pipeline ran; measurements eligible | Face Intelligence section |
| `UNAVAILABLE` | Pipeline ran or inputs incomplete; metrics unavailable | Section and/or notice with retake guidance |
| `FAILED` | Mesh/bridge/parse failure | `FaceIntelRuntimeNotice` |
| `SKIPPED` | Explicitly skipped this session | Notice |
| `NOT_REQUESTED` | Client did not send faceIntel (legacy / offline guest) | No Face section |

Every status includes: `reason`, `stage`, `confidence` (0–100), `userVisibleAr`, `userVisibleEn`.

Silent `faceIntel = null` without runtime is **forbidden**.
