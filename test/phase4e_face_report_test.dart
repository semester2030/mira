import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/entities/face_intelligence_report.dart';
import 'package:mirra/features/intelligence/presentation/widgets/face_intelligence_section.dart';
import 'package:mirra/shared/theme/colors.dart';

void main() {
  group('Phase 4E — Face Report', () {
    test('tryParse reads sibling DTO fields', () {
      final report = FaceIntelligenceReport.tryParse({
        'analysisId': 'a1',
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
        'limitations': ['Cosmetic facial-feature report — not attractiveness scoring.'],
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
        'findings': [
          {
            'id': 'face_shape_oval',
            'category': 'shape',
            'titleAr': 'شكل',
            'titleEn': 'Shape',
            'detailAr': 'تفاصيل',
            'detailEn': 'detail',
            'severity': 'info',
            'confidence': 'high',
          },
        ],
        'notableFindings': <Map<String, dynamic>>[],
        'metrics': [
          {
            'id': 'faceShape',
            'displayNameAr': 'شكل الوجه',
            'displayNameEn': 'Face shape',
            'availability': 'available',
            'categoricalValue': 'oval',
            'normalizedValue': 80,
            'confidence': 80,
            'source': 'locally_calculated',
          },
          {
            'id': 'symmetryCautious',
            'displayNameAr': 'تماثل',
            'displayNameEn': 'Symmetry',
            'availability': 'unavailable',
            'confidence': 0,
            'source': 'unavailable',
          },
        ],
        'recommendations': [
          {
            'id': 'rec_hairstyle_oval',
            'category': 'hairstyle',
            'titleAr': 'قصة',
            'titleEn': 'Cut',
            'bodyAr': 'نص',
            'bodyEn': 'body',
          },
        ],
        'featureLayers': [
          {
            'id': 'layer_face_shape_oval',
            'kind': 'shape',
            'titleAr': 'طبقة',
            'titleEn': 'Layer',
            'detailAr': 'سرد',
            'detailEn': 'narrative',
          },
        ],
        'retakeGuidanceAr': 'أعد الالتقاط',
        'retakeGuidanceEn': 'Retake',
      });

      expect(report, isNotNull);
      expect(report!.reportVersion, 'face-report-v1');
      expect(report.shape.shapeId, 'oval');
      expect(report.featureLayers.single.kind, 'shape');
      expect(report.metrics.where((m) => !m.isAvailable).length, 1);
      expect(
        report.metrics.firstWhere((m) => !m.isAvailable).normalizedValue,
        isNull,
      );
    });

    test('tryParse returns null for invalid payload', () {
      expect(FaceIntelligenceReport.tryParse(null), isNull);
      expect(FaceIntelligenceReport.tryParse('x'), isNull);
    });

    testWidgets('FaceIntelligenceSection uses premium theme tokens',
        (tester) async {
      final report = FaceIntelligenceReport.tryParse({
        'analysisId': 'ui',
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
        'confidence': 70,
        'limitations': const <String>[],
        'language': 'ar+en',
        'executiveSummaryAr': 'ملخص تجميلي.',
        'executiveSummaryEn': 'Cosmetic summary.',
        'measurementEligible': true,
        'eligibilityReasonCodes': const <String>[],
        'shape': {
          'availability': 'available',
          'shapeId': 'oval',
          'displayNameAr': 'بيضاوي',
          'displayNameEn': 'Oval',
          'confidence': 70,
          'explanationAr': '',
          'explanationEn': '',
        },
        'findings': const <Map<String, dynamic>>[],
        'notableFindings': const <Map<String, dynamic>>[],
        'metrics': const <Map<String, dynamic>>[],
        'recommendations': const <Map<String, dynamic>>[],
        'featureLayers': [
          {
            'id': 'layer_1',
            'kind': 'shape',
            'titleAr': 'طبقة ملامح',
            'titleEn': 'Feature layer',
            'detailAr': 'ليست خريطة بشرة',
            'detailEn': 'Not a skin heatmap',
          },
        ],
        'retakeGuidanceAr': 'أعد',
        'retakeGuidanceEn': 'Retake',
      })!;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: FaceIntelligenceSection(report: report),
            ),
          ),
        ),
      );

      expect(find.text('ذكاء الملامح'), findsOneWidget);
      expect(find.textContaining('طبقات تنسيق سردية'), findsOneWidget);
      expect(find.text('ليست خريطة بشرة'), findsOneWidget);
      // Theme token smoke: secondary text color exists in design system.
      expect(AppColors.textSecondary, isNotNull);
    });
  });
}
