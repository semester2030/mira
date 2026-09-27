/// Passive frame-blocking telemetry for Skin capture friction analysis.
///
/// Does not change gates. Call [record] each live evaluation while seeking
/// capture; call [snapshotAndReset] after success/failure for evidence.
class SkinCaptureFrictionTelemetry {
  SkinCaptureFrictionTelemetry();

  final Map<String, int> _frameCounts = {};
  final Map<String, int> _dwellMs = {};
  String? _lastCode;
  DateTime? _segmentStart;
  int _readyFrames = 0;
  int _notReadyFrames = 0;
  int _readyToNotReadyTransitions = 0;
  bool _wasReady = false;

  void record({
    required String? reasonCode,
    required bool isReady,
    required DateTime now,
  }) {
    if (isReady) {
      _readyFrames++;
      _closeSegment(now);
      if (!_wasReady && _notReadyFrames > 0) {
        // entering READY — no transition count
      }
      _wasReady = true;
      return;
    }

    _notReadyFrames++;
    final code = (reasonCode == null || reasonCode.isEmpty)
        ? 'unknown'
        : reasonCode;
    _frameCounts[code] = (_frameCounts[code] ?? 0) + 1;

    if (_wasReady) {
      _readyToNotReadyTransitions++;
    }
    _wasReady = false;

    if (_lastCode != code) {
      _closeSegment(now);
      _lastCode = code;
      _segmentStart = now;
    }
  }

  void _closeSegment(DateTime now) {
    final start = _segmentStart;
    final code = _lastCode;
    if (start != null && code != null) {
      final ms = now.difference(start).inMilliseconds;
      if (ms > 0) {
        _dwellMs[code] = (_dwellMs[code] ?? 0) + ms;
      }
    }
    _segmentStart = null;
    _lastCode = null;
  }

  SkinCaptureFrictionSnapshot snapshotAndReset({DateTime? now}) {
    _closeSegment(now ?? DateTime.now());
    final totalBlocked = _notReadyFrames;
    final ranked = _dwellMs.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final snap = SkinCaptureFrictionSnapshot(
      frameCounts: Map.unmodifiable(Map<String, int>.from(_frameCounts)),
      dwellMs: Map.unmodifiable(Map<String, int>.from(_dwellMs)),
      rankedByDwell: List.unmodifiable(
        ranked
            .map(
              (e) => SkinCaptureFrictionRank(
                reasonCode: e.key,
                dwellMs: e.value,
                frames: _frameCounts[e.key] ?? 0,
                shareOfBlockedFrames: totalBlocked == 0
                    ? 0
                    : (_frameCounts[e.key] ?? 0) / totalBlocked,
              ),
            )
            .toList(),
      ),
      readyFrames: _readyFrames,
      notReadyFrames: _notReadyFrames,
      readyToNotReadyTransitions: _readyToNotReadyTransitions,
    );
    _frameCounts.clear();
    _dwellMs.clear();
    _readyFrames = 0;
    _notReadyFrames = 0;
    _readyToNotReadyTransitions = 0;
    _wasReady = false;
    return snap;
  }
}

class SkinCaptureFrictionRank {
  final String reasonCode;
  final int dwellMs;
  final int frames;
  final double shareOfBlockedFrames;

  const SkinCaptureFrictionRank({
    required this.reasonCode,
    required this.dwellMs,
    required this.frames,
    required this.shareOfBlockedFrames,
  });
}

class SkinCaptureFrictionSnapshot {
  final Map<String, int> frameCounts;
  final Map<String, int> dwellMs;
  final List<SkinCaptureFrictionRank> rankedByDwell;
  final int readyFrames;
  final int notReadyFrames;
  final int readyToNotReadyTransitions;

  const SkinCaptureFrictionSnapshot({
    required this.frameCounts,
    required this.dwellMs,
    required this.rankedByDwell,
    required this.readyFrames,
    required this.notReadyFrames,
    required this.readyToNotReadyTransitions,
  });

  String summaryLine() {
    if (rankedByDwell.isEmpty) {
      return 'friction: none (readyFrames=$readyFrames)';
    }
    final top = rankedByDwell
        .take(3)
        .map(
          (r) =>
              '${r.reasonCode}:${(r.shareOfBlockedFrames * 100).toStringAsFixed(0)}%',
        )
        .join(' | ');
    return 'friction top: $top · flickerTransitions=$readyToNotReadyTransitions';
  }
}
