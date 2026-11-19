import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/commerce_api_client.dart';
import 'package:mirra/features/marketplace/data/pending_visit_attempt_store.dart';
import 'package:mirra/features/marketplace/domain/commerce_models.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/booking_basket.dart';
import 'package:mirra/features/marketplace/presentation/screens/booking_basket_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/booking_request_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/booking_visit_consecutive_screen.dart';
import 'package:mirra/features/marketplace/presentation/widgets/commerce_common.dart';
import 'package:mirra/shared/theme/theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

CatalogService _svc({
  required String id,
  required String nameAr,
  String partnerId = 'p1',
  String? branchId = 'br-1',
  String? branchNameAr = 'فرع العليا',
  int durationMin = 45,
  bool bookingEnabled = true,
}) {
  return CatalogService(
    id: id,
    partnerId: partnerId,
    partnerNameAr: 'مركز عناية BC',
    partnerType: 'salon',
    city: 'الرياض',
    nameAr: nameAr,
    nameEn: id,
    durationMin: durationMin,
    priceHalalas: 15000,
    priceLabel: '150',
    matchScore: 0,
    bookingEnabled: bookingEnabled,
    branchId: branchId,
    branchNameAr: branchNameAr,
  );
}

class _FakeVisitClient implements CommerceClient {
  _FakeVisitClient({this.holdSuccess = false});

  @override
  final bool signedIn = true;
  @override
  String? get accountKey => 'test-user';

  bool holdSuccess;
  int visitCalls = 0;
  final keys = <String>[];
  CommerceVisit? lastVisit;

  @override
  Future<CommerceAvailability> availability(String serviceId, String date) async {
    final start = DateTime.utc(2026, 11, 19, 14, 0);
    if (serviceId == 's043') {
      return CommerceAvailability(
        serviceId: serviceId,
        date: date,
        durationMin: 30,
        priceHalalas: 12000,
        payMode: 'pay_at_venue',
        slots: [
          CommerceSlot(
            startsAt: start.add(const Duration(minutes: 45)),
            endsAt: start.add(const Duration(minutes: 75)),
            available: true,
            remaining: 1,
            resourceId: 'r1',
          ),
        ],
      );
    }
    return CommerceAvailability(
      serviceId: serviceId,
      date: date,
      durationMin: 45,
      priceHalalas: 15000,
      payMode: 'pay_at_venue',
      slots: [
        CommerceSlot(
          startsAt: start,
          endsAt: start.add(const Duration(minutes: 45)),
          available: true,
          remaining: 1,
          resourceId: 'r1',
        ),
      ],
    );
  }

  CommerceVisit _visit(String key, String branchId, List<Map<String, dynamic>> items, String contactName, String contactPhone) {
    final start = DateTime.parse(items.first['startsAt'] as String);
    final bookings = [
      for (var i = 0; i < items.length; i++)
        CommerceBooking(
          id: 'b-$i',
          publicNumber: 'MB-$i',
          partnerNameAr: 'مركز عناية BC',
          serviceId: items[i]['serviceId'] as String,
          serviceNameAr: items[i]['serviceId'] as String,
          branchLabel: 'فرع العليا - الرياض',
          startsAt: i == 0 ? start : start.add(const Duration(minutes: 45)),
          endsAt: i == 0 ? start.add(const Duration(minutes: 45)) : start.add(const Duration(minutes: 75)),
          durationMin: i == 0 ? 45 : 30,
          priceHalalas: 15000,
          payMode: 'pay_at_venue',
          status: 'requested',
          contactName: contactName,
          contactPhone: contactPhone,
        ),
    ];
    return CommerceVisit(
      id: 'visit-1',
      publicNumber: 'MV-1',
      mode: 'consecutive',
      status: 'requested',
      statusLabelAr: 'طلب بانتظار رد المركز',
      branchId: branchId,
      branchLabel: 'فرع العليا - الرياض',
      partnerNameAr: 'مركز عناية BC',
      bookings: bookings,
    );
  }

  @override
  Future<CommerceVisitResult> createConsecutiveVisit({
    required String idempotencyKey,
    required String branchId,
    required String contactName,
    required String contactPhone,
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    visitCalls++;
    keys.add(idempotencyKey);
    if (holdSuccess) {
      // Simulate: server committed but response never arrived.
      lastVisit = _visit(idempotencyKey, branchId, items, contactName, contactPhone);
      throw const CommerceApiException(code: 'NETWORK', messageAr: 'انقطع الاتصال', status: 0);
    }
    lastVisit = _visit(idempotencyKey, branchId, items, contactName, contactPhone);
    return CommerceVisitResult(idempotentReplay: visitCalls > 1, visit: lastVisit!);
  }

  @override
  Future<CommerceVisitResult?> getVisitByKey(String idempotencyKey) async {
    if (lastVisit != null && keys.contains(idempotencyKey)) {
      return CommerceVisitResult(visit: lastVisit!, idempotentReplay: true);
    }
    return null;
  }

  @override
  Future<CommerceBookingResult> createBooking({
    required String idempotencyKey,
    required String serviceId,
    required DateTime startsAt,
    required String contactName,
    required String contactPhone,
    String resourceId = '',
    String? notes,
    String? placeMode,
    String? branchId,
    String? visitCityId,
    String? visitAddress,
    int? travelFeeHalalas,
    Map<String, dynamic>? visitPlan,
  }) async {
    fail('createBooking must not be used for consecutive visit');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Finder _slotChip() => find.byWidgetPredicate(
      (w) => w is ChoiceChip && (w.key?.toString().contains('visit_slot_') ?? false),
    );

Future<void> _fillAndSubmit(WidgetTester tester) async {
  await tester.pumpAndSettle();
  expect(_slotChip(), findsWidgets);
  await tester.ensureVisible(_slotChip().first);
  await tester.tap(_slotChip().first);
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'نورة');
  await tester.enterText(find.byType(TextFormField).at(1), '0501234567');
  await tester.ensureVisible(find.byKey(const Key('submit_consecutive_visit')));
  await tester.tap(find.byKey(const Key('submit_consecutive_visit')));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    BookingBasket.instance.clear();
    SharedPreferences.setMockInitialValues({});
  });

