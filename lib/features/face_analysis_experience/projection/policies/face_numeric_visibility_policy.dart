import '../contracts/face_result_enums.dart';
import '../versioning/face_result_projection_versions.dart';

/// Governed numeric visibility for geometry metrics (D7).
abstract final class FaceNumericVisibilityPolicy {
  FaceNumericVisibilityPolicy._();

  static const version = FaceResultProjectionVersions.numericPolicy;

  static FaceNumericVisibility forMetric(String metricId) {
    switch (metricId) {
      case 'facialThirdsBalance':
      case 'eyeSpacingRatio':
      case 'faceWidthHeightRatio':
      case 'noseToFaceWidthRatio':
      case 'mouthToFaceWidthRatio':
        // Relative labels preferred on first surface; numeric detail-only.
        return FaceNumericVisibility.showRelativeLabel;
      case 'symmetryCautious':
        // Structural observation — never beauty %.
        return FaceNumericVisibility.detailOnly;
      case 'faceShape':
        return FaceNumericVisibility.hide;
      default:
        return FaceNumericVisibility.hide;
    }
  }

  /// Public relative label from normalized 0–100 band — no inventing meaning.
  static String? relativeLabelAr(String metricId, double? normalized) {
    if (normalized == null) return null;
    final n = normalized.clamp(0, 100);
    switch (metricId) {
      case 'facialThirdsBalance':
        if (n >= 70) return 'توازن قريب بين أثلاث الوجه';
        if (n >= 45) return 'توازن متوسط بين أثلاث الوجه';
        return 'اختلاف ملحوظ بين أثلاث الوجه';
      case 'eyeSpacingRatio':
        if (n >= 70) return 'تباعد عينين ضمن نطاق شائع';
        if (n >= 45) return 'تباعد عينين قريب من المعتاد';
        return 'تباعد عينين خارج النطاق الشائع قليلاً';
      case 'faceWidthHeightRatio':
        if (n >= 70) return 'نسبة عرض إلى ارتفاع متوازنة نسبياً';
        if (n >= 45) return 'نسبة عرض إلى ارتفاع معتدلة';
        return 'نسبة عرض إلى ارتفاع أقل توازناً';
      case 'noseToFaceWidthRatio':
      case 'mouthToFaceWidthRatio':
        if (n >= 70) return 'نسبة ضمن نطاق شائع';
        if (n >= 45) return 'نسبة قريبة من المعتاد';
        return 'نسبة خارج النطاق الشائع قليلاً';
      default:
        return null;
    }
  }
}

abstract final class FaceConfidencePresentationPolicy {
  FaceConfidencePresentationPolicy._();

  static FaceConfidencePresentation forPrimary(int confidence0to100) {
    if (confidence0to100 >= 75) return FaceConfidencePresentation.showAsQualifier;
    if (confidence0to100 >= 45) return FaceConfidencePresentation.showAsQualifier;
    return FaceConfidencePresentation.detailOnly;
  }

  static String? qualifierAr(int confidence0to100) {
    if (confidence0to100 >= 75) return 'بثقة جيدة';
    if (confidence0to100 >= 45) return 'بثقة معتدلة';
    if (confidence0to100 > 0) return 'بثقة محدودة';
    return null;
  }

  static FacePresentationEligibility eligibilityForShape({
    required bool available,
    required int confidence,
    required bool measurementEligible,
  }) {
    if (!measurementEligible) {
      return FacePresentationEligibility.retakeRecommended;
    }
    if (!available || confidence < 30) {
      return FacePresentationEligibility.hide;
    }
    if (confidence < 55) {
      return FacePresentationEligibility.displayWithQualification;
    }
    return FacePresentationEligibility.display;
  }
}
