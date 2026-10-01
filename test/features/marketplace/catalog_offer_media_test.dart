import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_visual_preview_catalog.dart';
import 'package:mirra/features/marketplace/domain/catalog_offer_media.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';

void main() {
  test('images main rejects video and video main rejects extra slides', () {
    final mixed = [
      CatalogMediaLink(kind: 'image', url: 'a.jpg', placement: CatalogMediaPlacement.main),
      CatalogMediaLink(kind: 'video', url: 'a.mp4', placement: CatalogMediaPlacement.main),
    ];
    expect(
      CatalogOfferMedia.validate(kind: CatalogMainOfferKind.images, media: mixed),
      contains('عرض الصور لا يقبل فيديو في العرض الرئيسي.'),
    );

    final twoVideos = [
      CatalogMediaLink(kind: 'video', url: 'a.mp4', placement: CatalogMediaPlacement.main),
      CatalogMediaLink(kind: 'video', url: 'b.mp4', placement: CatalogMediaPlacement.main),
    ];
    expect(
      CatalogOfferMedia.validate(kind: CatalogMainOfferKind.video, media: twoVideos),
      contains('عرض الفيديو يحتاج فيديو واحدًا فقط في العرض الرئيسي.'),
    );

    final withImageMain = [
      CatalogMediaLink(kind: 'video', url: 'a.mp4', placement: CatalogMediaPlacement.main),
      CatalogMediaLink(kind: 'image', url: 'a.jpg', placement: CatalogMediaPlacement.main),
    ];
    expect(
      CatalogOfferMedia.validate(kind: CatalogMainOfferKind.video, media: withImageMain),
      contains('صور العرض الرئيسي غير مسموحة مع عرض الفيديو. استخدم الغلاف إن لزم.'),
    );
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

  test('legacy mixed main keeps detail media and drops video from image feed', () {
    final legacy = [
      const CatalogMediaLink(kind: 'image', url: 'a.jpg'),
      const CatalogMediaLink(kind: 'video', url: 'a.mp4'),
    ];
    expect(CatalogOfferMedia.isLegacyMixedMain(legacy), isTrue);
    expect(CatalogOfferMedia.mainSlides(legacy).map((item) => item.url), ['a.jpg']);
    expect(CatalogOfferMedia.detailMedia(legacy).map((item) => item.url), ['a.jpg', 'a.mp4']);
  });

  test('preview catalog matches the main-vs-detail cases', () {
    final single = DiscoverVisualPreviewCatalog.find('product', 'preview-body-cream')!;
    expect(single.mainOfferKind, CatalogMainOfferKind.images);
    expect(CatalogOfferMedia.mainSlides(single.media, kind: single.mainOfferKind).length, 1);
    expect(CatalogOfferMedia.detailMedia(single.media).any((item) => item.kind == 'video'), isTrue);

    final set = DiscoverVisualPreviewCatalog.find('product', 'preview-face-serum')!;
    final setSlide = DiscoverPresentationCatalog.slideForOffer(set);
    expect(setSlide.media.every((item) => item.kind == PresentationMediaKind.image), isTrue);
    expect(setSlide.media.length, greaterThan(1));
    expect(CatalogOfferMedia.detailMedia(set.media).any((item) => item.kind == 'video'), isTrue);

    final video = DiscoverVisualPreviewCatalog.find('product', 'preview-hair-oil')!;
    final videoSlide = DiscoverPresentationCatalog.slideForOffer(video);
    expect(videoSlide.mainOfferKind, CatalogMainOfferKind.video);
    expect(videoSlide.media.length, 1);
    expect(videoSlide.media.single.kind, PresentationMediaKind.video);
    expect(videoSlide.videoCoverPath, isNotNull);

    final serviceImages = DiscoverVisualPreviewCatalog.find('service', 'preview-salon-makeup')!;
    expect(CatalogOfferMedia.mainSlides(serviceImages.media, kind: serviceImages.mainOfferKind).every((item) => item.kind == 'image'), isTrue);
    expect(CatalogOfferMedia.detailMedia(serviceImages.media).any((item) => item.kind == 'video'), isTrue);

    final serviceVideo = DiscoverVisualPreviewCatalog.find('service', 'preview-clinic-skin')!;
    expect(CatalogOfferMedia.mainSlides(serviceVideo.media, kind: serviceVideo.mainOfferKind).single.kind, 'video');
    expect(CatalogOfferMedia.detailMedia(serviceVideo.media).where((item) => item.kind == 'image').length, greaterThan(0));

    for (final offer in DiscoverVisualPreviewCatalog.offers) {
      final kind = offer.mainOfferKind!;
      expect(CatalogOfferMedia.validate(kind: kind, media: offer.media), isEmpty, reason: offer.id);
    }
  });
}
