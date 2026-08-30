import 'package:flutter/foundation.dart';

import '../policy/face_result_motion_policy.dart';

/// Stages Result Mirror reveal without implying re-analysis (Law #41).
enum FaceResultRevealPhase {
  settling,
  contourCalm,
  primaryVisible,
  insightsVisible,
  actionsVisible,
  complete,
}

class FaceResultRevealCoordinator {
  FaceResultRevealCoordinator({
    FaceResultMotionPolicy policy = FaceResultMotionPolicy.defaults,
  }) : _policy = policy;

  final FaceResultMotionPolicy _policy;
  FaceResultRevealPhase _phase = FaceResultRevealPhase.settling;
  int _insightVisibleCount = 0;

  FaceResultRevealPhase get phase => _phase;
  int get insightVisibleCount => _insightVisibleCount;

  FaceResultMotionPolicy get policy => _policy;

  /// Advances based on elapsed presentation time since mirror mounted.
  void tick(Duration elapsed, {required int insightTotal}) {
    var t = elapsed;
    if (t < _policy.settle) {
      _phase = FaceResultRevealPhase.settling;
      _insightVisibleCount = 0;
      return;
    }
    t -= _policy.settle;
    if (t < _policy.contourCalm) {
      _phase = FaceResultRevealPhase.contourCalm;
      _insightVisibleCount = 0;
      return;
    }
    t -= _policy.contourCalm;
    if (t < _policy.primaryReveal) {
      _phase = FaceResultRevealPhase.primaryVisible;
      _insightVisibleCount = 0;
      return;
    }
    t -= _policy.primaryReveal;

    final step = _policy.insightStep;
    if (insightTotal <= 0 || step == Duration.zero) {
      _insightVisibleCount = insightTotal;
      if (t < _policy.actionsReveal) {
        _phase = FaceResultRevealPhase.insightsVisible;
        return;
      }
      _phase = FaceResultRevealPhase.actionsVisible;
      if (t >= _policy.actionsReveal) {
        _phase = FaceResultRevealPhase.complete;
      }
      return;
    }

    final steps = (t.inMilliseconds / step.inMilliseconds).floor();
    _insightVisibleCount = steps.clamp(0, insightTotal);
    if (_insightVisibleCount < insightTotal) {
      _phase = FaceResultRevealPhase.insightsVisible;
      return;
    }
    t -= step * insightTotal;
    if (t < _policy.actionsReveal) {
      _phase = FaceResultRevealPhase.insightsVisible;
      return;
    }
    _phase = FaceResultRevealPhase.actionsVisible;
    if (t >= _policy.actionsReveal) {
      _phase = FaceResultRevealPhase.complete;
    }
  }

  bool get showPrimary =>
      _phase.index >= FaceResultRevealPhase.primaryVisible.index;

  bool get showActions =>
      _phase.index >= FaceResultRevealPhase.actionsVisible.index;

  bool get showContourCalm =>
      _phase.index >= FaceResultRevealPhase.contourCalm.index;

  @visibleForTesting
  void forceComplete({required int insightTotal}) {
    _phase = FaceResultRevealPhase.complete;
    _insightVisibleCount = insightTotal;
  }
}
