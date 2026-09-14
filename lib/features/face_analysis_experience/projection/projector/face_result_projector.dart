import '../../../intelligence/domain/entities/face_intelligence_report.dart';
import '../contracts/face_result_enums.dart';
import '../contracts/face_result_vms.dart';
import '../localization/face_result_copy.dart';
import '../policies/face_insight_policies.dart';
import '../policies/face_numeric_visibility_policy.dart';
import '../validators/face_projection_validators.dart';
import '../versioning/face_result_projection_versions.dart';

/// Pure deterministic Face Result Projector (Phase 9E).
///
/// Selects / groups / labels / suppresses — never recomputes Face Intelligence.
class FaceResultProjector {
  const FaceResultProjector();

  FaceResultProjection project(
    FaceIntelligenceReport? report, {
    FaceResultProjectionContext context = const FaceResultProjectionContext(),
  }) {
    if (report == null) {
      final empty = _empty(context);
      FaceProjectionValidators.assertPublicSafe(empty);
      return empty;
    }

    final limitations = _limitations(report);
    final numericVisibility = <String, FaceNumericVisibility>{
      for (final m in report.metrics)
        m.id: FaceNumericVisibilityPolicy.forMetric(m.id),
    };

    final primary = _primary(report);
    final candidates = _insightCandidates(report);
    var deduped = FaceInsightDeduplication.dedupe(candidates);
    // Primary owns face shape — do not also list as insight.
    if (primary != null && primary.category == 'shape') {
      final shapeKey = FaceInsightDeduplication.semanticKey(
        shapeId: report.shape.shapeId,
        metricId: 'faceShape',
        category: 'shape',
        titleAr: primary.valueLabelAr,
      );
      deduped = deduped.where((i) => i.semanticKey != shapeKey).toList();
    }
    final insights = FaceInsightPriorityPolicy.selectTop(
      deduped
          .where((i) => i.eligibility != FacePresentationEligibility.detailOnly)
          .toList(),
    );

    final completeness = _completeness(report, primary, insights);
    final nextAction = _nextAction(report, primary, insights);
    final advisor = FaceAdvisorEntryVm(
      analysisId: report.analysisId,
      selectedInsightId: insights.isNotEmpty ? insights.first.id : null,
      evidenceRefs: [
        if (primary != null) primary.detailRef.id,
        ...insights.map((i) => i.detailRef.id),
      ],
      suggestedQuestionKeys: const [
        'face_shape_styling',
        'face_proportions_explain',
      ],
    );

    final headline = primary != null
        ? FaceResultCopy.shapeTitle(primary.valueLabelAr)
        : (completeness == FaceResultCompleteness.empty
            ? FaceResultCopy.emptyHeadline
            : 'ملامح وجهك');
    final support = completeness == FaceResultCompleteness.empty
        ? FaceResultCopy.emptySupport
        : completeness == FaceResultCompleteness.partial
            ? FaceResultCopy.partialSupport
            : _sanitizePublic(report.executiveSummaryAr);

    final summary = FaceExecutiveSummaryVm(
      id: 'face_exec_${report.analysisId}',
      primary: primary,
      insights: insights,
      nextAction: nextAction,
      advisorEntry: advisor,
      completeness: completeness,
      headlineAr: headline,
      supportAr: support,
    );

    final regions = _regions(insights);
    final detailRefs = <FaceDetailRef>[
      if (primary != null) primary.detailRef,
      ...insights.map((i) => i.detailRef),
      ...limitations.map(
        (l) => FaceDetailRef(id: l.id, owner: 'limitation'),
      ),
    ];

    final mirror = FaceResultMirrorVm(
      analysisId: report.analysisId,
      imageRef: context.imageRef,
      orientation: context.orientation,
      contourAllowed: report.measurementEligible,
      anchorsAllowed: report.measurementEligible,
      interactiveRegionsAllowed: insights.isNotEmpty,
      primary: primary,
      insightRefs: insights.map((i) => i.id).toList(growable: false),
      summary: summary,
    );

    final projection = FaceResultProjection(
      projectionVersion: FaceResultProjectionVersions.projection,
      completeness: completeness,
      executiveSummary: summary,
      mirror: mirror,
      limitations: limitations,
      regions: regions,
      detailRefs: detailRefs,
      numericVisibilityByMetric: numericVisibility,
      measurementEligible: report.measurementEligible,
    );

    FaceProjectionValidators.assertPublicSafe(projection);
    return projection;
  }

