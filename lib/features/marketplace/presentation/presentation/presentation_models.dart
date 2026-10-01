import '../../domain/catalog_offer_media.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import 'discover_ad.dart';

enum PresentationMediaKind { image, video }

class PresentationMedia {
  const PresentationMedia({
    required this.kind,
    required this.assetPath,
    this.network = false,
  });

  final PresentationMediaKind kind;
  final String assetPath;
  final bool network;
}

/// Links an existing product or service to isolated media. It does not store
/// a second price or stock catalog.
class PresentationSlide {
  const PresentationSlide({
    required this.entityId,
    required this.partnerId,
    required this.title,
    required this.partnerName,
    required this.kindLabel,
    required this.media,
    this.priceLabel,
    this.product,
    this.service,
    this.sampleMedia = true,
    this.preview = false,
    this.layoutNote,
    this.city,
    this.advertisement,
    this.mainOfferKind = CatalogMainOfferKind.images,
    this.videoCoverPath,
  });

  final String entityId;
  final String partnerId;
  final String title;
  final String partnerName;
  final String kindLabel;
  final String? priceLabel;
  final CatalogProduct? product;
  final CatalogService? service;
  final List<PresentationMedia> media;
  final bool sampleMedia;

  /// Visual preview. It is not a merchant listing and must not run a transaction.
  final bool preview;
  final String? layoutNote;
  final String? city;

  /// Present only when this slide is a celebrity ad for the original entity.
  final DiscoverAdLink? advertisement;

  final CatalogMainOfferKind mainOfferKind;

  /// Optional poster for a main video. Not a horizontal slide.
  final String? videoCoverPath;

  /// Ad identity stays separate from the original when two ads share one target.
  String get slotId => advertisement?.id ?? entityId;
}

/// The slide entity is the original product or service, not a copied listing.
PresentationSlide presentationSlideFromAd(
  DiscoverAdLink ad, {
  CatalogProduct? product,
  CatalogService? service,
  List<PresentationMedia> media = const [],
}) {
  return PresentationSlide(
    entityId: ad.targetId,
    partnerId: product?.partnerId ?? service?.partnerId ?? '',
    title: ad.caption,
    partnerName: ad.sellerName,
    kindLabel: ad.targetKind == 'service' ? 'خدمة' : 'منتج',
    priceLabel: product?.priceLabel ?? service?.priceLabel,
    product: product,
    service: service,
    media: media,
    sampleMedia: false,
    advertisement: ad,
  );
}

abstract final class PresentationSamples {
  static const portrait = 'assets/marketplace/samples/sample_portrait.png';
  static const square = 'assets/marketplace/samples/sample_square.png';
  static const landscape = 'assets/marketplace/samples/sample_landscape.png';
  static const clip = 'assets/marketplace/samples/sample_clip.mp4';
  static const sourceNote =
      'عينات اختبار مرسومة محليًا: صورة طولية ومربعة وأفقية، وفيديو testsrc متحرك. ليست صور المنتجات.';
  static const layoutNote =
      'عنوان طويل للتحقق من التفاف النص العربي من اليمين إلى اليسار فوق خلفية فاتحة وداكنة دون قصّ الوسائط.';
}
