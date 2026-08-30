/// AT-3 — Public-safe fashion request context matching AdvisorFashionContextDto.
/// Client context only — never authority / provenance / Claim Lock fields.
class AdvisorFashionGarmentFact {
  final String garmentId;
  final String? category;
  final String? type;
  final List<String> colors;
  final String? silhouette;
  final String? material;

  const AdvisorFashionGarmentFact({
    required this.garmentId,
    this.category,
    this.type,
    this.colors = const [],
    this.silhouette,
    this.material,
  });

  Map<String, dynamic> toJson() => {
        'garmentId': garmentId,
        if (category != null && category!.isNotEmpty) 'category': category,
        if (type != null && type!.isNotEmpty) 'type': type,
        if (colors.isNotEmpty) 'colors': colors,
        if (silhouette != null && silhouette!.isNotEmpty)
          'silhouette': silhouette,
        if (material != null && material!.isNotEmpty) 'material': material,
      };
}

class AdvisorFashionAccessoryFact {
  final String accessoryId;
  final String category;
  final String presence;
  final String? type;
  final List<String> colors;

  const AdvisorFashionAccessoryFact({
    required this.accessoryId,
    required this.category,
    required this.presence,
    this.type,
    this.colors = const [],
  });

  Map<String, dynamic> toJson() => {
        'accessoryId': accessoryId,
        'category': category,
        'presence': presence,
        if (type != null && type!.isNotEmpty) 'type': type,
        if (colors.isNotEmpty) 'colors': colors,
      };
}

class AdvisorFashionContext {
  final List<AdvisorFashionGarmentFact> garments;
  final List<AdvisorFashionAccessoryFact> accessories;
  final String? outfitId;
  final String? occasion;
  final String? dressCode;
  final String? styleGoal;
  final List<String> preferenceTokens;
  final String? culturalContext;
  final bool? culturalContextExplicit;
  final List<String> evidenceRefs;
  final bool? evidenceStale;

  const AdvisorFashionContext({
    this.garments = const [],
    this.accessories = const [],
    this.outfitId,
    this.occasion,
    this.dressCode,
    this.styleGoal,
    this.preferenceTokens = const [],
    this.culturalContext,
    this.culturalContextExplicit,
    this.evidenceRefs = const [],
    this.evidenceStale,
  });

  AdvisorFashionContext copyWith({
    List<AdvisorFashionGarmentFact>? garments,
    List<AdvisorFashionAccessoryFact>? accessories,
    String? outfitId,
    String? occasion,
    String? dressCode,
    String? styleGoal,
    List<String>? preferenceTokens,
    String? culturalContext,
    bool? culturalContextExplicit,
    List<String>? evidenceRefs,
    bool? evidenceStale,
  }) {
    return AdvisorFashionContext(
      garments: garments ?? this.garments,
      accessories: accessories ?? this.accessories,
      outfitId: outfitId ?? this.outfitId,
      occasion: occasion ?? this.occasion,
      dressCode: dressCode ?? this.dressCode,
      styleGoal: styleGoal ?? this.styleGoal,
      preferenceTokens: preferenceTokens ?? this.preferenceTokens,
      culturalContext: culturalContext ?? this.culturalContext,
      culturalContextExplicit:
          culturalContextExplicit ?? this.culturalContextExplicit,
      evidenceRefs: evidenceRefs ?? this.evidenceRefs,
      evidenceStale: evidenceStale ?? this.evidenceStale,
    );
  }

  /// Merge explicit conversational updates without inventing missing facts.
  AdvisorFashionContext mergeExplicit({
    String? occasion,
    String? dressCode,
    String? styleGoal,
    List<String>? preferenceTokens,
    String? culturalContext,
    bool? culturalContextExplicit,
  }) {
    final prefs = <String>{
      ...this.preferenceTokens,
      ...?preferenceTokens,
    };
    return copyWith(
      occasion: occasion ?? this.occasion,
      dressCode: dressCode ?? this.dressCode,
      styleGoal: styleGoal ?? this.styleGoal,
      preferenceTokens: prefs.toList(growable: false),
      culturalContext: culturalContext ?? this.culturalContext,
      culturalContextExplicit:
          culturalContextExplicit ?? this.culturalContextExplicit,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (garments.isNotEmpty)
        'garments': garments.map((g) => g.toJson()).toList(),
      if (accessories.isNotEmpty)
        'accessories': accessories.map((a) => a.toJson()).toList(),
      if (outfitId != null && outfitId!.isNotEmpty) 'outfitId': outfitId,
      if (occasion != null && occasion!.isNotEmpty) 'occasion': occasion,
      if (dressCode != null && dressCode!.isNotEmpty) 'dressCode': dressCode,
      if (styleGoal != null && styleGoal!.isNotEmpty) 'styleGoal': styleGoal,
      if (preferenceTokens.isNotEmpty) 'preferenceTokens': preferenceTokens,
      if (culturalContext != null && culturalContext!.isNotEmpty)
        'culturalContext': culturalContext,
      if (culturalContextExplicit != null)
        'culturalContextExplicit': culturalContextExplicit,
      if (evidenceRefs.isNotEmpty) 'evidenceRefs': evidenceRefs,
      if (evidenceStale != null) 'evidenceStale': evidenceStale,
    };
  }

  /// Authority / Claim Lock / provenance keys must never appear.
  static const forbiddenAuthorityKeys = [
    'sourceType',
    'provenance',
    'provenanceState',
    'approvalStatus',
    'claimLock',
    'claimLockDecision',
    'knowledgeRuleIds',
    'ACTIVE',
    'uncurated',
    'provider',
    'envelopeId',
    'traceId',
  ];
}
