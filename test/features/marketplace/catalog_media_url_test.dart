import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/data/catalog_media_url.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

class _RecordingVideoPort extends PresentationVideoPort {
  String? attached;

  @override
  PresentationSlot? activeSlot;

  @override
  PresentationPlayback playback = PresentationPlayback.idle;

  @override
  String? errorText;

  @override
  bool isPlaying = false;

  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {
    attached = assetPath;
    activeSlot = slot;
  }

  @override
  Future<void> detach(PresentationSlot slot) async {}

  @override
  Future<void> pause() async {}

  @override
  Future<void> release() async {}

  @override
  Future<void> retry(PresentationSlot slot, String assetPath) async {
    attached = assetPath;
  }

  @override
  Widget? buildView() => const SizedBox.shrink();
}

void main() {
  test('relative api media resolves on the api origin without a duplicated prefix', () {
    const base = 'http://127.0.0.1:3011/api/v1';
    final resolved = resolveCatalogMediaUrl('/api/v1/marketplace/media/prod-1', base);
    expect(resolved, 'http://127.0.0.1:3011/api/v1/marketplace/media/prod-1');
    expect(resolved.contains('/api/v1/api/v1'), isFalse);
  });

  testWidgets('catalog response reaches the data layer and the presentation', (tester) async {
    const base = 'http://127.0.0.1:3011/api/v1';
    final source = MarketplaceApiDataSource(dio: Dio(BaseOptions(baseUrl: base)));
    final offer = source.parseCatalogItem({
      'kind': 'product',
      'id': 'prod-1',
      'partnerId': 'partner-1',
      'partnerNameAr': 'ماركة',
      'nameAr': '<img src=x onerror=alert(1)> فستان',
      'nameEn': 'Dress',
      'priceHalalas': 8900,
      'externalUrl': 'https://example.com/dress',
      'city': 'الرياض',
      'concernTags': <String>[],
      'media': [
        {
          'kind': 'video',
          'url': '/api/v1/marketplace/media/clip',
          'sortOrder': 1,
          'isPrimary': false,
        },
        {
          'kind': 'image',
          'url': '/api/v1/marketplace/media/img',
          'sortOrder': 0,
          'isPrimary': true,
        },
      ],
    });
    expect(offer.id, 'prod-1');
    expect(offer.media, hasLength(2));
    expect(offer.media.first.kind, 'video');
    expect(offer.media.last.isPrimary, isTrue);
    expect(offer.media.last.url, 'http://127.0.0.1:3011/api/v1/marketplace/media/img');
    expect(offer.media.first.url.contains('/api/v1/api/v1'), isFalse);
    final videoSlide = DiscoverPresentationCatalog.slideForOffer(offer);
    expect(videoSlide.sampleMedia, isFalse);
    expect(videoSlide.media.first.network, isTrue);
    expect(Uri.parse(videoSlide.media.first.assetPath).isScheme('http'), isTrue);
    final port = _RecordingVideoPort();
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      navigatorObservers: [miraRouteObserver],
      home: DiscoverPresentationScreen(slides: [videoSlide], videoPort: port),
    ));
    await tester.pump();
    expect(find.text('<img src=x onerror=alert(1)> فستان'), findsOneWidget);
    expect(
      tester.widgetList<Image>(find.byType(Image)).where((image) => image.image is NetworkImage),
      isEmpty,
    );
    expect(port.attached, 'http://127.0.0.1:3011/api/v1/marketplace/media/clip');
    expect(port.attached!.startsWith('assets/'), isFalse);

    final imageOffer = source.parseCatalogItem({
      'kind': 'product',
      'id': 'prod-1',
      'partnerId': 'partner-1',
      'partnerNameAr': 'ماركة',
      'nameAr': '<img src=x onerror=alert(1)> فستان',
      'nameEn': 'Dress',
      'priceHalalas': 8900,
      'externalUrl': 'https://example.com/dress',
      'city': 'الرياض',
      'media': [
        {
          'kind': 'image',
          'url': '/api/v1/marketplace/media/img',
          'sortOrder': 0,
          'isPrimary': true,
        },
      ],
    });
    final image = DiscoverPresentationCatalog.slideForOffer(imageOffer);
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      navigatorObservers: [miraRouteObserver],
      home: DiscoverPresentationScreen(slides: [image], videoPort: _RecordingVideoPort()),
    ));
    await tester.pump();
    final shown = tester.widgetList<Image>(find.byType(Image)).where((image) => image.image is NetworkImage);
    expect(shown, hasLength(1));
    expect((shown.single.image as NetworkImage).url, 'http://127.0.0.1:3011/api/v1/marketplace/media/img');
  });
}
