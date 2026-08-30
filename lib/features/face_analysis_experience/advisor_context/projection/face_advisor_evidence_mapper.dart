import '../contracts/face_advisor_context.dart';

/// Client-side public evidence units for tests / Law #34 preparation.
///
/// Phase 9M: this mapper is **not** an evidence authority. It must not treat
/// [FaceAdvisorContext.publicFactAr] / [FaceAdvisorContext.reasonAr] as
/// canonical Face claims. Real sealing happens server-side after reconciling
/// selection refs against the stored Face Intelligence report.
class FaceAdvisorEvidenceUnit {
  final String evidenceId;
  final String claimKey;
  final String statementAr;
  final String confidence;
  final String sourceRef;
  final String subsystemId;
  final bool stale;
  final String? limitation;

  const FaceAdvisorEvidenceUnit({
    required this.evidenceId,
    required this.claimKey,
    required this.statementAr,
    required this.confidence,
    required this.sourceRef,
    this.subsystemId = 'face_intelligence',
    this.stale = false,
    this.limitation,
  });
}

/// Deterministic FaceAdvisorContext → public evidence *hints* (refs only).
///
/// Does **not** project client free text. Server owns canonical statements.
abstract final class FaceAdvisorEvidenceMapper {
  FaceAdvisorEvidenceMapper._();

  static List<FaceAdvisorEvidenceUnit> map(FaceAdvisorContext ctx) {
    final units = <FaceAdvisorEvidenceUnit>[];
    final conf = ctx.confidenceQualifier != null ? 'low' : 'medium';

    // Selection refs → claim keys only. Statement is a non-authoritative placeholder
    // that never copies client publicFactAr/reasonAr (9M).
    final ref = ctx.frozenRecommendationRef ??
        ctx.selectedInsightId ??
        ctx.selectedDetailRef ??
        ctx.selectedResultId ??
        ctx.selectedGuidanceId;

    if (ref != null && ref.isNotEmpty) {
      units.add(
        FaceAdvisorEvidenceUnit(
          evidenceId: 'ev_face_ref_${ctx.contextType.name}_$ref',
          claimKey: ctx.contextType == FaceAdvisorContextType.guidance
              ? 'face.recommendation.$ref'
              : 'face.context.${ctx.contextType.name}',
          statementAr:
              'مرجع اختيار يُحل على السيرفر من تقرير Face المخزّن — وليس نص العميل.',
          confidence: conf,
          sourceRef: ref,
          stale: ctx.evidenceStale,
          limitation: ctx.confidenceQualifier,
        ),
      );
    }

    if (ctx.contextType == FaceAdvisorContextType.region) {
      units.add(
        const FaceAdvisorEvidenceUnit(
          evidenceId: 'ev_face_region_illustrative',
          claimKey: 'face.region.association',
          statementAr:
              'ارتباط المنطقة توضيحي/دلالي — وليس قياسًا موضعيًا مستقلًا ما لم يُذكر خلاف ذلك.',
          confidence: 'medium',
          sourceRef: 'region_policy',
        ),
      );
    }

    for (final lim in ctx.limitationRefs) {
      units.add(
        FaceAdvisorEvidenceUnit(
          evidenceId: 'ev_face_lim_$lim',
          claimKey: 'face.limitation.$lim',
          statementAr: 'يوجد قيد مرتبط بهذه النتيجة.',
          confidence: 'low',
          sourceRef: lim,
          stale: ctx.evidenceStale,
        ),
      );
    }

    return List.unmodifiable(units);
  }

  /// Reject forged claims not present in projected units (Law #34 client check).
  static bool allowsClaim({
    required List<FaceAdvisorEvidenceUnit> units,
    required String claimKey,
  }) {
    return units.any((u) => u.claimKey == claimKey);
  }

  /// Client free text must never appear in mapped units (9M invariant).
  static bool containsClientFreeText({
    required List<FaceAdvisorEvidenceUnit> units,
    required FaceAdvisorContext ctx,
  }) {
    final needles = <String>[
      if (ctx.publicFactAr != null && ctx.publicFactAr!.trim().isNotEmpty)
        ctx.publicFactAr!.trim(),
      if (ctx.reasonAr != null && ctx.reasonAr!.trim().isNotEmpty)
        ctx.reasonAr!.trim(),
    ];
    if (needles.isEmpty) return false;
    return units.any(
      (u) => needles.any((n) => u.statementAr.contains(n)),
    );
  }
}
