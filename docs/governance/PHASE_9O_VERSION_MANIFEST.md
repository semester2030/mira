# PHASE 9O — Version Manifest

## Experience release
| Pin | Value | Source |
|---|---|---|
| Face Experience | `1.0.0` | `FaceExperienceVersion.version` |
| Release ID | `1.0.0-face-analysis-experience` | `FaceExperienceVersion.releaseId` |
| Certificate | `MIRA-FACE-EXPERIENCE-FREEZE-1.0.0` | `FaceExperienceVersion.certificateId` |
| Compatibility | `face-experience-compat-v1` | `FaceExperienceVersion.compatibility` |

## Contract pins (from code)
| Contract | Version |
|---|---|
| Capture quality input | `face-capture-quality-v1` |
| Capture readiness | `face-capture-readiness-v1` |
| Capture guidance | `face-capture-guidance-v1` |
| Capture policy / hold / latch | `face-capture-policy-v1` / `face-capture-hold-v1` / `face-capture-latch-v1` |
| Capture thresholds | `face-capture-thresholds-v1` |
| Contour reduce | `face-capture-contour-reduce-v1` |
| Analysis motion truth | `face-analysis-motion-truth-v1` |
| Result projection | `face-result-projection-v1` |
| Executive summary / primary / insight / mirror VM | `face-executive-summary-v1` / `face-primary-result-v1` / `face-insight-v1` / `face-result-mirror-vm-v1` |
| Result mirror truth | `face-result-mirror-truth-v1` |
| Detail sheet VM / truth | `face-detail-sheet-vm-v1` / `face-detail-sheet-truth-v1` |
| Guidance item / surface | `face-guidance-item-vm-v1` / `face-guidance-surface-vm-v1` |
| Advisor Face context | `face-advisor-context-v1` |
| History entry / comparison | `face-history-entry-vm-v1` / `face-comparison-vm-v1` |

## Guidance / history truth manifests
Law #40 entry tables exist in code; **no separate numeric version constant** beyond component contract versions above — documented honestly.

## External (consume-only; not re-frozen here)
| System | Status |
|---|---|
| Face Intelligence | v1.0.0 FROZEN / CONSUME-ONLY |
| AI Beauty Advisor | v1.0.0 FROZEN / CONSUME-ONLY |
