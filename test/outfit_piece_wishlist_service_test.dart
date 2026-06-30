import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_piece_wishlist_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('OutfitPieceWishlistService', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('toggle saves locally without external export', () async {
      expect(await OutfitPieceWishlistService.loadIds(), isEmpty);

      final afterAdd = await OutfitPieceWishlistService.toggle('cape_ivory');
      expect(afterAdd, contains('cape_ivory'));

      final afterRemove = await OutfitPieceWishlistService.toggle('cape_ivory');
      expect(afterRemove, isEmpty);
    });
  });
}
