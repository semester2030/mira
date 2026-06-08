/// User-facing zone narratives — Phase 5 (5b-fallback or spatial map).
class ConcernZonesSection {
  final bool enabled;
  final String mode;
  final String spatialConfidence;
  final String titleAr;
  final String disclaimerAr;
  final List<ConcernZoneNarrative> zones;

  const ConcernZonesSection({
    required this.enabled,
    required this.mode,
    required this.spatialConfidence,
    required this.titleAr,
    required this.disclaimerAr,
    required this.zones,
  });

  static const empty = ConcernZonesSection(
    enabled: false,
    mode: 'narrative_only',
    spatialConfidence: 'none',
    titleAr: '',
    disclaimerAr: '',
    zones: [],
  );

  bool get isNarrativeOnly => mode == 'narrative_only';
}

class ConcernZoneNarrative {
  final String id;
  final String zoneLabelAr;
  final String narrativeAr;
  final List<String> concernIds;

  const ConcernZoneNarrative({
    required this.id,
    required this.zoneLabelAr,
    required this.narrativeAr,
    required this.concernIds,
  });
}
