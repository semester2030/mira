import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/perfect_camera_kit_gate.dart';

/// Documents the post-capture contract: analysis must be invoked from the
/// screen after capture, not via a build-time null onAnalyze closure.
void main() {
  test('build probe identifies E2E FullRange + analysis-invoke fix', () {
    expect(PerfectCameraKitGate.buildProbeTag, 'CKLIT-20260916B');
    expect(PerfectCameraKitGate.fullRangeNv12, 875704422);
    expect(PerfectCameraKitGate.videoRangeNv12, 875704438);
  });

  test('stale onAnalyze null pattern is the verified post-capture bug', () {
    // Simulated build-time gate (old bug): canAnalyze false while no photo.
    FilePresence? captured;
    VoidCallback? onAnalyzeFromBuild;
    final calls = <String>[];

    void rebuild() {
      final canAnalyze = captured != null;
      onAnalyzeFromBuild = canAnalyze ? () => calls.add('analyze') : null;
    }

    void onImageChanged(FilePresence? file) {
      final became = file != null && captured == null;
      captured = file;
      // OLD BUG: schedule using stale build-time onAnalyze (still null).
      if (became && onAnalyzeFromBuild != null) {
        onAnalyzeFromBuild!();
      }
    }

    rebuild(); // captured == null → onAnalyze null
    onImageChanged(const FilePresence('x.jpg'));
    expect(calls, isEmpty, reason: 'stale null onAnalyze never invokes');

    // FIXED pattern: invoke start directly after capture (ignore build closure).
    calls.clear();
    captured = null;
    void onImageChangedFixed(FilePresence? file) {
      final became = file != null && captured == null;
      captured = file;
      if (became) calls.add('analyze');
    }

    onImageChangedFixed(const FilePresence('x.jpg'));
    expect(calls, ['analyze']);
  });
}

class FilePresence {
  final String path;
  const FilePresence(this.path);
}

typedef VoidCallback = void Function();
