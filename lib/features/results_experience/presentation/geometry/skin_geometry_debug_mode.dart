/// INTERNAL DEBUG ONLY — never ship without an explicit dart-define.
///
/// Enable on owner-review builds:
/// `--dart-define=MIRA_SKIN_GEOMETRY_DEBUG=true`
///
/// When enabled (including release), shows raw 468 landmarks + region outlines
/// so landmark↔image alignment can be verified before trusting regions.
abstract final class SkinGeometryDebugMode {
  SkinGeometryDebugMode._();

  static const _flag = bool.fromEnvironment(
    'MIRA_SKIN_GEOMETRY_DEBUG',
    defaultValue: false,
  );

  static bool get enabled => _flag;
}
