/// Perfect HD spatial truth contract for Face Explorer (no landmark fallback).
library;

enum PerfectSpatialMode {
  providerPixelMask,
  providerSubregionMasks,
  scoreOnly,
}

enum FaceExplorerRole {
  primary,
  secondary,
  scoreOnly,
  separateComponent,
  notUsable,
}

/// Absolute visual truth: overlay only for provider mask modes.
bool mayShowSpatialOverlay(PerfectSpatialMode mode) {
  return mode == PerfectSpatialMode.providerPixelMask ||
      mode == PerfectSpatialMode.providerSubregionMasks;
}

PerfectSpatialMode classifySpatialMode({
  required bool hasRootMask,
  required int subregionMaskCount,
}) {
  if (subregionMaskCount >= 2) {
    return PerfectSpatialMode.providerSubregionMasks;
  }
  if (hasRootMask || subregionMaskCount == 1) {
    return PerfectSpatialMode.providerPixelMask;
  }
  return PerfectSpatialMode.scoreOnly;
}

/// Proven MIRA-account inventory roles (2026-09-12). Not documentation guesses.
const Map<String, FaceExplorerRole> kPerfectHdFaceExplorerRoles = {
  'hd_age_spot': FaceExplorerRole.primary,
  'hd_pore': FaceExplorerRole.primary,
  'hd_wrinkle': FaceExplorerRole.primary,
  'hd_redness': FaceExplorerRole.primary,
  'hd_texture': FaceExplorerRole.primary,
  'hd_acne': FaceExplorerRole.primary,
  'hd_moisture': FaceExplorerRole.primary,
  'hd_oiliness': FaceExplorerRole.secondary,
  'hd_radiance': FaceExplorerRole.secondary,
  'hd_dark_circle': FaceExplorerRole.secondary,
  'hd_eye_bag': FaceExplorerRole.secondary,
  'hd_droopy_upper_eyelid': FaceExplorerRole.secondary,
  'hd_droopy_lower_eyelid': FaceExplorerRole.secondary,
  'hd_firmness': FaceExplorerRole.secondary,
  'hd_tear_trough': FaceExplorerRole.secondary,
  'hd_skin_type': FaceExplorerRole.separateComponent,
};

/// Switching concerns must clear previous mask selection (no stale overlay).
String? nextSelectedMaskKey({
  required String? previousKey,
  required String nextKey,
  required Iterable<String> availableKeys,
}) {
  if (!availableKeys.contains(nextKey)) return null;
  if (previousKey == nextKey) return nextKey;
  return nextKey;
}
