import '../contracts/capture_reason_codes.dart';
import '../contracts/face_capture_guidance_vm.dart';
import '../contracts/face_capture_readiness_result.dart';
import '../policy/face_capture_priority_policy.dart';

/// Maps readiness → Arabic microcopy (calm, short, non-technical).
abstract final class FaceCaptureGuidanceMapper {
  FaceCaptureGuidanceMapper._();

  static FaceCaptureGuidanceVm toVm(FaceCaptureReadinessResult result) {
    final copy = _copyFor(result);
    return FaceCaptureGuidanceVm(
      state: result.state,
      titleAr: copy.$1,
      instructionAr: copy.$2,
      accessibilityLabel: '${copy.$1}. ${copy.$2}',
      severity: FaceCapturePriorityPolicy.severity(result.state),
      isReady: result.isReady,
      canManualCapture: result.canManualCapture,
      autoCaptureEligible: result.autoCaptureEligible,
      truthClass: result.truthClass,
      reasonCode: result.reasonCode,
    );
  }

  static (String, String) _copyFor(FaceCaptureReadinessResult r) {
    switch (r.reasonCode) {
      case CaptureReasonCodes.permissionDenied:
        return ('الكاميرا', 'اسمحي بالوصول للكاميرا للمتابعة.');
      case CaptureReasonCodes.cameraUnavailable:
        return ('الكاميرا', 'الكاميرا غير متاحة حاليًا.');
      case CaptureReasonCodes.cameraInitializing:
      case CaptureReasonCodes.cameraPaused:
        return ('جاري التجهيز', 'لحظات… نجهّز الكاميرا.');
      case CaptureReasonCodes.noFace:
      case CaptureReasonCodes.faceUnknown:
        return ('ضعي وجهك', 'ضعي وجهك داخل الإطار.');
      case CaptureReasonCodes.multipleFaces:
        return ('وجه واحد', 'ابقي وجهًا واحدًا فقط في الإطار.');
      case CaptureReasonCodes.centerFace:
        return ('في المنتصف', 'حرّكي وجهك لمنتصف الإطار.');
      case CaptureReasonCodes.moveCloser:
        return ('اقتربي', 'اقتربي قليلًا.');
      case CaptureReasonCodes.moveFarther:
        return ('ابتعدي', 'ابتعدي قليلًا.');
      case CaptureReasonCodes.turnLeft:
        // Correct SUBJECT_RIGHT bias → cue to turn toward subject-left / camera.
        return ('انظري للكاميرا', 'أديري وجهك قليلًا نحو اليسار.');
      case CaptureReasonCodes.turnRight:
        return ('انظري للكاميرا', 'أديري وجهك قليلًا نحو اليمين.');
      case CaptureReasonCodes.lookUp:
        return ('انظري للكاميرا', 'ارفعي نظرك قليلًا.');
      case CaptureReasonCodes.lookDown:
        return ('انظري للكاميرا', 'اخفضي نظرك قليلًا.');
      case CaptureReasonCodes.straighten:
        return ('عدّلي الزاوية', 'عدّلي رأسك بشكل مستقيم.');
      case CaptureReasonCodes.adjustPose:
        return ('انظري مباشرة', 'انظري مباشرة للكاميرا.');
      case CaptureReasonCodes.lowLight:
        return ('الإضاءة', 'الإضاءة منخفضة — اقتربي من نور أوضح.');
      case CaptureReasonCodes.overexposed:
        return ('الإضاءة', 'الإضاءة قوية — قلّلي الضوء المباشر.');
      case CaptureReasonCodes.blurry:
        return ('ثبات', 'الصورة غير واضحة — ثبّتي الجوال.');
      case CaptureReasonCodes.holdStill:
        return ('اثبتي', 'اثبتي لحظة.');
      case CaptureReasonCodes.staleFrame:
        return ('حدّثي الإطار', 'حرّكي قليلًا ثم ثبّتي وجهك.');
      case CaptureReasonCodes.autoEligible:
        return ('ممتاز', 'ممتاز — جاهزة');
      case CaptureReasonCodes.ready:
        return ('ممتاز', 'جاهزة للالتقاط');
      case CaptureReasonCodes.captureInProgress:
        return ('التقاط', 'جاري الالتقاط…');
      case CaptureReasonCodes.captured:
        return ('تم', 'تم الالتقاط');
      default:
        return ('وجّهي الكاميرا', 'ثبّتي وجهك داخل الإطار.');
    }
  }
}
