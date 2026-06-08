/// Phase 5 — Face Health Map payload (educational or spatial).
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
  );

  bool get isEducational => mode == 'educational';
  bool get isRealSpatial => mode == 'spatial' || mode == 'regional';
}

class FaceHealthZone {
  final String id;
  final String labelAr;
  final bool highlight;
  final String highlightColor;
  final List<String> concernIds;
  final String? educationalNoteAr;
  final String source;

  const FaceHealthZone({
    required this.id,
    required this.labelAr,
    required this.highlight,
    required this.highlightColor,
    required this.concernIds,
    this.educationalNoteAr,
    required this.source,
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