  FaceResultProjection _empty(FaceResultProjectionContext context) {
    final summary = FaceExecutiveSummaryVm(
      id: 'face_exec_empty',
      insights: const [],
      nextAction: const FaceNextActionVm(
        id: 'action_retake',
        kind: FaceNextActionKind.retake,
        labelAr: FaceResultCopy.retakeLabel,
      ),
      advisorEntry: const FaceAdvisorEntryVm(analysisId: ''),
      completeness: FaceResultCompleteness.empty,
      headlineAr: FaceResultCopy.emptyHeadline,
      supportAr: FaceResultCopy.emptySupport,
    );
    return FaceResultProjection(
      projectionVersion: FaceResultProjectionVersions.projection,
      completeness: FaceResultCompleteness.empty,
      executiveSummary: summary,
      mirror: FaceResultMirrorVm(
        analysisId: '',
        imageRef: context.imageRef,
        orientation: context.orientation,
        contourAllowed: false,
        anchorsAllowed: false,
        interactiveRegionsAllowed: false,
        insightRefs: const [],
        summary: summary,
      ),
      limitations: const [
        FaceLimitationVm(
          id: 'lim_no_report',
          titleAr: FaceResultCopy.emptyHeadline,
          bodyAr: FaceResultCopy.emptySupport,
        ),
      ],
      regions: const [],
      detailRefs: const [],
      numericVisibilityByMetric: const {},
      measurementEligible: false,
    );
  }

  FacePrimaryResultVm? _primary(FaceIntelligenceReport report) {
    final shape = report.shape;
    final eligibility = FaceConfidencePresentationPolicy.eligibilityForShape(
      available: shape.isAvailable,
      confidence: shape.confidence,
      measurementEligible: report.measurementEligible,
    );
    if (eligibility == FacePresentationEligibility.hide ||
        eligibility == FacePresentationEligibility.retakeRecommended) {
      return null;
    }
    if (!shape.isAvailable || shape.displayNameAr == null) return null;

    final confPres =
        FaceConfidencePresentationPolicy.forPrimary(shape.confidence);
    final qualifier =
        FaceConfidencePresentationPolicy.qualifierAr(shape.confidence);

    return FacePrimaryResultVm(
      resultId: 'primary_shape_${shape.shapeId ?? 'unknown'}',
      titleAr: FaceResultCopy.primaryTitle,
      subtitleAr: FaceResultCopy.primarySubtitleFallback,
      category: 'shape',
      valueLabelAr: shape.displayNameAr!,
      truthClass: FacePresentationTruthClass.derived,
      eligibility: eligibility,
      confidencePresentation: confPres,
      confidenceQualifierAr: qualifier,
      detailRef: FaceDetailRef(
        id: 'detail_shape_${shape.shapeId ?? 'unknown'}',
        owner: 'shape',
        metricId: 'faceShape',
      ),
      evidenceAvailable: true,
      limitation: eligibility == FacePresentationEligibility.displayWithQualification
          ? FaceLimitationVm(
              id: 'lim_shape_low_conf',
              titleAr: 'ثقة محدودة',
              bodyAr: 'شكل الوجه الأقرب مع ثقة محدودة — قد تحتاجين صورة أوضح.',
            )
          : null,
    );
  }

