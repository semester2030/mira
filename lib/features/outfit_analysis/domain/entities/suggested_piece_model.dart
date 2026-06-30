/// Luxury catalog recommendation — asset-backed with explainable AI fields.
class SuggestedPieceModel {
  final String id;
  final String category;
  final String imageAsset;
  final String title;
  final String styleTag;
  final String colorHex;
  final double compatibilityScore;
  final String whyAr;
  final double confidence;
  final List<String> evidence;
  final Map<String, double> scoreBreakdown;

  const SuggestedPieceModel({
    required this.id,
    required this.category,
    required this.imageAsset,
    required this.title,
    required this.styleTag,
    required this.colorHex,
    required this.compatibilityScore,
    required this.whyAr,
    this.confidence = 0,
    this.evidence = const [],
    this.scoreBreakdown = const {},
  });

  int get compatibilityPercent => compatibilityScore.round().clamp(0, 99);

  int get confidencePercent => ((confidence > 0 ? confidence : compatibilityScore / 100) * 100)
      .round()
      .clamp(50, 99);

  String get categoryLabelAr => switch (category) {
        'tops' => 'علوي',
        'bottoms' => 'سفلي',
        'outerwear' => 'طبقة خارجية',
        'bags' => 'حقيبة',
        'heels' => 'حذاء',
        'jewelry' => 'مجوهرات',
        'scarves' => 'وشاح',
        'watch' => 'ساعة',
        'sunglasses' => 'نظارة',
        _ => 'إكسسوار',
      };
}
