import '../../data/lane_orb_assets.dart';

/// Display copies for the circular categories. Full frames stay beside them.
/// Prefer id-based keys (`elegance:clothes`); label keys remain for legacy callers.
/// Subcategory thumbs are generated per taxonomy leaf id — never reuse another leaf image.
abstract final class DiscoverCategoryAssets {
  static const thumbs = <String, String>{
    'product:الكل': 'assets/marketplace/discover/thumbs/product_all.jpg',
    'product:الوجه': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'product:الجسم': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'product:الشعر': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'product:الملابس': 'assets/marketplace/discover/thumbs/product_clothes.jpg',
    'product:الإكسسوارات': 'assets/marketplace/discover/thumbs/product_accessories.png',
    'elegance:all': 'assets/marketplace/discover/thumbs/product_all.jpg',
    'elegance:الكل': 'assets/marketplace/discover/thumbs/product_all.jpg',
    'elegance:clothes': 'assets/marketplace/discover/thumbs/product_clothes.jpg',
    'elegance:الملابس': 'assets/marketplace/discover/thumbs/product_clothes.jpg',
    'elegance:bags': 'assets/marketplace/discover/thumbs/product_bags.png',
    'elegance:الشنط': 'assets/marketplace/discover/thumbs/product_bags.png',
    'elegance:shoes': 'assets/marketplace/discover/thumbs/product_shoes.png',
    'elegance:الأحذية': 'assets/marketplace/discover/thumbs/product_shoes.png',
    'elegance:face': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'elegance:الوجه': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'elegance:body': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'elegance:الجسم': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'elegance:hair': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'elegance:الشعر': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'elegance:accessories': 'assets/marketplace/discover/thumbs/product_accessories.png',
    'elegance:الإكسسوارات': 'assets/marketplace/discover/thumbs/product_accessories.png',
    'elegance:accessories.all': 'assets/marketplace/discover/thumbs/product_accessories.png',
    'elegance:accessories.belt': 'assets/marketplace/discover/thumbs/accessories_belt.png',
    'elegance:accessories.hair': 'assets/marketplace/discover/thumbs/accessories_hair.png',
    'elegance:accessories.hat': 'assets/marketplace/discover/thumbs/accessories_hat.png',
    'elegance:accessories.scarf': 'assets/marketplace/discover/thumbs/accessories_scarf.png',
    'elegance:accessories.sunglasses': 'assets/marketplace/discover/thumbs/accessories_sunglasses.png',
    'elegance:bags.all': 'assets/marketplace/discover/thumbs/product_bags.png',
    'elegance:bags.backpack': 'assets/marketplace/discover/thumbs/bags_backpack.png',
    'elegance:bags.clutch': 'assets/marketplace/discover/thumbs/bags_clutch.png',
    'elegance:bags.crossbody': 'assets/marketplace/discover/thumbs/bags_crossbody.png',
    'elegance:bags.hand': 'assets/marketplace/discover/thumbs/bags_hand.png',
    'elegance:bags.shoulder': 'assets/marketplace/discover/thumbs/bags_shoulder.png',
    'elegance:bags.tote': 'assets/marketplace/discover/thumbs/bags_tote.png',
    'elegance:bags.travel': 'assets/marketplace/discover/thumbs/bags_travel.png',
    'elegance:bags.wallet': 'assets/marketplace/discover/thumbs/bags_wallet.png',
    'elegance:body.all': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'elegance:body.deodorant': 'assets/marketplace/discover/thumbs/body_deodorant.png',
    'elegance:body.foot_care': 'assets/marketplace/discover/thumbs/body_foot_care.png',
    'elegance:body.hand_care': 'assets/marketplace/discover/thumbs/body_hand_care.png',
    'elegance:body.moisturizer': 'assets/marketplace/discover/thumbs/body_moisturizer.png',
    'elegance:body.oil': 'assets/marketplace/discover/thumbs/body_oil.png',
    'elegance:body.scrub': 'assets/marketplace/discover/thumbs/body_scrub.png',
    'elegance:body.wash': 'assets/marketplace/discover/thumbs/body_wash.png',
    'elegance:clothes.abaya': 'assets/marketplace/discover/thumbs/clothes_abaya.png',
    'elegance:clothes.all': 'assets/marketplace/discover/thumbs/product_clothes.jpg',
    'elegance:clothes.blouse': 'assets/marketplace/discover/thumbs/clothes_blouse.png',
    'elegance:clothes.casual': 'assets/marketplace/discover/thumbs/clothes_casual.png',
    'elegance:clothes.evening': 'assets/marketplace/discover/thumbs/clothes_evening.png',
    'elegance:clothes.jacket': 'assets/marketplace/discover/thumbs/clothes_jacket.png',
    'elegance:clothes.jeans': 'assets/marketplace/discover/thumbs/clothes_jeans.png',
    'elegance:clothes.loungewear': 'assets/marketplace/discover/thumbs/clothes_loungewear.png',
    'elegance:clothes.pants': 'assets/marketplace/discover/thumbs/clothes_pants.png',
    'elegance:clothes.set': 'assets/marketplace/discover/thumbs/clothes_set.png',
    'elegance:clothes.shirt': 'assets/marketplace/discover/thumbs/clothes_shirt.png',
    'elegance:clothes.skirt': 'assets/marketplace/discover/thumbs/clothes_skirt.png',
    'elegance:clothes.sportswear': 'assets/marketplace/discover/thumbs/clothes_sportswear.png',
    'elegance:clothes.wedding_dress': 'assets/marketplace/discover/thumbs/clothes_wedding_dress.png',
    'elegance:face.all': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'elegance:face.cleanser': 'assets/marketplace/discover/thumbs/face_cleanser.png',
    'elegance:face.makeup_eyes': 'assets/marketplace/discover/thumbs/face_makeup_eyes.png',
    'elegance:face.makeup_face': 'assets/marketplace/discover/thumbs/face_makeup_face.png',
    'elegance:face.makeup_lips': 'assets/marketplace/discover/thumbs/face_makeup_lips.png',
    'elegance:face.makeup_tools': 'assets/marketplace/discover/thumbs/face_makeup_tools.png',
    'elegance:face.mask': 'assets/marketplace/discover/thumbs/face_mask.png',
    'elegance:face.moisturizer': 'assets/marketplace/discover/thumbs/face_moisturizer.png',
    'elegance:face.serum': 'assets/marketplace/discover/thumbs/face_serum.png',
    'elegance:face.sunscreen': 'assets/marketplace/discover/thumbs/face_sunscreen.png',
    'elegance:hair.all': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'elegance:hair.conditioner': 'assets/marketplace/discover/thumbs/hair_conditioner.png',
    'elegance:hair.dye': 'assets/marketplace/discover/thumbs/hair_dye.png',
    'elegance:hair.mask': 'assets/marketplace/discover/thumbs/hair_mask.png',
    'elegance:hair.oil_serum': 'assets/marketplace/discover/thumbs/hair_oil_serum.png',
    'elegance:hair.shampoo': 'assets/marketplace/discover/thumbs/hair_shampoo.png',
    'elegance:hair.styling': 'assets/marketplace/discover/thumbs/hair_styling.png',
    'elegance:hair.tools': 'assets/marketplace/discover/thumbs/hair_tools.png',
    'elegance:shoes.all': 'assets/marketplace/discover/thumbs/product_shoes.png',
    'elegance:shoes.boot': 'assets/marketplace/discover/thumbs/shoes_boot.png',
    'elegance:shoes.flat': 'assets/marketplace/discover/thumbs/shoes_flat.png',
    'elegance:shoes.heel': 'assets/marketplace/discover/thumbs/shoes_heel.png',
    'elegance:shoes.loafer': 'assets/marketplace/discover/thumbs/shoes_loafer.png',
    'elegance:shoes.sandal': 'assets/marketplace/discover/thumbs/shoes_sandal.png',
    'elegance:shoes.slipper': 'assets/marketplace/discover/thumbs/shoes_slipper.png',
    'elegance:shoes.sneaker': 'assets/marketplace/discover/thumbs/shoes_sneaker.png',
    'beauty:الكل': 'assets/marketplace/discover/thumbs/salon_all.jpg',
    'beauty:العيادات': 'assets/marketplace/discover/thumbs/clinic_all.jpg',
    'beauty:المشاغل': 'assets/marketplace/discover/thumbs/salon_all.jpg',
    'beauty:الشعر': 'assets/marketplace/discover/thumbs/salon_hair.jpg',
    'beauty:البشرة': 'assets/marketplace/discover/thumbs/clinic_skin.jpg',
    'beauty:المكياج': 'assets/marketplace/discover/thumbs/salon_makeup.jpg',
    'beauty:الأظافر': 'assets/marketplace/discover/thumbs/salon_nails.jpg',
    'beauty:العناية': 'assets/marketplace/discover/thumbs/salon_care.jpg',
    'salon:الكل': 'assets/marketplace/discover/thumbs/salon_all.jpg',
    'salon:الشعر': 'assets/marketplace/discover/thumbs/salon_hair.jpg',
    'salon:المكياج': 'assets/marketplace/discover/thumbs/salon_makeup.jpg',
    'salon:الأظافر': 'assets/marketplace/discover/thumbs/salon_nails.jpg',
    'salon:العناية': 'assets/marketplace/discover/thumbs/salon_care.jpg',
    'clinic:الكل': 'assets/marketplace/discover/thumbs/clinic_all.jpg',
    'clinic:البشرة': 'assets/marketplace/discover/thumbs/clinic_skin.jpg',
    'clinic:الشعر': 'assets/marketplace/discover/thumbs/clinic_hair.jpg',
    'clinic:الليزر': 'assets/marketplace/discover/thumbs/clinic_laser.jpg',
    'clinic:الأسنان': 'assets/marketplace/discover/thumbs/clinic_teeth.jpg',
  };

  static String? thumb(String family, String label) => thumbs['$family:$label'];

  /// Resolve by taxonomy imageKey / id first, then Arabic label.
  /// Prefer server [iconUrl] (HTTPS WebP) so portal and app show the same bytes.
  static String? thumbFor({
    required String family,
    String? id,
    String? label,
    String? imageKey,
    String? iconUrl,
  }) {
    if (iconUrl != null && iconUrl.isNotEmpty) return iconUrl;
    final fromKey = LaneOrbAssets.thumbForImageKey(imageKey) ??
        LaneOrbAssets.thumbForImageKey(id) ??
        (id != null && id != 'all' && id != '__back__'
            ? LaneOrbAssets.thumbForImageKey(id)
            : null);
    if (fromKey != null) return fromKey;
    if (id == 'all' || id == '__back__') {
      final laneThumb = LaneOrbAssets.thumbForImageKey(family);
      if (laneThumb != null) return laneThumb;
    }
    if (id != null && id.isNotEmpty) {
      final byId = thumbs['$family:$id'];
      if (byId != null) return byId;
    }
    if (label != null && label.isNotEmpty) {
      final byLabel = thumbs['$family:$label'];
      if (byLabel != null) return byLabel;
    }
    return null;
  }
}
