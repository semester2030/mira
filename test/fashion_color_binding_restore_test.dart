import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_color_binding.dart';

void main() {
  group('FashionColorBinding / VisionColorMapper restore', () {
    test('HEX wins over Arabic name', () {
      final c = FashionColorBinding.resolve(hex: '#781828', nameAr: 'تركواز');
      expect(c, isNotNull);
      expect(c!.red, greaterThan(100));
      expect(c.green, lessThan(80));
    });

    test('عنابي aliases to burgundy family', () {
      final c = FashionColorBinding.resolve(nameAr: 'عنابي');
      expect(c, isNotNull);
      expect(c!.red, greaterThan(c.blue));
    });

    test('unknown name → null (no purple / false gray invent)', () {
      expect(FashionColorBinding.resolve(nameAr: 'لون_غير_موجود_xyz'), isNull);
    });

    test('true gray name keeps gray hex', () {
      final c = FashionColorBinding.resolve(hex: '#9E9E9E', nameAr: 'رمادي');
      expect(c, isNotNull);
    });

    test('false gray hex without gray name is rejected', () {
      expect(
        FashionColorBinding.resolve(hex: '#9E9E9E', nameAr: 'فوشي'),
        isNull,
      );
    });

    test('detected true gray without name is kept', () {
      final c = FashionColorBinding.resolve(
        hex: '#7A7A7A',
        source: FashionColorSource.detected,
      );
      expect(c, isNotNull);
    });
  });
}
