import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/commerce_api_client.dart';
import 'package:mirra/features/marketplace/domain/commerce_models.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/intro_video_booking.dart';
import 'package:mirra/features/marketplace/presentation/screens/booking_request_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Flutter-side proof for jamalak connected chain evidence:
/// - home/branch place fields are sent for the same service ids
/// - clinic intro picker shows Arabic linked names and hides foreign/missing
///
/// Reads latest CONNECTED_SUMMARY.json when present; otherwise uses fixtures.
class _FakeBookings implements CommerceClient {
  _FakeBookings();

  final placePayloads = <Map<String, Object?>>[];

  @override
  bool get signedIn => true;

  @override
  Future<CommerceAvailability> availability(String serviceId, String date) async => CommerceAvailability(
        serviceId: serviceId,
        date: date,
        durationMin: 60,
        priceHalalas: 25000,
        payMode: 'pay_at_venue',
        slots: [
          CommerceSlot(
            startsAt: DateTime.utc(2026, 11, 15, 10),
            endsAt: DateTime.utc(2026, 11, 15, 11),
            remaining: 1,
            available: true,
          ),
        ],
      );

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
  }) async {
    placePayloads.add({
      'serviceId': serviceId,
      'placeMode': placeMode,
      'branchId': branchId,
      'visitCityId': visitCityId,
      'visitAddress': visitAddress,
      'travelFeeHalalas': travelFeeHalalas,
    });
    return CommerceBookingResult(
      idempotentReplay: false,
      booking: CommerceBooking(
        id: 'flutter-b-1',
        publicNumber: 'B-F1',
        partnerNameAr: 'شريك',
        serviceId: serviceId,
        serviceNameAr: 'خدمة',
        branchLabel: placeMode == 'home' ? 'زيارة' : 'فرع',
        startsAt: startsAt,
        endsAt: startsAt.add(const Duration(minutes: 60)),
        durationMin: 60,
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

Map<String, dynamic>? _loadConnectedSummary() {
  final dir = Directory('docs/jamalak-dual-reg/evidence');
  if (!dir.existsSync()) return null;
  final summaries = dir
      .listSync()
      .whereType<Directory>()
      .map((d) => File('${d.path}/CONNECTED_SUMMARY.json'))
      .where((f) => f.existsSync())
      .toList()
    ..sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
  if (summaries.isEmpty) return null;
  return jsonDecode(summaries.first.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final summary = _loadConnectedSummary();
  final independent = summary?['independent'] as Map<String, dynamic>?;
  final salon = summary?['salon'] as Map<String, dynamic>?;
  final clinic = summary?['clinic'] as Map<String, dynamic>?;

  Future<void> _prepareView(WidgetTester tester) async {
    tester.view.physicalSize = const Size(900, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('independent home booking sends visit fields for connected service', (tester) async {
    await _prepareView(tester);
    final client = _FakeBookings();
    final serviceId = independent?['serviceId'] as String? ?? 'ind-svc';
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        onGenerateRoute: (settings) => MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const Text('bookings-list'),
        ),
        home: BookingRequestScreen(
          service: CatalogService(
            id: serviceId,
            partnerId: independent?['partnerId'] as String? ?? 'ind-p',
            partnerNameAr: 'نورة متصلة',
            partnerType: 'salon',
            providerKind: 'independent',
            city: 'الرياض',
            nameAr: 'مكياج منزل',
            nameEn: 'home',
            durationMin: 60,
            priceHalalas: 25000,
            priceLabel: '250',
            matchScore: 0,
            placeMode: 'home',
            coverageCityIds: const ['sa-jeddah'],
            travelFeeHalalas: 3500,
            bookingEnabled: true,
            availabilityPresent: true,
          ),
          client: client,
          now: () => DateTime.utc(2026, 11, 15, 9),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('13:00'));
    await tester.pump();
    await tester.enterText(find.widgetWithText(TextFormField, 'الاسم'), 'عميلة');
    await tester.enterText(find.widgetWithText(TextFormField, 'رقم الجوال'), '0501112233');
    await tester.enterText(find.widgetWithText(TextFormField, 'عنوان الزيارة'), 'حي الزهراء، جدة — سلسلة متصلة');
    await tester.ensureVisible(find.byKey(const ValueKey('visit-city')));
    await tester.tap(find.byKey(const ValueKey('visit-city')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('جدة').last);
    await tester.pumpAndSettle();
    final send = find.widgetWithText(FilledButton, 'إرسال طلب الموعد');
    await tester.ensureVisible(send);
    await tester.tap(send);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(client.placePayloads, isNotEmpty);
    expect(client.placePayloads.single['serviceId'], serviceId);
    expect(client.placePayloads.single['placeMode'], 'home');
    expect(client.placePayloads.single['visitCityId'], 'sa-jeddah');
    expect(client.placePayloads.single['visitAddress'], contains('الزهراء'));
    expect(client.placePayloads.single['branchId'], isNull);
  });

  testWidgets('salon branch booking sends branchId for color offer', (tester) async {
    await _prepareView(tester);
    final client = _FakeBookings();
    final serviceId = salon?['colorOfferId'] as String? ?? 'color-svc';
    final branchId = salon?['branchId'] as String? ?? 'br-1';
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        onGenerateRoute: (settings) => MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const Text('bookings-list'),
        ),
        home: BookingRequestScreen(
          service: CatalogService(
            id: serviceId,
            partnerId: salon?['partnerId'] as String? ?? 'salon-p',
            partnerNameAr: 'صالون متصل',
            partnerType: 'salon',
            city: 'الرياض',
            nameAr: 'صبغة وجذور',
            nameEn: 'color',
            durationMin: 90,
            priceHalalas: 35000,
            priceLabel: '350',
            matchScore: 0,
            placeMode: 'branch',
            branchId: branchId,
            bookingEnabled: true,
            availabilityPresent: true,
          ),
          client: client,
          initialBranchId: branchId,
          now: () => DateTime.utc(2026, 11, 15, 9),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('13:00'));
    await tester.pump();
    await tester.enterText(find.widgetWithText(TextFormField, 'الاسم'), 'عميلة');
    await tester.enterText(find.widgetWithText(TextFormField, 'رقم الجوال'), '0502223344');
    await tester.tap(find.widgetWithText(FilledButton, 'إرسال طلب الموعد'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(client.placePayloads.single['serviceId'], serviceId);
    expect(client.placePayloads.single['placeMode'], 'branch');
    expect(client.placePayloads.single['branchId'], branchId);
  });

  testWidgets('clinic intro picker shows Arabic services and hides foreign', (tester) async {
    final dermId = clinic?['dermServiceId'] as String? ?? 'derm-1';
    final laserId = clinic?['laserServiceId'] as String? ?? 'laser-1';
    final foreignId = clinic?['foreignServiceId'] as String? ?? 'foreign-1';
    final intro = CatalogService(
      id: clinic?['introVideoId'] as String? ?? 'intro-1',
      partnerId: clinic?['partnerId'] as String? ?? 'clinic-p',
      partnerNameAr: 'عيادة متصلة',
      partnerType: 'clinic',
      city: 'الرياض',
      nameAr: 'فيديو تعريفي',
      nameEn: 'intro',
      durationMin: 1,
      priceHalalas: 1,
      priceLabel: '1',
      matchScore: 0,
      placeMode: 'branch',
      bookingEnabled: false,
      videoScope: 'provider_intro',
      linkedServiceIds: [dermId, laserId, foreignId],
      linkedServices: [
        CatalogLinkedService(id: dermId, nameAr: 'جلسة بشرة', bookingEnabled: true),
        CatalogLinkedService(id: laserId, nameAr: 'جلسة ليزر', bookingEnabled: true),
        CatalogLinkedService(id: foreignId, nameAr: null, bookingEnabled: false, missing: true),
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () => openServiceBookingFlow(context: context, service: intro),
              child: const Text('افتح الحجز'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('افتح الحجز'));
    await tester.pumpAndSettle();
    expect(find.text('جلسة بشرة'), findsOneWidget);
    expect(find.text('جلسة ليزر'), findsOneWidget);
    expect(find.text('خدمة أجنبية'), findsNothing);
    expect(find.textContaining(foreignId), findsNothing);
  });

  test('connected summary proves same partner identity across chain', () {
    expect(summary, isNotNull, reason: 'run jamalak-connected-journeys first');
    expect(summary!['verdict'], 'PASS_CONNECTED');
    expect(summary['sameIdentityProven'], isTrue);
    expect(summary['gitHead'], isNotNull);
    expect((salon?['approvedActivities'] as List?)?.contains('beauty.hair.color'), isTrue);
    expect((salon?['approvedActivities'] as List?)?.contains('beauty.hair.blowdry'), isTrue);
    expect(salon?['bothUnderHairParent'], isFalse);
    expect(salon?['hairParentNote'], contains('leaf queries still isolate'));
  });
}
