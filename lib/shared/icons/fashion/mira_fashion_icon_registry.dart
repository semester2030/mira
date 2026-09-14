import 'package:flutter/widgets.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import 'mira_fashion_icon_id.dart';

/// Descriptor for one of the canonical 36 Fashion semantic icons.
class MiraFashionIconSpec {
  final MiraFashionIconId id;
  final MiraFashionIconGroup group;
  final String englishId;
  final String labelAr;
  final MiraFashionIconSource source;
  final String? phosphorName;
  final IconData? phosphorRegular;
  final IconData? phosphorFill;
  final String? assetPath;
  final bool ownerHighAttention;
  final String? ownerReviewNote;

  const MiraFashionIconSpec({
    required this.id,
    required this.group,
    required this.englishId,
    required this.labelAr,
    required this.source,
    this.phosphorName,
    this.phosphorRegular,
    this.phosphorFill,
    this.assetPath,
    this.ownerHighAttention = false,
    this.ownerReviewNote,
  });
}

/// Preview-oriented registry: 36 IDs → Phosphor or Custom SVG.
abstract final class MiraFashionIconRegistry {
  MiraFashionIconRegistry._();

  static const phosphorCount = 21;
  static const customSvgCount = 15;
  static const totalCount = 36;

  static List<MiraFashionIconSpec> get all => List.unmodifiable(_all);

  static MiraFashionIconSpec byId(MiraFashionIconId id) =>
      _byId[id] ?? (throw StateError('Unknown Fashion icon: $id'));

  static List<MiraFashionIconSpec> byGroup(MiraFashionIconGroup group) =>
      all.where((s) => s.group == group).toList(growable: false);

  static final Map<MiraFashionIconId, MiraFashionIconSpec> _byId = {
    for (final s in _all) s.id: s,
  };

