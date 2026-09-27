import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/contracts/result_enums.dart';
import 'package:mirra/features/results_experience/contracts/result_presentation_vms.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_concern_catalog.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_controller.dart';

ResultMapConcernVM _mapConcern(String id) => ResultMapConcernVM(
  id: id,
  labelAr: id,
  evidenceRef: 'map:$id',
  visibility: VisibilityState.visibleSecondary,
);

ResultMetricVM _metric(String id, double score) => ResultMetricVM(
  id: 'metric_$id',
  titleAr: id,
  summaryAr: id,
  confidence: ConfidenceState.medium,
  evidenceRef: 'm:$id',
  visibility: VisibilityState.visibleSecondary,
  interaction: InteractionState.none,
  limitation: LimitationState.none,
  condition: ResultScoreView(
    category: ScoreCategory.wellnessScore,
    direction: ScoreDirection.higherBetter,
    value: score,
    statusLabelAr: 'ok',
    colorRole: ColorRole.wellness,
    numericVisible: true,
    accessibilityTextAr: '$score',
  ),
  severityOrWellness: null,
  statusLabelAr: 'ok',
  explanationAr: '',
  evidenceAvailable: true,
  comparisonEligible: false,
);

Map<String, dynamic> _sessionRow({
  required String concernType,
  String? region,
  double? uiScore,
  bool withBytes = false,
}) {
  return {
    'concernType': concernType,
    if (region != null) 'region': region,
    if (uiScore != null) 'uiScore': uiScore,
    if (withBytes)
      'maskBase64': base64Encode(Uint8List.fromList([137, 80, 78, 71])),
  };
}

