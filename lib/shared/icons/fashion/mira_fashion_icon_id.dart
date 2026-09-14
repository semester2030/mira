/// Canonical MIRA Fashion semantic icon IDs — preview registry.
///
/// Production Fashion screens must NOT migrate to these until Owner Approval.
library;

enum MiraFashionIconId {
  dress,
  blouse,
  shirt,
  skirt,
  pants,
  jacket,
  coat,
  abaya,
  suitSet,
  colorPalette,
  fabric,
  silhouetteCut,
  fit,
  handbag,
  shoeHeel,
  jewelry,
  belt,
  scarf,
  hat,
  everyday,
  work,
  formal,
  evening,
  specialOccasion,
  spring,
  summer,
  autumn,
  winter,
  casual,
  elegant,
  outfitStyling,
  colorHarmony,
  recommendations,
  similarLooks,
  wardrobe,
  askMira,
}

enum MiraFashionIconGroup {
  garments,
  attributes,
  accessories,
  occasions,
  seasonStyle,
  intelligence,
}

enum MiraFashionIconSource {
  phosphor,
  miraSvg,
}

enum MiraFashionIconState {
  defaults,
  selected,
  disabled,
}

enum MiraFashionIconSizeRole {
  small,
  normal,
  large,
}

extension MiraFashionIconSizeRoleX on MiraFashionIconSizeRole {
  double get pixels => switch (this) {
        MiraFashionIconSizeRole.small => 18,
        MiraFashionIconSizeRole.normal => 22,
        MiraFashionIconSizeRole.large => 28,
      };
}
