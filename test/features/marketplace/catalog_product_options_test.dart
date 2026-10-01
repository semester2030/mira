import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_visual_preview_catalog.dart';
import 'package:mirra/features/marketplace/domain/catalog_offer_media.dart';
import 'package:mirra/features/marketplace/domain/catalog_option_schema.dart';
import 'package:mirra/features/marketplace/domain/catalog_product_options.dart';

void main() {
  group('CatalogOptionMatrix', () {
    const color = CatalogOptionGroup(
      id: 'color',
      labelAr: 'اللون',
      kind: 'color',
      values: [
        CatalogOptionValue(id: 'pink', labelAr: 'وردي'),
        CatalogOptionValue(id: 'black', labelAr: 'أسود'),
      ],
    );
    const size = CatalogOptionGroup(
      id: 'size',
      labelAr: 'المقاس',
      kind: 'size',
      values: [
        CatalogOptionValue(id: 's', labelAr: 'S'),
        CatalogOptionValue(id: 'm', labelAr: 'M'),
        CatalogOptionValue(id: 'l', labelAr: 'L'),
      ],
    );
    const variants = [
      CatalogProductVariant(id: 'pink-m', selections: {'color': 'pink', 'size': 'm'}),
      CatalogProductVariant(id: 'black-s', selections: {'color': 'black', 'size': 's'}),
      CatalogProductVariant(id: 'black-l', selections: {'color': 'black', 'size': 'l'}),
    ];

    test('does not invent full cartesian availability', () {
      final sizesForPink = CatalogOptionMatrix.availableValueIds(
        group: size,
        variants: variants,
        selected: {'color': 'pink'},
      );
      expect(sizesForPink, {'m'});
      expect(sizesForPink.contains('s'), isFalse);
      expect(sizesForPink.contains('l'), isFalse);
    });

    test('sanitize drops invalid size after color change', () {
      final next = CatalogOptionMatrix.sanitize(
        groups: const [color, size],
        variants: variants,
        selected: {'color': 'black', 'size': 'm'},
        preferGroupId: 'color',
      );
      expect(next['color'], 'black');
      expect(next.containsKey('size'), isFalse);
    });

    test('match returns priced volume variant', () {
      const volume = CatalogOptionGroup(
        id: 'volume',
        labelAr: 'الحجم',
        kind: 'volume',
        values: [
          CatalogOptionValue(id: 'v50', labelAr: '50 مل', amount: 50, unit: 'مل'),
          CatalogOptionValue(id: 'v100', labelAr: '100 مل', amount: 100, unit: 'مل'),
        ],
      );
      const rows = [
        CatalogProductVariant(id: 'a', selections: {'volume': 'v50'}, priceHalalas: 8900),
        CatalogProductVariant(id: 'b', selections: {'volume': 'v100'}, priceHalalas: 14500),
      ];
      expect(volume.values.first.displayLabel, '50 مل');
      expect(
        CatalogOptionMatrix.match(variants: rows, selected: {'volume': 'v100'})?.priceHalalas,
        14500,
      );
    });
  });

  group('preview catalog identity and options', () {
    test('dress never reuses serum hero media', () {
      final dress = DiscoverVisualPreviewCatalog.offers.singleWhere((offer) => offer.id == 'preview-silk-dress');
      final serum = DiscoverVisualPreviewCatalog.offers.singleWhere((offer) => offer.id == 'preview-face-serum');
      final dressUrls = dress.media.map((item) => item.url).toSet();
      final serumUrls = serum.media.map((item) => item.url).toSet();
      expect(dressUrls.contains('assets/marketplace/discover/hero_product.jpg'), isFalse);
      expect(serumUrls.contains('assets/marketplace/discover/hero_product.jpg'), isTrue);
      expect(dress.product!.nameAr, 'فستان المعاينة');
      expect(serum.product!.nameAr, 'سيروم المعاينة');
      expect(dress.product!.priceHalalas, 24000);
      expect(serum.product!.priceHalalas, 8900);
    });

    test('main stay images-only or single video; details may mix', () {
      for (final offer in DiscoverVisualPreviewCatalog.offers) {
        final media = offer.media;
        final kind = CatalogOfferMedia.resolveKind(media, offer.mainOfferKind);
        final main = CatalogOfferMedia.mainSlides(media, kind: kind);
        if (kind == CatalogMainOfferKind.video) {
          expect(main.where((item) => item.kind == 'video').length, 1);
          expect(main.where((item) => item.kind == 'image'), isEmpty);
        } else {
          expect(main.every((item) => item.kind == 'image'), isTrue);
        }
        final details = CatalogOfferMedia.detailMedia(media);
        if (offer.id == 'preview-face-serum' || offer.id == 'preview-silk-dress') {
          expect(details.any((item) => item.kind == 'video'), isTrue);
          expect(details.any((item) => item.kind == 'image'), isTrue);
        }
      }
    });

    test('preview products cover option cases without forcing options', () {
      final dress = DiscoverVisualPreviewCatalog.offers.singleWhere((offer) => offer.id == 'preview-silk-dress').product!;
      final cream = DiscoverVisualPreviewCatalog.offers.singleWhere((offer) => offer.id == 'preview-body-cream').product!;
      final ear = DiscoverVisualPreviewCatalog.offers.singleWhere((offer) => offer.id == 'preview-earring').product!;
      final hair = DiscoverVisualPreviewCatalog.offers.singleWhere((offer) => offer.id == 'preview-hair-oil').product!;
      expect(dress.optionGroups.map((group) => group.kind), containsAll(['color', 'size']));
      expect(dress.variants.length, 3);
      expect(cream.optionGroups.single.kind, 'volume');
      expect(ear.optionGroups.single.kind, 'finish');
      expect(hair.optionGroups, isEmpty);
      expect(CatalogOptionSchema.suggestedOptionGroups('clothes'), isNotEmpty);
      expect(CatalogOptionSchema.suggestedOptionGroups('face').single.kind, 'volume');
    });
  });
}
