/// Phase 9B — Face Capture Quality + Camera Contracts (presentation-owned).
///
/// Does NOT create Face Intelligence findings.
/// Does NOT fire production auto-capture shutter (9C owns UX integration).
library;

export 'contracts/capture_reason_codes.dart';
export 'contracts/capture_versions.dart';
export 'contracts/face_capture_guidance_vm.dart';
export 'contracts/face_capture_quality_input.dart';
export 'contracts/face_capture_readiness_result.dart';
export 'contracts/face_capture_semantic.dart';
export 'contracts/face_capture_truth.dart';
export 'evaluation/face_capture_latch.dart';
export 'evaluation/face_capture_readiness_evaluator.dart';
export 'evaluation/face_capture_stability_history.dart';
export 'mapping/face_capture_guidance_mapper.dart';
export 'policy/face_capture_hold_window_policy.dart';
export 'policy/face_capture_priority_policy.dart';
export 'policy/face_capture_readiness_policy.dart';
export 'adapters/face_capture_input_adapter.dart';
