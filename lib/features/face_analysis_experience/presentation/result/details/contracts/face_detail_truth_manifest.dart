/// Law #40 truth manifest entries for Phase 9G detail sheets.
class FaceDetailTruthEntry {
  final String component;
  final String truthClass;
  final String source;
  final String claimAllowed;
  final String claimForbidden;

  const FaceDetailTruthEntry({
    required this.component,
    required this.truthClass,
    required this.source,
    required this.claimAllowed,
    required this.claimForbidden,
  });
}

abstract final class FaceDetailTruthManifest {
  FaceDetailTruthManifest._();

  static const version = 'face-detail-sheet-truth-v1';

  static const entries = <FaceDetailTruthEntry>[
    FaceDetailTruthEntry(
      component: 'sheet_title',
      truthClass: 'PUBLIC_PROJECTION',
      source: 'FaceDetailSheetVm.titleAr from 9E',
      claimAllowed: 'عنوان النتيجة المعروضة',
      claimForbidden: 'تحليل جديد أو درجة جمال',
    ),
    FaceDetailTruthEntry(
      component: 'metric_value',
      truthClass: 'MEASURED_OR_DERIVED_PER_VM',
      source: 'FaceInsightVm / FacePrimaryResultVm',
      claimAllowed: 'قيمة/تسمية معتمدة من سياسة 9E',
      claimForbidden: 'نسب خام غير معتمدة / Beauty Score',
    ),
    FaceDetailTruthEntry(
      component: 'region_highlight_sync',
      truthClass: 'ILLUSTRATIVE',
      source: 'FacePresentationRegion + mirror selection',
      claimAllowed: 'إبراز توضيحي للمنطقة المرتبطة',
      claimForbidden: 'قياس بكسل دقيق / اكتشفنا هنا',
    ),
    FaceDetailTruthEntry(
      component: 'confidence_qualifier',
      truthClass: 'PUBLIC_PROJECTION',
      source: 'FaceConfidencePresentation + qualifier',
      claimAllowed: 'مؤهل ثقة عام',
      claimForbidden: 'ثقة مزود خام / نسبة جمال',
    ),
    FaceDetailTruthEntry(
      component: 'sheet_recommendation',
      truthClass: 'PROJECTED_ONLY_IF_OWNED',
      source: 'FaceNextActionVm / retake / Ask Mira',
      claimAllowed: 'فعل موجود في الإسقاط',
      claimForbidden: 'نصيحة عامة مخترعة / محرك توصيات جديد',
    ),
    FaceDetailTruthEntry(
      component: 'sheet_open_motion',
      truthClass: 'DECORATIVE',
      source: 'Modal bottom sheet transition',
      claimAllowed: 'انتقال عرض',
      claimForbidden: 'إعادة مسح / نقيس الآن',
    ),
  ];
}
