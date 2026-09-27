/// Perfect HD map data kinds + single overlay availability decision.
library;

import 'mask_source_alignment_contract.dart';
import 'perfect_mask_data_kind_contract.dart';
import 'perfect_mask_session.dart';

export 'perfect_mask_data_kind_contract.dart'
    show PerfectMaskMapDataKind, PerfectMaskDataKindContract;

/// One decision drives overlay, magnifier, and legend.
class FaceMapOverlayDecision {
  const FaceMapOverlayDecision({
    required this.showSpatialOverlay,
    required this.scoreOnly,
    required this.unavailable,
    required this.alignmentBlocked,
    required this.regionMismatch,
    required this.dataKind,
    this.boundArtifact,
  });

  final bool showSpatialOverlay;
  final bool scoreOnly;
  final bool unavailable;
  final bool alignmentBlocked;
  final bool regionMismatch;
  final PerfectMaskMapDataKind dataKind;
  final PerfectMaskArtifact? boundArtifact;

  /// Photo-only (no mask) — caller ORs long-press compare.
  bool get hideMask => !showSpatialOverlay;

  /// True when the kind is a provider detection/area result (not zone-only).
  bool get isDiscoveredSpatial =>
      dataKind == PerfectMaskMapDataKind.discoveredPaths ||
      dataKind == PerfectMaskMapDataKind.discoveredPoints ||
      dataKind == PerfectMaskMapDataKind.intensityAreaMask;

  /// Measurement zone boundaries may draw as a quiet outline layer only.
  bool get isMeasurementBoundary =>
      dataKind == PerfectMaskMapDataKind.measurementRegionBoundary;

  static FaceMapOverlayDecision resolve({
    required String? selectedMetricId,
    required PerfectMaskSession? session,
    required String? selectedSubregion,
    required int? sourceWidth,
    required int? sourceHeight,
    required bool holdingOriginal,
    required bool showPerfectMaskLayer,
  }) {
    if (selectedMetricId == null || session == null) {
      return const FaceMapOverlayDecision(
        showSpatialOverlay: false,
        scoreOnly: false,
        unavailable: false,
        alignmentBlocked: false,
        regionMismatch: false,
        dataKind: PerfectMaskMapDataKind.unavailable,
      );
    }

    final region = selectedSubregion;
    final regionStrict = region != null && region != 'whole' && region != 'all';

    final mask = session.lookup(
      consumerMetricId: selectedMetricId,
      subregion: selectedSubregion,
      requireExactRegion: regionStrict,
    );

    final regionMaskBound =
        !regionStrict || (mask != null && mask.region == region);

    if (regionStrict && !regionMaskBound) {
      return const FaceMapOverlayDecision(
        showSpatialOverlay: false,
        scoreOnly: false,
        unavailable: false,
        alignmentBlocked: false,
        regionMismatch: true,
        dataKind: PerfectMaskMapDataKind.regionMaskAbsent,
      );
    }

    if (mask == null) {
      return const FaceMapOverlayDecision(
        showSpatialOverlay: false,
        scoreOnly: false,
        unavailable: true,
        alignmentBlocked: false,
        regionMismatch: false,
        dataKind: PerfectMaskMapDataKind.unavailable,
      );
    }

    final kind = PerfectMaskDataKindContract.classifyArtifact(
      artifact: mask,
      regionRequested: regionStrict,
      regionMaskBound: regionMaskBound,
    );

    final hasBytes = mask.bytes != null && mask.bytes!.isNotEmpty;
    final hasScore =
        mask.uiScore != null || mask.rawScore != null || mask.scoreOnly;

    if (kind == PerfectMaskMapDataKind.scoreOnly ||
        kind == PerfectMaskMapDataKind.unavailable) {
      return FaceMapOverlayDecision(
        showSpatialOverlay: false,
        scoreOnly: kind == PerfectMaskMapDataKind.scoreOnly,
        unavailable: kind == PerfectMaskMapDataKind.unavailable,
        alignmentBlocked: false,
        regionMismatch: false,
        dataKind: kind,
        boundArtifact: mask,
      );
    }

    if (!hasBytes) {
      return FaceMapOverlayDecision(
        showSpatialOverlay: false,
        scoreOnly: hasScore,
        unavailable: !hasScore,
        alignmentBlocked: false,
        regionMismatch: false,
        dataKind: hasScore
            ? PerfectMaskMapDataKind.scoreOnly
            : PerfectMaskMapDataKind.unavailable,
        boundArtifact: mask,
      );
    }

    final align = MaskSourceAlignmentContract.decide(
      sourceWidth: sourceWidth,
      sourceHeight: sourceHeight,
      maskWidth: mask.width,
      maskHeight: mask.height,
      alignedWithSource: mask.aligned,
    );

    if (!align.mayOverlaySpatially) {
      return FaceMapOverlayDecision(
        showSpatialOverlay: false,
        scoreOnly: hasScore,
        unavailable: !hasScore,
        alignmentBlocked: true,
        regionMismatch: false,
        dataKind: hasScore
            ? PerfectMaskMapDataKind.scoreOnly
            : PerfectMaskMapDataKind.unavailable,
        boundArtifact: mask,
      );
    }

    // Measurement zones: allow quiet boundary draw; not "discovered paths".
    final show =
        !holdingOriginal &&
        showPerfectMaskLayer &&
        (kind == PerfectMaskMapDataKind.discoveredPaths ||
            kind == PerfectMaskMapDataKind.discoveredPoints ||
            kind == PerfectMaskMapDataKind.intensityAreaMask ||
            kind == PerfectMaskMapDataKind.measurementRegionBoundary ||
            kind == PerfectMaskMapDataKind.undetermined);

    return FaceMapOverlayDecision(
      showSpatialOverlay: show,
      scoreOnly: false,
      unavailable: false,
      alignmentBlocked: false,
      regionMismatch: false,
      dataKind: kind,
      boundArtifact: mask,
    );
  }
}

/// @Deprecated — use [PerfectMaskDataKindContract.classifyArtifact].
PerfectMaskMapDataKind classifyMapDataKind({
  required String? consumerMetricId,
  required bool hasMaskBytes,
  required bool hasScore,
  required bool regionRequested,
  required bool regionMaskBound,
  PerfectMaskArtifact? artifact,
}) {
  if (artifact != null) {
    return PerfectMaskDataKindContract.classifyArtifact(
      artifact: artifact,
      regionRequested: regionRequested,
      regionMaskBound: regionMaskBound,
    );
  }
  if (regionRequested && !regionMaskBound) {
    return PerfectMaskMapDataKind.regionMaskAbsent;
  }
  if (!hasMaskBytes) {
    return hasScore
        ? PerfectMaskMapDataKind.scoreOnly
        : PerfectMaskMapDataKind.unavailable;
  }
  // Without an artifact, refuse alone is insufficient — undetermined.
  final provider = PerfectMaskSession.providerTypeForConsumerMetric(
    consumerMetricId ?? '',
  );
  final row = PerfectMaskDataKindContract.rowForProvider(provider);
  if (row == null) return PerfectMaskMapDataKind.undetermined;
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