void main() {
  group('FaceExplorerConcernCatalog', () {
    test('default grid always exposes six primary slots in approved order', () {
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: const [],
        reportMetrics: const [],
        session: null,
        fromHistory: false,
        analysisSettled: true,
      );
      expect(catalog.primary.map((s) => s.id).toList(), [
        'pores',
        'wrinkles',
        'acne',
        'pigmentation',
        'hydration',
        'oiliness',
      ]);
      expect(catalog.defaultVisible, hasLength(6));
      expect(
        catalog.defaultVisible.every(
          (s) => s.status == FaceExplorerMetricSlotStatus.unavailable,
        ),
        isTrue,
      );
      expect(FaceExplorerController.primaryConsumerIds, hasLength(6));
    });

    test('session oiliness appears even when absent from map.concerns', () {
      final session = PerfectMaskSession.fromApiPayload([
        _sessionRow(concernType: 'hd_oiliness', uiScore: 86, withBytes: true),
        _sessionRow(
          concernType: 'hd_pore',
          region: 'whole',
          uiScore: 64,
          withBytes: true,
        ),
      ]);
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: [_mapConcern('pores')],
        reportMetrics: const [],
        session: session,
        fromHistory: false,
        analysisSettled: true,
      );
      final oil = catalog.primary.firstWhere((s) => s.id == 'oiliness');
      expect(oil.status, FaceExplorerMetricSlotStatus.ready);
      expect(oil.hasScore, isTrue);
      expect(oil.hasMask, isTrue);
      expect(oil.fromSession, isTrue);
      expect(oil.fromMapConcerns, isFalse);
      expect(catalog.readyIds, containsAll(['pores', 'oiliness']));
    });

    test('expand extras without duplicating primary providers', () {
      final session = PerfectMaskSession.fromApiPayload([
        _sessionRow(concernType: 'hd_pore', region: 'whole', uiScore: 60),
        _sessionRow(concernType: 'hd_wrinkle', region: 'whole', uiScore: 70),
        _sessionRow(concernType: 'hd_acne', region: 'whole', uiScore: 80),
        _sessionRow(concernType: 'hd_age_spot', uiScore: 88),
        _sessionRow(concernType: 'hd_moisture', uiScore: 72),
        _sessionRow(concernType: 'hd_oiliness', uiScore: 86),
        _sessionRow(concernType: 'hd_redness', uiScore: 81),
        _sessionRow(concernType: 'hd_texture', uiScore: 55),
      ]);
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: [
          _mapConcern('pores'),
          _mapConcern('wrinkles'),
          _mapConcern('acne'),
          _mapConcern('pigmentation'),
          _mapConcern('hydration'),
          _mapConcern('oiliness'),
          _mapConcern('redness'),
          _mapConcern('texture'),
        ],
        reportMetrics: const [],
        session: session,
        fromHistory: false,
        analysisSettled: true,
      );
      expect(catalog.defaultVisible, hasLength(6));
      expect(catalog.expandedVisible.length, greaterThan(6));
      final ids = catalog.expandedVisible.map((s) => s.id).toList();
      expect(ids.toSet().length, ids.length);
      expect(
        catalog.extras.every(
          (s) => !FaceExplorerConcernCatalog.primaryIds.contains(s.id),
        ),
        isTrue,
      );
      expect(
        catalog.extras.map((s) => s.id),
        containsAll(['redness', 'texture']),
      );
    });

    test('score-only session entry is ready without inventing a mask', () {
      final session = PerfectMaskSession.fromApiPayload([
        _sessionRow(concernType: 'hd_wrinkle', region: 'whole', uiScore: 76),
      ]);
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: const [],
        reportMetrics: const [],
        session: session,
        fromHistory: false,
        analysisSettled: true,
      );
      final w = catalog.primary.firstWhere((s) => s.id == 'wrinkles');
      expect(w.status, FaceExplorerMetricSlotStatus.ready);
      expect(w.hasScore, isTrue);
      expect(w.hasMask, isFalse);
    });

    test('provider id aliases unify without duplicate chips', () {
      final session = PerfectMaskSession.fromApiPayload([
        _sessionRow(concernType: 'hd_pore', region: 'whole', uiScore: 61),
      ]);
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: [_mapConcern('pore'), _mapConcern('pores')],
        reportMetrics: const [],
        session: session,
        fromHistory: false,
        analysisSettled: true,
      );
      final poreSlots = catalog.primary
          .where((s) => s.providerType == 'hd_pore')
          .toList();
      expect(poreSlots, hasLength(1));
      expect(poreSlots.single.status, FaceExplorerMetricSlotStatus.ready);
    });

    test('partial results: missing primary is unavailable after settle', () {
      final session = PerfectMaskSession.fromApiPayload([
        _sessionRow(concernType: 'hd_pore', region: 'whole', uiScore: 64),
      ]);
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: [_mapConcern('pores')],
        reportMetrics: const [],
        session: session,
        fromHistory: false,
        analysisSettled: true,
      );
      final acne = catalog.primary.firstWhere((s) => s.id == 'acne');
      expect(acne.status, FaceExplorerMetricSlotStatus.unavailable);
      expect(acne.gapReason, FaceExplorerMetricGapReason.notReceived);
      expect(acne.hasScore, isFalse);
      expect(acne.hasMask, isFalse);
    });

    test('before settle missing primary is analyzing, not zero-filled', () {
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: const [],
        reportMetrics: const [],
        session: null,
        fromHistory: false,
        analysisSettled: false,
      );
      expect(
        catalog.primary.every(
          (s) => s.status == FaceExplorerMetricSlotStatus.analyzing,
        ),
        isTrue,
      );
      expect(
        catalog.primary.every((s) => s.hasScore == false && s.hasMask == false),
        isTrue,
      );
    });

    test('report metric score recovers provider missing from map.concerns', () {
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: [_mapConcern('pores')],
        reportMetrics: [_metric('oiliness', 86)],
        session: null,
        fromHistory: false,
        analysisSettled: true,
      );
      final oil = catalog.primary.firstWhere((s) => s.id == 'oiliness');
      expect(oil.status, FaceExplorerMetricSlotStatus.ready);
      expect(oil.hasScore, isTrue);
      expect(oil.fromReportMetrics, isTrue);
      expect(oil.fromMapConcerns, isFalse);
    });

    test('toggle expand keeps primary selection ids stable', () {
      final session = PerfectMaskSession.fromApiPayload([
        _sessionRow(concernType: 'hd_pore', region: 'whole', uiScore: 64),
        _sessionRow(concernType: 'hd_redness', uiScore: 70),
      ]);
      final catalog = FaceExplorerConcernCatalog.build(
        mapConcerns: [_mapConcern('pores'), _mapConcern('redness')],
        reportMetrics: const [],
        session: session,
        fromHistory: false,
        analysisSettled: true,
      );
      final collapsed = catalog
          .visible(showAll: false)
          .map((s) => s.id)
          .toList();
      final expanded = catalog.visible(showAll: true).map((s) => s.id).toList();
      expect(expanded.take(6).toList(), collapsed);
      expect(collapsed, contains('pores'));
      expect(expanded, contains('redness'));
    });
  });
}
