import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/catalog/professional_color_matcher.dart';

void main() {
  group('ProfessionalColorMatcher', () {
    test('emerald dress pixel maps to green family not neutral', () {
      final match = ProfessionalColorMatcher.matchRgb(13, 92, 74);
      expect(
        match.nameAr.contains('زمرد') ||
            match.nameAr.contains('أخضر') ||
            match.nameAr.contains('تركواز'),
        isTrue,
      );
      expect(match.deltaE, lessThan(15));
      expect(match.confidence, greaterThan(0.75));
    });

    test('dark blue pixel maps to blue/navy family', () {
      final match = ProfessionalColorMatcher.matchRgb(30, 42, 74);
      expect(
        match.nameAr.contains('كحل') ||
            match.nameAr.contains('أزرق') ||
            match.nameAr.contains('نيلي'),
        isTrue,
      );
      expect(match.deltaE, lessThan(18));
    });

    test('specular highlight detection', () {
      expect(ProfessionalColorMatcher.isSpecularHighlight(250, 248, 245), isTrue);
      expect(ProfessionalColorMatcher.isSpecularHighlight(13, 92, 74), isFalse);
    });

    test('deltaE2000 identical colors near zero', () {
      final lab = ProfessionalColorMatcher.rgbToLab(13, 92, 74);
      final de = ProfessionalColorMatcher.deltaE2000(lab, lab);
      expect(de, lessThan(0.01));
    });
  });
}
