import 'catalog_detail_family.dart';

/// Customer-facing attribute rows. Never prints camelCase keys or wire enums.
abstract final class CatalogAttributeDisplay {
  static const _hiddenKeys = {
    'fulfillmentReady',
    'discoveryTraits',
    'occasionTypeIds',
    'linkedServiceIds',
    'videoScope',
    'certificateMediaId',
    'certificateUrl',
    'certificate',
  };

  static String categoryLabelAr(String? category, {String? subcategory}) {
    final sub = (subcategory ?? '').trim().toLowerCase();
    if (sub.startsWith('jewelry.rings') || sub == 'jewelry.ring') return 'خواتم';
    if (sub.startsWith('jewelry.sets') || sub == 'jewelry.set') return 'أطقم ذهب';
    if (sub.startsWith('jewelry.neck')) return 'قلائد';
    if (sub.startsWith('jewelry.brace')) return 'أساور';
    if (sub.startsWith('jewelry.ear')) return 'أقراط';
    if (sub.startsWith('clothes.wedding')) return 'فساتين زفاف';
    if (sub.startsWith('clothes.evening') || sub.contains('evening')) return 'فساتين سهرة';
    if (sub.startsWith('clothes.abaya')) return 'عبايات';
    if (sub.startsWith('clothes.casual')) return 'فساتين يومية';
    if (sub.startsWith('clothes.')) return 'أزياء';
    switch ((category ?? '').trim().toLowerCase()) {
      case 'jewelry':
      case 'jewellery':
        return 'مجوهرات';
      case 'clothes':
        return 'أزياء';
      case 'face':
        return 'عناية بالوجه';
      case 'hair':
        return 'شعر';
      case 'bags':
        return 'حقائب';
      case 'shoes':
        return 'أحذية';
      case 'children':
        return 'أطفال';
      default:
        return '';
    }
  }

  /// Service / provider filter chips — never show raw wire ids to the customer.
  static String serviceCategoryLabelAr(String? category) {
    final raw = (category ?? '').trim();
    if (raw.isEmpty) return '';
    final key = raw.toLowerCase();
    switch (key) {
      case 'skin':
      case 'face':
      case 'beauty.face_care':
      case 'beauty.skin_centers':
      case 'beauty.clinic.derm':
        return 'البشرة';
      case 'hair':
      case 'beauty.hair':
      case 'beauty.salons':
        return 'الشعر';
      case 'makeup':
      case 'beauty.makeup':
        return 'المكياج';
      case 'nails':
      case 'beauty.nails':
        return 'الأظافر';
      case 'care':
      case 'beauty.spa':
      case 'spa':
        return 'العناية';
      case 'laser':
        return 'الليزر';
      case 'teeth':
        return 'الأسنان';
      case 'beauty.experts':
        return 'الخبيرات';
      case 'beauty.home_visit':
        return 'زيارة منزلية';
      case 'beauty.bridal_prep':
        return 'تجهيز العروس';
      default:
        final productish = categoryLabelAr(raw);
        if (productish.isNotEmpty) return productish;
        // Dotted taxonomy leftover — last segment only if already Arabic-looking.
        if (raw.contains('.')) {
          final tail = raw.split('.').last;
          if (RegExp(r'^[\u0600-\u06FF]').hasMatch(tail)) return tail;
        }
        if (RegExp(r'^[\u0600-\u06FF]').hasMatch(raw)) return raw;
        return '';
    }
  }

  /// Ordered customer rows from traits / attributes. Skips internal keys.
  static List<({String labelAr, String valueAr})> rows(Map<String, String> traits) {
    final preferred = <String>[
      'metal',
      'metalColor',
      'purityKarat',
      'purity',
      'goldWeight',
      'goldWeightG',
      'stone',
      'stoneType',
      'stoneWeight',
      'stoneWeightCt',
      'stoneShape',
      'sellUnit',
      'pieceStyle',
      'ringSize',
      'chainLength',
      'fabric',
      'material',
      'cut',
      'details',
      'color',
      'size',
    ];
    final used = <String>{};
    final out = <({String labelAr, String valueAr})>[];

    void addKey(String key) {
      if (used.contains(key) || _hiddenKeys.contains(key)) return;
      final raw = traits[key]?.trim() ?? '';
      if (raw.isEmpty) return;
      final value = formatValue(key, raw);
      if (value == null || value.isEmpty) return;
      final label = CatalogDetailFamilyResolver.attributeLabelAr(key);
      if (label.isEmpty) return;
      used.add(key);
      out.add((labelAr: label, valueAr: value));
    }

    for (final key in preferred) {
      addKey(key);
    }
    for (final key in traits.keys) {
      // Skip unknown camelCase / snake keys that look programmatic.
      if (_looksProgrammatic(key) && !preferred.contains(key)) continue;
      addKey(key);
    }
    return out;
  }

