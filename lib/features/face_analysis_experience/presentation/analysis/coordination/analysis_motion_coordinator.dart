import '../contracts/analysis_motion_semantics.dart';
import '../mapping/analysis_stage_copy.dart';
import '../policy/analysis_motion_timing_policy.dart';

/// One tick of analysis motion presentation.
class AnalysisMotionTick {
  final AnalysisMotionPhase phase;
  final AnalysisPresentationStage stage;
  final String titleAr;
  final String instructionAr;
  final String accessibilityLabel;
  final double scanProgress01;
  final double contourOpacity;
  final double anchorGlow01;
  final bool handoffReady;
  final bool shouldHapticScanStart;
  final bool shouldHapticComplete;

  const AnalysisMotionTick({
    required this.phase,
    required this.stage,
    required this.titleAr,
    required this.instructionAr,
    required this.accessibilityLabel,
    required this.scanProgress01,
    required this.contourOpacity,
    required this.anchorGlow01,
    required this.handoffReady,
    this.shouldHapticScanStart = false,
    this.shouldHapticComplete = false,
  });
}

/// Pure deterministic motion coordinator — no Widget deps.
///
/// Soft laser progress is DECORATIVE. Stages are PRESENTATION_GROUPs over
/// real Loading/Success/Failure — never fake percentages.
class AnalysisMotionCoordinator {
  AnalysisMotionCoordinator({
    AnalysisMotionTimingPolicy? timing,
  }) : timing = timing ?? AnalysisMotionTimingPolicy.defaults;

  final AnalysisMotionTimingPolicy timing;

  AnalysisMotionPhase? _previousPhase;
  bool _scanHapticFired = false;
  bool _completeHapticFired = false;

  void reset() {
    _previousPhase = null;
    _scanHapticFired = false;
    _completeHapticFired = false;
  }

  AnalysisMotionTick tick({
    required Duration elapsed,
    required AnalysisPipelineStatus pipeline,
    required bool reduceMotion,
    Duration? successElapsed,
    String? errorMessageAr,
  }) {
    if (pipeline == AnalysisPipelineStatus.failed) {
      return _pack(
        phase: AnalysisMotionPhase.error,
        stage: AnalysisPresentationStage.error,
        scan: 0,
        contour: 0.35,
        anchors: 0,
        handoff: false,
        errorOverride: errorMessageAr,
      );
    }

    if (reduceMotion) {
      return _tickReduced(
        elapsed: elapsed,
        pipeline: pipeline,
        successElapsed: successElapsed,
      );
    }

    return _tickFull(
      elapsed: elapsed,
      pipeline: pipeline,
      successElapsed: successElapsed,
    );
  }

  AnalysisMotionTick _tickFull({
    required Duration elapsed,
    required AnalysisPipelineStatus pipeline,
    Duration? successElapsed,
  }) {
    final t = timing;
    final settleEnd = t.settling;
    final contourEnd = settleEnd + t.contourReveal;
    final scanEnd = contourEnd + t.scanPass;

    // Fast / normal success handling
    if (pipeline == AnalysisPipelineStatus.succeeded) {
      final sinceSuccess = successElapsed ?? Duration.zero;
      final mayComplete = elapsed >= t.softMinChoreography ||
          sinceSuccess >= t.maxDelayAfterSuccess ||
          elapsed >= scanEnd;

      if (!mayComplete) {
        return _phaseAtElapsed(elapsed, settleEnd, contourEnd, scanEnd);
      }
      if (sinceSuccess < t.completing) {
        return _pack(
          phase: AnalysisMotionPhase.completing,
          stage: AnalysisPresentationStage.completing,
          scan: 1,
          contour: 0.85,
          anchors: 0.4,
          handoff: false,
        );
      }
      return _pack(
        phase: AnalysisMotionPhase.handoff,
        stage: AnalysisPresentationStage.completing,
        scan: 1,
        contour: 0.7,
        anchors: 0.2,
        handoff: true,
      );
    }

    // Running
    if (elapsed < settleEnd) {
      return _pack(
        phase: AnalysisMotionPhase.settling,
        stage: AnalysisPresentationStage.settlingImage,
        scan: 0,
        contour: 0.15 + 0.35 * (elapsed.inMilliseconds / settleEnd.inMilliseconds),
        anchors: 0,
        handoff: false,
      );
    }
    if (elapsed < contourEnd) {
      final local = elapsed - settleEnd;
      final p = local.inMilliseconds / t.contourReveal.inMilliseconds;
      return _pack(
        phase: AnalysisMotionPhase.contourReveal,
        stage: AnalysisPresentationStage.confirmingQuality,
        scan: 0,
        contour: 0.5 + 0.45 * p.clamp(0, 1),
        anchors: 0.1 * p.clamp(0, 1),
        handoff: false,
      );
    }
    if (elapsed < scanEnd) {
      final local = elapsed - contourEnd;
      final p =
          (local.inMilliseconds / t.scanPass.inMilliseconds).clamp(0.0, 1.0);
      return _pack(
        phase: AnalysisMotionPhase.scanPass,
        stage: p < 0.55
            ? AnalysisPresentationStage.reviewingFeatures
            : AnalysisPresentationStage.buildingDetails,
        scan: p,
        contour: 0.9,
        anchors: p > 0.35 && p < 0.85 ? 0.55 : 0.2,
        handoff: false,
      );
    }

    // Ambient wait after single scan
    return _pack(
      phase: AnalysisMotionPhase.ambientWait,
      stage: AnalysisPresentationStage.ambientWaiting,
      scan: 1,
      contour: 0.75,
      anchors: 0.15,
      handoff: false,
    );
  }

