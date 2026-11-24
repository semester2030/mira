import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/domain/catalog_attribute_display.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/domain/entities/partner_detail.dart';
import 'package:mirra/features/marketplace/domain/entities/partner_summary.dart';
import 'package:mirra/features/marketplace/presentation/screens/partner_catalog_surface.dart';
import 'package:mirra/features/marketplace/presentation/screens/partner_detail_screen.dart';

void main() {
  test('service category labels are Arabic and collapse skin aliases', () {
    expect(CatalogAttributeDisplay.serviceCategoryLabelAr('skin'), 'البشرة');
    expect(CatalogAttributeDisplay.serviceCategoryLabelAr('beauty.skin_centers'), 'البشرة');
    expect(CatalogAttributeDisplay.serviceCategoryLabelAr('makeup'), 'المكياج');
  });

  testWidgets('store surface shows products even when partner also has services', (tester) async {
    final detail = _hybridDetail();
    await tester.pumpWidget(
      MaterialApp(
        home: PartnerDetailScreen(
          partner: detail.summary,
          surface: PartnerCatalogSurface.store,
          loadDetail: (_) async => CatalogLoad(
            value: detail,
            transport: CatalogTransport.server,
            contentMark: ContentMark.unmarked,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('طقم ذهب اختبار'), findsOneWidget);
    expect(find.text('المنتجات'), findsOneWidget);
    expect(find.text('ابحثي عن خدمة'), findsNothing);
    expect(find.text('جلسة عناية اختبار'), findsNothing);
  });

  testWidgets('provider surface shows services for the same hybrid partner', (tester) async {
    final detail = _hybridDetail();
    await tester.pumpWidget(
      MaterialApp(
        home: PartnerDetailScreen(
          partner: detail.summary,
          surface: PartnerCatalogSurface.provider,
          loadDetail: (_) async => CatalogLoad(
            value: detail,
            transport: CatalogTransport.server,
            contentMark: ContentMark.unmarked,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('ابحثي عن خدمة'), findsOneWidget);
    expect(find.text('جلسة عناية اختبار'), findsOneWidget);
    expect(find.text('طقم ذهب اختبار'), findsNothing);
    expect(find.text('البشرة'), findsOneWidget);
    expect(find.text('skin'), findsNothing);
    expect(find.text('beauty.skin_centers'), findsNothing);
  });

  testWidgets('store surface with no products shows empty copy', (tester) async {
    final empty = PartnerDetail(
      summary: _summary(type: 'brand'),
      products: const [],
      services: [_service(category: 'skin')],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: PartnerDetailScreen(
          partner: empty.summary,
          surface: PartnerCatalogSurface.store,
          loadDetail: (_) async => CatalogLoad(
            value: empty,
            transport: CatalogTransport.server,
            contentMark: ContentMark.unmarked,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('لا توجد منتجات منشورة حاليًا'), findsOneWidget);
    expect(find.text('ابحثي عن خدمة'), findsNothing);
  });
}

PartnerSummary _summary({required String type}) {
  return PartnerSummary(
    id: 'dev-partner',
    type: type,
    nameAr: 'حساب المطوّر',
    nameEn: 'Developer',
    city: 'الرياض',
    rating: 0,
  );
}

PartnerDetail _hybridDetail() {
  return PartnerDetail(
    summary: _summary(type: 'brand'),
    products: [
      CatalogProduct(
        id: 'gold-set-1',
        partnerId: 'dev-partner',
        partnerNameAr: 'حساب المطوّر',
        nameAr: 'طقم ذهب اختبار',
        nameEn: 'Gold set',
        priceHalalas: 250000,
        priceLabel: '2500',
        priceKnown: true,
        externalUrl: '',
        matchScore: 0,
        matchKnown: false,
        category: 'jewelry',
      ),
    ],
    services: [
      _service(category: 'skin'),
      _service(id: 'svc-2', name: 'جلسة أخرى', category: 'beauty.skin_centers'),
    ],
  );
}

CatalogService _service({
  String id = 'svc-1',
  String name = 'جلسة عناية اختبار',
  String? category,
}) {
  return CatalogService(
    id: id,
    partnerId: 'dev-partner',
    partnerNameAr: 'حساب المطوّر',
    partnerType: 'brand',
    city: 'الرياض',
    nameAr: name,
    nameEn: name,
    durationMin: 60,
    priceHalalas: 30000,
    priceLabel: '300',
    matchScore: 0,
    category: category,
    bookingEnabled: true,
  );
}
