import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/data/mappers/mira_beauty_report_mapper.dart';
import 'package:mirra/features/intelligence/domain/entities/face_health_map.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/intelligence/domain/services/local_progress_builder.dart';
import 'package:mirra/features/intelligence/presentation/widgets/face_health_map_section.dart';
import 'package:mirra/features/skin_analysis/data/models/skin_report_model.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

void main() {
  test('a missing map score stays missing and a real zero stays zero', () {
    final parsed = MiraBeautyReportMapper.fromJson({
      'overallBeautyScore': 70,
      'faceHealthMap': {
        'enabled': true,
        'concernOverlays': [
          {'concernId': 'moisture', 'labelAr': 'الترطيب', 'globalScore': null},
          {'concernId': 'pore', 'labelAr': 'المسام', 'globalScore': 0},
          {'concernId': 'acne', 'labelAr': 'الحبوب', 'globalScore': 64},
        ],
      },
    });
    final again = LocalMiraReportBuilder.presentStored(parsed);
    expect(parsed.faceHealthMap.overlayById('moisture')?.globalScore, isNull);
    expect(again.faceHealthMap.overlayById('moisture')?.globalScore, isNull);
    expect(again.faceHealthMap.overlayById('pore')?.globalScore, 0);
    expect(again.faceHealthMap.overlayById('acne')?.globalScore, 64);
    expect(parsed.overallBeautyScore, 70);
  });

  test('progress does not invent 70 when a concern score is missing', () {
    SkinReportModel row(DateTime at, Map<String, dynamic> face) {
      return SkinReportModel(
        skinType: 'مختلطة',
        score: 70,
        hydration: 64,
        oiliness: 40,
        pores: 1,
        wrinkles: 1,
        spots: 1,
        advice: 'نصيحة',
        createdAt: at,
        miraReport: MiraBeautyReportMapper.fromJson({
          'overallBeautyScore': 70,
          'faceHealthMap': face,
        }),
      );
    }

    final missing = LocalProgressBuilder.fromReports([
      row(DateTime(2026, 1, 1), {
        'enabled': true,
        'concernOverlays': [
          {'concernId': 'moisture', 'labelAr': 'الترطيب', 'severity': 'moderate'},
        ],
      }),
      row(DateTime(2026, 2, 1), {
        'enabled': true,
        'concernOverlays': [
          {'concernId': 'moisture', 'labelAr': 'الترطيب', 'severity': 'mild'},
        ],
      }),
    ]);
    expect(missing.trends.where((trend) => trend.id == 'moisture'), isEmpty);
    expect(missing.trends.any((trend) => trend.currentScore == 70 && trend.id != 'overall'), isFalse);

    final compared = LocalProgressBuilder.fromReports([
      row(DateTime(2026, 1, 1), {
        'enabled': true,
        'concernOverlays': [
          {'concernId': 'moisture', 'labelAr': 'الترطيب', 'globalScore': 40},
        ],
      }),
      row(DateTime(2026, 2, 1), {
        'enabled': true,
        'concernOverlays': [
          {'concernId': 'moisture', 'labelAr': 'الترطيب', 'globalScore': 64},
        ],
      }),
    ]);
    final moisture = compared.trends.singleWhere((trend) => trend.id == 'moisture');
    expect(moisture.previousScore, 40);
    expect(moisture.currentScore, 64);
  });

  testWidgets('a missing face score is labeled unavailable and a real score stays', (tester) async {
    final map = FaceHealthMap(
      enabled: true,
      confidence: 'low',
      confidenceLabelAr: 'إرشادية',
      mode: 'educational',
      titleAr: 'الخريطة',
      subtitleAr: 'وصف',
      disclaimerAr: 'ليست تشخيصاً',
      zones: const [],
      insightCards: const [],
      concernOverlays: const [
        FaceHealthConcernOverlay(
          concernId: 'moisture',
          labelAr: 'الترطيب',
          labelEn: 'moisture',
          globalScore: null,
          severity: 'moderate',
          zoneScores: {},
          highlightZoneIds: [],
          highlightColor: '#3B82F6',
          hasRegionalData: false,
        ),
        FaceHealthConcernOverlay(
          concernId: 'acne',
          labelAr: 'الحبوب',
          labelEn: 'acne',
          globalScore: 40,
          severity: 'noticeable',
          zoneScores: {},
          highlightZoneIds: [],
          highlightColor: '#E74C3C',
          hasRegionalData: false,
        ),
      ],
      defaultConcernId: 'moisture',
      markers: const [],
    );

    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(child: FaceHealthMapSection(map: map)))));
    expect(find.text('غير متاح'), findsWidgets);
    expect(find.text('مؤشر تقديري من الصورة'), findsOneWidget);
    expect(find.text('70'), findsNothing);
    expect(find.text('72'), findsNothing);

    await tester.tap(find.text('الحبوب'));
    await tester.pump();
    expect(find.text('40'), findsWidgets);
  });

  test('an out of range score is unavailable and a real number stays', () {
    final parsed = MiraBeautyReportMapper.fromJson({
      'overallBeautyScore': 70,
      'faceHealthMap': {
        'enabled': true,
        'zones': [
          {'id': 'cheek', 'labelAr': 'الخد', 'zoneScore': 101, 'highlight': true},
        ],
        'concernOverlays': [
          {
            'concernId': 'moisture',
            'labelAr': 'الترطيب',
            'globalScore': 101,
            'zoneScores': {'cheek': 101, 'nose': '72'},
          },
          {'concernId': 'acne', 'labelAr': 'الحبوب', 'globalScore': -1},
          {'concernId': 'pore', 'labelAr': 'المسام', 'globalScore': 0},
          {'concernId': 'wrinkle', 'labelAr': 'التجاعيد', 'globalScore': '72'},
        ],
      },
    });
    expect(parsed.faceHealthMap.overlayById('moisture')?.globalScore, isNull);
    expect(parsed.faceHealthMap.overlayById('moisture')?.zoneScores, isEmpty);
    expect(parsed.faceHealthMap.overlayById('acne')?.globalScore, isNull);
    expect(parsed.faceHealthMap.overlayById('wrinkle')?.globalScore, isNull);
    expect(parsed.faceHealthMap.overlayById('pore')?.globalScore, 0);
    expect(parsed.faceHealthMap.zones.single.zoneScore, isNull);
    expect(parsed.faceHealthMap.overlayById('moisture')?.hasMeasuredScore, isFalse);
    expect(parsed.overallBeautyScore, 70);

    final progress = LocalProgressBuilder.fromReports([
      SkinReportModel(
        skinType: 'مختلطة',
        score: 70,
        hydration: 40,
        oiliness: 40,
        pores: 1,
        wrinkles: 1,
        spots: 1,
        advice: 'نصيحة',
        createdAt: DateTime(2026, 1, 1),
        miraReport: MiraBeautyReportMapper.fromJson({
          'overallBeautyScore': 70,
          'faceHealthMap': {
            'concernOverlays': [
              {'concernId': 'moisture', 'labelAr': 'الترطيب', 'globalScore': 40},
            ],
          },
        }),
      ),
      SkinReportModel(
        skinType: 'مختلطة',
        score: 70,
        hydration: 40,
        oiliness: 40,
        pores: 1,
        wrinkles: 1,
        spots: 1,
        advice: 'نصيحة',
        createdAt: DateTime(2026, 2, 1),
        miraReport: parsed,
      ),
    ]);
    expect(progress.trends.where((trend) => trend.id == 'moisture'), isEmpty);
    expect(progress.headlineAr.contains('61'), isFalse);
  });

  testWidgets('invalid score shows unavailable without a numeric ring', (tester) async {
    final parsed = MiraBeautyReportMapper.fromJson({
      'faceHealthMap': {
        'enabled': true,
        'titleAr': 'خريطة',
        'subtitleAr': 'وصف',
        'disclaimerAr': 'تنبيه',
        'defaultConcernId': 'moisture',
        'concernOverlays': [
          {'concernId': 'moisture', 'labelAr': 'الترطيب', 'globalScore': 101},
          {'concernId': 'acne', 'labelAr': 'الحبوب', 'globalScore': 40},
        ],
      },
    });
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: SingleChildScrollView(child: FaceHealthMapSection(map: parsed.faceHealthMap))),
    ));
    expect(find.text('غير متاح'), findsWidgets);
    expect(find.text('101'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.tap(find.text('الحبوب'));
    await tester.pump();
    expect(find.text('40'), findsWidgets);
  });

  test('local rebuild without miraReport does not manufacture measured scores', () {
    SkinReport legacy(DateTime at, int hydration, [Map<String, int> scores = const {}]) {
      return SkinReport(
        skinType: 'مختلطة',
        score: 70,
        hydration: hydration,
        oiliness: 40,
        pores: 3,
        wrinkles: 2,
        spots: 1,
        acne: 1,
        redness: 2,
        advice: 'نصيحة',
        createdAt: at,
        concernScores: scores,
      );
    }

    final previous = legacy(DateTime(2026, 1, 1), 0);
    final current = legacy(DateTime(2026, 2, 1), 40);
    expect(previous is SkinReportModel, isFalse);
    final rebuilt = LocalMiraReportBuilder.fromSkinReport(previous);
    expect(rebuilt.faceHealthMap.concernOverlays, isNotEmpty);
    expect(rebuilt.faceHealthMap.overlayById('moisture')?.globalScore, 0);
    expect(rebuilt.faceHealthMap.overlayById('pore')?.globalScore, isNull);
    expect(rebuilt.faceHealthMap.overlayById('redness')?.globalScore, isNull);
    expect(rebuilt.faceHealthMap.overlayById('wrinkle')?.globalScore, isNull);
    expect(rebuilt.faceHealthMap.overlayById('dark_circle')?.globalScore, isNull);
    expect(rebuilt.faceHealthMap.overlayById('texture')?.globalScore, isNull);

    final progress = LocalProgressBuilder.fromReports([previous, current]);
    final moisture = progress.trends.singleWhere((trend) => trend.id == 'moisture');
    expect(moisture.previousScore, 0);
    expect(moisture.currentScore, 40);
    expect(progress.trends.where((trend) => trend.id == 'pore'), isEmpty);
    expect(progress.trends.where((trend) => trend.id == 'redness'), isEmpty);
    expect(progress.headlineAr.contains('المسام'), isFalse);

    final measuredPores = LocalProgressBuilder.fromReports([
      legacy(DateTime(2026, 3, 1), 40, {'pore': 0, 'moisture': 40}),
      legacy(DateTime(2026, 4, 1), 40, {'pore': 72, 'moisture': 40}),
    ]);
    final pore = measuredPores.trends.singleWhere((trend) => trend.id == 'pore');
    expect(pore.previousScore, 0);
    expect(pore.currentScore, 72);
  });
}
