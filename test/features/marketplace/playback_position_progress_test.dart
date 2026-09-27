import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_progress.dart';

void main() {
  test('position progress rejects playing flag alone', () {
    expect(
      videoPositionShowsProgress(const [Duration.zero, Duration.zero, Duration.zero]),
      isFalse,
    );
  });

  test('position progress accepts movement', () {
    expect(
      videoPositionShowsProgress([
        Duration.zero,
        const Duration(milliseconds: 100),
        const Duration(milliseconds: 200),
      ]),
      isTrue,
    );
  });

  test('position progress accepts loop wrap', () {
    expect(
      videoPositionShowsProgress([
        const Duration(milliseconds: 1900),
        const Duration(milliseconds: 50),
      ]),
      isTrue,
    );
  });
}