  test('riyadhClock maps 14:00Z to 17:00 regardless of device local zone', () {
    expect(riyadhClock(DateTime.utc(2026, 11, 19, 14, 0)), '17:00');
    expect(riyadhClock(DateTime.utc(2026, 11, 19, 14, 45)), '17:45');
  });

  testWidgets('consecutive submits one visit and returns accepted service ids only', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = _FakeVisitClient();
    final pair = [
      _svc(id: 's042', nameAr: 'تنظيف', durationMin: 45),
      _svc(id: 's043', nameAr: 'ترطيب', durationMin: 30),
    ];
    Set<String>? popped;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                popped = await Navigator.of(context).push<Set<String>>(
                  MaterialPageRoute(
                    builder: (_) => BookingVisitConsecutiveScreen(services: pair, client: client),
                  ),
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await _fillAndSubmit(tester);

    expect(client.visitCalls, 1);
    expect(popped, {'s042', 's043'});
    expect(find.textContaining('17:00'), findsWidgets);
  });

  testWidgets('lost success recovers via pending key without availability gate', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = PendingVisitAttemptStore();
    final client = _FakeVisitClient(holdSuccess: true);
    final pair = [
      _svc(id: 's042', nameAr: 'تنظيف'),
      _svc(id: 's043', nameAr: 'ترطيب', durationMin: 30),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingVisitConsecutiveScreen(services: pair, client: client, pendingStore: store),
      ),
    );
    await _fillAndSubmit(tester);
    expect(client.visitCalls, 1);
    expect(await store.load('test-user'), isNotNull);

    // Re-open: holdSuccess off so getVisitByKey / replay returns the saved visit.
    client.holdSuccess = false;
    Set<String>? popped;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                popped = await Navigator.of(context).push<Set<String>>(
                  MaterialPageRoute(
                    builder: (_) => BookingVisitConsecutiveScreen(
                      services: pair,
                      client: client,
                      pendingStore: store,
                    ),
                  ),
                );
              },
              child: const Text('reopen'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('reopen'));
    await tester.pumpAndSettle();
    expect(popped, {'s042', 's043'});
    expect(await store.load('test-user'), isNull);
  });

  testWidgets('basket with three services requires explicit pick; marks only accepted ids', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = _FakeVisitClient();
    BookingBasket.instance.tryAdd(_svc(id: 's042', nameAr: 'تنظيف'));
    BookingBasket.instance.tryAdd(_svc(id: 's043', nameAr: 'ترطيب', durationMin: 30));
    BookingBasket.instance.tryAdd(_svc(id: 's044', nameAr: 'تقشير', durationMin: 30));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingBasketScreen(client: client),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('اختاري خدمتين'), findsOneWidget);

    await tester.tap(find.byKey(const Key('consecutive_pick_s042')));
    await tester.tap(find.byKey(const Key('consecutive_pick_s043')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('basket_start_consecutive')));
    await tester.tap(find.byKey(const Key('basket_start_consecutive')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('confirm_consecutive_pair')));
    await _fillAndSubmit(tester);

    expect(find.textContaining('· طُلب'), findsNWidgets(2));
    final thirdSubtitle = tester.widget<ListTile>(
      find.descendant(of: find.byKey(const Key('basket_item_s044')), matching: find.byType(ListTile)),
    );
    expect((thirdSubtitle.subtitle as Text?)?.data?.contains('طُلب') ?? false, isFalse);
  });

  testWidgets('separate cancel does not open the next service', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = _FakeVisitClient();
    BookingBasket.instance.tryAdd(_svc(id: 's042', nameAr: 'تنظيف'));
    BookingBasket.instance.tryAdd(_svc(id: 's043', nameAr: 'ترطيب', durationMin: 30));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingBasketScreen(client: client),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('visit_mode_separate')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('basket_book_separate_s042')));
    await tester.pumpAndSettle();
    expect(find.byType(BookingRequestScreen), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byType(BookingRequestScreen), findsNothing);
    expect(find.byKey(const Key('basket_book_separate_s043')), findsOneWidget);
    expect(client.visitCalls, 0);
  });

  testWidgets('mismatched branches block submit without creating a visit', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = _FakeVisitClient();
    final pair = [
      _svc(id: 's042', nameAr: 'تنظيف', branchId: 'br-a', branchNameAr: 'أ'),
      _svc(id: 's043', nameAr: 'ترطيب', branchId: 'br-b', branchNameAr: 'ب', durationMin: 30),
    ];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingVisitConsecutiveScreen(services: pair, client: client),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('لا يوجد فرع مشترك'), findsWidgets);
    expect(tester.widget<FilledButton>(find.byKey(const Key('submit_consecutive_visit'))).onPressed, isNull);
    expect(client.visitCalls, 0);
  });
}
