/// Law #40 visual truth manifest for Phase 9D components.
class AnalysisMotionTruthEntry {
  final String component;
  final String truthClass;
  final String source;
  final String claimAllowed;
  final String claimForbidden;

  const AnalysisMotionTruthEntry({
    required this.component,
    required this.truthClass,
    required this.source,
    required this.claimAllowed,
    required this.claimForbidden,
  });
}

abstract final class AnalysisMotionTruthManifest {
  AnalysisMotionTruthManifest._();

  static const version = 'face-analysis-motion-truth-v1';

  static const entries = <AnalysisMotionTruthEntry>[
    AnalysisMotionTruthEntry(
      component: 'captured_selfie',
      truthClass: 'SOURCE_IMAGE',
      source: 'FaceCapturePanel captured file',
      claimAllowed: 'صورتك الملتقطة',
      claimForbidden: 'نتيجة تحليل الوجه',
    ),
    AnalysisMotionTruthEntry(
      component: 'mediapipe_contour',
      truthClass: 'DERIVED',
      source: 'FaceMeshFrame.outline (capture-time MediaPipe)',
      claimAllowed: 'محيط مشتق من التتبع',
      claimForbidden: 'قياس Face Intelligence',
    ),
    AnalysisMotionTruthEntry(
      component: 'presentation_anchors',
      truthClass: 'DERIVED',
      source: 'CaptureContourReducer ≤18',
      claimAllowed: 'نقاط عرض محدودة',
      claimForbidden: '468 نقطة تحليل',
    ),
    AnalysisMotionTruthEntry(
      component: 'soft_laser_sweep',
      truthClass: 'DECORATIVE',
      source: 'SoftLaserPainter',
      claimAllowed: 'انتقال بصري أثناء الانتظار',
      claimForbidden: 'الليزر يقيس / يفحص / يحلل',
    ),
    AnalysisMotionTruthEntry(
      component: 'pearl_glow_anchor_activation',
      truthClass: 'DECORATIVE',
      source: 'AnalysisContourPainter glow',
      claimAllowed: 'تفعيل بصري زخرفي',
      claimForbidden: 'قياس منطقة الوجه الآن',
    ),
    AnalysisMotionTruthEntry(
      component: 'stage_text',
      truthClass: 'PRESENTATION_GROUP',
      source: 'AnalysisStageCopy over Loading wait',
      claimAllowed: 'حالة تجهيز مجمّعة',
      claimForbidden: 'نسبة إنجاز حقيقية / مراحل خادم حرفية',
    ),
    AnalysisMotionTruthEntry(
      component: 'fake_heatmap',
      truthClass: 'FORBIDDEN',
      source: 'n/a',
      claimAllowed: '—',
      claimForbidden: 'خريطة حرارية تحليلية',
    ),
    AnalysisMotionTruthEntry(
      component: 'fake_3d_depth',
      truthClass: 'FORBIDDEN',
      source: 'n/a',
      claimAllowed: '—',
      claimForbidden: 'مسح ثلاثي الأبعاد',
    ),
  ];
}
