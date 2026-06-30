/// Body shape bucket — drives guide padding and segment width scaling.
enum OutfitBodySilhouette {
  petite,
  average,
  tall,
  plusSize,
}

extension OutfitBodySilhouetteX on OutfitBodySilhouette {
  String get labelAr => switch (this) {
        OutfitBodySilhouette.petite => 'جسم صغير/نحيف',
        OutfitBodySilhouette.average => 'جسم متوسط',
        OutfitBodySilhouette.tall => 'جسم طويل',
        OutfitBodySilhouette.plusSize => 'جسم ممتلئ',
      };

  /// Horizontal padding multiplier for segment boxes.
  double get widthPaddingFactor => switch (this) {
        OutfitBodySilhouette.petite => 1.08,
        OutfitBodySilhouette.average => 1.12,
        OutfitBodySilhouette.tall => 1.10,
        OutfitBodySilhouette.plusSize => 1.22,
      };
}
