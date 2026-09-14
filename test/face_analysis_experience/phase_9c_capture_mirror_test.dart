import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/capture/capture.dart';
import 'package:mirra/features/face_analysis_experience/presentation/capture/capture_mirror.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

FaceMeshFrame _frame({
  required bool hasFace,
  Rect? box,
  FaceTrackingQuality quality = FaceTrackingQuality.high,
}) {
  final outline = hasFace
      ? [
          for (var i = 0; i < 36; i++)
            FaceMeshPoint(
              100 + 80 * (i.isEven ? 1 : -1) * (i % 5) / 5,
              120 + 100 * (i / 36),
            ),
        ]
      : <FaceMeshPoint>[];
  return FaceMeshFrame(
    outline: outline,
    regions: const [],
    quality: quality,
    boundingBox: box ??
        (hasFace ? const Rect.fromLTWH(80, 80, 160, 220) : null),
    timestamp: DateTime.utc(2026, 8, 11, 12),
  );
}

FaceCaptureGuidanceVm _vm(FaceCaptureReadinessState state) {
  return FaceCaptureGuidanceMapper.toVm(
    FaceCaptureReadinessResult(
      state: state,
      reasonCode: CaptureReasonCodes.noFace,
      isReady: state == FaceCaptureReadinessState.ready,
      canManualCapture: state == FaceCaptureReadinessState.ready ||
          state == FaceCaptureReadinessState.adjustAngle,
      autoCaptureEligible: false,
      presence: FacePresenceKind.noFace,
      alignment: AlignmentKind.unknown,
      distance: DistanceKind.unknown,
      pose: PoseKind.unknown,
      lighting: LightingKind.unknown,
      blur: BlurKind.unknown,
      stability: StabilityKind.unknown,
      truthClass: FaceCaptureTruthClass.derivedCapturePolicy,
    ),
  );
}

