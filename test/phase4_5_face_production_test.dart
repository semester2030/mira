import 'dart:convert';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/features/face_intelligence/data/face_intel_upload_payload.dart';
import 'package:mirra/features/face_intelligence/domain/face_client_mirror_gate.dart';
import 'package:mirra/features/face_intelligence/domain/face_foundation.dart';
import 'package:mirra/features/face_intelligence/domain/face_intel_runtime_state.dart';
import 'package:mirra/features/face_intelligence/domain/geometry_anchors.dart';
import 'package:mirra/features/intelligence/data/mappers/mira_beauty_report_mapper.dart';
import 'package:mirra/features/intelligence/domain/entities/face_intelligence_report.dart';
import 'package:mirra/features/intelligence/presentation/widgets/face_intelligence_section.dart';
import 'package:mirra/features/intelligence/presentation/widgets/face_intel_runtime_notice.dart';
import 'package:mirra/shared/theme/colors.dart';

GeometryAnchors _sampleAnchors() {
  NormPoint p(double x, double y) => NormPoint(x, y);
  return GeometryAnchors(
    foreheadTop: p(0.5, 0.22),
    browMid: p(0.5, 0.34),
    noseTip: p(0.5, 0.52),
    noseBase: p(0.5, 0.58),
    chin: p(0.5, 0.78),
    leftEyeOuter: p(0.31, 0.36),
    leftEyeInner: p(0.42, 0.36),
    rightEyeInner: p(0.58, 0.36),
    rightEyeOuter: p(0.69, 0.36),
    leftMouth: p(0.4, 0.68),
    rightMouth: p(0.6, 0.68),
    leftFace: p(0.29, 0.5),
    rightFace: p(0.71, 0.5),
    leftAla: p(0.44, 0.55),
    rightAla: p(0.56, 0.55),
    leftJaw: p(0.325, 0.72),
    rightJaw: p(0.675, 0.72),
    source: 'synthetic_test',
  );
}

Map<String, dynamic> _minimalFaceIntelJson() => {
      'analysisId': 'phase45',
      'provider': 'on_device_landmarks',
      'formulaVersion': 'face-shape-hybrid-ratios-v1',
      'captureVersion': 'cq-thresholds-v2.1',
      'faceVersion': 'face-model-v1',
      'intelligenceVersion': 'face-intel-v1',
      'geometryVersion': 'face-geometry-v1',
      'shapeVersion': 'face-shape-v1',
      'recommendationVersion': 'face-reco-v1',
      'reportVersion': 'face-report-v1',
      'generatedAt': '2026-07-19T00:00:00.000Z',
      'confidence': 80,
      'limitations': <String>['Cosmetic facial-feature report'],
      'language': 'ar+en',
      'executiveSummaryAr': 'شكل الوجه الظاهر: بيضاوي.',
      'executiveSummaryEn': 'Apparent face shape: Oval.',
      'measurementEligible': true,
      'eligibilityReasonCodes': <String>[],
      'shape': {
        'availability': 'available',
        'shapeId': 'oval',
        'displayNameAr': 'بيضاوي',
        'displayNameEn': 'Oval',
        'confidence': 80,
        'explanationAr': 'شرح',
        'explanationEn': 'explain',
      },
      'findings': <Map<String, dynamic>>[],
      'notableFindings': <Map<String, dynamic>>[],
      'metrics': <Map<String, dynamic>>[],
      'recommendations': <Map<String, dynamic>>[],
      'featureLayers': <Map<String, dynamic>>[],
      'retakeGuidanceAr': 'أعد',
      'retakeGuidanceEn': 'Retake',
    };

Map<String, dynamic> _miraJson({Map<String, dynamic>? faceIntelligence}) => {
      'analysisId': 'a',
      'overallBeautyScore': 70,
      'skinTypeAr': 'مختلطة',
      'skinTypeEn': 'combination',
      'summaryAdviceAr': '',
      'disclaimerAr': 'تنويه',
      'mainConcerns': <dynamic>[],
      'dailyRoutine': <String, dynamic>{},
      'tipsAr': <dynamic>[],
      'faceMap': <String, dynamic>{},
      'faceHealthMap': <String, dynamic>{'enabled': false},
      'concernZonesNarrative': <dynamic>[],
      'recommendedProducts': <dynamic>[],
      'weeklyPlan': <String, dynamic>{},
      'progressForecast': <String, dynamic>{},
      'childSafety': <String, dynamic>{'isMinor': false},
      'ageComparison': <String, dynamic>{},
      'confidenceLayer': <String, dynamic>{},
      'beautyJourney': <String, dynamic>{
        'enabled': false,
        'headlineAr': '',
        'priorities': <dynamic>[],
      },
      if (faceIntelligence != null) 'faceIntelligence': faceIntelligence,
    };

