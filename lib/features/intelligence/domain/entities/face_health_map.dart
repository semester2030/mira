/// Phase 5 + Spatial — Face Health Map payload (educational or spatial).
class FaceHealthMap {
  final bool enabled;
  final String confidence;
  final String confidenceLabelAr;
  final String mode;
  final String titleAr;
  final String subtitleAr;
  final String disclaimerAr;
  final List<FaceHealthZone> zones;
  final List<FaceHealthInsight> insightCards;
  final List<FaceHealthConcernOverlay> concernOverlays;
  final String defaultConcernId;
  final List<FaceHealthSpatialMarker> markers;

  const FaceHealthMap({
    required this.enabled,
    required this.confidence,
    required this.confidenceLabelAr,
    required this.mode,
    required this.titleAr,
    required this.subtitleAr,
    required this.disclaimerAr,
    required this.zones,
    required this.insightCards,
    required this.concernOverlays,
    required this.defaultConcernId,
    required this.markers,
  });

  static const empty = FaceHealthMap(
    enabled: false,
    confidence: 'low',
    confidenceLabelAr: '',
    mode: 'educational',
    titleAr: '',
    subtitleAr: '',
    disclaimerAr: '',
    zones: [],
    insightCards: [],
    concernOverlays: [],
    defaultConcernId: '',
    markers: [],
  );

  bool get isEducational => mode == 'educational';
  bool get isRealSpatial => mode == 'spatial' || mode == 'regional';

  FaceHealthConcernOverlay? overlayById(String id) {
    for (final o in concernOverlays) {
      if (o.concernId == id) return o;
    }
    return null;
  }

  List<FaceHealthZone> zonesForConcern(String concernId) {
    final overlay = overlayById(concernId);
    if (overlay == null) return zones;

    final highlightIds = {...overlay.highlightZoneIds};
    if (highlightIds.contains('t_zone')) {
      highlightIds.addAll(['forehead', 'nose', 'chin']);
    }

    return zones
        .map(
          (z) => FaceHealthZone(
            id: z.id,
            labelAr: z.labelAr,
            highlight: highlightIds.contains(z.id),
            highlightColor: overlay.highlightColor,
            concernIds: highlightIds.contains(z.id) ? [concernId] : const [],
            zoneScore: overlay.zoneScores[z.id],
            educationalNoteAr: z.educationalNoteAr,
            source: z.source,
          ),
        )
        .toList();
  }

  List<FaceHealthSpatialMarker> markersForConcern(String concernId) =>
      markers.where((m) => m.concernId == concernId).toList();
}

class FaceHealthZone {
  final String id;
  final String labelAr;
  final bool highlight;
  final String highlightColor;
  final List<String> concernIds;
  final int? zoneScore;
  final String? educationalNoteAr;
  final String source;

  const FaceHealthZone({
    required this.id,
    required this.labelAr,
    required this.highlight,
    required this.highlightColor,
    required this.concernIds,
    this.zoneScore,
    this.educationalNoteAr,
    required this.source,
  });
}

class FaceHealthConcernOverlay {
  final String concernId;
  final String labelAr;
  final String labelEn;
  final int globalScore;
  final String severity;
  final Map<String, int> zoneScores;
  final List<String> highlightZoneIds;
  final String highlightColor;
  final bool hasRegionalData;

  const FaceHealthConcernOverlay({
    required this.concernId,
    required this.labelAr,
    required this.labelEn,
    required this.globalScore,
    required this.severity,
    required this.zoneScores,
    required this.highlightZoneIds,
    required this.highlightColor,
    required this.hasRegionalData,
  });

  bool get isHealthy => globalScore >= 70;
}

class FaceHealthSpatialMarker {
  final String concernId;
  final String zoneId;
  final double x;
  final double y;
  final int severity;

  const FaceHealthSpatialMarker({
    required this.concernId,
    required this.zoneId,
    required this.x,
    required this.y,
    required this.severity,
  });
}

class FaceHealthInsight {
  final String id;
  final String concernId;
  final String concernLabelAr;
  final List<String> zoneIds;
  final String zoneLabelAr;
  final String bodyAr;

  const FaceHealthInsight({
    required this.id,
    required this.concernId,
    required this.concernLabelAr,
    required this.zoneIds,
    required this.zoneLabelAr,
    required this.bodyAr,
  });
}
