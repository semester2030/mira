import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/mappers/skin_result_mapper.dart';
import 'package:mirra/features/intelligence/data/mappers/mira_beauty_report_mapper.dart';
import 'package:mirra/features/intelligence/domain/entities/progress_forecast.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/intelligence/domain/services/local_progress_builder.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_score_hero.dart';
import 'package:mirra/features/intelligence/presentation/widgets/progress_timeline.dart';
import 'package:mirra/features/skin_analysis/data/models/skin_report_model.dart';
import 'package:mirra/shared/widgets/premium/beauty_score_ring.dart';

Map<String, dynamic> _json({
  required String createdAt,
  Object? hydration = _missing,
  Map<String, int>? concernScores,
}) {
  return {
    'skinType': 'مختلطة',
    'score': 70,
    'oiliness': 40,
    'pores': 1,
    'wrinkles': 1,
    'spots': 1,
    'advice': 'نصيحة',
    'createdAt': createdAt,
    if (hydration != _missing) 'hydration': hydration,
    if (concernScores != null) 'concernScores': concernScores,
  };
}

const _missing = Object();

SkinReportModel _read(String id, Map<String, dynamic> json) => SkinReportModel.fromJson(id, json);

void main() {
  test('T-REGRESSION-B3 explicit zero stays distinct from missing hydration', () {
    final zero = _read('z', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 0));
    final absent = _read('a', _json(createdAt: '2026-02-01T00:00:00.000'));
    expect(zero.hydration, 0);
    expect(absent.hydration, isNull);
    expect(LocalMiraReportBuilder.fromSkinReport(zero).overallScoreAvailable, isTrue);
    expect(LocalMiraReportBuilder.fromSkinReport(absent).overallScoreAvailable, isFalse);
  });

  test('T-OVERALL-ABSENCE-B3 missing hydration does not prove an overall change', () {
    final encoded = jsonEncode(_json(createdAt: '2026-02-01T00:00:00.000'));
    final older = _read('a', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 40));
    final absent = _read('b', _json(createdAt: '2026-02-01T00:00:00.000'));
    final nil = _read('c', _json(createdAt: '2026-02-01T00:00:00.000', hydration: null));
    final newer = _read('d', _json(createdAt: '2026-03-01T00:00:00.000', hydration: 40));
    expect(jsonEncode(_json(createdAt: '2026-02-01T00:00:00.000')), encoded);
    expect(absent.hydration, isNull);
    expect(LocalMiraReportBuilder.fromSkinReport(absent).faceHealthMap.overlayById('moisture')?.globalScore, isNull);

    for (final pair in [
      [older, absent],
      [absent, newer],
      [older, nil],
    ]) {
      final forecast = LocalProgressBuilder.fromReports(pair);
      expect(forecast.trends.where((row) => row.id == 'overall'), isEmpty);
      expect(forecast.headlineAr, overallComparisonUnavailableAr);
      expect(forecast.summaryAr, overallComparisonUnavailableAr);
      expect(forecast.projectedOverallScore30Days, isNull);
      expect(forecast.timeline.any((point) => point.overallScore == null), isTrue);
      expect(forecast.milestones.any((row) => row.titleAr.contains('مؤشر الجمال')), isFalse);
      expect(forecast.headlineAr.contains('مستقر'), isFalse);
    }
  });

  test('T-OVERALL-CONSUMERS-B3 availability survives display copy and blocks the goal', () {
    final absent = _read('a', _json(createdAt: '2026-02-01T00:00:00.000'));
    final built = LocalMiraReportBuilder.fromSkinReport(absent);
    expect(built.overallScoreAvailable, isFalse);
    expect(built.beautyJourney.nextGoal.scoreAvailable, isFalse);
    expect(built.beautyJourney.nextGoal.headlineAr, overallComparisonUnavailableAr);
    final shown = LocalMiraReportBuilder.presentStored(built);
    expect(shown.overallScoreAvailable, isFalse);
    expect(identical(shown, built), isFalse);
    expect(built.overallScoreAvailable, isFalse);

    final stored = MiraBeautyReportMapper.fromJson({'overallBeautyScore': 70});
    expect(stored.overallScoreAvailable, isNull);
    final displayed = LocalMiraReportBuilder.presentStored(stored);
    expect(displayed.overallBeautyScore, 70);
    expect(displayed.overallScoreAvailable, isNull);
    expect(displayed.beautyJourney.nextGoal.scoreAvailable, isFalse);

    final roundTrip = MiraBeautyReportMapper.fromJson({
      'overallBeautyScore': 41,
      'overallScoreAvailable': false,
    });
    expect(roundTrip.overallScoreAvailable, isFalse);
    expect(MiraBeautyReportMapper.fromJson({
      'overallBeautyScore': 50,
      'overallScoreAvailable': true,
    }).overallScoreAvailable, isTrue);

    final mapped = SkinResultMapper.fromReport(absent);
    expect(mapped.hydration, 0);
    final progress = LocalProgressBuilder.fromReports([
      _read('p', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 40)),
      absent,
    ]);
    expect(progress.trends.where((row) => row.id == 'overall'), isEmpty);
  });

  test('T-OVERALL-VALID-B3 explicit zero and concern scores stay comparable', () {
    ProgressForecast forecast(SkinReportModel a, SkinReportModel b) =>
        LocalProgressBuilder.fromReports([a, b]);

    final up = forecast(
      _read('z', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 0)),
      _read('f', _json(createdAt: '2026-02-01T00:00:00.000', hydration: 40)),
    );
    final moistureUp = up.trends.singleWhere((row) => row.id == 'moisture');
    expect(moistureUp.previousScore, 0);
    expect(moistureUp.currentScore, 40);
    expect(up.trends.singleWhere((row) => row.id == 'overall').previousScore, isNotNull);
    expect(up.headlineAr, isNot(overallComparisonUnavailableAr));
    expect(up.projectedOverallScore30Days, isNotNull);

    final down = forecast(
      _read('f2', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 40)),
      _read('z2', _json(createdAt: '2026-02-01T00:00:00.000', hydration: 0)),
    );
    final moistureDown = down.trends.singleWhere((row) => row.id == 'moisture');
    expect(moistureDown.previousScore, 40);
    expect(moistureDown.currentScore, 0);

    final concernZero = _read('c0', _json(
      createdAt: '2026-01-01T00:00:00.000',
      concernScores: {'moisture': 0, 'pore': 40},
    ));
    final concernForty = _read('c40', _json(
      createdAt: '2026-02-01T00:00:00.000',
      concernScores: {'moisture': 40, 'pore': 72},
    ));
    expect(concernZero.hydration, isNull);
    expect(LocalMiraReportBuilder.fromSkinReport(concernZero).overallScoreAvailable, isTrue);
    expect(LocalMiraReportBuilder.fromSkinReport(concernZero).faceHealthMap.overlayById('moisture')?.globalScore, 0);
    final kept = forecast(concernZero, concernForty);
    expect(kept.trends.singleWhere((row) => row.id == 'moisture').currentScore, 40);
    expect(kept.trends.singleWhere((row) => row.id == 'pore').previousScore, 40);
    expect(kept.trends.singleWhere((row) => row.id == 'pore').currentScore, 72);
    expect(kept.trends.where((row) => row.id == 'overall'), isNotEmpty);

    final poresOnly = forecast(
      _read('p1', _json(createdAt: '2026-01-01T00:00:00.000', concernScores: {'pore': 40})),
      _read('p2', _json(createdAt: '2026-02-01T00:00:00.000', concernScores: {'pore': 72})),
    );
    expect(poresOnly.trends.where((row) => row.id == 'overall'), isEmpty);
    expect(poresOnly.trends.singleWhere((row) => row.id == 'pore').currentScore, 72);
    expect(poresOnly.headlineAr, overallComparisonUnavailableAr);

    final complete = forecast(
      _read('k1', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 40)),
      _read('k2', _json(createdAt: '2026-02-01T00:00:00.000', hydration: 64)),
    );
    expect(complete.trends.singleWhere((row) => row.id == 'moisture').currentScore, 64);
    expect(complete.trends.where((row) => row.id == 'overall'), isNotEmpty);
    expect(complete.projectedOverallScore30Days, isNotNull);
    expect(complete.headlineAr, isNot(overallComparisonUnavailableAr));
  });

  testWidgets('T-OVERALL-ABSENCE-B3 hero and timeline do not draw the substituted score', (tester) async {
    final absent = LocalMiraReportBuilder.fromSkinReport(
      _read('a', _json(createdAt: '2026-02-01T00:00:00.000')),
    );
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: BeautyScoreHero(report: absent))));
    expect(find.text('غير متاح'), findsOneWidget);
    expect(find.byType(BeautyScoreRing), findsNothing);
    expect(find.text('41'), findsNothing);

    final forecast = LocalProgressBuilder.fromReports([
      _read('p', _json(createdAt: '2026-01-01T00:00:00.000', hydration: 40)),
      _read('b', _json(createdAt: '2026-02-01T00:00:00.000')),
    ]);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ProgressTimeline(points: forecast.timeline))));
    expect(find.text(overallComparisonUnavailableAr), findsOneWidget);
    expect(find.text('50'), findsNothing);
    expect(find.text('41'), findsNothing);
    expect(find.text('0'), findsNothing);
  });
}
