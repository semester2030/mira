import 'package:flutter/material.dart';

import '../../../../shared/icons/fashion/mira_fashion_icon.dart';
import '../../../../shared/icons/fashion/mira_fashion_icon_id.dart';

/// Central map: garment/accessory label → illustrated asset or registry icon.
/// Reuses existing Phosphor/SVG icons for actions; illustrations only for piece cards.
abstract final class OutfitPieceArt {
  OutfitPieceArt._();

  static const illustrationsRoot = 'assets/icons/fashion/illustrations';

  static const _byKey = <String, String>{
    'dress': '$illustrationsRoot/mira_piece_dress.png',
    'فستان': '$illustrationsRoot/mira_piece_dress.png',
    'gown': '$illustrationsRoot/mira_piece_dress.png',
    'blouse': '$illustrationsRoot/mira_piece_blouse.png',
    'بلوزة': '$illustrationsRoot/mira_piece_blouse.png',
    'top': '$illustrationsRoot/mira_piece_blouse.png',
    'قميص': '$illustrationsRoot/mira_piece_blouse.png',
    'skirt': '$illustrationsRoot/mira_piece_skirt.png',
    'تنورة': '$illustrationsRoot/mira_piece_skirt.png',
    'pants': '$illustrationsRoot/mira_piece_pants.png',
    'بنطال': '$illustrationsRoot/mira_piece_pants.png',
    'بنطلون': '$illustrationsRoot/mira_piece_pants.png',
    'جينز': '$illustrationsRoot/mira_piece_pants.png',
    'abaya': '$illustrationsRoot/mira_piece_abaya.png',
    'عباية': '$illustrationsRoot/mira_piece_abaya.png',
    'bag': '$illustrationsRoot/mira_piece_bag.png',
    'حقيبة': '$illustrationsRoot/mira_piece_bag.png',
    'handbag': '$illustrationsRoot/mira_piece_bag.png',
    'heel': '$illustrationsRoot/mira_piece_heel.png',
    'حذاء': '$illustrationsRoot/mira_piece_heel.png',
    'shoe': '$illustrationsRoot/mira_piece_heel.png',
    'jewelry': '$illustrationsRoot/mira_piece_jewelry.png',
    'مجوهرات': '$illustrationsRoot/mira_piece_jewelry.png',
    'عقد': '$illustrationsRoot/mira_piece_jewelry.png',
    'belt': '$illustrationsRoot/mira_piece_belt.png',
    'حزام': '$illustrationsRoot/mira_piece_belt.png',
    'scarf': '$illustrationsRoot/mira_piece_scarf.png',
    'وشاح': '$illustrationsRoot/mira_piece_scarf.png',
  };

  static const _iconByKey = <String, MiraFashionIconId>{
    'dress': MiraFashionIconId.dress,
    'فستان': MiraFashionIconId.dress,
    'blouse': MiraFashionIconId.blouse,
    'بلوزة': MiraFashionIconId.blouse,
    'skirt': MiraFashionIconId.skirt,
    'تنورة': MiraFashionIconId.skirt,
    'pants': MiraFashionIconId.pants,
    'بنطال': MiraFashionIconId.pants,
    'عباية': MiraFashionIconId.abaya,
    'حقيبة': MiraFashionIconId.handbag,
    'حذاء': MiraFashionIconId.shoeHeel,
    'مجوهرات': MiraFashionIconId.jewelry,
    'حزام': MiraFashionIconId.belt,
    'وشاح': MiraFashionIconId.scarf,
    'سهرة': MiraFashionIconId.evening,
    'رسمي': MiraFashionIconId.formal,
    'كاجوال': MiraFashionIconId.casual,
    'أنيق': MiraFashionIconId.elegant,
  };

  static String? assetForLabel(String label) {
    final t = label.trim().toLowerCase();
    if (t.isEmpty) return null;
    final direct = _byKey[label.trim()] ?? _byKey[t];
    if (direct != null) return direct;
    for (final entry in _byKey.entries) {
      if (t.contains(entry.key.toLowerCase()) || entry.key.toLowerCase().contains(t)) {
        return entry.value;
      }
    }
    return null;
  }

  static MiraFashionIconId? iconIdForLabel(String label) {
    final t = label.trim();
    final direct = _iconByKey[t] ?? _iconByKey[t.toLowerCase()];
    if (direct != null) return direct;
    for (final entry in _iconByKey.entries) {
      if (t.contains(entry.key) || entry.key.contains(t)) return entry.value;
    }
    return null;
  }

  /// Prefer illustrated PNG; fall back to registry icon.
  static Widget visual({
    required String label,
    double size = 40,
    Color? tint,
  }) {
    final asset = assetForLabel(label);
    if (asset != null) {
      return Image.asset(
        asset,
        width: size,
        height: size,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
        errorBuilder: (_, __, ___) => _fallbackIcon(label, size, tint),
      );
    }
    return _fallbackIcon(label, size, tint);
  }

  static Widget _fallbackIcon(String label, double size, Color? tint) {
    final id = iconIdForLabel(label) ?? MiraFashionIconId.outfitStyling;
    return SizedBox(
      width: size,
      height: size,
      child: MiraFashionIcon(
        id: id,
        sizeRole: size <= 20
            ? MiraFashionIconSizeRole.small
            : size >= 28
                ? MiraFashionIconSizeRole.large
                : MiraFashionIconSizeRole.normal,
        color: tint,
      ),
    );
  }
}
