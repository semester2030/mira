/// Display copies for the circular categories. Full frames stay beside them.
/// Prefer id-based keys (`elegance:clothes`); label keys remain for legacy callers.
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
    'elegance:clothes.wedding_dress': 'assets/marketplace/discover/thumbs/clothes_wedding_dress.png',
    'elegance:clothes.abaya': 'assets/marketplace/discover/thumbs/clothes_abaya.png',
    'elegance:clothes.evening': 'assets/marketplace/discover/thumbs/clothes_evening.png',
    'elegance:clothes.blouse': 'assets/marketplace/discover/thumbs/clothes_blouse.png',
    'elegance:clothes.skirt': 'assets/marketplace/discover/thumbs/clothes_skirt.png',
    'elegance:clothes.casual': 'assets/marketplace/discover/thumbs/clothes_casual.png',
    'elegance:clothes.all': 'assets/marketplace/discover/thumbs/product_clothes.jpg',
    'elegance:face': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'elegance:الوجه': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'elegance:body': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'elegance:الجسم': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'elegance:hair': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'elegance:الشعر': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'elegance:accessories': 'assets/marketplace/discover/thumbs/product_accessories.png',
    'elegance:الإكسسوارات': 'assets/marketplace/discover/thumbs/product_accessories.png',
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

  /// Resolve by taxonomy id first, then Arabic label.
  static String? thumbFor({required String family, String? id, String? label}) {
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
