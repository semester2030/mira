/// Shared public-safe enums for Results Experience contracts.
library;

enum VisibilityState {
  visiblePrimary,
  visibleSecondary,
  visibleDetails,
  hiddenLowConfidence,
  hiddenMissingEvidence,
  hiddenDuplicate,
  hiddenInternal,
  hiddenIneligible,
  unavailable,
}

enum ConfidenceState {
  high,
  medium,
  low,
  unavailable,
}

enum PersonalizationClass {
  evidenceDerived,
  profileDerived,
  contextDerived,
  generalEducation,
  unsupported,
}

enum ScoreCategory {
  wellnessScore,
  concernSeverity,
  confidenceScore,
  progressDelta,
  projection,
  productMatch,
  estimatedSkinAge,
  nonPublicTechnicalScore,
}

enum ScoreDirection {
  higherBetter,
  higherWorse,
  neutral,
}

enum ColorRole {
  wellness,
  severity,
  confidence,
  projection,
  match,
  neutral,
  hidden,
}

enum MapPresentationMode {
  measuredHeatmap,
  illustrativeUserImage,
  genericEducational,
}

enum ProgressComparabilityState {
  comparable,
  partiallyComparable,
  notComparable,
  insufficientHistory,
}

enum ProductRecommendationState {
  recommended,
  possibleAlternative,
  hidden,
  insufficientEvidence,
}

enum ProductDisclosure {
  independent,
  partner,
  sponsored,
  unknown,
}

enum AdviceOwner {
  immediateAction,
  routine,
  educationalAdvice,
  productExplanation,
  advisorContext,
}

enum InteractionState {
  none,
  expandable,
  tappable,
  navigable,
  disabled,
}

enum LimitationState {
  none,
  advisory,
  lowConfidence,
  missingEvidence,
  illustrativeOnly,
  estimateOnly,
  retakeSuggested,
}

/// Morning / evening / weekly period for personal plan steps.
enum RoutinePeriod {
  morning,
  evening,
  weekly,
}
