/// Law #40 truth classification for Personal Guidance surfaces.
class FaceGuidanceTruthEntry {
  final String component;
  final String truthClass;
  final String notes;

  const FaceGuidanceTruthEntry({
    required this.component,
    required this.truthClass,
    required this.notes,
  });
}

abstract final class FaceGuidanceTruthManifest {
  FaceGuidanceTruthManifest._();

  static const entries = <FaceGuidanceTruthEntry>[
    FaceGuidanceTruthEntry(
      component: 'guidance_title',
      truthClass: 'PUBLIC_PROJECTION',
      notes: 'Projection of frozen Face recommendation title',
    ),
    FaceGuidanceTruthEntry(
      component: 'guidance_body',
      truthClass: 'PUBLIC_PROJECTION',
      notes: 'Projection of frozen Face recommendation body',
    ),
    FaceGuidanceTruthEntry(
      component: 'guidance_reason',
      truthClass: 'PUBLIC_PROJECTION',
      notes: 'User-facing why linked to projected primary result',
    ),
    FaceGuidanceTruthEntry(
      component: 'personalization_badge',
      truthClass: 'PRESENTATION_METADATA',
      notes: 'Assembler classification — not a measured face metric',
    ),
    FaceGuidanceTruthEntry(
      component: 'educational_label',
      truthClass: 'EDUCATIONAL',
      notes: 'Must not masquerade as personalized advice',
    ),
    FaceGuidanceTruthEntry(
      component: 'retake_guidance',
      truthClass: 'QUALITY_GATE',
      notes: 'Supersedes ordinary personalization on weak capture',
    ),
    FaceGuidanceTruthEntry(
      component: 'empty_state',
      truthClass: 'HONEST_ABSENCE',
      notes: 'No filler advice invented',
    ),
    FaceGuidanceTruthEntry(
      component: 'guidance_open_motion',
      truthClass: 'PRESENTATION_ONLY',
      notes: 'Law #41 — opening guidance must not fake re-analysis',
    ),
    FaceGuidanceTruthEntry(
      component: 'region_association',
      truthClass: 'ILLUSTRATIVE',
      notes: 'Guidance does not invent region measurements',
    ),
  ];
}