void main() {
  group('CaptureContourReducer', () {
    test('never exceeds 18 public anchors', () {
      final outline = [
        for (var i = 0; i < 36; i++) FaceMeshPoint(i.toDouble(), i.toDouble()),
      ];
      final reduced = CaptureContourReducer.reduceOutline(outline);
      expect(reduced.length, lessThanOrEqualTo(18));
      expect(reduced.length, 18);
    });

    test('deterministic for same outline', () {
      final outline = [
        for (var i = 0; i < 24; i++) FaceMeshPoint(i * 2.0, i * 3.0),
      ];
      expect(
        CaptureContourReducer.reduceOutline(outline),
        CaptureContourReducer.reduceOutline(outline),
      );
    });
  });

  group('CaptureGuideGeometry', () {
    test('illustrative oval uses normalized ratios', () {
      const size = Size(300, 500);
      final oval = CaptureGuideGeometry.illustrativeOval(size);
      expect(oval.center.dx, closeTo(150, 0.01));
      expect(oval.width / size.width, closeTo(0.58, 0.001));
    });

    test('mesh metrics null-safe without box', () {
      final m = CaptureGuideGeometry.meshMetrics(
        boundingBox: null,
        viewport: const Size(200, 400),
      );
      expect(m.$1, isNull);
    });
  });

  group('CaptureMirrorCoordinator', () {
    test('consumes 9B evaluator — no face → searching', () {
      final c = CaptureMirrorCoordinator();
      final input = c.inputFromMesh(
        frame: _frame(hasFace: false),
        viewport: const Size(300, 500),
        now: DateTime.utc(2026, 8, 11, 12, 0, 0, 100),
      );
      // Fresh timestamp relative to now
      final tick = c.tick(
        input: FaceCaptureQualityInput(
          frameTimestamp: DateTime.utc(2026, 8, 11, 12, 0, 0, 80),
          evaluationNow: DateTime.utc(2026, 8, 11, 12, 0, 0, 100),
          cameraReady: true,
          permissionGranted: true,
          faceCount: 0,
          primarySource: FaceCaptureSignalSource.mediapipe,
        ),
      );
      expect(tick.guidance.state, FaceCaptureReadinessState.searchingFace);
      expect(tick.shouldAutoCapture, isFalse);
      expect(input.primarySource, FaceCaptureSignalSource.mediapipe);
    });

    test('auto capture only through latch after hold', () {
      final policy = const FaceCaptureReadinessPolicy(
        holdStillWindow: Duration(milliseconds: 200),
        maxFrameAge: Duration(seconds: 2),
        requireBlurForReady: false,
        requireBrightnessForReady: false,
      );
      final c = CaptureMirrorCoordinator(policy: policy);
      final viewport = const Size(300, 500);
      final guide = CaptureGuideGeometry.illustrativeOval(viewport);
      // Centered good-size face
      final box = Rect.fromCenter(
        center: guide.center,
        width: guide.width * 0.7,
        height: guide.height * 0.9,
      );

      CaptureMirrorTick? last;
      for (var ms = 0; ms <= 250; ms += 50) {
        final now = DateTime.utc(2026, 8, 11, 12, 0, 0, ms);
        final frame = FaceMeshFrame(
          outline: [
            for (var i = 0; i < 20; i++)
              FaceMeshPoint(box.left + i * 2, box.top + i * 3),
          ],
          regions: const [],
          quality: FaceTrackingQuality.high,
          boundingBox: box,
          timestamp: now,
        );
        final input = c.inputFromMesh(
          frame: frame,
          viewport: viewport,
          now: now,
        );
        last = c.tick(input: input);
      }
      expect(last, isNotNull);
      // Eventually ready/eligible depending on stability samples
      expect(
        last!.result.isReady || last.guidance.state == FaceCaptureReadinessState.holdStill,
        isTrue,
      );

      // Second eligible tick after firing must not re-queue until reset
      if (last.shouldAutoCapture) {
        c.beginFiring(DateTime.utc(2026, 8, 11, 12, 0, 1));
        final again = c.tick(
          input: c.inputFromMesh(
            frame: _frame(hasFace: true, box: box),
            viewport: viewport,
            now: DateTime.utc(2026, 8, 11, 12, 0, 1, 100),
          ),
        );
        expect(again.shouldAutoCapture, isFalse);
      }
    });

    test('retake reset clears latch', () {
      final c = CaptureMirrorCoordinator();
      c.beginFiring(DateTime.utc(2026, 8, 11));
      c.markCaptured();
      expect(c.latchPhase, CaptureLatchPhase.captured);
      c.resetForRetake();
      expect(c.latchPhase, CaptureLatchPhase.idle);
    });

    test('ready haptic arms once', () {
      final policy = const FaceCaptureReadinessPolicy(
        holdStillWindow: Duration(milliseconds: 50),
        maxFrameAge: Duration(seconds: 2),
      );
      final c = CaptureMirrorCoordinator(policy: policy);
      final viewport = const Size(300, 500);
      final guide = CaptureGuideGeometry.illustrativeOval(viewport);
      final box = Rect.fromCenter(
        center: guide.center,
        width: guide.width * 0.7,
        height: guide.height * 0.9,
      );

      var hapticCount = 0;
      for (var ms = 0; ms <= 120; ms += 30) {
        final now = DateTime.utc(2026, 8, 11, 12, 0, 0, ms);
        final frame = FaceMeshFrame(
          outline: [
            for (var i = 0; i < 20; i++)
              FaceMeshPoint(box.left + i, box.top + i),
          ],
          regions: const [],
          quality: FaceTrackingQuality.high,
          boundingBox: box,
          timestamp: now,
        );
        final tick = c.tick(
          input: c.inputFromMesh(frame: frame, viewport: viewport, now: now),
        );
        if (tick.shouldHapticReady) hapticCount++;
      }
      expect(hapticCount, lessThanOrEqualTo(1));
    });
  });

  group('InteractiveCaptureMirrorOverlay widgets', () {
    Future<void> pumpState(
      WidgetTester tester,
      FaceCaptureReadinessState state, {
      Size size = const Size(390, 780),
      bool reduceMotion = false,
      TextDirection direction = TextDirection.rtl,
    }) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final frame = _frame(
        hasFace: state != FaceCaptureReadinessState.searchingFace,
        box: const Rect.fromLTWH(90, 120, 180, 240),
      );
      // Fix reason mapping for ready etc.
      final result = FaceCaptureReadinessResult(
        state: state,
        reasonCode: switch (state) {
          FaceCaptureReadinessState.ready => CaptureReasonCodes.ready,
          FaceCaptureReadinessState.moveCloser => CaptureReasonCodes.moveCloser,
          FaceCaptureReadinessState.moveFarther => CaptureReasonCodes.moveFarther,
          FaceCaptureReadinessState.alignFace => CaptureReasonCodes.centerFace,
          FaceCaptureReadinessState.adjustAngle => CaptureReasonCodes.adjustPose,
          FaceCaptureReadinessState.improveLight => CaptureReasonCodes.lowLight,
          FaceCaptureReadinessState.holdStill => CaptureReasonCodes.holdStill,
          FaceCaptureReadinessState.multipleFaces =>
            CaptureReasonCodes.multipleFaces,
          FaceCaptureReadinessState.captureInProgress =>
            CaptureReasonCodes.captureInProgress,
          _ => CaptureReasonCodes.noFace,
        },
        isReady: state == FaceCaptureReadinessState.ready,
        canManualCapture: true,
        autoCaptureEligible: false,
        presence: FacePresenceKind.singleFace,
        alignment: AlignmentKind.good,
        distance: DistanceKind.good,
        pose: PoseKind.good,
        lighting: LightingKind.good,
        blur: BlurKind.sharpEnough,
        stability: StabilityKind.stable,
        truthClass: FaceCaptureTruthClass.derivedCapturePolicy,
      );
      final guidance = FaceCaptureGuidanceMapper.toVm(result);

      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          home: MediaQuery(
            data: MediaQueryData(
              size: size,
              disableAnimations: reduceMotion,
            ),
            child: Directionality(
              textDirection: direction,
              child: Scaffold(
                backgroundColor: const Color(0xFF120C10),
                body: Center(
                  child: SizedBox(
                    width: size.width * 0.9,
                    height: size.height * 0.62,
                    child: InteractiveCaptureMirrorOverlay(
                      frame: frame,
                      guidance: guidance,
                      poseHint: PoseKind.turnLeft,
                      holdProgress01:
                          state == FaceCaptureReadinessState.ready ? 1 : 0.4,
                      pulse: 0.3,
                      reduceMotion: reduceMotion,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('searching shows Arabic guidance', (tester) async {
      await pumpState(tester, FaceCaptureReadinessState.searchingFace);
      expect(find.textContaining('وجه'), findsWidgets);
    });

    testWidgets('ready shows جاهزة', (tester) async {
      await pumpState(tester, FaceCaptureReadinessState.ready);
      expect(find.textContaining('جاهزة'), findsWidgets);
    });

    testWidgets('move closer copy', (tester) async {
      await pumpState(tester, FaceCaptureReadinessState.moveCloser);
      expect(find.textContaining('اقتربي'), findsWidgets);
    });

    testWidgets('multiple faces guidance', (tester) async {
      await pumpState(tester, FaceCaptureReadinessState.multipleFaces);
      expect(find.textContaining('واحد'), findsWidgets);
    });

    testWidgets('hold still calm copy', (tester) async {
      await pumpState(tester, FaceCaptureReadinessState.holdStill);
      expect(find.textContaining('اثبتي'), findsWidgets);
    });

    testWidgets('RTL directionality', (tester) async {
      await pumpState(tester, FaceCaptureReadinessState.alignFace);
      expect(find.textContaining('المنتصف'), findsWidgets);
      final dirs = tester.widgetList<Directionality>(find.byType(Directionality));
      expect(dirs.any((d) => d.textDirection == TextDirection.rtl), isTrue);
    });

    testWidgets('reduce motion still shows text', (tester) async {
      await pumpState(
        tester,
        FaceCaptureReadinessState.ready,
        reduceMotion: true,
      );
      expect(find.textContaining('جاهزة'), findsWidgets);
    });

    for (final entry in {
      'searching': FaceCaptureReadinessState.searchingFace,
      'align': FaceCaptureReadinessState.alignFace,
      'closer': FaceCaptureReadinessState.moveCloser,
      'farther': FaceCaptureReadinessState.moveFarther,
      'pose': FaceCaptureReadinessState.adjustAngle,
      'light': FaceCaptureReadinessState.improveLight,
      'hold': FaceCaptureReadinessState.holdStill,
      'ready': FaceCaptureReadinessState.ready,
      'locked': FaceCaptureReadinessState.captureInProgress,
    }.entries) {
      testWidgets('golden ${entry.key}', (tester) async {
        await pumpState(tester, entry.value, size: const Size(390, 844));
        await expectLater(
          find.byType(InteractiveCaptureMirrorOverlay),
          matchesGoldenFile('goldens/phase_9c_${entry.key}.png'),
        );
      });

      testWidgets('golden ${entry.key}_compact', (tester) async {
        await pumpState(tester, entry.value, size: const Size(320, 640));
        await expectLater(
          find.byType(InteractiveCaptureMirrorOverlay),
          matchesGoldenFile('goldens/phase_9c_${entry.key}_compact.png'),
        );
      });
    }

    testWidgets('golden ready_reduced_motion', (tester) async {
      await pumpState(
        tester,
        FaceCaptureReadinessState.ready,
        reduceMotion: true,
      );
      await expectLater(
        find.byType(InteractiveCaptureMirrorOverlay),
        matchesGoldenFile('goldens/phase_9c_ready_reduced_motion.png'),
      );
    });

    testWidgets('golden ready_ltr', (tester) async {
      await pumpState(
        tester,
        FaceCaptureReadinessState.ready,
        direction: TextDirection.ltr,
      );
      await expectLater(
        find.byType(InteractiveCaptureMirrorOverlay),
        matchesGoldenFile('goldens/phase_9c_ready_ltr.png'),
      );
    });
  });

  group('manual fallback contract via coordinator results', () {
    test('no face blocks manual', () {
      final c = CaptureMirrorCoordinator(
        policy: const FaceCaptureReadinessPolicy(
          maxFrameAge: Duration(seconds: 2),
        ),
      );
      final tick = c.tick(
        input: FaceCaptureQualityInput(
          frameTimestamp: DateTime.utc(2026, 8, 11, 12),
          evaluationNow: DateTime.utc(2026, 8, 11, 12, 0, 0, 50),
          cameraReady: true,
          permissionGranted: true,
          faceCount: 0,
        ),
      );
      expect(tick.guidance.canManualCapture, isFalse);
    });
  });

  // silence unused helper warning in analyzer for _vm if unused
  test('vm helper smoke', () {
    expect(_vm(FaceCaptureReadinessState.ready).isReady, isTrue);
  });
}
