// Phase 5 surgical Face Analysis journey states.
// SUBMITTING ≠ PROCESSING — Soft Laser only after processing threshold.
import 'analysis_motion_semantics.dart';

enum FaceAnalysisJourneyPhase {
  idle,
  capturing,
  captured,
  localValidation,
  ready,
  submitting,
  accepted,
  processing,
  completed,
  captureRejected,
  submissionFailed,
  processingFailed,
  serviceUnavailable,
  timeout,
}

enum FaceAnalysisUserAction {
  none,
  recapture,
  retry,
}

class FaceAnalysisJourneyError {
  final String code;
  final String titleAr;
  final String bodyAr;
  final FaceAnalysisUserAction userAction;
  final bool requiresRecapture;
  final bool retryable;

  const FaceAnalysisJourneyError({
    required this.code,
    required this.titleAr,
    required this.bodyAr,
    required this.userAction,
    required this.requiresRecapture,
    required this.retryable,
  });

  String get snackMessage => '$titleAr — $bodyAr';
}

/// Maps backend/domain errors to product Face UX (never Nest class names).
FaceAnalysisJourneyError mapFaceAnalysisError({
  int? statusCode,
  String? code,
  String? category,
  String? message,
  bool? requiresRecapture,
  String? userAction,
}) {
  final raw = '${code ?? ''} ${category ?? ''} ${message ?? ''}'.toLowerCase();
  final msg = (message ?? '').trim();

  bool looksTechnical(String m) {
    final lower = m.toLowerCase();
    return lower.contains('exception') ||
        lower.contains('service unavailable') ||
        lower.startsWith('http ') ||
        lower.contains('statuscode') ||
        lower.contains('internal server');
  }

  if (code == 'CAPTURE_LIGHTING_TOO_DARK' ||
      raw.contains('lighting_dark') ||
      raw.contains('lighting_too_dark') ||
      raw.contains('إضاءة ضعيفة') ||
      raw.contains('إضاءة منخفضة') ||
      raw.contains('أكثر إضاءة')) {
    return const FaceAnalysisJourneyError(
      code: 'CAPTURE_LIGHTING_TOO_DARK',
      titleAr: 'الإضاءة منخفضة',
      bodyAr: 'التقط الصورة في مكان أكثر إضاءة للحصول على تحليل أوضح.',
      userAction: FaceAnalysisUserAction.recapture,
      requiresRecapture: true,
      retryable: false,
    );
  }

  if (code == 'CAPTURE_FACE_OUT_OF_BOUNDS' ||
      raw.contains('out_of_bound') ||
      raw.contains('out_of_bounds') ||
      raw.contains('داخل الإطار')) {
    return const FaceAnalysisJourneyError(
      code: 'CAPTURE_FACE_OUT_OF_BOUNDS',
      titleAr: 'اجعل وجهك داخل الإطار',
      bodyAr: 'تأكد من ظهور الوجه كاملًا داخل الإطار ثم أعد التقاط الصورة.',
      userAction: FaceAnalysisUserAction.recapture,
      requiresRecapture: true,
      retryable: false,
    );
  }

  if (code == 'CAPTURE_NO_FACE' ||
      code == 'no_face' ||
      raw.contains('no_face') ||
      raw.contains('لم نتعرف على وجه')) {
    return const FaceAnalysisJourneyError(
      code: 'CAPTURE_NO_FACE',
      titleAr: 'لم نتعرف على وجه',
      bodyAr: 'التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.',
      userAction: FaceAnalysisUserAction.recapture,
      requiresRecapture: true,
      retryable: false,
    );
  }

  if (statusCode == 504 ||
      code == 'provider_timeout' ||
      raw.contains('timeout') ||
      raw.contains('وقتًا أطول')) {
    return const FaceAnalysisJourneyError(
      code: 'TIMEOUT',
      titleAr: 'استغرق التحليل وقتًا أطول من المتوقع',
      bodyAr: 'حاول مرة أخرى.',
      userAction: FaceAnalysisUserAction.retry,
      requiresRecapture: false,
      retryable: true,
    );
  }

  final forceRecapture = requiresRecapture == true ||
      userAction == 'recapture' ||
      category == 'capture_quality' ||
      statusCode == 400;

  if (forceRecapture) {
    final body = (!looksTechnical(msg) && msg.isNotEmpty)
        ? msg
        : 'أعيدي التقاط صورة أوضح ثم ابدئي التحليل.';
    return FaceAnalysisJourneyError(
      code: code ?? 'CAPTURE_REJECTED',
      titleAr: 'تعذر اعتماد الصورة',
      bodyAr: body,
      userAction: FaceAnalysisUserAction.recapture,
      requiresRecapture: true,
      retryable: false,
    );
  }

  if (statusCode == 503 ||
      category == 'provider' ||
      code == 'PROVIDER_UNAVAILABLE' ||
      code == 'provider_unavailable') {
    return const FaceAnalysisJourneyError(
      code: 'SERVICE_UNAVAILABLE',
      titleAr: 'تعذر بدء التحليل حاليًا',
      bodyAr: 'يمكنك المحاولة مرة أخرى بعد قليل.',
      userAction: FaceAnalysisUserAction.retry,
      requiresRecapture: false,
      retryable: true,
    );
  }

  if (!looksTechnical(msg) && msg.isNotEmpty) {
    return FaceAnalysisJourneyError(
      code: code ?? 'PROCESSING_FAILED',
      titleAr: 'تعذر إكمال التحليل',
      bodyAr: msg,
      userAction: FaceAnalysisUserAction.retry,
      requiresRecapture: false,
      retryable: true,
    );
  }

  return const FaceAnalysisJourneyError(
    code: 'SERVICE_UNAVAILABLE',
    titleAr: 'تعذر بدء التحليل حاليًا',
    bodyAr: 'يمكنك المحاولة مرة أخرى بعد قليل.',
    userAction: FaceAnalysisUserAction.retry,
    requiresRecapture: false,
    retryable: true,
  );
}

/// Soft Laser may run only in [processing] / [accepted]→processing / success choreography.
bool faceAnalysisAllowsSoftLaser(FaceAnalysisJourneyPhase phase) {
  switch (phase) {
    case FaceAnalysisJourneyPhase.processing:
    case FaceAnalysisJourneyPhase.accepted:
    case FaceAnalysisJourneyPhase.completed:
      return true;
    default:
      return false;
  }
}

/// Map journey phase onto legacy AnalysisPipelineStatus for Soft Laser overlay.
AnalysisPipelineStatus? pipelineStatusForSoftLaser(
  FaceAnalysisJourneyPhase phase,
) {
  switch (phase) {
    case FaceAnalysisJourneyPhase.processing:
    case FaceAnalysisJourneyPhase.accepted:
      return AnalysisPipelineStatus.running;
    case FaceAnalysisJourneyPhase.completed:
      return AnalysisPipelineStatus.succeeded;
    case FaceAnalysisJourneyPhase.captureRejected:
    case FaceAnalysisJourneyPhase.submissionFailed:
    case FaceAnalysisJourneyPhase.processingFailed:
    case FaceAnalysisJourneyPhase.serviceUnavailable:
    case FaceAnalysisJourneyPhase.timeout:
      return AnalysisPipelineStatus.failed;
    default:
      return null;
  }
}
