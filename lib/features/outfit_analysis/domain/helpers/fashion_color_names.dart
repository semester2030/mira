/// Turns ontology color ids into Arabic labels.
///
/// Unknown ids stay visible. They are never replaced with a default color.
abstract final class FashionColorNames {
  static const _tokens = <String, String>{
    'blue': 'أزرق',
    'sky': 'سماوي',
    'navy': 'كحلي',
    'black': 'أسود',
    'white': 'أبيض',
    'soft': 'ناعم',
    'light': 'فاتح',
    'deep': 'غامق',
    'dark': 'داكن',
    'pale': 'باهت',
    'red': 'أحمر',
    'pink': 'وردي',
    'gold': 'ذهبي',
    'beige': 'بيج',
    'green': 'أخضر',
    'cream': 'كريمي',
    'ivory': 'عاجي',
    'gray': 'رمادي',
    'grey': 'رمادي',
    'brown': 'بني',
    'purple': 'بنفسجي',
    'lilac': 'ليلكي',
    'yellow': 'أصفر',
    'orange': 'برتقالي',
    'teal': 'تركواز',
    'burgundy': 'عنابي',
    'wine': 'خمري',
    'silver': 'فضي',
    'nude': 'نود',
    'emerald': 'زمردي',
    'ruby': 'ياقوتي',
  };

  static Map<String, String> _catalog = const {};

  static var catalogLoaded = false;

  static void useCatalog(Map<String, String> names) {
    _catalog = Map.unmodifiable(names);
    catalogLoaded = true;
  }

  static String arabic(String colorId) {
    final id = colorId.trim();
    if (id.isEmpty) return '';
    final known = _catalog[id];
    if (known != null && known.trim().isNotEmpty) return known.trim();
    final parts = id
        .split('_')
        .map((part) => _tokens[part] ?? '')
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isNotEmpty) return parts.join(' ');
    return id.replaceAll('_', ' ');
  }
}
