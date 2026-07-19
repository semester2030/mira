# Face Intelligence Technical Debt Register (v1.0.0)

Frozen subsystem may still carry **known deferred work**. None of the below is approved for silent implementation — each needs a CR.

## Known limitations (accepted in 1.0.0)

| ID | Limitation | Notes |
|----|------------|-------|
| TD-FI-01 | No facial fifths / dedicated eye-brow-nose-lip engines | Geometry = ratios + thirds + cautious symmetry |
| TD-FI-02 | Flutter Face*Pipeline mirrors retained | Gated; Testing/Future offline |
| TD-FI-03 | Guest offline path does not run Face Report | `NOT_REQUESTED` / local mock |
| TD-FI-04 | Device MediaPipe variance | Operational smoke optional remote health |
| TD-FI-05 | No full device Camera→UI hermetic E2E in CI | Software-stage operational E2E exists |

## Future improvements (candidates)

| ID | Idea | Class |
|----|------|-------|
| TD-FI-10 | Richer feature findings (eyes/lips/…) | MAJOR / new engines |
| TD-FI-11 | Fifths geometry | Formula MAJOR |
| TD-FI-12 | Confidence calibration from field data | MINOR/MAJOR |
| TD-FI-13 | Localization expansion beyond ar+en | MINOR |

## Deferred work

| ID | Item | Blocked on |
|----|------|------------|
| TD-FI-20 | Remove Flutter mirrors | Offline product decision |
| TD-FI-21 | LocalFaceMapBuilder full removal | Guest path replacement CR |
| TD-FI-22 | Remote production smoke in CI | Secrets / staging harness |

## Performance ideas

| ID | Idea |
|----|------|
| TD-FI-30 | Reuse live-preview mesh for upload anchors (avoid second MediaPipe pass) |
| TD-FI-31 | Lazy-init FaceMeshService pooling |

## Offline roadmap

| ID | Item |
|----|------|
| TD-FI-40 | Approved offline Face Report using gated Flutter mirrors **or** thin API-compatible client builder |
| TD-FI-41 | Explicit offline DTO package (must not fork schemas) |

## Provider roadmap

| ID | Item |
|----|------|
| TD-FI-50 | Alternate landmark provider → `GeometryAnchors` adapter only |
| TD-FI-51 | Server-side landmark option (if ever) must keep engines provider-free |

## Explicitly out of debt (non-goals)

- Attractiveness / beauty score in Face Intel  
- Perfect product lock-in in recommendations  
- Merging with FaceHealthMap  
