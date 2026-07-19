/// Operational Hardening — Face Intelligence runtime status (Flutter).
///
/// Explicit states replace silent faceIntel omission.
library;

/// Canonical Face Intelligence runtime statuses (shared with API).
enum FaceIntelRuntimeStatus {
  available,
  unavailable,
  failed,
  skipped,
  notRequested,
}

extension FaceIntelRuntimeStatusWire on FaceIntelRuntimeStatus {
  String get wire {
    switch (this) {
      case FaceIntelRuntimeStatus.available:
        return 'AVAILABLE';
      case FaceIntelRuntimeStatus.unavailable:
        return 'UNAVAILABLE';
      case FaceIntelRuntimeStatus.failed:
        return 'FAILED';
      case FaceIntelRuntimeStatus.skipped:
        return 'SKIPPED';
      case FaceIntelRuntimeStatus.notRequested:
        return 'NOT_REQUESTED';
    }
  }

  static FaceIntelRuntimeStatus? tryParse(String? raw) {
    switch (raw?.toUpperCase()) {
      case 'AVAILABLE':
        return FaceIntelRuntimeStatus.available;
      case 'UNAVAILABLE':
        return FaceIntelRuntimeStatus.unavailable;
      case 'FAILED':
        return FaceIntelRuntimeStatus.failed;
      case 'SKIPPED':
        return FaceIntelRuntimeStatus.skipped;
      case 'NOT_REQUESTED':
        return FaceIntelRuntimeStatus.notRequested;
      default:
        return null;
    }
  }
}

/// Traceable runtime outcome for Face Intelligence (never silent).
class FaceIntelRuntimeState {
  final FaceIntelRuntimeStatus status;
  final String reason;
  final String stage;
  final int confidence;
  final String userVisibleAr;
  final String userVisibleEn;

  const FaceIntelRuntimeState({
    required this.status,
    required this.reason,
    required this.stage,
    required this.confidence,
    required this.userVisibleAr,
    required this.userVisibleEn,
  });

  bool get showNotice =>
      status == FaceIntelRuntimeStatus.failed ||
      status == FaceIntelRuntimeStatus.skipped ||
      status == FaceIntelRuntimeStatus.unavailable;

  Map<String, dynamic> toJson() => {
        'status': status.wire,
        'reason': reason,
        'stage': stage,
        'confidence': confidence,
        'userVisibleAr': userVisibleAr,
        'userVisibleEn': userVisibleEn,
      };

  static FaceIntelRuntimeState? tryParse(dynamic raw) {
    if (raw is! Map) return null;
    final map = Map<String, dynamic>.from(raw);
    final status = FaceIntelRuntimeStatusWire.tryParse(map['status'] as String?);
    if (status == null) return null;
    return FaceIntelRuntimeState(
      status: status,
      reason: map['reason'] as String? ?? '',
      stage: map['stage'] as String? ?? '',
      confidence: (map['confidence'] as num?)?.toInt() ?? 0,
      userVisibleAr: map['userVisibleAr'] as String? ?? '',
      userVisibleEn: map['userVisibleEn'] as String? ?? '',
    );
  }

  static FaceIntelRuntimeState available({
    required String stage,
    int confidence = 90,
  }) =>
      FaceIntelRuntimeState(
        status: FaceIntelRuntimeStatus.available,
        reason: 'face_intel_inputs_ready',
        stage: stage,
        confidence: confidence,
        userVisibleAr: 'تم تجهيز قراءة الملامح.',
        userVisibleEn: 'Face feature reading is ready.',
      );

  static FaceIntelRuntimeState unavailable({
    required String reason,
    required String stage,
    int confidence = 40,
    String? userVisibleAr,
    String? userVisibleEn,
  }) =>
      FaceIntelRuntimeState(
        status: FaceIntelRuntimeStatus.unavailable,
        reason: reason,
        stage: stage,
        confidence: confidence,
        userVisibleAr: userVisibleAr ??
            'قراءة الملامح غير متاحة لهذه اللقطة — أعيدي الالتقاط بوجه أمامي ثابت.',
        userVisibleEn: userVisibleEn ??
            'Face feature reading is unavailable for this capture — retake with a steady frontal face.',
      );

  static FaceIntelRuntimeState failed({
    required String reason,
    required String stage,
    int confidence = 10,
  }) =>
      FaceIntelRuntimeState(
        status: FaceIntelRuntimeStatus.failed,
        reason: reason,
        stage: stage,
        confidence: confidence,
        userVisibleAr:
            'تعذر إكمال قراءة الملامح — التحليل الجلدي اكتمل دون قسم الملامح.',
        userVisibleEn:
            'Face feature reading failed — skin analysis completed without the face section.',
      );

  static FaceIntelRuntimeState skipped({
    required String reason,
    required String stage,
    int confidence = 0,
  }) =>
      FaceIntelRuntimeState(
        status: FaceIntelRuntimeStatus.skipped,
        reason: reason,
        stage: stage,
        confidence: confidence,
        userVisibleAr: 'تم تخطي قراءة الملامح لهذه الجلسة.',
        userVisibleEn: 'Face feature reading was skipped for this session.',
      );

  static const notRequested = FaceIntelRuntimeState(
    status: FaceIntelRuntimeStatus.notRequested,
    reason: 'face_intel_not_requested',
    stage: 'client',
    confidence: 0,
    userVisibleAr: 'لم تُطلب قراءة الملامح.',
    userVisibleEn: 'Face feature reading was not requested.',
  );
}
