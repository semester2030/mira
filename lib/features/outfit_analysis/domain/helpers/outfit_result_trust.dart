import '../entities/outfit_analysis.dart';
import '../entities/outfit_photo_trust.dart';

export '../entities/outfit_photo_trust.dart';

/// Post-analysis trust — never show confident scores without verified outfit photo.
abstract final class OutfitResultTrustPolicy {
  OutfitResultTrustPolicy._();

  static const blockedTitle = 'لم نتحقق من إطلالتك';
  static const blockedDefaultMessage =
      'التقطي صورة كاملة لجسمك وملابسك — لا سكرينشوت ولا صور تطبيقات أخرى';
  static const degradedTitle = 'تحليل بثقة منخفضة';

  static OutfitResultTrust evaluate(OutfitAnalysis analysis) {
    if (analysis.analysisGate == 'blocked') {
      return OutfitResultTrust(
        level: OutfitResultTrustLevel.blocked,
        titleAr: blockedTitle,
        messageAr: analysis.photoTrustMessageAr ?? blockedDefaultMessage,
        detailAr: 'تعذّر التحقق من القطع والألوان في هذه الصورة',
      );
    }

    final map = analysis.segmentMap;
    if (map == null || !map.hasTrustedOverlay) {
      return OutfitResultTrust(
        level: OutfitResultTrustLevel.blocked,
        titleAr: blockedTitle,
        messageAr: map?.validationMessage ?? blockedDefaultMessage,
        detailAr:
            'ميرا لا تعرض درجة إلا بعد التحقق البصري من ملابسك — خصوصيتك ومصداقيتك أولاً',
      );
    }

    final lowVision = analysis.visualConfidence < 52 || analysis.confidence < 52;
    final degradedGate = analysis.analysisGate == 'degraded';

    if (degradedGate || lowVision) {
      return OutfitResultTrust(
        level: OutfitResultTrustLevel.degraded,
        titleAr: degradedTitle,
        messageAr: 'النتائج تقريبية — أعيدي التقاط صورة أوضح لدقة أعلى',
        detailAr: analysis.photoTrustMessageAr,
      );
    }

    if (!map.garmentPalette.isReliable && map.upperBodyColors.isEmpty) {
      return OutfitResultTrust(
        level: OutfitResultTrustLevel.degraded,
        titleAr: degradedTitle,
        messageAr: 'تعذّر استخراج ألوان الملابس بدقة — جرّبي إضاءة أفضل',
      );
    }

    return const OutfitResultTrust(
      level: OutfitResultTrustLevel.trusted,
      titleAr: 'تحليل موثوق',
      messageAr: 'تحققنا من إطلالتك بصرياً',
    );
  }
}
