import 'package:flutter/foundation.dart';

import '../domain/entities/catalog_service.dart';

enum BookingBasketAddResult {
  added,
  duplicate,
  paused,
  differentPartner,
  full,
  preview,
}

/// In-memory «حجزك» — notifies listeners so detail screen updates without reopen.
class BookingBasket extends ChangeNotifier {
  BookingBasket._();
  static final BookingBasket instance = BookingBasket._();

  static const maxItems = 5;
  final List<CatalogService> _items = [];

  List<CatalogService> get items => List.unmodifiable(_items);
  int get length => _items.length;
  bool get isEmpty => _items.isEmpty;

  bool containsId(String id) => _items.any((s) => s.id == id);

  BookingBasketAddResult tryAdd(CatalogService service) {
    if (service.id.startsWith('preview-')) return BookingBasketAddResult.preview;
    if (!service.bookingEnabled) return BookingBasketAddResult.paused;
    if (containsId(service.id)) return BookingBasketAddResult.duplicate;
    if (_items.length >= maxItems) return BookingBasketAddResult.full;
    if (_items.isNotEmpty && _items.first.partnerId != service.partnerId) {
      return BookingBasketAddResult.differentPartner;
    }
    _items.add(service);
    notifyListeners();
    return BookingBasketAddResult.added;
  }

  /// Legacy bool API.
  bool add(CatalogService service) => tryAdd(service) == BookingBasketAddResult.added;

  void remove(String id) {
    final before = _items.length;
    _items.removeWhere((s) => s.id == id);
    if (_items.length != before) notifyListeners();
  }

  void clear() {
    if (_items.isEmpty) return;
    _items.clear();
    notifyListeners();
  }

  /// Drop paused rows when customer returns (stale basket).
  void pruneDisabled() {
    final next = _items.where((s) => s.bookingEnabled).toList();
    if (next.length == _items.length) return;
    _items
      ..clear()
      ..addAll(next);
    notifyListeners();
  }

  static String messageFor(BookingBasketAddResult r, CatalogService s) {
    switch (r) {
      case BookingBasketAddResult.added:
        return 'أُضيفت إلى حجزك (${BookingBasket.instance.length})';
      case BookingBasketAddResult.duplicate:
        return '«${s.nameAr}» موجودة مسبقًا في حجزك';
      case BookingBasketAddResult.paused:
        return '«${s.nameAr}» متوقفة عن الحجز حاليًا';
      case BookingBasketAddResult.differentPartner:
        return 'حجزك يقتصر على خدمات نفس المركز. أكملي الحجز الحالي أولًا';
      case BookingBasketAddResult.full:
        return 'حجزك ممتلئ (حد أقصى $maxItems)';
      case BookingBasketAddResult.preview:
        return 'لا يمكن إضافة معاينة إلى الحجز';
    }
  }
}
