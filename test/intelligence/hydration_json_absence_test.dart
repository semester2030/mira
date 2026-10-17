import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/dashboard/presentation/screens/analysis_screen.dart';
import 'package:mirra/features/intelligence/domain/entities/progress_forecast.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/intelligence/domain/services/local_progress_builder.dart';
import 'package:mirra/features/intelligence/presentation/widgets/face_health_map_section.dart';
import 'package:mirra/features/skin_analysis/data/models/skin_report_model.dart';

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

SkinReportModel _read(String id, Map<String, dynamic> json) {
  return SkinReportModel.fromJson(id, json);
}

void main() {
  test('T-HYDRATION-JSON-ABSENCE-RC3 missing and null hydration are not zero', () {
    final absent = _read('a', _json(createdAt: '2026-02-01T00:00:00.000'));
    final nil = _read('b', _json(createdAt: '2026-02-01T00:00:00.000', hydration: null));
    final invalid = _read('c', _json(createdAt: '2026-02-01T00:00:00.000', hydration: 101));
    final negative = _read('d', _json(createdAt: '2026-02-01T00:00:00.000', hydration: -1));
    expect(absent.hydration, isNull);
    expect(nil.hydration, isNull);
    expect(invalid.hydration, isNull);
    expect(negative.hydration, isNull);
    expect(absent.miraReport, isNull);
    for (final report in [absent, nil]) {
      final moisture = LocalMiraReportBuilder.fromSkinReport(report)
          .faceHealthMap
          .overlayById('moisture')
          ?.globalScore;
      expect(moisture, isNull);
    }
  });

  test('T-HYDRATION-PROGRESS-RC3 absence does not invent a moisture trend', () {
    SkinReportModel at(String day, {Object? hydration = _missing, Map<String, int>? scores}) {
      return _read(day, _json(createdAt: day, hydration: hydration, concernScores: scores));
    }

    ProgressMetricTrend? moistureOf(SkinReportModel previous, SkinReportModel current) {
      final rows = LocalProgressBuilder.fromReports([previous, current])
          .trends
          .where((row) => row.id == 'moisture')
          .toList();
      if (rows.isEmpty) return null;
      return rows.single;
    }

    expect(
      moistureOf(at('2026-01-01T00:00:00.000', hydration: 40), at('2026-02-01T00:00:00.000')),
      isNull,
    );
    expect(
      moistureOf(at('2026-01-01T00:00:00.000'), at('2026-02-01T00:00:00.000', hydration: 40)),
      isNull,
    );
    final up = moistureOf(
      at('2026-01-01T00:00:00.000', hydration: 0),
      at('2026-02-01T00:00:00.000', hydration: 40),
    );
    expect(up?.previousScore, 0);
    expect(up?.currentScore, 40);
    final down = moistureOf(
      at('2026-01-01T00:00:00.000', hydration: 40),
      at('2026-02-01T00:00:00.000', hydration: 0),
    );
    expect(down?.previousScore, 40);
    expect(down?.currentScore, 0);

    final mixed = LocalProgressBuilder.fromReports([
      at('2026-03-01T00:00:00.000', scores: {'pore': 40}),
      at('2026-04-01T00:00:00.000', hydration: 40, scores: {'pore': 72}),
    ]);
    expect(mixed.trends.where((row) => row.id == 'moisture'), isEmpty);
    final pore = mixed.trends.singleWhere((row) => row.id == 'pore');
    expect(pore.previousScore, 40);
    expect(pore.currentScore, 72);
  });

  test('T-HYDRATION-SOURCE-RC3 concernScores keep priority over a missing field', () {
    final zero = _read('a', _json(createdAt: '2026-01-01T00:00:00.000', concernScores: {'moisture': 0}));
    final forty = _read('b', _json(createdAt: '2026-01-01T00:00:00.000', concernScores: {'moisture': 40}));
    final none = _read('c', _json(createdAt: '2026-01-01T00:00:00.000'));
    expect(zero.hydration, isNull);
    expect(LocalMiraReportBuilder.fromSkinReport(zero).faceHealthMap.overlayById('moisture')?.globalScore, 0);
    expect(LocalMiraReportBuilder.fromSkinReport(forty).faceHealthMap.overlayById('moisture')?.globalScore, 40);
    expect(LocalMiraReportBuilder.fromSkinReport(none).faceHealthMap.overlayById('moisture')?.globalScore, isNull);
  });

  test('T-HYDRATION-ROUNDTRIP-RC3 keeps absence distinct from an explicit zero', () {
    final absentJson = _json(createdAt: '2026-02-01T00:00:00.000');
    final before = jsonEncode(absentJson);
    final absent = _read('absent', absentJson);
    expect(jsonEncode(absentJson), before);
    expect(absent.toJson().containsKey('hydration'), isFalse);
    expect(_read('again', absent.toJson()).hydration, isNull);
    expect(absent.copyWith(advice: 'نسخة').hydration, isNull);
    expect(SkinReportModel.fromEntity(absent).hydration, isNull);

    final zeroJson = _json(createdAt: '2026-02-01T00:00:00.000', hydration: 0);
    final zero = _read('zero', zeroJson);
    expect(zero.hydration, 0);
    expect(zero.toJson()['hydration'], 0);
    expect(_read('zero-again', zero.toJson()).hydration, 0);
    expect(zero.copyWith(advice: 'نسخة').hydration, 0);
  });

  test('T-HYDRATION-UI-RC3 history line distinguishes absence from zero', () {
    final absent = _read('a', _json(createdAt: '2026-02-01T00:00:00.000'));
    final zero = _read('b', _json(createdAt: '2026-02-01T00:00:00.000', hydration: 0));
    expect(analysisHydrationLine(absent), 'مختلطة · مؤشر الترطيب غير متاح · مؤشر تقديري من الصورة');
    expect(analysisHydrationLine(zero), 'مختلطة · مؤشر الترطيب 0 · مؤشر تقديري من الصورة');
  });

  testWidgets('T-HYDRATION-UI-RC3 absent hydration has no zero ring and a real score stays', (tester) async {
    Future<void> show(SkinReportModel report) async {
      final map = LocalMiraReportBuilder.fromSkinReport(report).faceHealthMap;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: SingleChildScrollView(child: FaceHealthMapSection(map: map))),
      ));
    }

    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final absentReport = _read('absent', _json(
      createdAt: '2026-02-01T00:00:00.000',
      concernScores: {'acne': 40},
    ));
    expect(
      LocalMiraReportBuilder.fromSkinReport(absentReport).faceHealthMap.overlayById('acne')?.globalScore,
      40,
    );
    await show(absentReport);
    await tester.tap(find.text('الترطيب'));
    await tester.pump();
    expect(find.text('غير متاح'), findsWidgets);
    expect(find.text('0'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    final acneChip = find.descendant(of: find.byType(ListView), matching: find.text('الحبوب'));
    await tester.scrollUntilVisible(
      acneChip,
      160,
      scrollable: find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)),
    );
    await tester.tap(acneChip);
    await tester.pump();
    expect(find.text('40'), findsWidgets);

    await tester.pumpWidget(const SizedBox.shrink());
    await show(_read('zero', _json(createdAt: '2026-02-01T00:00:00.000', hydration: 0)));
    await tester.tap(find.descendant(of: find.byType(ListView), matching: find.text('الترطيب')));
    await tester.pump();
    expect(find.text('0'), findsWidgets);
  });
}
