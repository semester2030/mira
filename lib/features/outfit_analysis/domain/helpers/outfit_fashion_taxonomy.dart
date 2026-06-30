import 'package:flutter/material.dart';

import '../entities/outfit_segment_map.dart';
import '../services/outfit_segmentation_service.dart';

/// Fashion object classification for Vision-first segmentation.
abstract final class OutfitFashionTaxonomy {
  OutfitFashionTaxonomy._();

  static const minVisionScore = 0.82;
  static const minDisplayConfidence = 0.82;

  static const clothingKeywords = [
    'dress',
    'shirt',
    't-shirt',
    'blouse',
    'top',
    'blazer',
    'jacket',
    'coat',
    'cape',
    'corset',
    'suit',
    'pants',
    'trouser',
    'jean',
    'skirt',
    'sweater',
    'hoodie',
    'outerwear',
    'cardigan',
    'gown',
    'formal',
  ];

  static const footwearKeywords = ['shoe', 'heel', 'boot', 'sneaker', 'footwear'];

  static const bagKeywords = ['bag', 'handbag', 'purse', 'backpack', 'clutch'];

  static const accessoryKeywords = [
    'watch',
    'sunglass',
    'glasses',
    'belt',
    'scarf',
    'hat',
    'jewelry',
    'necklace',
    'earring',
    'bracelet',
  ];

  static const hiddenOverlayZones = {
    OutfitSegmentZone.head,
    OutfitSegmentZone.waist,
  };

  static bool isFashionObject(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('person') || lower.contains('human') || lower.contains('face')) {
      return false;
    }
    return isClothing(name) ||
        isFootwear(name) ||
        isBag(name) ||
        isAccessory(name);
  }

  static bool isClothing(String name) {
    final lower = name.toLowerCase();
    return clothingKeywords.any(lower.contains);
  }

  static bool isFootwear(String name) {
    final lower = name.toLowerCase();
    return footwearKeywords.any(lower.contains);
  }

  static bool isBag(String name) {
    final lower = name.toLowerCase();
    return bagKeywords.any(lower.contains) || lower.contains('حقيب');
  }

  static bool isAccessory(String name) {
    final lower = name.toLowerCase();
    return accessoryKeywords.any(lower.contains) ||
        lower.contains('إكسسوار') ||
        lower.contains('ساع') ||
        lower.contains('نظار') ||
        lower.contains('وشاح');
  }

  static OutfitSegmentZone zoneForObject(String name, Rect box) {
    if (isFootwear(name)) return OutfitSegmentZone.feet;
    if (isBag(name) || isAccessory(name)) return OutfitSegmentZone.accessories;
    if (isClothing(name)) {
      final centerY = box.center.dy;
      if (centerY >= 0.52) return OutfitSegmentZone.lowerBody;
      if (centerY >= 0.38 && centerY < 0.52) return OutfitSegmentZone.waist;
      return OutfitSegmentZone.upperBody;
    }
    final centerY = box.center.dy;
    if (centerY >= 0.78) return OutfitSegmentZone.feet;
    if (centerY >= 0.48) return OutfitSegmentZone.lowerBody;
    if (centerY >= 0.38) return OutfitSegmentZone.waist;
    return OutfitSegmentZone.upperBody;
  }

  static List<VisionLocalizedObject> filterFashionObjects(
    List<VisionLocalizedObject> objects,
  ) {
    final filtered = objects
        .where((o) => isFashionObject(o.name) && o.score >= minVisionScore)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
    return filtered;
  }

  static bool isGenericPlaceholderLabel(OutfitSegmentRegion region) {
    final ar = region.labelAr;
    final en = region.labelEn.toLowerCase();
    return ar == 'الجزء العلوي' ||
        ar == 'الجزء السفلي' ||
        ar == 'الحذاء' ||
        ar == 'حذاء' ||
        ar == 'غير مؤكد' ||
        ar == 'إكسسوار' ||
        en == 'upper body' ||
        en == 'lower body' ||
        en == 'shoes' ||
        en == 'accessory';
  }

  static bool shouldShowRegion(OutfitSegmentRegion region) {
    if (hiddenOverlayZones.contains(region.zone)) return false;
    if (isGenericPlaceholderLabel(region)) return false;
    if (region.confidence < minDisplayConfidence) return false;

    if (region.zone == OutfitSegmentZone.accessories) {
      final lower = region.labelEn.toLowerCase();
      return isBag(lower) ||
          isAccessory(lower) ||
          region.labelAr.contains('حقيب') ||
          region.labelAr.contains('عقد') ||
          region.labelAr.contains('قلادة') ||
          region.labelAr.contains('ساعة') ||
          region.labelAr.contains('نظارة');
    }
    if (region.zone == OutfitSegmentZone.feet) {
      return isFootwear(region.labelEn) || region.labelAr.contains('حذ');
    }
    return region.labelAr.isNotEmpty;
  }

  static IconData iconForPiece(String labelAr) {
    final lower = labelAr.toLowerCase();
    if (lower.contains('حذ') || lower.contains('heel') || lower.contains('shoe')) {
      return Icons.directions_walk_rounded;
    }
    if (lower.contains('حقيب') || lower.contains('bag')) {
      return Icons.shopping_bag_outlined;
    }
    if (lower.contains('بنط') || lower.contains('جين') || lower.contains('jean')) {
      return Icons.straighten_rounded;
    }
    if (lower.contains('فستان') || lower.contains('dress')) {
      return Icons.woman_rounded;
    }
    if (lower.contains('تنورة') || lower.contains('skirt')) {
      return Icons.line_style_rounded;
    }
    if (lower.contains('جاك') || lower.contains('بلوز') || lower.contains('ستر') ||
        lower.contains('blazer') || lower.contains('jacket')) {
      return Icons.checkroom_outlined;
    }
    if (lower.contains('تيش') || lower.contains('shirt') || lower.contains('قمي')) {
      return Icons.checkroom_outlined;
    }
    if (lower.contains('ساع')) return Icons.watch_outlined;
    if (lower.contains('نظار')) return Icons.visibility_outlined;
    if (lower.contains('وشاح')) return Icons.air_rounded;
    return Icons.checkroom_outlined;
  }

  static IconData iconForAccessory(String label) {
    final lower = label.toLowerCase();
    if (lower.contains('ساع')) return Icons.watch_outlined;
    if (lower.contains('نظار')) return Icons.visibility_outlined;
    if (lower.contains('حقيب')) return Icons.shopping_bag_outlined;
    if (lower.contains('وشاح')) return Icons.air_rounded;
    if (lower.contains('حزام')) return Icons.linear_scale_rounded;
    if (lower.contains('أقر') || lower.contains('قلادة')) {
      return Icons.diamond_outlined;
    }
    return Icons.auto_awesome_outlined;
  }

  static String verdictForScore(int score) {
    if (score >= 90) return 'نتيجة الإطلالة استثنائية';
    if (score >= 85) return 'نتيجة الإطلالة ممتاز';
    if (score >= 75) return 'نتيجة الإطلالة جيدة جداً';
    if (score >= 65) return 'نتيجة الإطلالة جيدة';
    if (score >= 50) return 'نتيجة الإطلالة مقبولة';
    return 'تحتاجين تحسينات';
  }

  static List<OutfitSegmentRegion> visibleRegions(List<OutfitSegmentRegion> regions) {
    return regions.where(shouldShowRegion).toList();
  }
}
