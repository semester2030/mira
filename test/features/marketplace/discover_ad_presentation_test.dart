import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_ad.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_view_count.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_visual_chrome.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

void main() {
  test('public ad contract keeps the original id and does not treat a link or booking flag as completion', () {
    final ad = DiscoverAdLink.fromPublic({
      'id': 'ad-1',
      'disclosure': 'إعلان',
      'captionAr': '<script>alert(1)</script> "اقتباس"',
      'advertiser': {'nameAr': 'المعلن'},
      'publisher': {'nameAr': 'الناشر'},
      'seller': {'nameAr': 'الجهة'},
      'target': {'kind': 'product', 'id': 'dress-1', 'priceHalalas': 1800, 'externalUrl': 'https://example.com/dress'},
      'actions': {'openLink': true, 'purchaseCompleted': false, 'appointmentOperational': false, 'appointmentConfirmed': false},
    });
    final slide = presentationSlideFromAd(ad, product: _product(priceHalalas: 1800));
    expect(slide.entityId, 'dress-1');
    expect(slide.advertisement?.id, 'ad-1');
    expect(slide.advertisement?.openLink, isTrue);
    expect(slide.advertisement?.countsAsPurchase, isFalse);
    expect(ad.priceHalalas, 1800);

    final service = DiscoverAdLink.fromPublic({
      'id': 'ad-2',
      'disclosure': 'إعلان',
      'captionAr': 'جلسة',
      'advertiser': {'nameAr': 'المعلن'},
      'publisher': {'nameAr': 'المعلن'},
      'seller': {'nameAr': 'العيادة'},
      'target': {'kind': 'service', 'id': 'session-1', 'priceHalalas': 4500, 'externalUrl': null},
      'actions': {
        'openLink': false,
        'purchaseCompleted': false,
        'appointmentRequest': true,
        'appointmentOperational': false,
        'appointmentConfirmed': false,
      },
    });
    expect(service.openLink, isFalse);
    expect(service.appointmentOperational, isFalse);
    expect(service.countsAsConfirmedAppointment, isFalse);
  });

  testWidgets('the current presentation shows the ad roles and hides a misleading action', (tester) async {
    final caption = '<script>alert(1)</script> "اقتباس"';
    final ad = DiscoverAdLink.fromPublic({
      'id': 'ad-1',
      'disclosure': 'إعلان',
      'captionAr': caption,
      'advertiser': {'nameAr': 'المعلن'},
      'publisher': {'nameAr': 'الناشر'},
      'seller': {'nameAr': 'الجهة'},
      'target': {'kind': 'service', 'id': 'session-1', 'priceHalalas': 4500, 'externalUrl': null},
      'actions': {'openLink': false, 'appointmentOperational': false, 'appointmentConfirmed': false},
    });
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: DiscoverPresentationScreen(
        slides: [
          presentationSlideFromAd(ad, service: _service()),
        ],
        videoPort: _QuietVideoPort(),
      ),
    ));
    await tester.pump();
    expect(find.text(caption), findsOneWidget);
    expect(find.textContaining('إعلان · المعلن: المعلن · الجهة: الجهة · الناشر: الناشر'), findsOneWidget);
    expect(find.bySemanticsLabel('العد غير مفعّل'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text('اطلبي موعدًا'), findsNothing);
    expect(find.text('اشتري الآن'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

CatalogProduct _product({required int priceHalalas}) {
  return CatalogProduct(
    id: 'dress-1',
    partnerId: 'seller',
    partnerNameAr: 'الجهة',
    nameAr: 'فستان',
    nameEn: 'Dress',
    priceHalalas: priceHalalas,
    priceLabel: '18 ر.س',
    externalUrl: 'https://example.com/dress',
    matchScore: 0,
  );
}

CatalogService _service() {
  return const CatalogService(
    id: 'session-1',
    partnerId: 'clinic',
    partnerNameAr: 'العيادة',
    partnerType: 'clinic',
    city: 'الرياض',
    nameAr: 'جلسة',
    nameEn: 'Session',
    durationMin: 30,
    priceHalalas: 4500,
    priceLabel: '45 ر.س',
    matchScore: 0,
    bookingEnabled: true,
  );
}

class _QuietVideoPort extends PresentationVideoPort {
  @override
  PresentationSlot? activeSlot;

  @override
  PresentationPlayback playback = PresentationPlayback.idle;

  @override
  String? errorText;

  @override
  bool isPlaying = false;

  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {}

  @override
  Future<void> detach(PresentationSlot slot) async {}

  @override
  Future<void> pause() async {}

  @override
  Future<void> release() async {}

  @override
  Future<void> retry(PresentationSlot slot, String assetPath) async {}

  @override
  Widget? buildView() => null;
}
