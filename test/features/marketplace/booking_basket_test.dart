import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/booking_basket.dart';

CatalogService _svc({
  required String id,
  String partnerId = 'p1',
  bool bookingEnabled = true,
}) {
  return CatalogService(
    id: id,
    partnerId: partnerId,
    partnerNameAr: 'مركز',
    partnerType: 'salon',
    city: 'الرياض',
    nameAr: 'خدمة $id',
    nameEn: id,
    durationMin: 45,
    priceHalalas: 10000,
    priceLabel: '100',
    matchScore: 0,
    bookingEnabled: bookingEnabled,
  );
}

void main() {
  setUp(() => BookingBasket.instance.clear());

  test('notifies on add and shows length for same-screen open link', () {
    var ticks = 0;
    void listener() => ticks++;
    BookingBasket.instance.addListener(listener);
    final r = BookingBasket.instance.tryAdd(_svc(id: 'a'));
    expect(r, BookingBasketAddResult.added);
    expect(BookingBasket.instance.length, 1);
    expect(ticks, 1);
    BookingBasket.instance.removeListener(listener);
  });

  test('rejects duplicate, other partner, paused', () {
    expect(BookingBasket.instance.tryAdd(_svc(id: 'a')), BookingBasketAddResult.added);
    expect(BookingBasket.instance.tryAdd(_svc(id: 'a')), BookingBasketAddResult.duplicate);
    expect(
      BookingBasket.instance.tryAdd(_svc(id: 'b', partnerId: 'other')),
      BookingBasketAddResult.differentPartner,
    );
    expect(
      BookingBasket.instance.tryAdd(_svc(id: 'c', bookingEnabled: false)),
      BookingBasketAddResult.paused,
    );
  });
}
