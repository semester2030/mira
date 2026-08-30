import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/presentation/analysis/analysis_motion.dart';
import 'package:mirra/features/face_analysis_experience/presentation/capture/capture_mirror.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

FaceMeshFrame _frame() {
  final box = const Rect.fromLTWH(90, 120, 180, 240);
  return FaceMeshFrame(
    outline: [
      for (var i = 0; i < 24; i++)
        FaceMeshPoint(box.left + (i % 8) * 20.0, box.top + (i ~/ 3) * 18.0),
    ],
    regions: const [],
    quality: FaceTrackingQuality.high,
    boundingBox: box,
    timestamp: DateTime.utc(2026, 8, 11, 12),
  );
}

void main() {
  group('AnalysisMotionTruthManifest', () {
    test('every component classified — Law #40', () {
      expect(AnalysisMotionTruthManifest.entries, isNotEmpty);
      for (final e in AnalysisMotionTruthManifest.entries) {
        expect(e.component, isNotEmpty);
        expect(e.truthClass, isNotEmpty);
        expect(e.claimForbidden, isNotEmpty);
      }
      expect(
        AnalysisMotionTruthManifest.entries
            .any((e) => e.component == 'soft_laser_sweep' && e.truthClass == 'DECORATIVE'),
        isTrue,
      );
    });

    test('Law #41 — forbidden measurement claims listed', () {
      final laser = AnalysisMotionTruthManifest.entries
          .firstWhere((e) => e.component == 'soft_laser_sweep');
      expect(laser.claimForbidden.toLowerCase(), contains('يقيس'));
    });
  });

  group('AnalysisStageCopy Law #41', () {
    test('no fake measurement wording', () {
      for (final stage in AnalysisPresentationStage.values) {
        final copy = AnalysisStageCopy.forStage(stage);
        final blob = '${copy.$1} ${copy.$2} ${copy.$3}';
        expect(blob.contains('ليزر يفحص'), isFalse);
        expect(blob.contains('ثلاثي الأبعاد'), isFalse);
        expect(blob.contains('نقيس الآن'), isFalse);
        expect(blob.contains('كل نقطة'), isFalse);
      }
    });
  });

  group('AnalysisMotionCoordinator', () {
    const timing = AnalysisMotionTimingPolicy(
      settling: Duration(milliseconds: 100),
      contourReveal: Duration(milliseconds: 100),
      scanPass: Duration(milliseconds: 400),
      completing: Duration(milliseconds: 80),
      maxDelayAfterSuccess: Duration(milliseconds: 120),
    );

    test('phase order while running — single scan then ambient', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      expect(
        c.tick(
          elapsed: const Duration(milliseconds: 50),
          pipeline: AnalysisPipelineStatus.running,
          reduceMotion: false,
        ).phase,
        AnalysisMotionPhase.settling,
      );
      expect(
        c.tick(
          elapsed: const Duration(milliseconds: 150),
          pipeline: AnalysisPipelineStatus.running,
          reduceMotion: false,
        ).phase,
        AnalysisMotionPhase.contourReveal,
      );
      final scan = c.tick(
        elapsed: const Duration(milliseconds: 250),
        pipeline: AnalysisPipelineStatus.running,
        reduceMotion: false,
      );
      expect(scan.phase, AnalysisMotionPhase.scanPass);
      expect(scan.scanProgress01, greaterThan(0));
      expect(scan.scanProgress01, lessThan(1));

      final ambient = c.tick(
        elapsed: const Duration(milliseconds: 700),
        pipeline: AnalysisPipelineStatus.running,
        reduceMotion: false,
      );
      expect(ambient.phase, AnalysisMotionPhase.ambientWait);
      expect(ambient.scanProgress01, 1);
    });

    test('scan does not restart in ambient wait', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      final a = c.tick(
        elapsed: const Duration(milliseconds: 800),
        pipeline: AnalysisPipelineStatus.running,
        reduceMotion: false,
      );
      final b = c.tick(
        elapsed: const Duration(milliseconds: 1500),
        pipeline: AnalysisPipelineStatus.running,
        reduceMotion: false,
      );
      expect(a.phase, AnalysisMotionPhase.ambientWait);
      expect(b.phase, AnalysisMotionPhase.ambientWait);
      expect(b.scanProgress01, 1);
    });

    test('fast success respects soft min then handoff', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      // Success very early
      final early = c.tick(
        elapsed: const Duration(milliseconds: 40),
        pipeline: AnalysisPipelineStatus.succeeded,
        reduceMotion: false,
        successElapsed: const Duration(milliseconds: 40),
      );
      expect(early.phase, isNot(AnalysisMotionPhase.handoff));

      // After soft min
      final mid = c.tick(
        elapsed: timing.softMinChoreography,
        pipeline: AnalysisPipelineStatus.succeeded,
        reduceMotion: false,
        successElapsed: const Duration(milliseconds: 40),
      );
      expect(
        mid.phase == AnalysisMotionPhase.completing ||
            mid.phase == AnalysisMotionPhase.handoff,
        isTrue,
      );

      final done = c.tick(
        elapsed: timing.softMinChoreography + timing.completing,
        pipeline: AnalysisPipelineStatus.succeeded,
        reduceMotion: false,
        successElapsed: timing.completing,
      );
      expect(done.phase, AnalysisMotionPhase.handoff);
      expect(done.handoffReady, isTrue);
    });

    test('slow response stays ambient without fake percent', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      final tick = c.tick(
        elapsed: const Duration(seconds: 8),
        pipeline: AnalysisPipelineStatus.running,
        reduceMotion: false,
      );
      expect(tick.phase, AnalysisMotionPhase.ambientWait);
      expect(tick.instructionAr.contains('%'), isFalse);
    });

    test('error stops motion honestly', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      final tick = c.tick(
        elapsed: const Duration(milliseconds: 300),
        pipeline: AnalysisPipelineStatus.failed,
        reduceMotion: false,
        errorMessageAr: 'تعذر الاتصال',
      );
      expect(tick.phase, AnalysisMotionPhase.error);
      expect(tick.instructionAr, 'تعذر الاتصال');
      expect(tick.handoffReady, isFalse);
    });

    test('reduce motion skips scan pass', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      final tick = c.tick(
        elapsed: const Duration(milliseconds: 300),
        pipeline: AnalysisPipelineStatus.running,
        reduceMotion: true,
      );
      expect(tick.phase, isNot(AnalysisMotionPhase.scanPass));
      expect(tick.scanProgress01, 0);
    });

    test('scan haptic fires once', () {
      final c = AnalysisMotionCoordinator(timing: timing);
      var count = 0;
      for (var ms = 180; ms <= 350; ms += 20) {
        final t = c.tick(
          elapsed: Duration(milliseconds: ms),
          pipeline: AnalysisPipelineStatus.running,
          reduceMotion: false,
        );
        if (t.shouldHapticScanStart) count++;
      }
      expect(count, lessThanOrEqualTo(1));
    });
  });

  group('AnalysisMotionOverlay widgets', () {
    Future<void> pumpOverlay(
      WidgetTester tester, {
      required AnalysisPipelineStatus status,
      bool reduceMotion = false,
      Size size = const Size(390, 844),
      TextDirection dir = TextDirection.rtl,
      String? error,
    }) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          home: MediaQuery(
            data: MediaQueryData(size: size, disableAnimations: reduceMotion),
            child: Directionality(
              textDirection: dir,
              child: Scaffold(
                backgroundColor: const Color(0xFF120C10),
                body: Center(
                  child: SizedBox(
                    width: size.width * 0.9,
                    height: size.height * 0.62,
                    child: AnalysisMotionOverlay(
                      frame: _frame(),
                      pipelineStatus: status,
                      errorMessageAr: error,
                      reduceMotion: reduceMotion,
                      timing: const AnalysisMotionTimingPolicy(
                        settling: Duration(milliseconds: 80),
                        contourReveal: Duration(milliseconds: 80),
                        scanPass: Duration(milliseconds: 200),
                        completing: Duration(milliseconds: 60),
                        maxDelayAfterSuccess: Duration(milliseconds: 80),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    testWidgets('settling shows stage copy', (tester) async {
      await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
      await tester.pump();
      expect(find.textContaining('صورتك'), findsWidgets);
    });

    testWidgets('error state', (tester) async {
      await pumpOverlay(
        tester,
        status: AnalysisPipelineStatus.failed,
        error: 'الشبكة غير متاحة',
      );
      await tester.pump();
      expect(find.textContaining('الشبكة'), findsWidgets);
    });

    testWidgets('reduce motion still shows text', (tester) async {
      await pumpOverlay(
        tester,
        status: AnalysisPipelineStatus.running,
        reduceMotion: true,
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.byType(AnalysisMotionOverlay), findsOneWidget);
      expect(find.textContaining('نتأكد'), findsWidgets);
    });

    testWidgets('RTL directionality present', (tester) async {
      await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
      final dirs =
          tester.widgetList<Directionality>(find.byType(Directionality));
      expect(dirs.any((d) => d.textDirection == TextDirection.rtl), isTrue);
    });

    testWidgets('contour reducer ≤18 for overlay frame', (tester) async {
      final reduced = CaptureContourReducer.reduceOutline(_frame().outline);
      expect(reduced.length, lessThanOrEqualTo(18));
    });

    Future<void> golden(
      WidgetTester tester,
      String name,
      Future<void> Function() setup,
    ) async {
      await setup();
      await expectLater(
        find.byType(AnalysisMotionOverlay),
        matchesGoldenFile('goldens/phase_9d_$name.png'),
      );
    }

    testWidgets('golden settle', (tester) async {
      await golden(tester, 'settle', () async {
        await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
        await tester.pump();
      });
    });

    testWidgets('golden contour', (tester) async {
      await golden(tester, 'contour', () async {
        await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
        await tester.pump(const Duration(milliseconds: 120));
      });
    });

    testWidgets('golden mid_scan', (tester) async {
      await golden(tester, 'mid_scan', () async {
        await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
        await tester.pump(const Duration(milliseconds: 220));
      });
    });

    testWidgets('golden ambient', (tester) async {
      await golden(tester, 'ambient', () async {
        await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
        await tester.pump(const Duration(milliseconds: 500));
      });
    });

    testWidgets('golden completing', (tester) async {
      await golden(tester, 'completing', () async {
        await pumpOverlay(tester, status: AnalysisPipelineStatus.succeeded);
        await tester.pump(const Duration(milliseconds: 200));
      });
    });

    testWidgets('golden reduced_motion', (tester) async {
      await golden(tester, 'reduced_motion', () async {
        await pumpOverlay(
          tester,
          status: AnalysisPipelineStatus.running,
          reduceMotion: true,
        );
        await tester.pump(const Duration(milliseconds: 200));
      });
    });

    testWidgets('golden error', (tester) async {
      await golden(tester, 'error', () async {
        await pumpOverlay(
          tester,
          status: AnalysisPipelineStatus.failed,
          error: 'أعيدي المحاولة',
        );
        await tester.pump();
      });
    });

    testWidgets('golden rtl', (tester) async {
      await golden(tester, 'rtl', () async {
        await pumpOverlay(tester, status: AnalysisPipelineStatus.running);
        await tester.pump(const Duration(milliseconds: 220));
      });
    });

    testWidgets('golden compact', (tester) async {
      await golden(tester, 'compact', () async {
        await pumpOverlay(
          tester,
          status: AnalysisPipelineStatus.running,
          size: const Size(320, 640),
        );
        await tester.pump(const Duration(milliseconds: 220));
      });
    });

    testWidgets('golden large', (tester) async {
      await golden(tester, 'large', () async {
        await pumpOverlay(
          tester,
          status: AnalysisPipelineStatus.running,
          size: const Size(430, 932),
        );
        await tester.pump(const Duration(milliseconds: 220));
      });
    });
  });
}
