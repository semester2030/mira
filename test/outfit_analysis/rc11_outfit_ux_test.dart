import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_consultation_mapper.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_color_binding.dart';

void main() {
  test('clientSaveId stays within server MaxLength(64) even with SHA-256 fingerprint', () {
    final fp = List.filled(64, 'a').join();
    final id = OutfitConsultationMapper.buildClientSaveId(
      fingerprint: fp,
      occasionId: 'university',
      at: DateTime.utc(2026, 10, 22, 1, 27, 53),
    );
    expect(id.length, lessThanOrEqualTo(64));
    expect(id.startsWith('s-'), isTrue);
    // Legacy form that caused live 400 must stay rejected by length guard.
    final legacy = '${DateTime.now().microsecondsSinceEpoch}-$fp';
    expect(legacy.length, greaterThan(64));
  });

  test('نبيتي swatch is deep burgundy, not pale pink', () {
    final bound = FashionColorBinding.resolveDetailed(nameAr: 'نبيتي');
    expect(bound.isAvailable, isTrue);
    expect(bound.hex?.toUpperCase(), '#781828');
    final color = bound.color!;
    // Pale pink #ECD5D5 is very light; deep نبيتي is dark.
    expect(color.computeLuminance(), lessThan(0.25));
  });

  test('عنابي aliases to the same deep swatch family', () {
    final nab = FashionColorBinding.resolveDetailed(nameAr: 'نبيتي');
    final burg = FashionColorBinding.resolveDetailed(nameAr: 'عنابي');
    expect(nab.hex?.toUpperCase(), burg.hex?.toUpperCase());
  });
}
