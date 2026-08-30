# PHASE 9G — Feature Flag Report

| Decision | Value |
|---|---|
| Flag | **Reuse** `MIRA_FACE_RESULT_MIRROR_V1` / `FaceResultMirrorFlag` |
| Separate details flag | **Not created** — sheets inseparable from 9F |
| Default | `false` |

## Matrix
| Mirror flag | Behavior |
|---|---|
| OFF | Legacy / Results V2 unchanged |
| ON | 9F mirror + 9G sheets |

QA: `--dart-define=MIRA_FACE_RESULT_MIRROR_V1=true`
