/// Documented Perfect HD mask data-kind contract (inventory 2026-09-12).
///
/// Classification is driven by [PerfectMaskArtifact.concernType] + region +
/// bytes/score — NOT by consumer display names alone, and NEVER by inventing
/// geometry from a global score or luminance heuristics.
library;

import 'perfect_mask_session.dart';

/// What the provider actually supplies for a concern — not presentation guesses.
enum PerfectMaskMapDataKind {
  /// Sparse detected lesion/point masks (acne, pores, pigmentation).
  discoveredPoints,

  /// Thin path / line detections (wrinkles) when provider pixel mask exists.
  discoveredPaths,

  /// Area intensity / coverage mask (oil, moisture, redness, texture).
  intensityAreaMask,

  /// Provider region mask is a measurement-zone boundary only
  /// (e.g. hd_skin_type t_zone/u_zone) — NOT discovered concern results.
  measurementRegionBoundary,

  /// Score without usable spatial mask bytes.
  scoreOnly,

  /// Selected subregion has no provider mask — do not substitute whole-face.
  regionMaskAbsent,

  /// No usable provider result for this concern.
  unavailable,

  /// Bytes present but provider/family not in the documented contract.
  undetermined,
}

/// Expected spatial family from the proven Perfect inventory.
enum PerfectMaskContractFamily {
  sparsePoints,
  sparsePaths,
  areaIntensity,
  measurementZone,
  scoreBearing,
  notSpatial,
}

/// One inventory row — authority: FULL_HD_CAPABILITY_MATRIX.json + input spec.
class PerfectMaskProviderContractRow {
  const PerfectMaskProviderContractRow({
    required this.providerType,
    required this.family,
    required this.spatialModeName,
    required this.knownSubregions,
    required this.faceExplorerRole,
  });

  final String providerType;
  final PerfectMaskContractFamily family;
  final String spatialModeName;
  final List<String> knownSubregions;
  final String faceExplorerRole;
}

/// Proven Perfect HD Face Explorer contracts (MIRA account inventory).
abstract final class PerfectMaskDataKindContract {
  PerfectMaskDataKindContract._();

  static const Map<String, PerfectMaskProviderContractRow> byProvider = {
    'hd_age_spot': PerfectMaskProviderContractRow(
      providerType: 'hd_age_spot',
      family: PerfectMaskContractFamily.sparsePoints,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_pore': PerfectMaskProviderContractRow(
      providerType: 'hd_pore',
      family: PerfectMaskContractFamily.sparsePoints,
      spatialModeName: 'PROVIDER_SUBREGION_MASKS',
      knownSubregions: ['forehead', 'nose', 'cheek', 'whole'],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_wrinkle': PerfectMaskProviderContractRow(
      providerType: 'hd_wrinkle',
      family: PerfectMaskContractFamily.sparsePaths,
      spatialModeName: 'PROVIDER_SUBREGION_MASKS',
      knownSubregions: [
        'forehead',
        'glabellar',
        'crowfeet',
        'periocular',
        'nasolabial',
        'marionette',
        'whole',
      ],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_redness': PerfectMaskProviderContractRow(
      providerType: 'hd_redness',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_texture': PerfectMaskProviderContractRow(
      providerType: 'hd_texture',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: ['whole'],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_acne': PerfectMaskProviderContractRow(
      providerType: 'hd_acne',
      family: PerfectMaskContractFamily.sparsePoints,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: ['whole'],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_moisture': PerfectMaskProviderContractRow(
      providerType: 'hd_moisture',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'PRIMARY',
    ),
    'hd_oiliness': PerfectMaskProviderContractRow(
      providerType: 'hd_oiliness',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_radiance': PerfectMaskProviderContractRow(
      providerType: 'hd_radiance',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_dark_circle': PerfectMaskProviderContractRow(
      providerType: 'hd_dark_circle',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_eye_bag': PerfectMaskProviderContractRow(
      providerType: 'hd_eye_bag',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_droopy_upper_eyelid': PerfectMaskProviderContractRow(
      providerType: 'hd_droopy_upper_eyelid',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_droopy_lower_eyelid': PerfectMaskProviderContractRow(
      providerType: 'hd_droopy_lower_eyelid',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_firmness': PerfectMaskProviderContractRow(
      providerType: 'hd_firmness',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_tear_trough': PerfectMaskProviderContractRow(
      providerType: 'hd_tear_trough',
      family: PerfectMaskContractFamily.areaIntensity,
      spatialModeName: 'PROVIDER_PIXEL_MASK',
      knownSubregions: [],
      faceExplorerRole: 'SECONDARY',
    ),
    'hd_skin_type': PerfectMaskProviderContractRow(
      providerType: 'hd_skin_type',
      family: PerfectMaskContractFamily.measurementZone,
      spatialModeName: 'PROVIDER_SUBREGION_MASKS',
      knownSubregions: ['whole', 't_zone', 'u_zone'],
      faceExplorerRole: 'SEPARATE',
    ),
  };

  static PerfectMaskProviderContractRow? rowForProvider(String? providerType) {
    if (providerType == null || providerType.isEmpty) return null;
    return byProvider[providerType];
  }

  /// Classify one Perfect artifact using inventory contract + artifact fields.
  static PerfectMaskMapDataKind classifyArtifact({
    required PerfectMaskArtifact? artifact,
    required bool regionRequested,
    required bool regionMaskBound,
  }) {
    if (regionRequested && !regionMaskBound) {
      return PerfectMaskMapDataKind.regionMaskAbsent;
    }
    if (artifact == null) {
      return PerfectMaskMapDataKind.unavailable;
    }
    final hasBytes =
        artifact.bytes != null && artifact.bytes!.isNotEmpty;
    final hasScore = artifact.uiScore != null ||
        artifact.rawScore != null ||
        artifact.scoreOnly;

    if (!hasBytes) {
      if (hasScore || artifact.scoreOnly) {
        return PerfectMaskMapDataKind.scoreOnly;
      }
      return PerfectMaskMapDataKind.unavailable;
    }

    final row = rowForProvider(artifact.concernType);
    if (row == null) {
      return PerfectMaskMapDataKind.undetermined;
    }

    switch (row.family) {
      case PerfectMaskContractFamily.sparsePoints:
        return PerfectMaskMapDataKind.discoveredPoints;
      case PerfectMaskContractFamily.sparsePaths:
        return PerfectMaskMapDataKind.discoveredPaths;
      case PerfectMaskContractFamily.areaIntensity:
        return PerfectMaskMapDataKind.intensityAreaMask;
      case PerfectMaskContractFamily.measurementZone:
        return PerfectMaskMapDataKind.measurementRegionBoundary;
      case PerfectMaskContractFamily.scoreBearing:
        return PerfectMaskMapDataKind.scoreOnly;
      case PerfectMaskContractFamily.notSpatial:
        return PerfectMaskMapDataKind.unavailable;
    }
  }
}
