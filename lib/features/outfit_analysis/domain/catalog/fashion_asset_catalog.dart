import '../../../../core/ai/models/mira_occasion.dart';
import '../entities/suggested_piece_model.dart';
import 'fashion_asset_catalog_data.dart';
import 'fashion_catalog_types.dart';

/// Luxury fashion asset library — driven by assets/fashion/catalog.json.
abstract final class FashionAssetCatalog {
  FashionAssetCatalog._();

  static const basePath = 'assets/fashion';

  static List<CatalogPiece> get all => catalogPieces;

  static List<CatalogPiece> clothingPieces() =>
      all.where((p) => p.kind == CatalogKind.clothing).toList();

  static List<CatalogPiece> accessoryPieces() =>
      all.where((p) => p.kind == CatalogKind.accessory).toList();

  static List<CatalogPiece> byCategory(String category) =>
      all.where((p) => p.category == category).toList();

  static CatalogPiece? byId(String id) {
    for (final p in all) {
      if (p.id == id) return p;
    }
    return null;
  }
}

enum CatalogKind { clothing, accessory }

class CatalogPiece {
  final String id;
  final String category;
  final String subcategory;
  final String asset;
  final String titleAr;
  final String styleTag;
  final String colorHex;
  final String? colorId;
  final String? secondaryColorId;
  final List<String> colorTags;
  final List<String> seasons;
  final List<String> styles;
  final List<String> archetypes;
  final String brandStyle;
  final String priceLevel;
  final String gender;
  final String material;
  final String fit;
  final String sleeve;
  final String texture;
  final String pattern;
  final String countryStyle;
  final List<MiraOccasion> occasions;
  final double minFormality;
  final double maxFormality;
  final String whyAr;
  final CatalogKind kind;
  final List<String> compatibleWith;
  final List<String> recommendedFor;
  final List<String> extendedOccasions;
  final FashionPieceScores scores;
  final PieceAngles angles;
  final PiecePrompts? prompts;

  const CatalogPiece({
    required this.id,
    required this.category,
    this.subcategory = '',
    required this.asset,
    required this.titleAr,
    required this.styleTag,
    required this.colorHex,
    this.colorId,
    this.secondaryColorId,
    required this.colorTags,
    this.seasons = const [],
    this.styles = const [],
    this.archetypes = const [],
    this.brandStyle = 'minimal',
    this.priceLevel = 'premium',
    this.gender = 'female',
    this.material = '',
    this.fit = 'regular',
    this.sleeve = 'none',
    this.texture = 'matte',
    this.pattern = 'solid',
    this.countryStyle = 'European',
    required this.occasions,
    required this.minFormality,
    required this.maxFormality,
    required this.whyAr,
    required this.kind,
    this.compatibleWith = const [],
    this.recommendedFor = const [],
    this.extendedOccasions = const [],
    this.scores = const FashionPieceScores(),
    required this.angles,
    this.prompts,
  });

  SuggestedPieceModel toModel(
    double score, {
    String? whyOverride,
    double? confidence,
    List<String>? evidence,
    Map<String, double>? scoreBreakdown,
  }) =>
      SuggestedPieceModel(
        id: id,
        category: category,
        imageAsset: asset,
        title: titleAr,
        styleTag: styleTag,
        colorHex: colorHex,
        compatibilityScore: score,
        whyAr: whyOverride ?? whyAr,
        confidence: confidence ?? (score / 100).clamp(0.5, 0.98),
        evidence: evidence ?? const [],
        scoreBreakdown: scoreBreakdown ?? const {},
      );
}
