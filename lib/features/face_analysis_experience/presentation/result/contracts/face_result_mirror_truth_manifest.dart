/// Law #40 visual truth manifest for Phase 9F Result Mirror components.
class FaceResultMirrorTruthEntry {
  final String component;
  final String truthClass;
  final String source;
  final String claimAllowed;
  final String claimForbidden;

  const FaceResultMirrorTruthEntry({
    required this.component,
    required this.truthClass,
    required this.source,
    required this.claimAllowed,
    required this.claimForbidden,
  });
}

abstract final class FaceResultMirrorTruthManifest {
  FaceResultMirrorTruthManifest._();

  static const version = 'face-result-mirror-truth-v1';

  static const entries = <FaceResultMirrorTruthEntry>[
    FaceResultMirrorTruthEntry(
      component: 'captured_face',
      truthClass: 'SOURCE_IMAGE',
      source: 'FaceResultMirrorImageHold / capture path',
      claimAllowed: 'صورتك الملتقطة المعتمدة للنتيجة',
      claimForbidden: 'صورة حيّة أو إعادة التقاط ضمن المرآة',
    ),
    FaceResultMirrorTruthEntry(
      component: 'derived_contour',
      truthClass: 'DERIVED',
      source: '9E overlay eligibility + presentation geometry',
      claimAllowed: 'محيط عرض مشتق عند الأهلية',
      claimForbidden: '468 نقطة MediaPipe / قياس حي',
    ),
    FaceResultMirrorTruthEntry(
      component: 'presentation_anchors',
      truthClass: 'DERIVED',
      source: '≤18 presentation anchors when helpful',
      claimAllowed: 'مراسي عرض محدودة',
      claimForbidden: 'كل نقاط الشبكة أو إثبات قياس بكسل دقيق',
    ),
    FaceResultMirrorTruthEntry(
      component: 'high_level_region',
      truthClass: 'ILLUSTRATIVE',
      source: 'FaceRegionAssociationVm / FacePresentationRegion',
      claimAllowed: 'منطقة تشريحية عالية المستوى مرتبطة بالرؤية',
      claimForbidden: 'Mira قاست هذا البكسل بالضبط',
    ),
    FaceResultMirrorTruthEntry(
      component: 'region_glow',
      truthClass: 'DECORATIVE',
      source: 'FaceRegionInteractionLayer selection halo',
      claimAllowed: 'إبراز تفاعلي للاختيار',
      claimForbidden: 'خريطة حرارية طبية / منطقة مشكلة',
    ),
    FaceResultMirrorTruthEntry(
      component: 'primary_result',
      truthClass: 'MEASURED_OR_DERIVED_PER_VM',
      source: 'FacePrimaryResultVm.truthClass',
      claimAllowed: 'النتيجة الأولية كما في إسقاط 9E',
      claimForbidden: 'Beauty Score / Attractiveness / Golden Ratio Beauty',
    ),
    FaceResultMirrorTruthEntry(
      component: 'insight',
      truthClass: 'MEASURED_OR_DERIVED_PER_VM',
      source: 'FaceInsightVm from executive summary ≤3',
      claimAllowed: 'رؤية مختارة من 9E دون إعادة ترتيب',
      claimForbidden: 'إعادة حساب أولوية أو نص تحليل جديد',
    ),
    FaceResultMirrorTruthEntry(
      component: 'glass_chrome',
      truthClass: 'DECORATIVE',
      source: 'FaceResultTokens glass surfaces',
      claimAllowed: 'إطار زجاجي للقراءة',
      claimForbidden: 'دليل قياس أو ثقة إضافية',
    ),
    FaceResultMirrorTruthEntry(
      component: 'soft_laser_replay',
      truthClass: 'FORBIDDEN',
      source: 'n/a',
      claimAllowed: '—',
      claimForbidden: 'إعادة مسح / نفحص الآن / الليزر اكتشف بعد وجود النتيجة',
    ),
    FaceResultMirrorTruthEntry(
      component: 'beauty_score_display',
      truthClass: 'FORBIDDEN',
      source: 'n/a',
      claimAllowed: '—',
      claimForbidden: 'Beauty / Attractiveness / Golden-Ratio Beauty Score',
    ),
  ];
}
