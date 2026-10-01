import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/constants/marketplace_copy.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/marketplace/data/commerce_api_client.dart';
import 'package:mirra/features/marketplace/domain/commerce_models.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/screens/booking_request_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

class _FakeBookings implements CommerceClient {
  _FakeBookings({this.slots = const [], this.signedIn = true});

  @override
  final bool signedIn;
  final List<CommerceSlot> slots;
  final created = <String>[];
  final keys = <String>[];

  @override
  Future<CommerceAvailability> availability(String serviceId, String date) async => CommerceAvailability(
        serviceId: serviceId,
        date: date,
        durationMin: 45,
        priceHalalas: 25000,
        payMode: 'pay_at_venue',
        slots: slots,
      );

  @override
  Future<CommerceBookingResult> createBooking({
    required String idempotencyKey,
    required String serviceId,
    required DateTime startsAt,
    required String contactName,
    required String contactPhone,
    String? notes,
  }) async {
    created.add('$serviceId|${startsAt.toUtc().toIso8601String()}|$contactPhone');
    keys.add(idempotencyKey);
    return CommerceBookingResult(
      idempotentReplay: false,
      booking: CommerceBooking(
        id: 'b-1',
        publicNumber: 'B-1',
        partnerNameAr: 'عيادة',
        serviceId: serviceId,
        serviceNameAr: 'استشارة',
        branchLabel: 'الرياض',
        startsAt: startsAt,
        endsAt: startsAt.add(const Duration(minutes: 45)),
        durationMin: 45,
        priceHalalas: 25000,
        payMode: 'pay_at_venue',
        status: 'requested',
        contactName: contactName,
        contactPhone: contactPhone,
      ),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

CatalogService _service({bool booking = true, bool availability = true}) => CatalogService(
      id: 'svc-1',
      partnerId: 'p-1',
      partnerNameAr: 'عيادة اختبار',
      partnerType: 'clinic',
      city: 'الرياض',
      nameAr: 'استشارة',
      nameEn: 'Consult',
      durationMin: 45,
      priceHalalas: 25000,
      priceLabel: '250 ر.س',
      matchScore: 0,
      bookingEnabled: booking,
      availabilityPresent: availability,
    );

Future<List<String>> _pump(WidgetTester tester, CommerceClient client, CatalogService service) async {
  tester.view.physicalSize = const Size(900, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final opened = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightTheme,
      onGenerateRoute: (settings) {
        opened.add(settings.name ?? '');
        return MaterialPageRoute<void>(settings: settings, builder: (_) => const Text('bookings-list'));
      },
      home: BookingRequestScreen(
        service: service,
        client: client,
        now: () => DateTime.utc(2026, 10, 1, 9),
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
  return opened;
}

void main() {
  testWidgets('a slot is chosen, the request is sent once with an idempotency key and stays a request', (tester) async {
    final client = _FakeBookings(
      slots: [
        CommerceSlot(startsAt: DateTime.utc(2026, 10, 1, 10), endsAt: DateTime.utc(2026, 10, 1, 10, 45), remaining: 1, available: true),
        CommerceSlot(startsAt: DateTime.utc(2026, 10, 1, 11), endsAt: DateTime.utc(2026, 10, 1, 11, 45), remaining: 0, available: false),
      ],
    );
    final opened = await _pump(tester, client, _service());

    expect(find.text(MarketplaceCopy.bookingPayAtVenue), findsOneWidget);
    expect(find.textContaining('تم الحجز'), findsNothing);
    expect(find.text('13:00'), findsOneWidget, reason: 'slots are shown in Riyadh time');

    final send = find.widgetWithText(FilledButton, 'إرسال طلب الموعد');
    expect(tester.widget<FilledButton>(send).onPressed, isNull, reason: 'no slot, no request');

    await tester.tap(find.text('13:00'));
    await tester.pump();
    await tester.enterText(find.widgetWithText(TextFormField, 'الاسم'), 'سارة');
    await tester.enterText(find.widgetWithText(TextFormField, 'رقم الجوال'), '0501234567');
    await tester.tap(send);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(client.created, ['svc-1|2026-10-01T10:00:00.000Z|+966501234567']);
    expect(client.keys.single, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(find.text(MarketplaceCopy.bookingRequested), findsOneWidget);
    expect(opened, contains(AppRoutes.myBookings));
  });

  testWidgets('no published availability says so instead of showing fake slots', (tester) async {
    await _pump(tester, _FakeBookings(), _service(availability: false));
    expect(find.text(MarketplaceCopy.availabilityMissing), findsOneWidget);
  });

  testWidgets('a service without bookings enabled shows the unavailable copy', (tester) async {
    final client = _FakeBookings();
    await _pump(tester, client, _service(booking: false));
    expect(find.text(MarketplaceCopy.appointmentUnavailable), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'إرسال طلب الموعد'), findsNothing);
  });

  testWidgets('a signed-out customer is asked to log in', (tester) async {
    await _pump(tester, _FakeBookings(signedIn: false), _service());
    expect(find.text(MarketplaceCopy.loginRequiredBookings), findsOneWidget);
  });

  test('requested is never labelled confirmed', () {
    expect(CommerceLabels.booking('requested'), isNot(contains('مؤكد ')));
    expect(CommerceLabels.booking('requested'), isNot(CommerceLabels.booking('confirmed')));
  });
}