  static bool _looksProgrammatic(String key) {
    if (_hiddenKeys.contains(key)) return true;
    if (key.contains('_')) return true;
    if (RegExp(r'[A-Z]').hasMatch(key) && RegExp(r'[a-z]').hasMatch(key)) return true;
    return false;
  }

  static String? formatValue(String key, String raw) {
    final v = raw.trim();
    if (v.isEmpty) return null;
    switch (key) {
      case 'metal':
        return _metalAr(v);
      case 'metalColor':
        // Color only — never invent «ذهب أبيض» from white metal.
        return _colorAr(v);
      case 'sellUnit':
        return _sellUnitAr(v);
      case 'pieceStyle':
        return _pieceStyleAr(v);
      case 'purity':
      case 'purityKarat':
        final digits = RegExp(r'\d+').firstMatch(v)?.group(0);
        if (digits != null) return '${_easternDigits(digits)} قيراط';
        return v;
      case 'goldWeight':
      case 'goldWeightG':
        return v.contains('غ') || v.toLowerCase().contains('g') ? v : '$v غ';
      case 'stoneWeight':
      case 'stoneWeightCt':
        return v.contains('قيراط') ? v : '$v قيراط';
      case 'fulfillmentReady':
        return null;
      default:
        if (_looksWireEnum(v)) return _wireEnumAr(v) ?? v;
        return v;
    }
  }

  static bool _looksWireEnum(String v) {
    return RegExp(r'^[a-z][a-z0-9_]*$', caseSensitive: false).hasMatch(v) && !v.contains(' ');
  }

  static String? _wireEnumAr(String v) {
    switch (v.toLowerCase()) {
      case 'gold':
        return 'ذهب';
      case 'silver':
        return 'فضة';
      case 'white':
        return 'أبيض';
      case 'yellow':
        return 'أصفر';
      case 'rose':
      case 'pink':
        return 'وردي';
      case 'set':
        return 'طقم';
      case 'piece':
        return 'قطعة';
      case 'ready':
        return null;
      default:
        return null;
    }
  }

  static String _metalAr(String v) {
    switch (v.toLowerCase()) {
      case 'gold':
        return 'ذهب';
      case 'silver':
        return 'فضة';
      case 'platinum':
        return 'بلاتين';
      default:
        return v;
    }
  }

  static String _colorAr(String v) {
    switch (v.toLowerCase()) {
      case 'white':
        return 'أبيض';
      case 'yellow':
        return 'أصفر';
      case 'rose':
      case 'pink':
        return 'وردي';
      case 'black':
        return 'أسود';
      default:
        return v;
    }
  }

  static String _sellUnitAr(String v) {
    switch (v.toLowerCase()) {
      case 'set':
        return 'طقم';
      case 'piece':
        return 'قطعة';
      case 'pair':
        return 'زوج';
      default:
        return v;
    }
  }

  static String _pieceStyleAr(String v) {
    switch (v.toLowerCase()) {
      case 'set':
        return 'طقم';
      case 'ring':
        return 'خاتم';
      case 'necklace':
        return 'قلادة';
      case 'bracelet':
        return 'سوار';
      case 'earrings':
        return 'أقراط';
      default:
        return v;
    }
  }

  static String _easternDigits(String western) {
    const map = {'0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤', '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'};
    return western.split('').map((c) => map[c] ?? c).join();
  }

  /// Approximate swatch for Arabic / English color labels when hex missing.
  static int? colorArgbFromLabel(String label) {
    final t = label.trim().toLowerCase();
    const table = <String, int>{
      'أسود': 0xFF1A1A1A,
      'black': 0xFF1A1A1A,
      'أبيض': 0xFFF5F5F5,
      'white': 0xFFF5F5F5,
      'سكري': 0xFFF3E9D8,
      'ivory': 0xFFF3E9D8,
      'بني': 0xFF6B3F2A,
      'brown': 0xFF6B3F2A,
      'وردي': 0xFFE8A0B5,
      'pink': 0xFFE8A0B5,
      'أخضر': 0xFF2F6B4F,
      'green': 0xFF2F6B4F,
      'أحمر': 0xFFB00020,
      'red': 0xFFB00020,
      'عنابي': 0xFF6B2040,
      'burgundy': 0xFF6B2040,
      'أزرق': 0xFF2F5AA8,
      'blue': 0xFF2F5AA8,
      'بنفسجي': 0xFF6B3FA0,
      'purple': 0xFF6B3FA0,
      'بيج': 0xFFD8C3A5,
      'beige': 0xFFD8C3A5,
      'شامبانيا': 0xFFE8D5B0,
      'champagne': 0xFFE8D5B0,
      'خوخي': 0xFFE8B4A0,
      'peach': 0xFFE8B4A0,
      'نود': 0xFFD4B5A0,
      'nude': 0xFFD4B5A0,
    };
    return table[t] ?? table[label.trim()];
  }
}
