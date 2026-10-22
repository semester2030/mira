import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/outfit_piece_art.dart';

void main() {
  test('piece art map covers core garments and accessories', () {
    expect(OutfitPieceArt.assetForLabel('فستان'), contains('mira_piece_dress'));
    expect(OutfitPieceArt.assetForLabel('حقيبة'), contains('mira_piece_bag'));
    expect(OutfitPieceArt.assetForLabel('حذاء'), contains('mira_piece_heel'));
    expect(OutfitPieceArt.assetForLabel('عباية'), contains('mira_piece_abaya'));
    expect(OutfitPieceArt.assetForLabel('unknown-xyz'), isNull);
  });

  test('illustrations root is under fashion icons', () {
    expect(
      OutfitPieceArt.illustrationsRoot,
      'assets/icons/fashion/illustrations',
    );
  });
}
