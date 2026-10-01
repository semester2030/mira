import '../../data/catalog_price.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/marketplace_local_catalog.dart';
import '../../domain/catalog_offer_media.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import 'presentation_models.dart';

/// Phase-1 slides use existing local catalog ids and isolated sample media.
abstract final class DiscoverPresentationCatalog {
  static PresentationSlide? slideForProduct(String id) {
    for (final slide in slides()) {
      if (slide.product?.id == id) return slide;
    }
    return null;
  }

  static List<PresentationSlide> slides() {
    CatalogProduct? productById(String id) {
      for (final product in MarketplaceLocalCatalog.products) {
        if (product.id == id) return product;
      }
      return null;
    }

    CatalogService? serviceById(String id) {
      for (final service in MarketplaceLocalCatalog.services) {
        if (service.id == id) return service;
      }
      return null;
    }

    final vitamin = productById('p-loreal-vitc');
    final wash = productById('p-neutro-wash');
    final consult = serviceById('s-noor-consult');
    final facial = serviceById('s-rose-facial');
    return [
      if (vitamin != null)
        PresentationSlide(
          entityId: vitamin.id,
          partnerId: vitamin.partnerId,
          title: vitamin.nameAr,
          partnerName: vitamin.partnerNameAr,
          kindLabel: 'منتج',
          priceLabel: vitamin.priceLabel,
          product: vitamin,
          layoutNote: PresentationSamples.layoutNote,
          media: const [
            PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.portrait),
            PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.square),
            PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.landscape),
            PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip),
          ],
        ),
      if (wash != null)
        PresentationSlide(
          entityId: wash.id,
          partnerId: wash.partnerId,
          title: wash.nameAr,
          partnerName: wash.partnerNameAr,
          kindLabel: 'منتج',
          priceLabel: wash.priceLabel,
          product: wash,
          media: const [
            PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.square),
          ],
        ),
      if (consult != null)
        PresentationSlide(
          entityId: consult.id,
          partnerId: consult.partnerId,
          title: consult.nameAr,
          partnerName: consult.partnerNameAr,
          kindLabel: 'خدمة',
          priceLabel: consult.priceLabel,
          service: consult,
          media: const [
            PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip),
          ],
        ),
      if (facial != null)
        PresentationSlide(
          entityId: facial.id,
          partnerId: facial.partnerId,
          title: facial.nameAr,
          partnerName: facial.partnerNameAr,
          kindLabel: 'خدمة',
          priceLabel: facial.priceLabel,
          service: facial,
          media: const [
            PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.portrait),
          ],
        ),
    ];
  }

  static List<PresentationSlide> previewSlides() {
    CatalogService previewService({
      required String id,
      required String partnerType,
      required String title,
    }) {
      return CatalogService(
        id: id,
        partnerId: 'preview',
        partnerNameAr: 'عرض معاينة',
        partnerType: partnerType,
        city: 'معاينة',
        nameAr: title,
        nameEn: 'Preview',
        durationMin: 0,
        priceHalalas: 0,
        priceLabel: '',
        matchScore: 0,
        bookingEnabled: false,
      );
    }

    final clinic = previewService(id: 'preview-clinic', partnerType: 'clinic', title: 'جلسة عناية بالبشرة');
    final salon = previewService(id: 'preview-salon', partnerType: 'salon', title: 'تصفيف الشعر');
    return [
      const PresentationSlide(
        entityId: 'preview-product',
        partnerId: 'preview',
        title: 'سيروم عناية',
        partnerName: 'عرض معاينة',
        kindLabel: 'معاينة',
        preview: true,
        media: [
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: 'assets/marketplace/discover/hero_product.jpg'),
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.square),
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.landscape),
          PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip),
        ],
      ),
      PresentationSlide(
        entityId: clinic.id,
        partnerId: clinic.partnerId,
        title: clinic.nameAr,
        partnerName: clinic.partnerNameAr,
        kindLabel: 'معاينة',
        preview: true,
        service: clinic,
        media: const [
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: 'assets/marketplace/discover/hero_clinic.jpg'),
        ],
      ),
      PresentationSlide(
        entityId: salon.id,
        partnerId: salon.partnerId,
        title: salon.nameAr,
        partnerName: salon.partnerNameAr,
        kindLabel: 'معاينة',
        preview: true,
        service: salon,
        media: const [
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: 'assets/marketplace/discover/hero_salon.jpg'),
        ],
      ),
    ];
  }

  /// Catalog rows do not receive generated hero images. Missing media stays missing.
  /// Main slides follow [CatalogMainOfferKind]: images only, or one video (cover is not a slide).
  static PresentationSlide slideForOffer(DiscoverOffer offer) {
    final known = offer.product?.priceKnown ?? offer.service?.priceKnown ?? false;
    final halalas = offer.product?.priceHalalas ?? offer.service?.priceHalalas ?? 0;
    final price = known ? CatalogPrice.text(known: true, halalas: halalas) : null;
    final kind = CatalogOfferMedia.resolveKind(offer.media, offer.mainOfferKind);
    final mains = CatalogOfferMedia.mainSlides(offer.media, kind: kind);
    final cover = kind == CatalogMainOfferKind.video ? CatalogOfferMedia.videoCover(offer.media) : null;
    return PresentationSlide(
      entityId: offer.id,
      partnerId: offer.partnerId,
      title: offer.nameAr,
      partnerName: offer.partnerNameAr,
      kindLabel: offer.kind == 'product' ? 'منتج' : 'خدمة',
      priceLabel: price,
      product: offer.product,
      service: offer.service,
      city: offer.city,
      sampleMedia: false,
      preview: offer.id.startsWith('preview-'),
      mainOfferKind: kind,
      videoCoverPath: cover?.url,
      media: [
        for (final item in mains)
          PresentationMedia(
            kind: item.kind == 'video' ? PresentationMediaKind.video : PresentationMediaKind.image,
            assetPath: item.url,
            network: item.url.startsWith('http://') || item.url.startsWith('https://'),
          ),
      ],
    );
  }
}
