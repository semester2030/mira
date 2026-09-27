/// Display copies for the circular categories. Full frames stay beside them.
abstract final class DiscoverCategoryAssets {
  static const thumbs = <String, String>{
    'product:الكل': 'assets/marketplace/discover/thumbs/product_all.jpg',
    'product:الوجه': 'assets/marketplace/discover/thumbs/product_face.jpg',
    'product:الجسم': 'assets/marketplace/discover/thumbs/product_body.jpg',
    'product:الشعر': 'assets/marketplace/discover/thumbs/product_hair.jpg',
    'product:الملابس': 'assets/marketplace/discover/thumbs/product_clothes.jpg',
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
}
