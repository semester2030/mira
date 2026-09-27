import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_color_binding.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_compatibility_label.dart';

void main() {
  group('FashionColorBinding', () {
    test('prefers canonical HEX over name', () {
      final color = FashionColorBinding.resolve(
        hex: '#1A1A1A',
        nameAr: 'أسود متوسط',
      );
      expect(color, isNotNull);
      expect(color!.value, const Color(0xFF1A1A1A).value);
    });

    test('resolves shaded Arabic name via base catalog entry', () {
      final color = FashionColorBinding.resolve(nameAr: 'أسود متوسط');
      // Base «أسود» should resolve — never identical false-gray for known base.
      expect(color, isNotNull);
      expect(
        '#${color!.value.toRadixString(16).substring(2).toUpperCase()}',
        isNot(FashionColorBinding.falseGrayHex),
      );
    });

    test('unknown name does not invent #9E9E9E swatch', () {
      final color = FashionColorBinding.resolve(nameAr: 'لون_غير_موجود_xyz');
      expect(color, isNull);
    });
  });

  group('FashionCompatibilityLabel', () {
    test('uses outfit-fit language without beauty score framing', () {
      expect(FashionCompatibilityLabel.fromScore(73), contains('توافق'));
      expect(FashionCompatibilityLabel.fromScore(73), isNot(contains('/100')));
      expect(FashionCompatibilityLabel.fromScore(73), isNot(contains('جمال')));
    });
  });
}