  AnalysisMotionTick _phaseAtElapsed(
    Duration elapsed,
    Duration settleEnd,
    Duration contourEnd,
    Duration scanEnd,
  ) {
    if (elapsed < settleEnd) {
      return _pack(
        phase: AnalysisMotionPhase.settling,
        stage: AnalysisPresentationStage.settlingImage,
        scan: 0,
        contour: 0.3,
        anchors: 0,
        handoff: false,
      );
    }
    if (elapsed < contourEnd) {
      return _pack(
        phase: AnalysisMotionPhase.contourReveal,
        stage: AnalysisPresentationStage.confirmingQuality,
        scan: 0,
        contour: 0.8,
        anchors: 0.15,
        handoff: false,
      );
    }
    final local = elapsed - contourEnd;
    final p = (local.inMilliseconds / timing.scanPass.inMilliseconds)
        .clamp(0.0, 1.0);
    return _pack(
      phase: AnalysisMotionPhase.scanPass,
      stage: AnalysisPresentationStage.reviewingFeatures,
      scan: p,
      contour: 0.9,
      anchors: 0.45,
      handoff: false,
    );
  }

  AnalysisMotionTick _tickReduced({
    required Duration elapsed,
    required AnalysisPipelineStatus pipeline,
    Duration? successElapsed,
  }) {
    if (pipeline == AnalysisPipelineStatus.succeeded) {
      final since = successElapsed ?? Duration.zero;
      if (since < timing.completing) {
        return _pack(
          phase: AnalysisMotionPhase.completing,
          stage: AnalysisPresentationStage.completing,
          scan: 0,
          contour: 0.6,
          anchors: 0,
          handoff: false,
        );
      }
      return _pack(
        phase: AnalysisMotionPhase.handoff,
        stage: AnalysisPresentationStage.completing,
        scan: 0,
        contour: 0.5,
        anchors: 0,
        handoff: true,
      );
    }

    if (elapsed < timing.reduceSettling) {
      return _pack(
        phase: AnalysisMotionPhase.settling,
        stage: AnalysisPresentationStage.settlingImage,
        scan: 0,
        contour: 0.4,
        anchors: 0,
        handoff: false,
      );
    }

    final after = elapsed - timing.reduceSettling;
    final step = timing.reduceStageStep.inMilliseconds;
    final bucket = step <= 0 ? 0 : after.inMilliseconds ~/ step;
    final stage = switch (bucket) {
      0 => AnalysisPresentationStage.confirmingQuality,
      1 => AnalysisPresentationStage.reviewingFeatures,
      2 => AnalysisPresentationStage.buildingDetails,
      _ => AnalysisPresentationStage.ambientWaiting,
    };
    return _pack(
      phase: bucket >= 3
          ? AnalysisMotionPhase.ambientWait
          : AnalysisMotionPhase.contourReveal,
      stage: stage,
      scan: 0,
      contour: 0.65,
      anchors: 0,
      handoff: false,
    );
  }

  AnalysisMotionTick _pack({
    required AnalysisMotionPhase phase,
    required AnalysisPresentationStage stage,
    required double scan,
    required double contour,
    required double anchors,
    required bool handoff,
    String? errorOverride,
  }) {
    final copy = AnalysisStageCopy.forStage(stage);
    final title = stage == AnalysisPresentationStage.error &&
            errorOverride != null &&
            errorOverride.isNotEmpty
        ? 'تعذّر التحليل'
        : copy.$1;
    final instruction = stage == AnalysisPresentationStage.error &&
            errorOverride != null &&
            errorOverride.isNotEmpty
        ? errorOverride
        : copy.$2;

    final scanStart = phase == AnalysisMotionPhase.scanPass &&
        _previousPhase != AnalysisMotionPhase.scanPass &&
        !_scanHapticFired;
    if (scanStart) _scanHapticFired = true;

    final completeHaptic = phase == AnalysisMotionPhase.completing &&
        _previousPhase != AnalysisMotionPhase.completing &&
        !_completeHapticFired;
    if (completeHaptic) _completeHapticFired = true;

    _previousPhase = phase;

    return AnalysisMotionTick(
      phase: phase,
      stage: stage,
      titleAr: title,
      instructionAr: instruction,
      accessibilityLabel: copy.$3,
      scanProgress01: scan,
      contourOpacity: contour.clamp(0.0, 1.0),
      anchorGlow01: anchors.clamp(0.0, 1.0),
      handoffReady: handoff,
      shouldHapticScanStart: scanStart,
      shouldHapticComplete: completeHaptic,
    );
  }
}