  List<FaceInsightVm> _insightCandidates(FaceIntelligenceReport report) {
    final out = <FaceInsightVm>[];

    // Shape insight (may dedupe with primary — same semantic key)
    if (report.shape.isAvailable && report.shape.shapeId != null) {
      final key = FaceInsightDeduplication.semanticKey(
        shapeId: report.shape.shapeId,
        metricId: 'faceShape',
        category: 'shape',
        titleAr: report.shape.displayNameAr ?? '',
      );
      out.add(
        FaceInsightVm(
          id: 'insight_shape_${report.shape.shapeId}',
          semanticKey: key,
          titleAr: FaceResultCopy.shapeTitle(report.shape.displayNameAr ?? ''),
          bodyAr: _sanitizePublic(
            report.shape.explanationAr.isNotEmpty
                ? report.shape.explanationAr
                : FaceResultCopy.primarySubtitleFallback,
          ),
          importance: FaceInsightPriorityPolicy.importanceFor(
            semanticKey: key,
            category: 'shape',
          ),
          truthClass: FacePresentationTruthClass.derived,
          relatedRegion: FacePresentationRegion.faceGeneral,
          detailRef: FaceDetailRef(
            id: 'detail_shape_${report.shape.shapeId}',
            owner: 'shape',
            metricId: 'faceShape',
          ),
          confidencePresentation:
              FaceConfidencePresentationPolicy.forPrimary(report.shape.confidence),
          eligibility: FacePresentationEligibility.display,
        ),
      );
    }

    for (final m in report.metrics) {
      if (!m.isAvailable) continue;
      if (m.id == 'faceShape') continue; // owned by primary/shape insight

      final visibility = FaceNumericVisibilityPolicy.forMetric(m.id);
      if (visibility == FaceNumericVisibility.hide) continue;

      final key = FaceInsightDeduplication.semanticKey(
        shapeId: null,
        metricId: m.id,
        category: 'proportion',
        titleAr: m.displayNameAr,
      );

      final body = m.id == 'symmetryCautious'
          ? FaceResultCopy.symmetryInsightBody
          : (FaceNumericVisibilityPolicy.relativeLabelAr(
                  m.id, m.normalizedValue) ??
              _sanitizePublic(m.displayNameAr));

      final title = m.id == 'symmetryCautious'
          ? FaceResultCopy.symmetryInsightTitle
          : m.displayNameAr;

      out.add(
        FaceInsightVm(
          id: 'insight_metric_${m.id}',
          semanticKey: key,
          titleAr: title,
          bodyAr: body,
          importance: FaceInsightPriorityPolicy.importanceFor(
            semanticKey: key,
            category: m.id == 'symmetryCautious' ? 'symmetry_note' : 'proportion',
          ),
          truthClass: FacePresentationTruthClass.measured,
          relatedRegion: FaceRegionMapping.forMetric(m.id),
          detailRef: FaceDetailRef(
            id: 'detail_metric_${m.id}',
            owner: m.id == 'symmetryCautious' ? 'symmetry' : 'geometry',
            metricId: m.id,
          ),
          confidencePresentation: FaceConfidencePresentation.detailOnly,
          eligibility: visibility == FaceNumericVisibility.detailOnly
              ? FacePresentationEligibility.detailOnly
              : FacePresentationEligibility.display,
          limitation: m.id == 'symmetryCautious'
              ? const FaceLimitationVm(
                  id: 'lim_symmetry_not_beauty',
                  titleAr: 'ملاحظة هيكلية',
                  bodyAr: FaceResultCopy.symmetryInsightBody,
                )
              : null,
        ),
      );
    }

    // Findings that aren't shape duplicates
    for (final f in report.notableFindings.isNotEmpty
        ? report.notableFindings
        : report.findings) {
      if (f.category == 'shape') continue; // owned by shape
      final key = FaceInsightDeduplication.semanticKey(
        shapeId: null,
        metricId: null,
        category: f.category,
        titleAr: f.titleAr,
      );
      out.add(
        FaceInsightVm(
          id: 'insight_finding_${f.id}',
          semanticKey: key,
          titleAr: _sanitizePublic(f.titleAr),
          bodyAr: _sanitizePublic(f.detailAr),
          importance: FaceInsightPriorityPolicy.importanceFor(
            semanticKey: key,
            category: f.category,
          ),
          truthClass: FacePresentationTruthClass.derived,
          relatedRegion: f.category == 'symmetry_note'
              ? FacePresentationRegion.faceGeneral
              : FacePresentationRegion.faceGeneral,
          detailRef: FaceDetailRef(id: 'detail_finding_${f.id}', owner: 'geometry'),
          confidencePresentation: FaceConfidencePresentation.detailOnly,
          eligibility: FacePresentationEligibility.display,
        ),
      );
    }

    return out;
  }

