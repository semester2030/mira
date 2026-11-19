import '../domain/entities/catalog_service.dart';

/// In-memory «حجزك» for multi-service appointment planning (journey-1: up to 2+).
class BookingBasket {
  BookingBasket._();
  static final BookingBasket instance = BookingBasket._();

  static const maxItems = 5;
  final List<CatalogService> _items = [];

  List<CatalogService> get items => List.unmodifiable(_items);
  int get length => _items.length;
  bool get isEmpty => _items.isEmpty;

  bool containsId(String id) => _items.any((s) => s.id == id);

  /// Returns false when duplicate or full.
  bool add(CatalogService service) {
    if (service.id.startsWith('preview-')) return false;
    if (!service.bookingEnabled) return false;
    if (containsId(service.id)) return false;
    if (_items.length >= maxItems) return false;
    // Same partner only — mixed providers need separate bookings.
    if (_items.isNotEmpty && _items.first.partnerId != service.partnerId) return false;
    _items.add(service);
    return true;
  }

  void remove(String id) => _items.removeWhere((s) => s.id == id);

  void clear() => _items.clear();
}
