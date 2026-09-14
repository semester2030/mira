/// Presentation truth / eligibility / confidence / action enums (9E).
enum FacePresentationTruthClass {
  measured,
  derived,
  illustrative,
  decorative,
  forbidden,
}

enum FacePresentationEligibility {
  display,
  displayWithQualification,
  detailOnly,
  hide,
  retakeRecommended,
  noUsableResult,
}

enum FaceConfidencePresentation {
  show,
  showAsQualifier,
  detailOnly,
  hide,
}

enum FaceNumericVisibility {
  showNumeric,
  showRelativeLabel,
  detailOnly,
  hide,
}

enum FaceNextActionKind {
  retake,
  exploreDetails,
  askMira,
  openGuidance,
}

enum FacePresentationRegion {
  faceGeneral,
  forehead,
  eyes,
  nose,
  cheeks,
  mouth,
  jaw,
  chin,
}

enum FaceResultCompleteness {
  complete,
  partial,
  empty,
}

/// Subject orientation for Result Mirror (D3 / D12).
enum FaceSubjectOrientation {
  /// Live-mirrored selfie still shown mirrored (rare post-capture).
  mirroredPreview,

  /// Canonical subject-left / subject-right (default after capture normalize).
  subjectCanonical,
}
