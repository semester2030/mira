import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/catalog_price.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/domain/entities/partner_detail.dart';
import 'package:mirra/features/marketplace/presentation/screens/product_detail_screen.dart';

void main() {
  test('halalas render as riyals in the UI text', () {
    expect(CatalogPrice.formatHalalas(8900), '89 ر.س');
    expect(CatalogPrice.formatHalalas(8999), '89.99 ر.س');
    expect(CatalogPrice.formatHalalas(0), '0 ر.س');
    expect(CatalogPrice.text(known: false, halalas: 8900), 'السعر غير متوفر');
    expect(CatalogPrice.text(known: true, halalas: 8900), '89 ر.س');
    expect(CatalogPrice.read({'priceHalalas': null}).known, isFalse);
    expect(CatalogPrice.read({}).known, isFalse);
    expect(CatalogPrice.read({'priceHalalas': 'x'}).known, isFalse);
    expect(CatalogPrice.read({'priceHalalas': 0}), (halalas: 0, known: true));
  });

  test('partner json null price stays unknown', () {
    final detail = PartnerDetail.fromJson({
      'id': 'p',
      'type': 'brand',
      'nameAr': 'متجر',
      'products': [
        {'id': 'x', 'nameAr': 'قطعة', 'priceHalalas': null, 'externalUrl': 'https://example.com'},
      ],
    });
    expect(detail.products.single.priceKnown, isFalse);
  });

  testWidgets('product detail shows riyals and an unknown price', (tester) async {
    await tester.pumpWidget(MaterialApp(home: ProductDetailScreen(product: _product(8900, known: true))));
    await tester.pump();
    expect(find.text('89 ر.س'), findsOneWidget);
    await tester.pumpWidget(MaterialApp(home: ProductDetailScreen(product: _product(0, known: true))));
    await tester.pump();
    expect(find.text('0 ر.س'), findsOneWidget);
    await tester.pumpWidget(MaterialApp(home: ProductDetailScreen(product: _product(0, known: false))));
    await tester.pump();
    expect(find.text('السعر غير متوفر'), findsOneWidget);
  });
}

CatalogProduct _product(int halalas, {required bool known}) {
  return CatalogProduct(
    id: 'p',
    partnerId: 'partner',
    partnerNameAr: 'متجر',
    nameAr: 'قطعة',
    nameEn: 'Item',
    priceHalalas: halalas,
    priceLabel: '',
    priceKnown: known,
    externalUrl: 'https://example.com',
    matchScore: 0,
  );
}
