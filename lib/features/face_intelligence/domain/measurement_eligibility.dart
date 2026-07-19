/// Phase 4A — Measurement eligibility (Flutter).
///
/// JUSTIFICATION: Client mirror of API eligibility for on-device pre-checks.
/// REUSES [CaptureQualityThresholds] + [FaceGateRules] — does not duplicate thresholds.
library;

import '../../../core/face_gate/face_gate_result.dart';
import '../../../core/face_gate/face_gate_rules.dart';
import '../../skin_analysis/domain/image_quality/capture_quality_thresholds.dart';

const measurementEligibilityVersion = 'face-eligibility-v1';

class MeasurementEligibilityResult {
  final String version;
  final String thresholdVersion;
  final bool eligible;
  final List<String> reasonCodes;
  final String messageAr;
  final String messageEn;

  const MeasurementEligibilityResult({
    required this.version,
    required this.thresholdVersion,
    required this.eligible,
    required this.reasonCodes,
    required this.messageAr,
    required this.messageEn,
  });
}

/// Composes existing [FaceGateRules] — single owner of pose rejection rules.
abstract final class MeasurementEligibility {
  MeasurementEligibility._();

  /// From a completed [FaceGateResult] (accepted or rejected).
  static MeasurementEligibilityResult fromFaceGate(
    FaceGateResult gate, {
    bool? captureQualityAcceptable,
  }) {
    final codes = <String>[];
    if (captureQualityAcceptable == false) {
      codes.add('capture_quality_blocked');
    }
    if (!gate.isAccepted) {
      if (gate.reasonCode != null) codes.add(gate.reasonCode!);
    } else {
      // Re-validate pose fields with the same rules (deterministic).
      final recheck = FaceGateRules.evaluate(
        faceCount: gate.faceCount ?? 1,
        faceAreaRatio: gate.faceAreaRatio ?? 0.2,
        headYawDegrees: gate.headYawDegrees,
        headPitchDegrees: gate.headPitchDegrees,
        headRollDegrees: gate.headRollDegrees,
        centerOffsetXRatio: gate.centerOffsetXRatio,
        centerOffsetYRatio: gate.centerOffsetYRatio,
      );
      if (!recheck.isAccepted && recheck.reasonCode != null) {
        codes.add(recheck.reasonCode!);
      }
    }

    final unique = codes.toSet().toList();
    final eligible = unique.isEmpty;
    return MeasurementEligibilityResult(
      version: measurementEligibilityVersion,
      thresholdVersion: CaptureQualityThresholds.version,
      eligible: eligible,
      reasonCodes: unique,
      messageAr: eligible
          ? 'القياس مؤهل — هندسة الوجه لاحقاً (4B).'
          : 'القياس غير مؤهل — المقاييس تبقى غير متاحة.',
      messageEn: eligible
          ? 'Measurement eligible — geometry later (4B).'
          : 'Measurement not eligible — metrics stay unavailable.',
    );
  }
}
