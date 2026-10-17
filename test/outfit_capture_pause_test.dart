import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/config/mira_features.dart';
import 'package:mirra/features/outfit_analysis/domain/outfit_capture_availability.dart';

void main() {
  test('outfit camera stays paused while face capture remains available', () {
    expect(MiraFeatures.outfitCameraCaptureEnabled, isFalse);
    expect(resolveOutfitCaptureEntry(), OutfitCaptureEntry.galleryWhilePaused);
    expect(
      resolveOutfitCaptureEntry(cameraEnabled: true),
      OutfitCaptureEntry.liveCamera,
    );
    expect(faceCameraCaptureRemainsAvailable, isTrue);
    expect(
      outfitCameraPausedMessage,
      'تصوير الإطلالة بالكاميرا متوقف مؤقتًا للتطوير. اختاري صورة من الاستديو لتحليل إطلالتك',
    );
  });
}
