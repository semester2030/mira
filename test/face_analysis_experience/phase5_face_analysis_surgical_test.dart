import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/presentation/analysis/contracts/face_analysis_journey.dart';
import 'package:mirra/features/face_analysis_experience/presentation/analysis/contracts/analysis_motion_semantics.dart';

void main() {
  group('Face analysis journey Soft Laser gate', () {
    test('Soft Laser forbidden during submitting', () {
      expect(
        faceAnalysisAllowsSoftLaser(FaceAnalysisJourneyPhase.submitting),
        isFalse,
      );
      expect(
        pipelineStatusForSoftLaser(FaceAnalysisJourneyPhase.submitting),
        isNull,
      );
    });

    test('Soft Laser allowed during processing', () {
      expect(
        faceAnalysisAllowsSoftLaser(FaceAnalysisJourneyPhase.processing),
        isTrue,
      );
      expect(
        pipelineStatusForSoftLaser(FaceAnalysisJourneyPhase.processing),
        AnalysisPipelineStatus.running,
      );
    });

    test('SUBMITTING != PROCESSING', () {
      expect(
        FaceAnalysisJourneyPhase.submitting ==
            FaceAnalysisJourneyPhase.processing,
        isFalse,
      );
    });
  });

  group('Face analysis error mapping', () {
    test('lighting_dark → recapture UX', () {
      final e = mapFaceAnalysisError(
        statusCode: 400,
        code: 'CAPTURE_LIGHTING_TOO_DARK',
        message: 'dark',
      );
      expect(e.requiresRecapture, isTrue);
      expect(e.userAction, FaceAnalysisUserAction.recapture);
      expect(e.titleAr, 'الإضاءة منخفضة');
      expect(e.snackMessage.toLowerCase(), isNot(contains('exception')));
    });

    test('face_out_of_bound → recapture UX', () {
      final e = mapFaceAnalysisError(
        statusCode: 400,
        code: 'CAPTURE_FACE_OUT_OF_BOUNDS',
      );
      expect(e.requiresRecapture, isTrue);
      expect(e.titleAr, 'اجعل وجهك داخل الإطار');
    });

    test('503 → retry UX without technical exception text', () {
      final e = mapFaceAnalysisError(
        statusCode: 503,
        message: 'Service Unavailable Exception',
      );
      expect(e.requiresRecapture, isFalse);
      expect(e.userAction, FaceAnalysisUserAction.retry);
      expect(e.snackMessage.toLowerCase(), isNot(contains('exception')));
      expect(e.titleAr, 'تعذر بدء التحليل حاليًا');
    });

    test('timeout → retry UX', () {
      final e = mapFaceAnalysisError(statusCode: 504, code: 'provider_timeout');
      expect(e.code, 'TIMEOUT');
      expect(e.retryable, isTrue);
    });

    test('Law #41 — Soft Laser not tied to idle/ready/submitting', () {
      for (final phase in [
        FaceAnalysisJourneyPhase.idle,
        FaceAnalysisJourneyPhase.ready,
        FaceAnalysisJourneyPhase.submitting,
        FaceAnalysisJourneyPhase.captured,
      ]) {
        expect(faceAnalysisAllowsSoftLaser(phase), isFalse, reason: '$phase');
      }
    });
  });
}
