import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/shared/icons/fashion/mira_fashion_icon_id.dart';
import 'package:mirra/shared/icons/fashion/mira_fashion_icon_registry.dart';

void main() {
  test('Fashion icon registry exposes exactly 36 unique semantic IDs', () {
    final all = MiraFashionIconRegistry.all;
    expect(all.length, MiraFashionIconRegistry.totalCount);
    expect(all.length, 36);
    expect(all.map((e) => e.id).toSet().length, 36);
    expect(all.map((e) => e.englishId).toSet().length, 36);
  });

  test('Fashion icon registry split is 21 Phosphor + 15 Custom SVG', () {
    final all = MiraFashionIconRegistry.all;
    final phosphor =
        all.where((e) => e.source == MiraFashionIconSource.phosphor).toList();
    final custom =
        all.where((e) => e.source == MiraFashionIconSource.miraSvg).toList();
    expect(phosphor.length, MiraFashionIconRegistry.phosphorCount);
    expect(custom.length, MiraFashionIconRegistry.customSvgCount);
    expect(phosphor.length + custom.length, 36);
  });

  test('every Fashion icon resolves with Arabic label and source payload', () {
    for (final id in MiraFashionIconId.values) {
      final spec = MiraFashionIconRegistry.byId(id);
      expect(spec.labelAr.trim().isNotEmpty, isTrue, reason: '$id label');
      switch (spec.source) {
        case MiraFashionIconSource.phosphor:
          expect(spec.phosphorRegular, isNotNull, reason: '$id phosphor');
          expect(spec.phosphorFill, isNotNull, reason: '$id phosphor fill');
          expect(spec.phosphorName, isNotEmpty);
        case MiraFashionIconSource.miraSvg:
          expect(spec.assetPath, isNotNull);
          expect(File(spec.assetPath!).existsSync(), isTrue,
              reason: 'missing ${spec.assetPath}');
      }
    }
  });

  test('enum count matches registry total', () {
    expect(MiraFashionIconId.values.length, 36);
  });
}
