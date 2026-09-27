/// INTERNAL Face Explorer layer isolation (forensics only).
///
/// Default: all production layers ON.
/// Owner forensics builds may disable layers via dart-define, e.g.:
/// `--dart-define=MIRA_FX_HIDE_PERFECT_MASK=true`
///
/// Never enable hide-flags in consumer App Store builds.
abstract final class SkinFaceExplorerLayerIsolation {
  SkinFaceExplorerLayerIsolation._();

  static const hideSubject = bool.fromEnvironment(
    'MIRA_FX_HIDE_SUBJECT',
    defaultValue: false,
  );
  static const hidePerfectMask = bool.fromEnvironment(
    'MIRA_FX_HIDE_PERFECT_MASK',
    defaultValue: false,
  );
  static const hideMagnifierCallout = bool.fromEnvironment(
    'MIRA_FX_HIDE_UI_ANNOTATION',
    defaultValue: false,
  );

  static bool get showSubject => !hideSubject;
  static bool get showPerfectMask => !hidePerfectMask;
  static bool get showMagnifierCallout => !hideMagnifierCallout;
}
