import 'package:flutter/foundation.dart';

/// In-memory «مناسبتي» basket — one row per provider/service with independent status/price.
class OccasionPlanItem {
  const OccasionPlanItem({
    required this.serviceId,
    required this.partnerId,
    required this.partnerNameAr,
    required this.summaryAr,
    required this.priceHalalas,
    required this.priceKnown,
    required this.statusLabelAr,
    this.imageUrl,
  });

  final String serviceId;
  final String partnerId;
  final String partnerNameAr;
  final String summaryAr;
  final int priceHalalas;
  final bool priceKnown;
  final String statusLabelAr;
  final String? imageUrl;
}

class OccasionPlan extends ChangeNotifier {
  OccasionPlan._();
  static final OccasionPlan instance = OccasionPlan._();

  final List<OccasionPlanItem> _items = [];

  List<OccasionPlanItem> get items => List.unmodifiable(_items);

  void upsert(OccasionPlanItem item) {
    final i = _items.indexWhere((e) => e.serviceId == item.serviceId);
    if (i >= 0) {
      _items[i] = item;
    } else {
      _items.add(item);
    }
    notifyListeners();
  }

  void remove(String serviceId) {
    _items.removeWhere((e) => e.serviceId == serviceId);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
