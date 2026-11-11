/// Resolves taxonomy `imageKey` → Flutter asset path (master + thumb).
/// Canonical keys match mira-api taxonomy JSON / phase2-orb-assets.v1.json.
abstract final class LaneOrbAssets {
  static const _laneDir = 'assets/marketplace/discover/lanes';
  static const _thumbDir = 'assets/marketplace/discover/thumbs';

  /// Home-orbit only: hanging clothes for أناقتك (reference 853×1844).
  /// Other screens keep [byImageKey] elegance_lane.png unchanged.
  static const String eleganceHomeOrbit = 'assets/marketplace/discover/home_orbit/elegance_home.png';

  /// Home-orbit / subcategory masters keyed by taxonomy imageKey.
  static const Map<String, String> byImageKey = {
    'elegance': 'assets/marketplace/discover/elegance_lane.png',
    'beauty': 'assets/marketplace/discover/beauty_lane.png',
    'jewelry': '$_laneDir/jewelry.png',
    'children': '$_laneDir/children.png',
    'gifts': '$_laneDir/gifts.png',
    'occasions': '$_laneDir/occasions.png',
    'jewelry.rings': '$_laneDir/jewelry.rings.png',
    'jewelry.necklaces': '$_laneDir/jewelry.necklaces.png',
    'jewelry.bracelets': '$_laneDir/jewelry.bracelets.png',
    'jewelry.earrings': '$_laneDir/jewelry.earrings.png',
    'children.clothes': '$_laneDir/children.clothes.png',
    'children.shoes': '$_laneDir/children.shoes.png',
    'children.newborn': '$_laneDir/children.newborn.png',
    'occasions.favors': '$_laneDir/occasions.favors.png',
    'occasions.decor': '$_laneDir/occasions.decor.png',
    'occasions.styling': '$_laneDir/occasions.styling.png',
    'occasions.types': '$_laneDir/occasions.types.png',
    'occasions.type.graduation': '$_laneDir/occasions.type.graduation.png',
    'occasions.type.baby_shower': '$_laneDir/occasions.type.baby_shower.png',
    'occasions.type.wedding': '$_laneDir/occasions.type.wedding.png',
    'occasions.type.birthday': '$_laneDir/occasions.type.birthday.png',
    'occasions.type.private': '$_laneDir/occasions.type.private.png',
    'gifts.boxes': '$_laneDir/gifts.boxes.png',
  };

  static String? assetForImageKey(String? imageKey) {
    if (imageKey == null || imageKey.isEmpty) return null;
    return byImageKey[imageKey];
  }

  /// Asset used by the home «اكتشفي عالم ميرا» orbit only.
  static String? homeOrbitAssetForImageKey(String? imageKey) {
    if (imageKey == 'elegance') return eleganceHomeOrbit;
    return assetForImageKey(imageKey);
  }

  static String? thumbForImageKey(String? imageKey) {
    if (imageKey == null || imageKey.isEmpty) return null;
    if (imageKey == 'elegance') return 'assets/marketplace/discover/elegance_lane.png';
    if (imageKey == 'beauty') return 'assets/marketplace/discover/beauty_lane.png';
    if (byImageKey.containsKey(imageKey)) {
      return '$_thumbDir/$imageKey.png';
    }
    return null;
  }
}
