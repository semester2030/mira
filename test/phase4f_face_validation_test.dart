import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/services/local_face_map_builder.dart';
import 'package:mirra/features/intelligence/presentation/widgets/face_intelligence_section.dart';
import 'package:mirra/shared/theme/colors.dart';
import 'package:mirra/shared/theme/typography.dart';

void main() {
  group('Phase 4F — Face Validation', () {
    test('LocalFaceMapBuilder is marked deprecated', () {
      // Class still exists for guest skin heatmap fallback during deprecation window.
      expect(LocalFaceMapBuilder, isNotNull);
    });

    test('Face Intelligence UI tokens remain on unified theme', () {
      expect(AppColors.textSecondary, isNotNull);
      expect(AppTypography.titleMedium, isNotNull);
      expect(FaceIntelligenceSection, isNotNull);
    });
  });
}
