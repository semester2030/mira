import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/screens/product_detail_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget wrap(Widget child) {
    return MaterialApp(theme: AppTheme.lightTheme, home: child);
  }

  testWidgets('old dress category clothes opens fashion family key', (tester) async {
    await tester.pumpWidget(
      wrap(
        ProductDetailScreen(
          product: CatalogProduct(
            id: '14260bc3-7960-493f-86ad-2422d96bfa47',
            partnerId: 'p1',
            partnerNameAr: 'ميرا',
            nameAr: 'فستان زواج',
            nameEn: 'فستان زواج',
            descriptionAr: 'فستان زواج',
            priceHalalas: 1500000,
            priceLabel: '15000 ر.س',
            externalUrl: '',
            matchScore: 0,
            category: 'clothes',
            subcategory: null,
            profileId: null,
            purchaseMode: CatalogPurchaseMode.display,
          ),
        ),
      ),
    );
    expect(find.byKey(const Key('product_detail_family_fashion')), findsOneWidget);
    expect(find.byKey(const Key('product_detail_ask_mira')), findsOneWidget);
    expect(find.byKey(const Key('product_detail_sticky_price')), findsOneWidget);
  });

  testWidgets('ring opens jewelry family with honest certificate empty state', (tester) async {
    await tester.pumpWidget(
      wrap(
        ProductDetailScreen(
          product: CatalogProduct(
            id: 'a06ff375-cbf8-4a5e-bef3-66bbebd98d31',
            partnerId: 'p1',
            partnerNameAr: 'ميرا',
            nameAr: 'خاتم',
            nameEn: 'خاتم',
            priceHalalas: 150000,
            priceLabel: '1500 ر.س',
            externalUrl: '',
            matchScore: 0,
            category: 'jewelry',
            subcategory: 'jewelry.rings',
            profileId: 'product.jewelry',
            purchaseMode: CatalogPurchaseMode.internalCod,
            deliveryFeeHalalas: 20000,
          ),
        ),
      ),
    );
    expect(find.byKey(const Key('product_detail_family_jewelry')), findsOneWidget);
    expect(find.byKey(const Key('jewelry_certificate_row')), findsOneWidget);
    expect(find.textContaining('غير مرفقة'), findsOneWidget);
    expect(find.textContaining('لم يُدخل البائع مواصفات'), findsOneWidget);
  });
}
