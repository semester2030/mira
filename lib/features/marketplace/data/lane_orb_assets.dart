/// Resolves taxonomy `imageKey` → Flutter asset path (master + thumb).
/// Canonical keys match mira-api taxonomy JSON / phase2-orb-assets.v1.json.
abstract final class LaneOrbAssets {
  static const _laneDir = 'assets/marketplace/discover/lanes';
  static const _thumbDir = 'assets/marketplace/discover/thumbs';

  /// Home «اكتشفي عالم ميرا» row only: hanging clothes for أناقتك.
  /// Other screens keep [byImageKey] elegance_lane.png unchanged.
  static const String eleganceHomeOrbit = 'assets/marketplace/discover/home_orbit/elegance_home.png';

  /// Home row / subcategory masters keyed by taxonomy imageKey.
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
    // Package imageKey for bracelets (id remains jewelry.bracelets).
    'jewelry.bangles': '$_laneDir/jewelry.bracelets.png',
    'jewelry.earrings': '$_laneDir/jewelry.earrings.png',
    'jewelry.pendants': '$_laneDir/jewelry.pendants.png',
    'jewelry.sets': '$_laneDir/jewelry.sets.png',
    'jewelry.hand_chains': '$_laneDir/jewelry.hand_chains.png',
    'jewelry.hand-chains': '$_laneDir/jewelry.hand_chains.png',
    'jewelry.anklets': '$_laneDir/jewelry.anklets.png',
    'jewelry.nose': '$_laneDir/jewelry.nose.png',
    'jewelry.nose-jewelry': '$_laneDir/jewelry.nose.png',
    'jewelry.brooches': '$_laneDir/jewelry.brooches.png',
    'jewelry.head': '$_laneDir/jewelry.head.png',
    'jewelry.head-jewelry': '$_laneDir/jewelry.head.png',
    'jewelry.waist': '$_laneDir/jewelry.waist.png',
    'jewelry.waist-jewelry': '$_laneDir/jewelry.waist.png',
    'jewelry.armband': '$_laneDir/jewelry.armband.png',
    'jewelry.armlets': '$_laneDir/jewelry.armband.png',
    'jewelry.metals': '$_laneDir/jewelry.metals.png',
    'jewelry.stones': '$_laneDir/jewelry.stones.png',
    'jewelry.traits': '$_laneDir/jewelry.traits.png',
    'jewelry.metal.gold': '$_laneDir/jewelry.metal.gold.png',
    'materials.gold': '$_laneDir/jewelry.metal.gold.png',
    'jewelry.metal.white_gold': '$_laneDir/jewelry.metal.white_gold.png',
    'jewelry.metal.rose_gold': '$_laneDir/jewelry.metal.rose_gold.png',
    'jewelry.metal.silver': '$_laneDir/jewelry.metal.silver.png',
    'materials.silver': '$_laneDir/jewelry.metal.silver.png',
    'jewelry.metal.silver_gold_plated': '$_laneDir/jewelry.metal.silver_gold_plated.png',
    'jewelry.stone.diamond': '$_laneDir/jewelry.stone.diamond.png',
    'materials.diamond': '$_laneDir/jewelry.stone.diamond.png',
    'jewelry.stone.emerald': '$_laneDir/jewelry.stone.emerald.png',
    'jewelry.stone.ruby': '$_laneDir/jewelry.stone.ruby.png',
    'jewelry.stone.sapphire': '$_laneDir/jewelry.stone.sapphire.png',
    'jewelry.stone.pearl': '$_laneDir/jewelry.stone.pearl.png',
    'materials.pearls': '$_laneDir/jewelry.stone.pearl.png',
    'jewelry.stone.gemstones': '$_laneDir/jewelry.stones.png',
    'materials.gemstones': '$_laneDir/jewelry.stones.png',
    'jewelry.trait.bridal': '$_laneDir/jewelry.trait.bridal.png',
    'jewelry.trait.newborn': '$_laneDir/jewelry.trait.newborn.png',
    'jewelry.trait.gift': '$_laneDir/jewelry.trait.gift.png',
    'jewelry.trait.heritage': '$_laneDir/jewelry.trait.heritage.png',
    'jewelry.trait.named': '$_laneDir/jewelry.trait.named.png',
    'children.clothes': '$_laneDir/children.clothes.png',
    'children.shoes': '$_laneDir/children.shoes.png',
    'children.newborn': '$_laneDir/children.newborn.png',
    'occasions.favors': '$_laneDir/occasions.favors.png',
    'occasions.decor': '$_laneDir/occasions.decor.png',
    'occasions.styling': '$_laneDir/occasions.styling.png',
    'occasions.packages': '$_laneDir/occasions.packages.png',
    'occasions.planning': '$_laneDir/occasions.packages.png',
    'occasions.arches': '$_laneDir/occasions.arches.png',
    'occasions.stages': '$_laneDir/occasions.arches.png',
    'occasions.tables_decor': '$_laneDir/occasions.tables_decor.png',
    'occasions.tables': '$_laneDir/occasions.tables_decor.png',
    'occasions.hospitality': '$_laneDir/occasions.hospitality.png',
    'occasions.hosts': '$_laneDir/occasions.hospitality.png',
    'occasions.buffet': '$_laneDir/occasions.buffet.png',
    'occasions.catering': '$_laneDir/occasions.buffet.png',
    'occasions.perfume_corner': '$_laneDir/occasions.perfume_corner.png',
    'occasions.perfume': '$_laneDir/occasions.perfume_corner.png',
    'occasions.furniture_rental': '$_laneDir/occasions.furniture_rental.png',
    'occasions.rentals': '$_laneDir/occasions.furniture_rental.png',
    'occasions.photography': '$_laneDir/occasions.photography.png',
    'occasions.types': '$_laneDir/occasions.types.png',
    'occasions.type.engagement': '$_laneDir/occasions.type.engagement.png',
    'occasions.type.milka': '$_laneDir/occasions.type.milka.png',
    'occasions.type.wedding': '$_laneDir/occasions.type.wedding.png',
    'occasions.type.henna': '$_laneDir/occasions.type.henna.png',
    'occasions.type.graduation': '$_laneDir/occasions.type.graduation.png',
    'occasions.type.baby_shower': '$_laneDir/occasions.type.baby_shower.png',
    'occasions.type.birthday': '$_laneDir/occasions.type.birthday.png',
    'occasions.type.family': '$_laneDir/occasions.type.family.png',
    'occasions.type.private': '$_laneDir/occasions.type.private.png',
    'gifts.boxes': '$_laneDir/gifts.boxes.png',
    'gifts.flowers': '$_laneDir/gifts.flowers.png',
    'gifts.chocolate': '$_laneDir/gifts.chocolate.png',
    'gifts.sweets': '$_laneDir/gifts.chocolate.png',
    'gifts.perfume_incense': '$_laneDir/gifts.perfume_incense.png',
    'gifts.fragrance': '$_laneDir/gifts.perfume_incense.png',
    'gifts.personalized': '$_laneDir/gifts.personalized.png',
    'gifts.balloons': '$_laneDir/gifts.balloons.png',
  };

  static String? assetForImageKey(String? imageKey) {
    if (imageKey == null || imageKey.isEmpty) return null;
    return byImageKey[imageKey];
  }

  /// Asset used by the home «اكتشفي عالم ميرا» circle row only.
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