  static const _all = <MiraFashionIconSpec>[
    // A — garments
    MiraFashionIconSpec(
      id: MiraFashionIconId.dress,
      group: MiraFashionIconGroup.garments,
      englishId: 'dress',
      labelAr: 'فستان',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'dress',
      phosphorRegular: PhosphorIconsRegular.dress,
      phosphorFill: PhosphorIconsFill.dress,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.blouse,
      group: MiraFashionIconGroup.garments,
      englishId: 'blouse',
      labelAr: 'بلوزة',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/garments/mira_fashion_blouse.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.shirt,
      group: MiraFashionIconGroup.garments,
      englishId: 'shirt',
      labelAr: 'قميص',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'shirt-folded',
      phosphorRegular: PhosphorIconsRegular.shirtFolded,
      phosphorFill: PhosphorIconsFill.shirtFolded,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.skirt,
      group: MiraFashionIconGroup.garments,
      englishId: 'skirt',
      labelAr: 'تنورة',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/garments/mira_fashion_skirt.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.pants,
      group: MiraFashionIconGroup.garments,
      englishId: 'pants',
      labelAr: 'بنطال',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'pants',
      phosphorRegular: PhosphorIconsRegular.pants,
      phosphorFill: PhosphorIconsFill.pants,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.jacket,
      group: MiraFashionIconGroup.garments,
      englishId: 'jacket',
      labelAr: 'جاكيت',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/garments/mira_fashion_jacket.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.coat,
      group: MiraFashionIconGroup.garments,
      englishId: 'coat',
      labelAr: 'معطف',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/garments/mira_fashion_coat.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.abaya,
      group: MiraFashionIconGroup.garments,
      englishId: 'abaya',
      labelAr: 'عباية',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/garments/mira_fashion_abaya.svg',
      ownerHighAttention: true,
      ownerReviewNote: 'Garment category only — Law #38',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.suitSet,
      group: MiraFashionIconGroup.garments,
      englishId: 'suit_set',
      labelAr: 'طقم أو بدلة',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/garments/mira_fashion_suit_set.svg',
    ),
    // B — attributes
    MiraFashionIconSpec(
      id: MiraFashionIconId.colorPalette,
      group: MiraFashionIconGroup.attributes,
      englishId: 'color_palette',
      labelAr: 'اللون',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'palette',
      phosphorRegular: PhosphorIconsRegular.palette,
      phosphorFill: PhosphorIconsFill.palette,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.fabric,
      group: MiraFashionIconGroup.attributes,
      englishId: 'fabric',
      labelAr: 'القماش',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/attributes/mira_fashion_fabric.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.silhouetteCut,
      group: MiraFashionIconGroup.attributes,
      englishId: 'silhouette_cut',
      labelAr: 'القصة',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/attributes/mira_fashion_silhouette_cut.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.fit,
      group: MiraFashionIconGroup.attributes,
      englishId: 'fit',
      labelAr: 'الملاءمة',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'ruler',
      phosphorRegular: PhosphorIconsRegular.ruler,
      phosphorFill: PhosphorIconsFill.ruler,
    ),
    // C — accessories
    MiraFashionIconSpec(
      id: MiraFashionIconId.handbag,
      group: MiraFashionIconGroup.accessories,
      englishId: 'handbag',
      labelAr: 'حقيبة',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'handbag',
      phosphorRegular: PhosphorIconsRegular.handbag,
      phosphorFill: PhosphorIconsFill.handbag,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.shoeHeel,
      group: MiraFashionIconGroup.accessories,
      englishId: 'shoe_heel',
      labelAr: 'حذاء',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'high-heel',
      phosphorRegular: PhosphorIconsRegular.highHeel,
      phosphorFill: PhosphorIconsFill.highHeel,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.jewelry,
      group: MiraFashionIconGroup.accessories,
      englishId: 'jewelry',
      labelAr: 'مجوهرات',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/accessories/mira_fashion_jewelry.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.belt,
      group: MiraFashionIconGroup.accessories,
      englishId: 'belt',
      labelAr: 'حزام',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'belt',
      phosphorRegular: PhosphorIconsRegular.belt,
      phosphorFill: PhosphorIconsFill.belt,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.scarf,
      group: MiraFashionIconGroup.accessories,
      englishId: 'scarf',
      labelAr: 'وشاح',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/accessories/mira_fashion_scarf.svg',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.hat,
      group: MiraFashionIconGroup.accessories,
      englishId: 'hat',
      labelAr: 'قبعة',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/accessories/mira_fashion_hat.svg',
    ),
    // D — occasions
    MiraFashionIconSpec(
      id: MiraFashionIconId.everyday,
      group: MiraFashionIconGroup.occasions,
      englishId: 'everyday',
      labelAr: 'يومي',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'house-simple',
      phosphorRegular: PhosphorIconsRegular.houseSimple,
      phosphorFill: PhosphorIconsFill.houseSimple,
      ownerHighAttention: true,
      ownerReviewNote:
          'OWNER REVIEW: house-simple may read as home. Alternate (not in 36): coffee / sun-horizon.',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.work,
      group: MiraFashionIconGroup.occasions,
      englishId: 'work',
      labelAr: 'عمل',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'briefcase',
      phosphorRegular: PhosphorIconsRegular.briefcase,
      phosphorFill: PhosphorIconsFill.briefcase,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.formal,
      group: MiraFashionIconGroup.occasions,
      englishId: 'formal',
      labelAr: 'رسمي',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/occasions/mira_fashion_formal.svg',
      ownerHighAttention: true,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.evening,
      group: MiraFashionIconGroup.occasions,
      englishId: 'evening',
      labelAr: 'سهرة',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'moon-stars',
      phosphorRegular: PhosphorIconsRegular.moonStars,
      phosphorFill: PhosphorIconsFill.moonStars,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.specialOccasion,
      group: MiraFashionIconGroup.occasions,
      englishId: 'special_occasion',
      labelAr: 'مناسبة خاصة',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/occasions/mira_fashion_special_occasion.svg',
      ownerHighAttention: true,
      ownerReviewNote: 'Not a heart=wedding stereotype',
    ),
    // E — season + style
    MiraFashionIconSpec(
      id: MiraFashionIconId.spring,
      group: MiraFashionIconGroup.seasonStyle,
      englishId: 'spring',
      labelAr: 'ربيع',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'flower',
      phosphorRegular: PhosphorIconsRegular.flower,
      phosphorFill: PhosphorIconsFill.flower,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.summer,
      group: MiraFashionIconGroup.seasonStyle,
      englishId: 'summer',
      labelAr: 'صيف',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'sun',
      phosphorRegular: PhosphorIconsRegular.sun,
      phosphorFill: PhosphorIconsFill.sun,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.autumn,
      group: MiraFashionIconGroup.seasonStyle,
      englishId: 'autumn',
      labelAr: 'خريف',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'leaf',
      phosphorRegular: PhosphorIconsRegular.leaf,
      phosphorFill: PhosphorIconsFill.leaf,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.winter,
      group: MiraFashionIconGroup.seasonStyle,
      englishId: 'winter',
      labelAr: 'شتاء',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'snowflake',
      phosphorRegular: PhosphorIconsRegular.snowflake,
      phosphorFill: PhosphorIconsFill.snowflake,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.casual,
      group: MiraFashionIconGroup.seasonStyle,
      englishId: 'casual',
      labelAr: 'كاجوال',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'sneaker',
      phosphorRegular: PhosphorIconsRegular.sneaker,
      phosphorFill: PhosphorIconsFill.sneaker,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.elegant,
      group: MiraFashionIconGroup.seasonStyle,
      englishId: 'elegant',
      labelAr: 'أنيق',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/style/mira_fashion_elegant.svg',
    ),
    // F — intelligence
    MiraFashionIconSpec(
      id: MiraFashionIconId.outfitStyling,
      group: MiraFashionIconGroup.intelligence,
      englishId: 'outfit_styling',
      labelAr: 'تنسيق الإطلالة',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'coat-hanger',
      phosphorRegular: PhosphorIconsRegular.coatHanger,
      phosphorFill: PhosphorIconsFill.coatHanger,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.colorHarmony,
      group: MiraFashionIconGroup.intelligence,
      englishId: 'color_harmony',
      labelAr: 'ألوان متناسقة',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'swatches',
      phosphorRegular: PhosphorIconsRegular.swatches,
      phosphorFill: PhosphorIconsFill.swatches,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.recommendations,
      group: MiraFashionIconGroup.intelligence,
      englishId: 'recommendations',
      labelAr: 'اقتراحات',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'star-four',
      phosphorRegular: PhosphorIconsRegular.starFour,
      phosphorFill: PhosphorIconsFill.starFour,
      ownerHighAttention: true,
      ownerReviewNote:
          'MUST NOT read as generic AI magic. Alternate (not in 36): shopping-bag-open.',
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.similarLooks,
      group: MiraFashionIconGroup.intelligence,
      englishId: 'similar_looks',
      labelAr: 'إطلالات مشابهة',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'images',
      phosphorRegular: PhosphorIconsRegular.images,
      phosphorFill: PhosphorIconsFill.images,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.wardrobe,
      group: MiraFashionIconGroup.intelligence,
      englishId: 'wardrobe',
      labelAr: 'خزانة الملابس',
      source: MiraFashionIconSource.phosphor,
      phosphorName: 'dresser',
      phosphorRegular: PhosphorIconsRegular.dresser,
      phosphorFill: PhosphorIconsFill.dresser,
    ),
    MiraFashionIconSpec(
      id: MiraFashionIconId.askMira,
      group: MiraFashionIconGroup.intelligence,
      englishId: 'ask_mira',
      labelAr: 'اسألي ميرا',
      source: MiraFashionIconSource.miraSvg,
      assetPath: 'assets/icons/fashion/intelligence/mira_fashion_ask_mira.svg',
      ownerHighAttention: true,
      ownerReviewNote: 'Brand-derived stylist mark — not chatbot/robot/sparkle',
    ),
  ];
}
