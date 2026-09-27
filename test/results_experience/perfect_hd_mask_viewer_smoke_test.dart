import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/screens/perfect_hd_mask_technical_viewer_screen.dart';

void main() {
  test(
    'technical viewer screen type is loadable (no landmark painter import)',
    () {
      // Compile-time presence: screen exists for HD mask acceptance route.
      expect(PerfectHdMaskTechnicalViewerScreen, isNotNull);
    },
  );
}
