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
import 'package:mirra/features/marketplace/presentation/screens/bookings_list_screen.dart';
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
  _FakeVisitClient({this.holdSuccess = false, this.rejectCode, this.byKeyMode = 'normal'});

  @override
  final bool signedIn = true;
  @override
  String? get accountKey => account;

  String account = 'test-user';
  bool holdSuccess;
  String? rejectCode;
  /// `normal` | `generic404` — generic404 throws HTTP_404 (not VISIT_NOT_FOUND).
  String byKeyMode;
  int visitCalls = 0;
  int availabilityCalls = 0;
  int byKeyCalls = 0;
  final keys = <String>[];
  CommerceVisit? lastVisit;
  final List<Map<String, dynamic>> lastItems = [];

  @override
  Future<CommerceAvailability> availability(String serviceId, String date) async {
    availabilityCalls++;
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
    lastItems
      ..clear()
      ..addAll(items);
    if (rejectCode != null) {
      throw CommerceApiException(code: rejectCode!, messageAr: 'مرفوض: $rejectCode', status: 422);
    }
    if (holdSuccess) {
      lastVisit = _visit(idempotencyKey, branchId, items, contactName, contactPhone);
      throw const CommerceApiException(code: 'NETWORK', messageAr: 'انقطع الاتصال', status: 0);
    }
    lastVisit = _visit(idempotencyKey, branchId, items, contactName, contactPhone);
    return CommerceVisitResult(idempotentReplay: visitCalls > 1, visit: lastVisit!);
  }

  @override
  Future<CommerceVisitResult?> getVisitByKey(String idempotencyKey) async {
    byKeyCalls++;
    if (byKeyMode == 'generic404') {
      throw const CommerceApiException(
        code: 'HTTP_404',
        messageAr: 'المسار غير متاح',
        status: 404,
      );
    }
    if (lastVisit != null && keys.contains(idempotencyKey)) {
      return CommerceVisitResult(visit: lastVisit!, idempotentReplay: true);
    }
    // Mimic ApiCommerceClient: only VISIT_NOT_FOUND → null (caller may same-key replay).
    return null;
  }

  @override
  Future<CommercePage<CommerceBooking>> listBookings({String? cursor}) async {
    return const CommercePage(items: [], nextCursor: null);
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

  test('pending store keeps two accounts and two attempts without overwrite', () async {
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
    final a1 = PendingVisitAttempt(
      userId: 'u1',
      idempotencyKey: 'k1',
      fingerprint: 'fp1',
      branchId: 'br',
      branchLabel: 'فرع',
      items: [
        {'serviceId': 's042', 'startsAt': '2026-11-19T14:00:00.000Z'},
        {'serviceId': 's043', 'startsAt': '2026-11-19T14:45:00.000Z'},
      ],
      serviceNamesAr: const ['تنظيف', 'ترطيب'],
      phase: VisitAttemptPhase.outcomeUnknown,
      savedAtMs: 1,
    );
    final a2 = PendingVisitAttempt(
      userId: 'u1',
      idempotencyKey: 'k2',
      fingerprint: 'fp2',
      branchId: 'br',
      branchLabel: 'فرع',
      items: [
        {'serviceId': 's044', 'startsAt': '2026-11-20T14:00:00.000Z'},
        {'serviceId': 's045', 'startsAt': '2026-11-20T14:45:00.000Z'},
      ],
      serviceNamesAr: const ['أ', 'ب'],
      phase: VisitAttemptPhase.outcomeUnknown,
      savedAtMs: 2,
    );
    final other = a1.copyWith(phase: VisitAttemptPhase.outcomeUnknown);
    final otherAttempt = PendingVisitAttempt(
      userId: 'u2',
      idempotencyKey: 'k1',
      fingerprint: 'fp1',
      branchId: 'br',
      branchLabel: 'فرع',
      items: a1.items,
      serviceNamesAr: a1.serviceNamesAr,
      phase: VisitAttemptPhase.outcomeUnknown,
      savedAtMs: 3,
    );
    await store.upsert(a1, contact: const VisitAttemptContact(contactName: 'أ', contactPhone: '+966501111111'));
    await store.upsert(a2, contact: const VisitAttemptContact(contactName: 'ب', contactPhone: '+966502222222'));
    await store.upsert(otherAttempt, contact: const VisitAttemptContact(contactName: 'ج', contactPhone: '+966503333333'));

    expect((await store.list('u1')).map((e) => e.idempotencyKey).toSet(), {'k1', 'k2'});
    expect((await store.list('u2')).map((e) => e.idempotencyKey).toSet(), {'k1'});
    expect((await store.readContact('u1', 'k1'))?.contactName, 'أ');
    expect((await store.readContact('u2', 'k1'))?.contactName, 'ج');
    await store.remove('u1', 'k1');
    expect(await store.get('u1', 'k1'), isNull);
    expect(await store.get('u1', 'k2'), isNotNull);
    expect(await store.get('u2', 'k1'), isNotNull);
    expect(other.userId, 'u1');
  });

  testWidgets('consecutive submits one visit and returns accepted service ids only', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = PendingVisitAttemptStore(secrets: MemoryVisitAttemptSecrets());
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
                    builder: (_) => BookingVisitConsecutiveScreen(
                      services: pair,
                      client: client,
                      pendingStore: store,
                    ),
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

  testWidgets('(a) lost success on same screen verifies by key before availability', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
    final client = _FakeVisitClient(holdSuccess: true);
    final pair = [
      _svc(id: 's042', nameAr: 'تنظيف'),
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
                    builder: (_) => BookingVisitConsecutiveScreen(
                      services: pair,
                      client: client,
                      pendingStore: store,
                    ),
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
    final key = client.keys.single;
    final itemsSnapshot = List<Map<String, dynamic>>.from(client.lastItems);
    expect(find.byKey(const Key('verify_pending_visit')), findsOneWidget);
    expect(client.availabilityCalls, greaterThan(0));

    final availBeforeVerify = client.availabilityCalls;
    client.holdSuccess = false;
    await tester.tap(find.byKey(const Key('verify_pending_visit')));
    await tester.pumpAndSettle();

    expect(popped, {'s042', 's043'});
    expect(client.keys.last, key);
    expect(client.availabilityCalls, availBeforeVerify); // no new availability reads during verify
    expect(client.lastItems.map((e) => e['serviceId']).toList(), itemsSnapshot.map((e) => e['serviceId']).toList());
    expect(await store.get('test-user', key), isNull);
  });

  testWidgets('(b) lost success recovers from حجوزاتي entry without re-picking services', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
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
    final key = client.keys.single;
    client.holdSuccess = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingsListScreen(client: client, pendingStore: store),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(Key('pending_visit_$key')), findsOneWidget);
    await tester.tap(find.byKey(Key('verify_pending_$key')));
    await tester.pumpAndSettle();
    expect(await store.get('test-user', key), isNull);
  });

  testWidgets('(c) final reject does not auto-resend on reopen after service re-enabled', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
    final client = _FakeVisitClient(rejectCode: 'BOOKING_NOT_ENABLED');
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
    final key = client.keys.single;
    final stored = await store.get('test-user', key);
    expect(stored?.phase, VisitAttemptPhase.rejectedFinal);

    client.rejectCode = null; // service available again
    final callsBefore = client.visitCalls;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingVisitConsecutiveScreen(services: pair, client: client, pendingStore: store),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('pending_rejected_final')), findsOneWidget);
    expect(find.byKey(const Key('start_new_visit_after_reject')), findsOneWidget);
    expect(client.visitCalls, callsBefore); // zero new sends on reopen alone
  });

  testWidgets('(c2) intentional new request after reject = one new POST, reopen alone = zero', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
    final client = _FakeVisitClient(rejectCode: 'BOOKING_NOT_ENABLED');
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
    final rejectedKey = client.keys.single;
    expect((await store.get('test-user', rejectedKey))?.phase, VisitAttemptPhase.rejectedFinal);

    client.rejectCode = null;
    final callsAfterReject = client.visitCalls;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingVisitConsecutiveScreen(services: pair, client: client, pendingStore: store),
      ),
    );
    await tester.pumpAndSettle();
    expect(client.visitCalls, callsAfterReject); // reopen = zero send

    await tester.tap(find.byKey(const Key('start_new_visit_after_reject')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('pending_rejected_final')), findsNothing);
    expect(find.byKey(const Key('submit_consecutive_visit')), findsOneWidget);

    await _fillAndSubmit(tester);
    expect(client.visitCalls, callsAfterReject + 1);
    expect(client.keys.last, isNot(rejectedKey));
    // Prior rejected attempt kept for حجوزاتي view — not overwritten.
    expect((await store.get('test-user', rejectedKey))?.phase, VisitAttemptPhase.rejectedFinal);
  });

  testWidgets('(c3) generic HTTP 404 on by-key is verification failure — zero auto-resend', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
    final client = _FakeVisitClient(holdSuccess: true, byKeyMode: 'generic404');
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
    final key = client.keys.single;
    final callsBefore = client.visitCalls;

    await tester.tap(find.byKey(const Key('verify_pending_visit')));
    await tester.pumpAndSettle();

    expect(client.byKeyCalls, greaterThan(0));
    expect(client.visitCalls, callsBefore); // no createConsecutiveVisit replay
    expect(find.byKey(const Key('verify_pending_visit')), findsOneWidget);
    expect(find.textContaining('لم نتحقق'), findsWidgets);
    expect((await store.get('test-user', key))?.phase, VisitAttemptPhase.outcomeUnknown);
  });

  testWidgets('(d) second pending + other account isolation', (tester) async {
    final secrets = MemoryVisitAttemptSecrets();
    final store = PendingVisitAttemptStore(secrets: secrets);
    await store.upsert(
      PendingVisitAttempt(
        userId: 'test-user',
        idempotencyKey: 'first',
        fingerprint: 'fp',
        branchId: 'br-1',
        branchLabel: 'فرع',
        items: [
          {'serviceId': 's042', 'startsAt': '2026-11-19T14:00:00.000Z'},
          {'serviceId': 's043', 'startsAt': '2026-11-19T14:45:00.000Z'},
        ],
        serviceNamesAr: const ['تنظيف', 'ترطيب'],
        phase: VisitAttemptPhase.outcomeUnknown,
        savedAtMs: 1,
      ),
      contact: const VisitAttemptContact(contactName: 'نورة', contactPhone: '+966501234567'),
    );
    await store.upsert(
      PendingVisitAttempt(
        userId: 'other-user',
        idempotencyKey: 'other',
        fingerprint: 'fp2',
        branchId: 'br-1',
        branchLabel: 'فرع',
        items: [
          {'serviceId': 'x1', 'startsAt': '2026-11-19T15:00:00.000Z'},
          {'serviceId': 'x2', 'startsAt': '2026-11-19T15:45:00.000Z'},
        ],
        serviceNamesAr: const ['أ', 'ب'],
        phase: VisitAttemptPhase.outcomeUnknown,
        savedAtMs: 2,
      ),
      contact: const VisitAttemptContact(contactName: 'أخرى', contactPhone: '+966509999999'),
    );

    expect(await store.get('test-user', 'first'), isNotNull);
    expect(await store.get('test-user', 'other'), isNull);
    expect((await store.readContact('test-user', 'first'))?.contactName, 'نورة');
    expect((await store.readContact('other-user', 'other'))?.contactName, 'أخرى');
  });

  testWidgets('basket with three services requires explicit pick; marks only accepted ids', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = PendingVisitAttemptStore(secrets: MemoryVisitAttemptSecrets());
    final client = _FakeVisitClient();
    BookingBasket.instance.tryAdd(_svc(id: 's042', nameAr: 'تنظيف'));
    BookingBasket.instance.tryAdd(_svc(id: 's043', nameAr: 'ترطيب', durationMin: 30));
    BookingBasket.instance.tryAdd(_svc(id: 's044', nameAr: 'تقشير', durationMin: 30));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: BookingBasketScreen(client: client, pendingStore: store),
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
