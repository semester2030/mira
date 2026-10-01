import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_visual_preview_catalog.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';

void main() {
  final all = DiscoverCatalogQueryEngine.localOffers();

  test('search covers the whole local catalog, not one page', () {
    final filtered = DiscoverCatalogQueryEngine.filter(all, const DiscoverCatalogQuery(text: 'مكياج'));
    expect(filtered.map((offer) => offer.id), ['s-glam-makeup']);
    final firstPage = DiscoverCatalogQueryEngine.page(all, limit: 2);
    expect(firstPage.items.map((offer) => offer.id), isNot(contains('s-glam-makeup')));
    expect(filtered.single.id, 's-glam-makeup');
  });

  test('clothes is empty only when no row stores that category', () {
    final filtered = DiscoverCatalogQueryEngine.filter(
      all,
      const DiscoverCatalogQuery(partnerType: 'brand', categoryId: 'clothes'),
    );
    expect(filtered, isEmpty);
    final clothes = DiscoverOffer.product(
      const CatalogProduct(
        id: 'p-clothes',
        partnerId: 'local-loreal',
        partnerNameAr: 'لوريال باريس',
        nameAr: 'فستان',
        nameEn: 'Dress',
        priceHalalas: 1000,
        priceLabel: '10 ر.س',
        externalUrl: 'https://example.com',
        matchScore: 0,
        category: 'clothes',
      ),
      city: 'الرياض',
    );
    final matched = DiscoverCatalogQueryEngine.filter(
      [clothes],
      const DiscoverCatalogQuery(partnerType: 'brand', categoryId: 'clothes'),
    );
    expect(matched.single.id, 'p-clothes');
  });

  test('makeup matches the stored category, not the service name', () {
    final makeup = DiscoverCatalogQueryEngine.filter(
      all,
      const DiscoverCatalogQuery(partnerType: 'salon', categoryId: 'makeup'),
    );
    expect(makeup.map((offer) => offer.id), ['s-glam-makeup']);
  });

  test('paging uses one key order for sort and continuation', () {
    final rows = [
      DiscoverOffer.product(
        const CatalogProduct(
          id: 'a',
          partnerId: 'local-loreal',
          partnerNameAr: 'x',
          nameAr: 'lower',
          nameEn: 'a',
          priceHalalas: 100,
          priceLabel: '1 ر.س',
          externalUrl: 'https://example.com',
          matchScore: 0,
        ),
        city: 'الرياض',
      ),
      DiscoverOffer.product(
        const CatalogProduct(
          id: 'A',
          partnerId: 'local-loreal',
          partnerNameAr: 'x',
          nameAr: 'upper',
          nameEn: 'A',
          priceHalalas: 100,
          priceLabel: '1 ر.س',
          externalUrl: 'https://example.com',
          matchScore: 0,
        ),
        city: 'الرياض',
      ),
      DiscoverOffer.product(
        const CatalogProduct(
          id: 'b',
          partnerId: 'local-loreal',
          partnerNameAr: 'x',
          nameAr: 'bee',
          nameEn: 'b',
          priceHalalas: 100,
          priceLabel: '1 ر.س',
          externalUrl: 'https://example.com',
          matchScore: 0,
        ),
        city: 'الرياض',
      ),
    ];
    final seen = <String>[];
    var page = DiscoverCatalogQueryEngine.page(rows, limit: 1);
    seen.addAll(page.items.map((offer) => offer.id));
    var cursor = page.nextCursor;
    while (cursor != null) {
      page = DiscoverCatalogQueryEngine.page(rows, cursor: cursor, limit: 1);
      seen.addAll(page.items.map((offer) => offer.id));
      cursor = page.nextCursor;
    }
    expect(seen, ['A', 'a', 'b']);
    expect(seen.toSet().length, 3);
  });

  test('paging continues after the cursor row is gone', () {
    final first = DiscoverCatalogQueryEngine.page(all, limit: 2);
    final cursor = first.nextCursor!;
    final without = all.where((offer) => offer.cursor != cursor).toList();
    final next = DiscoverCatalogQueryEngine.page(without, cursor: cursor, limit: 2);
    expect(next.invalidCursor, isFalse);
    expect(next.items, isNotEmpty);
    expect(next.items.map((offer) => offer.cursor), isNot(contains(cursor)));
  });

  test('an invalid cursor is not treated as the end', () {
    final page = DiscoverCatalogQueryEngine.page(all, cursor: 'gone', limit: 2);
    expect(page.invalidCursor, isTrue);
  });

  test('الكل clears the category and keeps the current type', () {
    final products = DiscoverCatalogQueryEngine.filter(all, const DiscoverCatalogQuery(partnerType: 'brand'));
    expect(products, isNotEmpty);
    expect(products.every((offer) => offer.partnerType == 'brand'), isTrue);
  });

  test('pages do not repeat ids and a new query does not keep the old page', () {
    final first = DiscoverCatalogQueryEngine.page(all, limit: 4);
    final second = DiscoverCatalogQueryEngine.page(all, cursor: first.nextCursor, limit: 4);
    final ids = {...first.items.map((offer) => offer.id), ...second.items.map((offer) => offer.id)};
    expect(ids.length, first.items.length + second.items.length);
    final makeup = DiscoverCatalogQueryEngine.filter(all, const DiscoverCatalogQuery(text: 'جلم'));
    expect(makeup.every((offer) => offer.partnerId == 'local-glam'), isTrue);
  });

  test('a store query cannot include another partner', () {
    final store = DiscoverCatalogQueryEngine.filter(all, const DiscoverCatalogQuery(partnerId: 'local-loreal'));
    expect(store, isNotEmpty);
    expect(store.every((offer) => offer.partnerId == 'local-loreal'), isTrue);
  });

  test('elegance keeps products and beauty keeps services', () {
    final products = DiscoverCatalogQueryEngine.filter(
      all,
      const DiscoverCatalogQuery(lane: DiscoverLane.elegance, categoryId: 'all'),
    );
    final services = DiscoverCatalogQueryEngine.filter(
      all,
      const DiscoverCatalogQuery(lane: DiscoverLane.beauty, categoryId: 'all'),
    );
    expect(products, isNotEmpty);
    expect(services, isNotEmpty);
    expect(products.every((offer) => offer.kind == 'product'), isTrue);
    expect(services.every((offer) => offer.kind == 'service'), isTrue);
    final face = DiscoverCatalogQueryEngine.filter(
      all,
      const DiscoverCatalogQuery(lane: DiscoverLane.elegance, categoryId: 'face'),
    );
    expect(face, isNotEmpty);
    expect(face.every((offer) => offer.kind == 'product' && offer.category == 'face'), isTrue);
    final clinics = DiscoverCatalogQueryEngine.filter(
      all,
      const DiscoverCatalogQuery(lane: DiscoverLane.beauty, categoryId: 'venue-clinic'),
    );
    expect(clinics.every((offer) => offer.kind == 'service' && offer.partnerType == 'clinic'), isTrue);
    expect(clinics.any((offer) => offer.kind == 'product'), isFalse);
  });

  test('an older response is ignored', () {
    final gate = DiscoverRequestGate();
    final first = gate.next();
    final second = gate.next();
    expect(gate.isCurrent(first), isFalse);
    expect(gate.isCurrent(second), isTrue);
  });

  test('catalog slides keep ids and do not borrow generated images', () {
    final slide = DiscoverPresentationCatalog.slideForOffer(all.first);
    expect(slide.entityId, all.first.id);
    expect(slide.product?.id, all.first.id);
    expect(slide.media, isEmpty);
    expect(slide.preview, isFalse);
  });

  test('explicit visual preview stays inside its lane and keeps media', () {
    const elegance = DiscoverCatalogQuery(lane: DiscoverLane.elegance, requireVisual: true);
    const beauty = DiscoverCatalogQuery(lane: DiscoverLane.beauty, requireVisual: true);
    final products = DiscoverCatalogQueryEngine.filter(DiscoverVisualPreviewCatalog.offers, elegance);
    final services = DiscoverCatalogQueryEngine.filter(DiscoverVisualPreviewCatalog.offers, beauty);
    expect(products, isNotEmpty);
    expect(services, isNotEmpty);
    expect(products.every((offer) => offer.kind == 'product'), isTrue);
    expect(services.every((offer) => offer.kind == 'service'), isTrue);
    expect(products.map((offer) => offer.category), containsAll(['face', 'body', 'hair', 'clothes', 'accessories']));
    expect(services.map((offer) => offer.category), containsAll(['skin', 'hair', 'makeup', 'nails', 'care']));
    final serum = products.singleWhere((offer) => offer.id == 'preview-face-serum');
    expect(serum.media.where((item) => item.kind == 'image').length, greaterThan(1));
    expect(serum.media.any((item) => item.kind == 'video' && item.placement == 'detail'), isTrue);
    final slide = DiscoverPresentationCatalog.slideForOffer(serum);
    expect(slide.preview, isTrue);
    expect(slide.media.every((item) => item.kind.toString().contains('image')), isTrue);
    expect(slide.media.first.network, isFalse);
    expect(DiscoverCatalogQueryEngine.filter(products, elegance.copyWith(categoryId: 'clothes')).single.id, 'preview-silk-dress');
  });

  test('cities come from partner records', () {
    expect(DiscoverCatalogQueryEngine.citiesIn(all), containsAll(['الرياض', 'جدة']));
  });
}
