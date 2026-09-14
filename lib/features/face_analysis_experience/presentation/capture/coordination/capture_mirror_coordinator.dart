import 'package:flutter/material.dart';

import '../../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../../capture/contracts/face_capture_guidance_vm.dart';
import '../../../capture/contracts/face_capture_quality_input.dart';
import '../../../capture/contracts/face_capture_readiness_result.dart';
import '../../../capture/contracts/face_capture_semantic.dart';
import '../../../capture/contracts/face_capture_truth.dart';
import '../../../capture/evaluation/face_capture_latch.dart';
import '../../../capture/evaluation/face_capture_readiness_evaluator.dart';
import '../../../capture/evaluation/face_capture_stability_history.dart';
import '../../../capture/mapping/face_capture_guidance_mapper.dart';
import '../../../capture/policy/face_capture_readiness_policy.dart';
import '../geometry/capture_guide_geometry.dart';

/// One coordinator tick outcome — presentation consumes; does not re-threshold.
class CaptureMirrorTick {
  final FaceCaptureReadinessResult result;
  final FaceCaptureGuidanceVm guidance;
  final bool shouldAutoCapture;
  final bool shouldHapticReady;
  final bool shouldHapticEligible;
  final double holdProgress01;

  const CaptureMirrorTick({
    required this.result,
    required this.guidance,
    required this.shouldAutoCapture,
    required this.shouldHapticReady,
    required this.shouldHapticEligible,
    required this.holdProgress01,
  });
}

/// Orchestrates 9B evaluator + latch for the Interactive Capture Mirror.
///
/// Owns NO readiness thresholds — all truth from [FaceCaptureReadinessEvaluator].
class CaptureMirrorCoordinator {
  CaptureMirrorCoordinator({
    FaceCaptureReadinessPolicy? policy,
  }) : policy = policy ?? FaceCaptureReadinessPolicy.defaults;

  final FaceCaptureReadinessPolicy policy;
  final FaceCaptureStabilityHistory history = FaceCaptureStabilityHistory();
  final FaceCaptureLatch latch = FaceCaptureLatch();

  DateTime? _readySince;
  FaceCaptureReadinessState? _previousState;
  bool _armedReadyHaptic = false;
  bool _armedEligibleHaptic = false;
  bool _autoFireScheduled = false;

  FaceCaptureReadinessState? get previousState => _previousState;
  CaptureLatchPhase get latchPhase => latch.phase;

  /// Prefer this over raw adapter so stability centers are included.
  FaceCaptureQualityInput inputFromMesh({
    required FaceMeshFrame? frame,
    required Size viewport,
    required DateTime now,
    bool? cameraReady,
    bool? permissionGranted,
    bool? cameraPaused,
    bool? controllerDisposed,
  }) {
    final metrics = CaptureGuideGeometry.meshMetrics(
      boundingBox: frame?.boundingBox,
      viewport: viewport,
    );
    final centers = CaptureGuideGeometry.normalizedBoxCenter(
      boundingBox: frame?.boundingBox,
      viewport: viewport,
    );
    return FaceCaptureQualityInput(
      frameTimestamp: frame?.timestamp ?? now,
      evaluationNow: now,
      cameraReady: cameraReady ?? true,
      permissionGranted: permissionGranted ?? true,
      cameraPaused: cameraPaused ?? false,
      controllerDisposed: controllerDisposed ?? false,
      faceCount: frame == null ? null : (frame.hasFace ? 1 : 0),
      faceHeightVsGuideRatio: metrics.$3,
      centerOffsetXRatio: metrics.$1,
      centerOffsetYRatio: metrics.$2,
      trackingAcceptable:
          frame == null ? null : frame.quality != FaceTrackingQuality.low,
      normalizedBoxCenterX: centers.$1,
      normalizedBoxCenterY: centers.$2,
      primarySource: FaceCaptureSignalSource.mediapipe,
    );
  }

  CaptureMirrorTick tick({
    required FaceCaptureQualityInput input,
    bool captureInProgress = false,
    bool alreadyCaptured = false,
  }) {
    if (input.normalizedBoxCenterX != null &&
        input.normalizedBoxCenterY != null) {
      history.push(
        FaceCaptureStabilitySample(
          timestamp: input.evaluationNow,
          centerX: input.normalizedBoxCenterX!,
          centerY: input.normalizedBoxCenterY!,
        ),
        keep: policy.stabilityWindow * 3,
      );
    }

    final result = FaceCaptureReadinessEvaluator.evaluate(
      input: input,
      policy: policy,
      history: history,
      readySince: _readySince,
      previousState: _previousState,
      captureInProgress:
          captureInProgress || latch.phase == CaptureLatchPhase.firing,
      alreadyCaptured:
          alreadyCaptured || latch.phase == CaptureLatchPhase.captured,
    );

    if (result.isReady) {
      _readySince ??= input.evaluationNow;
    } else {
      _readySince = null;
    }

    var shouldAuto = false;
    if (result.autoCaptureEligible &&
        latch.phase != CaptureLatchPhase.firing &&
        latch.phase != CaptureLatchPhase.captured) {
      final phase = latch.onEligible(
        now: input.evaluationNow,
        policy: policy,
      );
      if (phase == CaptureLatchPhase.eligible && !_autoFireScheduled) {
        shouldAuto = true;
        _autoFireScheduled = true;
      }
    } else if (!result.autoCaptureEligible) {
      latch.onNotReady();
      _autoFireScheduled = false;
    }

    final shouldHapticReady = result.isReady && !_armedReadyHaptic;
    if (result.isReady) {
      _armedReadyHaptic = true;
    } else {
      _armedReadyHaptic = false;
    }

    final shouldHapticEligible =
        result.autoCaptureEligible && !_armedEligibleHaptic;
    if (result.autoCaptureEligible) {
      _armedEligibleHaptic = true;
    } else {
      _armedEligibleHaptic = false;
    }

    final holdProgress = _holdProgress(result, input.evaluationNow);
    _previousState = result.state;

    return CaptureMirrorTick(
      result: result,
      guidance: FaceCaptureGuidanceMapper.toVm(result),
      shouldAutoCapture: shouldAuto,
      shouldHapticReady: shouldHapticReady,
      shouldHapticEligible: shouldHapticEligible,
      holdProgress01: holdProgress,
    );
  }

  void beginFiring(DateTime now) {
    latch.beginFiring(now);
    _autoFireScheduled = true;
  }

  void markCaptured() {
    latch.markCaptured();
    _autoFireScheduled = false;
  }

  void releaseAfterFailure() {
    latch.reset();
    _autoFireScheduled = false;
    _readySince = null;
  }

  void resetForRetake() {
    latch.reset();
    history.clear();
    _readySince = null;
    _previousState = null;
    _armedReadyHaptic = false;
    _armedEligibleHaptic = false;
    _autoFireScheduled = false;
  }

  void onLifecycleInterrupt() {
    latch.reset();
    history.clear();
    _readySince = null;
    _autoFireScheduled = false;
    _armedReadyHaptic = false;
    _armedEligibleHaptic = false;
  }

  double _holdProgress(FaceCaptureReadinessResult result, DateTime now) {
    if (!result.isReady || _readySince == null) {
      return 0;
    }
    final elapsed = now.difference(_readySince!);
    final total = policy.holdStillWindow;
    if (total.inMilliseconds <= 0) return 1;
    return (elapsed.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0);
  }
}
