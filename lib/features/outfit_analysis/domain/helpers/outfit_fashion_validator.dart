import '../entities/garment_color_palette.dart';
import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_segment_map.dart';
import '../helpers/outfit_fashion_taxonomy.dart';
import '../helpers/outfit_person_mask.dart';

/// Rejects decorative / inconsistent fashion intelligence before display.
class OutfitFashionValidation {
  final bool isTrusted;
  final String? rejectionReason;
  final double colorConfidence;
  final double pieceMapConfidence;

  const OutfitFashionValidation({
    required this.isTrusted,
    this.rejectionReason,
    this.colorConfidence = 0,
    this.pieceMapConfidence = 0,
  });

  static const rejected = OutfitFashionValidation(
    isTrusted: false,
    rejectionReason: 'تعذّر التحقق من القطع والألوان في الصورة',
  );
}

abstract final class OutfitFashionValidator {
  OutfitFashionValidator._();

  static const minPieceConfidence = 0.82;
  static const minColorConfidence = 0.52;
  static const minRegions = 1;

  static OutfitFashionValidation validate({
    required OutfitSegmentMap segmentMap,
    required GarmentColorPalette palette,
    required OutfitBodyPoseMetrics pose,
  }) {
    if (!OutfitPersonMask.isReady(pose)) {
      return const OutfitFashionValidation(
        isTrusted: false,
        rejectionReason: 'لم يتم عزل الجسم — التقطي صورة كاملة للجسم',
      );
    }

    final regions = OutfitFashionTaxonomy.visibleRegions(segmentMap.regions);
    if (regions.length < minRegions) {
      return const OutfitFashionValidation(
        isTrusted: false,
        rejectionReason: 'لم نتمكن من تحديد قطع ملابس حقيقية بثقة كافية',
      );
    }

    if (segmentMap.source != 'vision_garment' && segmentMap.source != 'vision_pixel_contour') {
      return const OutfitFashionValidation(
        isTrusted: false,
        rejectionReason: 'خريطة القطع غير مبنية على كشف بصري حقيقي',
      );
    }

    final lowConf = regions.where((r) => r.confidence < minPieceConfidence).toList();
    if (lowConf.isNotEmpty) {
      return OutfitFashionValidation(
        isTrusted: false,
        rejectionReason: 'ثقة كشف القطع منخفضة — أعيدي التقاط صورة أوضح',
        pieceMapConfidence: regions.map((r) => r.confidence).reduce((a, b) => a + b) / regions.length,
      );
    }

    if (!palette.isReliable || palette.confidence < minColorConfidence) {
      return OutfitFashionValidation(
        isTrusted: false,
        rejectionReason: 'تعذّر استخراج ألوان الملابس من القطع — وليس من الخلفية',
        colorConfidence: palette.confidence,
        pieceMapConfidence: regions.map((r) => r.confidence).reduce((a, b) => a + b) / regions.length,
      );
    }

    final hasGeneric = regions.any(OutfitFashionTaxonomy.isGenericPlaceholderLabel);
    if (hasGeneric) {
      return const OutfitFashionValidation(
        isTrusted: false,
        rejectionReason: 'خريطة القطع تحتوي تسميات عامة — تم رفض العرض',
      );
    }

    final avgPiece = regions.map((r) => r.confidence).reduce((a, b) => a + b) / regions.length;
    return OutfitFashionValidation(
      isTrusted: true,
      colorConfidence: palette.confidence,
      pieceMapConfidence: avgPiece,
    );
  }

  static OutfitSegmentMap applyValidation(
    OutfitSegmentMap map,
    OutfitFashionValidation validation,
  ) {
    if (validation.isTrusted) {
      return map.copyWith(isVisualTrusted: true, validationMessage: null);
    }
    return map.copyWith(
      regions: const [],
      isVisualTrusted: false,
      validationMessage: validation.rejectionReason,
    );
  }
}