  List<FaceLimitationVm> _limitations(FaceIntelligenceReport report) {
    final out = <FaceLimitationVm>[
      const FaceLimitationVm(
        id: 'lim_cosmetic',
        titleAr: FaceResultCopy.cosmeticLimitationTitle,
        bodyAr: FaceResultCopy.cosmeticLimitationBody,
      ),
    ];
    if (!report.measurementEligible ||
        report.eligibilityReasonCodes.isNotEmpty) {
      out.add(
        FaceLimitationVm(
          id: 'lim_eligibility',
          titleAr: 'حدود القياس',
          bodyAr: FaceResultCopy.eligibilityLimitationAr(
            report.eligibilityReasonCodes,
          ),
        ),
      );
    }
    // Public-safe subset of engine limitations (no English internal jargon)
    for (var i = 0; i < report.limitations.length && i < 2; i++) {
      final raw = report.limitations[i];
      final safe = _sanitizePublic(raw);
      if (safe.isEmpty) continue;
      // Skip English-heavy limitation lines
      if (RegExp(r'[A-Za-z]{4,}').hasMatch(safe) &&
          !safe.contains('ميرا')) {
        continue;
      }
      out.add(
        FaceLimitationVm(
          id: 'lim_engine_$i',
          titleAr: FaceResultCopy.cosmeticLimitationTitle,
          bodyAr: safe,
        ),
      );
    }
    return out;
  }

  FaceNextActionVm _nextAction(
    FaceIntelligenceReport report,
    FacePrimaryResultVm? primary,
    List<FaceInsightVm> insights,
  ) {
    if (!report.measurementEligible || primary == null) {
      return const FaceNextActionVm(
        id: 'action_retake',
        kind: FaceNextActionKind.retake,
        labelAr: FaceResultCopy.retakeLabel,
      );
    }
    final styling = report.recommendations
        .where((r) => r.category != 'educational')
        .toList();
    if (styling.isNotEmpty) {
      return FaceNextActionVm(
        id: 'action_guidance',
        kind: FaceNextActionKind.openGuidance,
        labelAr: FaceResultCopy.openGuidanceLabel,
        detailRefId: 'detail_reco_${styling.first.id}',
      );
    }
    if (insights.isNotEmpty) {
      return FaceNextActionVm(
        id: 'action_details',
        kind: FaceNextActionKind.exploreDetails,
        labelAr: FaceResultCopy.exploreDetailsLabel,
        detailRefId: insights.first.detailRef.id,
      );
    }
    return const FaceNextActionVm(
      id: 'action_ask',
      kind: FaceNextActionKind.askMira,
      labelAr: FaceResultCopy.askMiraLabel,
    );
  }

  List<FaceRegionAssociationVm> _regions(List<FaceInsightVm> insights) {
    final map = <FacePresentationRegion, List<String>>{};
    for (final i in insights) {
      map.putIfAbsent(i.relatedRegion, () => []).add(i.id);
    }
    final keys = map.keys.toList()..sort((a, b) => a.name.compareTo(b.name));
    return [
      for (final r in keys)
        FaceRegionAssociationVm(
          region: r,
          insightIds: map[r]!,
          associationTruth: FacePresentationTruthClass.illustrative,
        ),
    ];
  }

  FaceResultCompleteness _completeness(
    FaceIntelligenceReport report,
    FacePrimaryResultVm? primary,
    List<FaceInsightVm> insights,
  ) {
    if (primary == null && insights.isEmpty) {
      return FaceResultCompleteness.empty;
    }
    final availableMetrics =
        report.metrics.where((m) => m.isAvailable).length;
    if (!report.measurementEligible ||
        primary == null ||
        availableMetrics < 3) {
      return FaceResultCompleteness.partial;
    }
    return FaceResultCompleteness.complete;
  }

  /// Strip provider/internal leaks from public copy without inventing findings.
  String _sanitizePublic(String text) {
    var out = text;
    const replacements = <String, String>{
      'locally_calculated': '',
      'on_device_landmarks': '',
      'raw=': '',
      'provider': '',
      'face-geom-ratios-thirds-sym-v1': '',
      'face-shape-hybrid-ratios-v1': '',
      'FaceHealthMap': 'خريطة صحة البشرة',
      'SVI': '',
      'Phase 4C': '',
      'Phase 4': '',
    };
    for (final e in replacements.entries) {
      out = out.replaceAll(e.key, e.value);
    }
    // Remove raw=0.xxxx remnants
    out = out.replaceAll(RegExp(r'raw=\d+(\.\d+)?'), '');
    out = out.replaceAll(RegExp(r'\s{2,}'), ' ').trim();
    // Soften absolute certainty / strip attractiveness score phrasing
    out = out.replaceAll('بالتأكيد', 'الأقرب');
    out = out.replaceAll('درجة جاذبية', 'تقييماً للجاذبية');
    out = out.replaceAll('درجة جمال', 'تقييماً للجمال');
    return out;
  }
}
