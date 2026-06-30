import 'package:shared_preferences/shared_preferences.dart';

/// Local-only saved pieces — never leaves the device, no sharing.
abstract final class OutfitPieceWishlistService {
  OutfitPieceWishlistService._();

  static const _key = 'fits.outfit_wishlist_piece_ids';

  static Future<Set<String>> loadIds() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_key)?.toSet() ?? {};
  }

  static Future<Set<String>> toggle(String pieceId) async {
    final prefs = await SharedPreferences.getInstance();
    final current = prefs.getStringList(_key)?.toSet() ?? {};
    if (current.contains(pieceId)) {
      current.remove(pieceId);
    } else {
      current.add(pieceId);
    }
    await prefs.setStringList(_key, current.toList());
    return current;
  }

  static Future<bool> isSaved(String pieceId) async {
    final ids = await loadIds();
    return ids.contains(pieceId);
  }
}
