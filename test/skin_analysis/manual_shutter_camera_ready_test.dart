import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/post_capture_minimal_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_ux_policy.dart';

void main() {
  test('manual UX copy has no auto-capture promise', () {
    expect(SkinCaptureInstruction.readyManual, contains('اضغطي'));
    expect(SkinCaptureInstruction.readyManual, isNot(contains('تلقائي')));
  });

  test('HD short-side contract unchanged for post-capture gate', () {
    expect(PostCaptureMinimalGate.hdMinShortSidePx, 1080);
  });
}
