import 'package:flutter/material.dart';

import '../../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../capture/contour/capture_contour_reducer.dart';
import '../../capture/tokens/capture_mirror_tokens.dart';
import '../../shared/face_experience_haptics.dart';
import '../contracts/analysis_motion_semantics.dart';
import '../coordination/analysis_motion_coordinator.dart';
import '../painters/analysis_contour_painter.dart';
import '../painters/soft_laser_painter.dart';
import '../policy/analysis_motion_timing_policy.dart';

/// Post-capture Soft Laser / analysis motion surface (Phase 9D).
///
/// Soft laser is DECORATIVE — it does not measure the face.
/// Elapsed time is driven by [AnimationController] for deterministic tests.
class AnalysisMotionOverlay extends StatefulWidget {
  final FaceMeshFrame frame;
  final AnalysisPipelineStatus pipelineStatus;
  final String? errorMessageAr;
  final bool reduceMotion;
  final VoidCallback? onHandoffReady;
  final AnalysisMotionTimingPolicy timing;

  const AnalysisMotionOverlay({
    super.key,
    required this.frame,
    required this.pipelineStatus,
    this.errorMessageAr,
    this.reduceMotion = false,
    this.onHandoffReady,
    this.timing = AnalysisMotionTimingPolicy.defaults,
  });

  @override
  State<AnalysisMotionOverlay> createState() => _AnalysisMotionOverlayState();
}

class _AnalysisMotionOverlayState extends State<AnalysisMotionOverlay>
    with TickerProviderStateMixin {
  static const _clockSpan = Duration(minutes: 3);

  late final AnalysisMotionCoordinator _coordinator;
  late final AnimationController _clock;
  late final AnimationController _pulse;
  Duration? _successAtElapsed;
  bool _handoffNotified = false;

  @override
  void initState() {
    super.initState();
    _coordinator = AnalysisMotionCoordinator(timing: widget.timing);
    _clock = AnimationController(vsync: this, duration: _clockSpan)..forward();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );
    if (!widget.reduceMotion) {
      _pulse.repeat(reverse: true);
    }
    if (widget.pipelineStatus == AnalysisPipelineStatus.succeeded) {
      _successAtElapsed = Duration.zero;
    }
  }

  Duration get _elapsed {
    final d = _clock.duration ?? _clockSpan;
    return Duration(milliseconds: (_clock.value * d.inMilliseconds).round());
  }

  @override
  void didUpdateWidget(covariant AnalysisMotionOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pipelineStatus != widget.pipelineStatus) {
      if (widget.pipelineStatus == AnalysisPipelineStatus.succeeded &&
          _successAtElapsed == null) {
        _successAtElapsed = _elapsed;
      }
      if (widget.pipelineStatus == AnalysisPipelineStatus.running &&
          oldWidget.pipelineStatus != AnalysisPipelineStatus.running) {
        _clock
          ..stop()
          ..reset()
          ..forward();
        _successAtElapsed = null;
        _handoffNotified = false;
        _coordinator.reset();
      }
      if (widget.pipelineStatus == AnalysisPipelineStatus.failed) {
        _handoffNotified = false;
      }
    }
    if (oldWidget.reduceMotion != widget.reduceMotion) {
      if (widget.reduceMotion) {
        _pulse.stop();
        _pulse.value = 0;
      } else if (!_pulse.isAnimating) {
        _pulse.repeat(reverse: true);
      }
    }
  }

  @override
  void dispose() {
    _clock.dispose();
    _pulse.dispose();
    super.dispose();
  }

  AnalysisMotionTick _evaluate() {
    final elapsed = _elapsed;
    final successElapsed = _successAtElapsed == null
        ? null
        : elapsed - _successAtElapsed!;
    return _coordinator.tick(
      elapsed: elapsed,
      pipeline: widget.pipelineStatus,
      reduceMotion: widget.reduceMotion,
      successElapsed: successElapsed,
      errorMessageAr: widget.errorMessageAr,
    );
  }

  void _sideEffects(AnalysisMotionTick tick) {
    if (tick.shouldHapticScanStart) {
      FaceExperienceHaptics.light();
    }
    if (tick.shouldHapticComplete) {
      FaceExperienceHaptics.medium();
    }
    if (tick.handoffReady && !_handoffNotified) {
      _handoffNotified = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        widget.onHandoffReady?.call();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_clock, _pulse]),
      builder: (context, _) {
        final tick = _evaluate();
        _sideEffects(tick);
        final anchors =
            CaptureContourReducer.reduceOutline(widget.frame.outline);
        final bounds = widget.frame.boundingBox;

        return Stack(
          fit: StackFit.expand,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.center,
                  radius: 0.95,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.38),
                  ],
                ),
              ),
            ),
            RepaintBoundary(
              child: CustomPaint(
                painter: AnalysisContourPainter(
                  contourAnchors: anchors,
                  contourOpacity: tick.contourOpacity,
                  anchorGlow01: widget.reduceMotion ? 0 : tick.anchorGlow01,
                  showAmbientPulse:
                      tick.phase == AnalysisMotionPhase.ambientWait,
                  pulse: widget.reduceMotion ? 0 : _pulse.value,
                ),
              ),
            ),
            if (tick.phase == AnalysisMotionPhase.scanPass)
              RepaintBoundary(
                child: CustomPaint(
                  painter: SoftLaserPainter(
                    progress01: tick.scanProgress01,
                    faceBounds: bounds,
                    reduceMotion: widget.reduceMotion,
                  ),
                ),
              ),
            Align(
              alignment: Alignment.bottomCenter,
              child: SafeArea(
                minimum: const EdgeInsets.only(bottom: 14),
                child: _StageChip(
                  title: tick.titleAr,
                  instruction: tick.instructionAr,
                  a11y: tick.accessibilityLabel,
                  isError: tick.phase == AnalysisMotionPhase.error,
                  isComplete: tick.phase == AnalysisMotionPhase.completing ||
                      tick.phase == AnalysisMotionPhase.handoff,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _StageChip extends StatelessWidget {
  final String title;
  final String instruction;
  final String a11y;
  final bool isError;
  final bool isComplete;

  const _StageChip({
    required this.title,
    required this.instruction,
    required this.a11y,
    required this.isError,
    required this.isComplete,
  });

  @override
  Widget build(BuildContext context) {
    final border = isError
        ? CaptureMirrorTokens.violet.withValues(alpha: 0.2)
        : isComplete
            ? CaptureMirrorTokens.readyAccent.withValues(alpha: 0.55)
            : CaptureMirrorTokens.pearl.withValues(alpha: 0.22);
    return Semantics(
      liveRegion: true,
      label: a11y,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 28),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: CaptureMirrorTokens.guidanceGlass,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              instruction,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w600,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.62),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
