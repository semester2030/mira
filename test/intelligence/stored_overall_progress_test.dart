import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/data/mappers/mira_beauty_report_mapper.dart';
import 'package:mirra/features/intelligence/domain/entities/progress_forecast.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/intelligence/presentation/widgets/progress_forecast_section.dart';
import 'package:mirra/features/intelligence/presentation/widgets/progress_timeline.dart';

Map<String, dynamic> _stored({bool? overallScoreAvailable, bool includeFlag = true, bool provePoints = false}) {
  return {
    'overallBeautyScore': 41,
    if (includeFlag) 'overallScoreAvailable': overallScoreAvailable,
    'skinTypeAr': 'مختلطة',
    'headlineAr': 'عنوان',
    'summaryAdviceAr': 'ملخص',
    'progressForecast': {
      'enabled': true,
      'scanCount': 2,
      'needsMoreScans': false,
      'headlineAr': 'تراجع مؤشر الجمال 9 نقاط',
      'summaryAr': 'تراجع مؤشر الجمال 9 نقاط',
      'projectedOverallScore30Days': 32,
      'timeline': [
        {
          'analysisId': 'a',
          'createdAt': '2026-01-01T00:00:00.000Z',
          'overallScore': 50,
          if (provePoints) 'overallScoreAvailable': true,
        },
        {
          'analysisId': 'b',
          'createdAt': '2026-02-01T00:00:00.000Z',
          'overallScore': 41,
          if (provePoints) 'overallScoreAvailable': true,
        },
      ],
      'trends': [
        {
          'id': 'overall',
          'labelAr': 'مؤشر الجمال',
          'previousScore': 50,
          'currentScore': 41,
          'deltaPoints': -9,
          'direction': 'regressed',
          'messageAr': 'تراجع مؤشر الجمال 9 نقاط',
        },
        {
          'id': 'pore',
          'labelAr': 'المسام',
          'previousScore': 40,
          'currentScore': 72,
          'deltaPoints': 32,
          'direction': 'improved',
          'messageAr': 'تحسّن المسام +32 نقطة',
        },
      ],
      'milestones': [
        {
          'id': 'milestone_overall',
          'titleAr': 'تراجع مؤشر الجمال',
          'descriptionAr': 'من 50 إلى 41',
        },
        {
          'id': 'pore_gain',
          'titleAr': 'متابعة المسام',
          'descriptionAr': 'مقارنة المسام بقيت',
        },
      ],
    },
  };
}

void main() {
  test('T-STORED-OVERALL-ABSENCE-B4 stored progress without proof is not an overall comparison', () {
    for (final json in [
      _stored(overallScoreAvailable: false),
      _stored(includeFlag: false),
      _stored(overallScoreAvailable: true),
    ]) {
      final encoded = jsonEncode(json);
      final shown = MiraBeautyReportMapper.fromJson(json);
      expect(jsonEncode(json), encoded);
      final forecast = shown.progressForecast;
      expect(forecast.trends.where((row) => row.id == 'overall'), isEmpty);
      expect(forecast.headlineAr, overallComparisonUnavailableAr);
      expect(forecast.summaryAr, overallComparisonUnavailableAr);
      expect(forecast.projectedOverallScore30Days, isNull);
      expect(forecast.timeline.every((point) => point.overallScore == null), isTrue);
      expect(forecast.milestones.any((row) => row.titleAr.contains('مؤشر الجمال')), isFalse);
      expect(forecast.trends.single.messageAr, 'تحسّن المسام +32 نقطة');
      expect(forecast.headlineAr.contains('مستقر'), isFalse);
    }
  });

  testWidgets('T-STORED-OVERALL-CONSUMERS-B4 widgets hide the stored overall numbers', (tester) async {
    final shown = MiraBeautyReportMapper.fromJson(_stored(overallScoreAvailable: false));
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ListView(
          children: [
            ProgressTimeline(points: shown.progressForecast.timeline),
            ProgressForecastSection(forecast: shown.progressForecast),
          ],
        ),
      ),
    ));
    expect(find.text(overallComparisonUnavailableAr), findsWidgets);
    expect(find.text('50'), findsNothing);
    expect(find.text('41'), findsNothing);
    expect(find.text('32'), findsNothing);
    expect(find.textContaining('تراجع مؤشر الجمال'), findsNothing);
    expect(find.text('تحسّن المسام +32 نقطة'), findsOneWidget);
  });

  test('T-STORED-OVERALL-VALID-B4 proven points keep the comparison and pores', () {
    final json = _stored(overallScoreAvailable: true, provePoints: true);
    json['progressForecast']['headlineAr'] = 'مقارنة بين آخر تحليلين';
    json['progressForecast']['summaryAr'] = 'قارنا آخر تحليلين';
    json['progressForecast']['trends'][0]['messageAr'] = 'تراجع مؤشر الجمال 9 نقاط';
    final shown = MiraBeautyReportMapper.fromJson(json);
    final overall = shown.progressForecast.trends.where((row) => row.id == 'overall').single;
    expect(overall.previousScore, 50);
    expect(overall.currentScore, 41);
    expect(shown.progressForecast.projectedOverallScore30Days, 32);
    expect(shown.progressForecast.timeline.map((point) => point.overallScore), [50, 41]);
    expect(shown.progressForecast.trends.any((row) => row.id == 'pore'), isTrue);
  });

  test('T-STORED-OVERALL-IMMUTABLE-B4 repeated display is stable and leaves the source json', () {
    final json = _stored(overallScoreAvailable: false);
    final before = jsonEncode(json);
    final first = MiraBeautyReportMapper.fromJson(json);
    final second = LocalMiraReportBuilder.presentStored(first);
    expect(jsonEncode(json), before);
    expect(second.progressForecast.headlineAr, first.progressForecast.headlineAr);
    expect(second.progressForecast.projectedOverallScore30Days, isNull);
    expect(second.progressForecast.trends.map((row) => row.id), first.progressForecast.trends.map((row) => row.id));
    expect(second.progressForecast.timeline.map((point) => point.overallScore), [null, null]);
    expect(first.overallScoreAvailable, isFalse);
  });
}
