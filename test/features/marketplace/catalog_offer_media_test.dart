import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_visual_preview_catalog.dart';
import 'package:mirra/features/marketplace/domain/catalog_offer_media.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';

void main() {
  test('gallery accepts up to 3 videos and 10 images independently', () {
    final media = <CatalogMediaLink>[
      for (var i = 0; i < 3; i++)
        CatalogMediaLink(
          kind: 'video',
          url: 'v$i.mp4',
          placement: CatalogMediaPlacement.main,
          sortOrder: i,
        ),
      for (var i = 0; i < 10; i++)
        CatalogMediaLink(
          kind: 'image',
          url: 'i$i.jpg',
          placement: CatalogMediaPlacement.main,
          sortOrder: 100 + i,
        ),
    ];
    expect(CatalogOfferMedia.validate(kind: CatalogMainOfferKind.gallery, media: media), isEmpty);
    final slides = CatalogOfferMedia.mainSlides(media, kind: CatalogMainOfferKind.gallery);
    expect(slides.where((item) => item.kind == 'video').length, 3);
    expect(slides.where((item) => item.kind == 'image').length, 10);
    expect(slides.length, 13);
  });

  test('caps reject an 11th image or 4th video on main', () {
    final tooManyImages = [
      for (var i = 0; i < 11; i++)
        CatalogMediaLink(kind: 'image', url: 'i$i.jpg', placement: CatalogMediaPlacement.main),
    ];
    expect(
      CatalogOfferMedia.validate(kind: CatalogMainOfferKind.gallery, media: tooManyImages),
      contains('العرض الرئيسي يقبل حتى 10 صور فقط.'),
    );

    final tooManyVideos = [
      for (var i = 0; i < 4; i++)
        CatalogMediaLink(kind: 'video', url: 'v$i.mp4', placement: CatalogMediaPlacement.main),
    ];
    expect(
      CatalogOfferMedia.validate(kind: CatalogMainOfferKind.gallery, media: tooManyVideos),
      contains('العرض الرئيسي يقبل حتى 3 فيديوهات فقط.'),
    );
  });

  test('mixed main resolves to gallery and preserves partner order', () {
    final mixed = [
      CatalogMediaLink(kind: 'image', url: 'a.jpg', placement: CatalogMediaPlacement.main, sortOrder: 0),
      CatalogMediaLink(kind: 'video', url: 'a.mp4', placement: CatalogMediaPlacement.main, sortOrder: 1),
      CatalogMediaLink(kind: 'image', url: 'b.jpg', placement: CatalogMediaPlacement.main, sortOrder: 2),
    ];
    expect(CatalogOfferMedia.resolveKind(mixed, CatalogMainOfferKind.images), CatalogMainOfferKind.gallery);
    expect(CatalogOfferMedia.mainSlides(mixed).map((item) => item.url), ['a.jpg', 'a.mp4', 'b.jpg']);
  });

  test('details may mix media and cover is not a main slide', () {
    final media = [
      CatalogMediaLink(kind: 'video', url: 'main.mp4', placement: CatalogMediaPlacement.main),
      CatalogMediaLink(kind: 'image', url: 'cover.jpg', placement: CatalogMediaPlacement.cover, isPrimary: true),
      CatalogMediaLink(kind: 'image', url: 'd1.jpg', placement: CatalogMediaPlacement.detail),
      CatalogMediaLink(kind: 'video', url: 'd2.mp4', placement: CatalogMediaPlacement.detail, sortOrder: 1),
    ];
    expect(CatalogOfferMedia.validate(kind: CatalogMainOfferKind.video, media: media), isEmpty);
    expect(CatalogOfferMedia.mainSlides(media, kind: CatalogMainOfferKind.video).single.url, 'main.mp4');
    expect(CatalogOfferMedia.videoCover(media)?.url, 'cover.jpg');
    final details = CatalogOfferMedia.detailMedia(media);
    expect(details.map((item) => item.url), ['d1.jpg', 'd2.mp4']);
    expect(details.any((item) => item.placement == CatalogMediaPlacement.cover), isFalse);
  });

  test('legacy mixed main keeps both kinds as main slides', () {
    final legacy = [
      const CatalogMediaLink(kind: 'image', url: 'a.jpg'),
      const CatalogMediaLink(kind: 'video', url: 'a.mp4'),
    ];
    expect(CatalogOfferMedia.isLegacyMixedMain(legacy), isTrue);
    expect(CatalogOfferMedia.mainSlides(legacy).map((item) => item.url), ['a.jpg', 'a.mp4']);
    expect(CatalogOfferMedia.resolveKind(legacy, null), CatalogMainOfferKind.gallery);
  });

  test('preview catalog still validates and maps to slides', () {
    final single = DiscoverVisualPreviewCatalog.find('product', 'preview-body-cream')!;
    expect(single.mainOfferKind, CatalogMainOfferKind.images);
    expect(CatalogOfferMedia.mainSlides(single.media, kind: single.mainOfferKind).length, 1);

    final set = DiscoverVisualPreviewCatalog.find('product', 'preview-face-serum')!;
    final setSlide = DiscoverPresentationCatalog.slideForOffer(set);
    expect(setSlide.media.every((item) => item.kind == PresentationMediaKind.image), isTrue);
    expect(setSlide.media.length, greaterThan(1));

    final video = DiscoverVisualPreviewCatalog.find('product', 'preview-hair-oil')!;
    final videoSlide = DiscoverPresentationCatalog.slideForOffer(video);
    expect(videoSlide.mainOfferKind, CatalogMainOfferKind.video);
    expect(videoSlide.media.length, 1);
    expect(videoSlide.media.single.kind, PresentationMediaKind.video);
    expect(videoSlide.videoCoverPath, isNotNull);

    for (final offer in DiscoverVisualPreviewCatalog.offers) {
      final kind = CatalogOfferMedia.resolveKind(offer.media, offer.mainOfferKind);
      expect(CatalogOfferMedia.validate(kind: kind, media: offer.media), isEmpty, reason: offer.id);
    }
  });
}