void main() {
  group('Phase 4.5 — Face production integration', () {
    test('upload payload serializes pose + anchors + runtime once', () {
      final gate = FaceGateResult.acceptedWithFace(
        faceBox: const Rect.fromLTWH(0.2, 0.2, 0.5, 0.6),
        imageSize: const Size(1000, 1000),
        faceCount: 1,
        faceAreaRatio: 0.3,
        headYawDegrees: 0,
        headPitchDegrees: 0,
        headRollDegrees: 0,
      );

      final bundle = FaceIntelUploadPayload.build(
        gate: gate,
        captureQualityAcceptable: true,
        runtime: FaceIntelRuntimeState.available(stage: 'anchors'),
        anchors: _sampleAnchors(),
        pointCount: 468,
        trackingQuality: 'high',
      );

      final decoded = jsonDecode(bundle.json) as Map<String, dynamic>;
      expect(decoded['pose'], isA<Map>());
      expect(decoded['anchors'], isA<Map>());
      expect(decoded['runtime']['status'], 'AVAILABLE');
      expect(decoded['captureVersion'], 'cq-thresholds-v2.1');
      expect(decoded['provider'], 'on_device_landmarks');
      expect(decoded.containsKey('rawYouCam'), isFalse);
      expect(bundle.json.toLowerCase().contains('perfect'), isFalse);
    });

    test('unavailable payload still includes explicit runtime (never silent)', () {
      final gate = FaceGateResult.acceptedWithFace(
        faceBox: const Rect.fromLTWH(0.2, 0.2, 0.5, 0.6),
        imageSize: const Size(800, 800),
        faceCount: 1,
        faceAreaRatio: 0.28,
      );
      final bundle = FaceIntelUploadPayload.build(
        gate: gate,
        captureQualityAcceptable: true,
        runtime: FaceIntelRuntimeState.unavailable(
          reason: 'anchors_extraction_incomplete',
          stage: 'anchors',
        ),
      );
      final map = jsonDecode(bundle.json) as Map<String, dynamic>;
      expect(map.containsKey('anchors'), isFalse);
      expect(map['landmarks']['pointCount'], 0);
      expect(map['runtime']['status'], 'UNAVAILABLE');
      expect(map['runtime']['reason'], 'anchors_extraction_incomplete');
    });

    test('mapper deserializes faceIntelligenceRuntime', () {
      final mira = MiraBeautyReportMapper.fromJson(
        _miraJson(faceIntelligence: _minimalFaceIntelJson())
          ..['faceIntelligenceRuntime'] = FaceIntelRuntimeState.available(
            stage: 'test',
          ).toJson(),
      );
      expect(mira.faceIntelligence, isNotNull);
      expect(mira.faceIntelligence!.reportVersion, 'face-report-v1');
      expect(mira.faceIntelligence!.shape.shapeId, 'oval');
      expect(mira.faceIntelligenceRuntime?.status, FaceIntelRuntimeStatus.available);
    });

    test('mirror gate blocks production execution of Flutter pipelines', () {
      FaceClientMirrorGate.allowMirrorExecution = false;
      expect(
        () => FaceFoundationPipeline.run(
          gate: FaceGateResult.acceptedWithFace(
            faceBox: const Rect.fromLTWH(0, 0, 1, 1),
            imageSize: const Size(10, 10),
          ),
        ),
        throwsStateError,
      );
    });

    test('unavailable faceIntelligence parses without inventing metrics', () {
      final report = FaceIntelligenceReport.tryParse({
        ..._minimalFaceIntelJson(),
        'measurementEligible': false,
        'eligibilityReasonCodes': ['head_turned'],
        'shape': {
          'availability': 'unavailable',
          'shapeId': null,
          'displayNameAr': '',
          'displayNameEn': '',
          'confidence': 0,
          'explanationAr': '',
          'explanationEn': '',
        },
        'metrics': [
          {
            'id': 'face_width_height_ratio',
            'availability': 'unavailable',
            'normalizedValue': null,
            'displayNameAr': 'نسبة',
            'displayNameEn': 'ratio',
          },
        ],
      });
      expect(report, isNotNull);
      expect(report!.measurementEligible, isFalse);
      expect(report.metrics.first.normalizedValue, isNull);
    });

    testWidgets('beauty report shows Face Intelligence section when present',
        (tester) async {
      final mira = MiraBeautyReportMapper.fromJson(
        _miraJson(faceIntelligence: _minimalFaceIntelJson()),
      );
      expect(mira.faceIntelligence, isNotNull);

      // Mirrors MiraBeautyReportScreen conditional (avoid Firebase in widget test).
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  if (mira.faceIntelligence != null)
                    FaceIntelligenceSection(report: mira.faceIntelligence!),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.byType(FaceIntelligenceSection), findsOneWidget);
      expect(find.text('ذكاء الملامح'), findsOneWidget);
      expect(AppColors.textSecondary, isNotNull);
    });

    testWidgets('runtime notice when FAILED without report', (tester) async {
      final mira = MiraBeautyReportMapper.fromJson(
        _miraJson()
          ..['faceIntelligenceRuntime'] = FaceIntelRuntimeState.failed(
            reason: 'mediapipe_exception',
            stage: 'mediapipe',
          ).toJson(),
      );
      expect(mira.faceIntelligence, isNull);
      expect(mira.faceIntelligenceRuntime?.showNotice, isTrue);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FaceIntelRuntimeNotice(runtime: mira.faceIntelligenceRuntime!),
          ),
        ),
      );
      expect(find.byType(FaceIntelRuntimeNotice), findsOneWidget);
      expect(find.textContaining('FAILED'), findsOneWidget);
    });
  });
}
