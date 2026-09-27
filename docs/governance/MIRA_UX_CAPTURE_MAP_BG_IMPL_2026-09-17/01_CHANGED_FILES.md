# CHANGED_FILES

## Production
| Path | Change |
|------|--------|
| `lib/features/skin_analysis/presentation/widgets/face_capture_panel.dart` | Manual shutter mesh+freshness; no CK ready; no auto; minimal post gate |
| `lib/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart` | `canTakePhoto` + preview overlap + maxAge |
| `lib/features/skin_analysis/domain/image_quality/post_capture_minimal_gate.dart` | NEW — HD 1080 + presence/area only |
| `lib/core/face_gate/face_gate_rules.dart` | `evaluatePresenceAndArea` |
| `lib/core/face_gate/face_gate_validator.dart` | `validatePresenceAndArea` |
| `ios/Runner/ApplePersonMattingChannel.swift` | Composite bg #FFF7FA |
| `lib/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart` | explorerStage Mist Blush |
| `lib/features/results_experience/presentation/widgets/results_skin_map_panel.dart` | Stage color #FFF7FA |

## Tests
| Path | Change |
|------|--------|
| `test/skin_analysis/manual_capture_shutter_and_minimal_gate_test.dart` | NEW |

## Docs (this pack)
| Path |
|------|
| `00_SUMMARY.md` |
| `01_DEVICE_PROOF_STATUS.md` |
| `02_POST_CAPTURE_BLOCKERS.md` |
| `test_results.txt` |
