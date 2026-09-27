import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/config/mira_features.dart';
import 'package:mirra/core/constants/marketplace_copy.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/core/navigation/premium_page_route.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/repositories/marketplace_repository_impl.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/marketplace_routes.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_hub_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/partner_list_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/catalog_record_page.dart';
import 'package:mirra/features/marketplace/presentation/screens/product_detail_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/service_detail_screen.dart';

void main() {
  testWidgets('discover hub follows the marketplace build flag', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: DiscoverHubScreen()));
    await tester.pump();

    if (MiraFeatures.marketplaceEnabled) {
      expect(find.text('شركاء ميرا'), findsOneWidget);
      expect(find.text('العرض المرئي'), findsOneWidget);
      expect(find.text('ماركات التجميل'), findsOneWidget);
      expect(find.text('عيادات التجميل'), findsOneWidget);
      expect(find.text('صالونات التجميل'), findsOneWidget);
      expect(find.text(MarketplaceCopy.testBuildNotice), findsOneWidget);
      expect(find.text(MarketplaceCopy.comingSoonHeadline), findsNothing);
    } else {
      expect(find.text(MarketplaceCopy.comingSoonHeadline), findsOneWidget);
      expect(find.text('شركاء ميرا'), findsNothing);
      expect(find.byIcon(Icons.schedule_rounded), findsNWidgets(3));
    }
  });

  test('discover routes stay closed unless the test define is on', () {
    final list = MarketplaceRoutes.onGenerate(
      const RouteSettings(name: AppRoutes.discoverList, arguments: 'clinic'),
    )! as PremiumPageRoute<void>;
    final product = MarketplaceRoutes.onGenerate(
      RouteSettings(
        name: AppRoutes.productDetail,
        arguments: _product(),
      ),
    );
    final missingProduct = MarketplaceRoutes.onGenerate(
      const RouteSettings(name: AppRoutes.productDetail),
    );
    final presentation = MarketplaceRoutes.onGenerate(
      const RouteSettings(name: AppRoutes.discoverPresentation),
    )! as PremiumPageRoute<void>;

    if (MiraFeatures.marketplaceEnabled) {
      expect(presentation.page, isA<DiscoverPresentationScreen>());
      expect(list.page, isA<PartnerListScreen>());
      expect(product, isA<PremiumPageRoute<void>>());
      expect((product! as PremiumPageRoute<void>).page, isA<CatalogRecordPage>());
      expect(missingProduct, isNull);
    } else {
      expect(presentation.page, isA<DiscoverHubScreen>());
      expect(list.page, isA<DiscoverHubScreen>());
      expect((product! as PremiumPageRoute<void>).page, isA<DiscoverHubScreen>());
      expect((missingProduct! as PremiumPageRoute<void>).page, isA<DiscoverHubScreen>());
    }
  });

  testWidgets('service detail does not claim a completed booking', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: ServiceDetailScreen(service: _service())),
    );
    await tester.pump();

    expect(find.text('اطلبي موعدًا'), findsOneWidget);
    expect(find.textContaining('تم الحجز'), findsNothing);
    expect(find.textContaining('سيُفعّل'), findsNothing);

    await tester.tap(find.text('اطلبي موعدًا'));
    await tester.pump();
    expect(find.textContaining('طلب الموعد غير متاح'), findsOneWidget);
    expect(find.textContaining('تم الحجز'), findsNothing);
  });

  testWidgets('product detail treats the store link as an external handoff', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: ProductDetailScreen(product: _product())),
    );
    await tester.pump();

    expect(find.textContaining('الشراء من متجر'), findsOneWidget);
    expect(find.text(MarketplaceCopy.externalLinkNotPurchase), findsOneWidget);
    expect(find.textContaining('تم الشراء'), findsNothing);
  });

  test('unreachable Mira API falls back to the labeled local seed', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
            ),
          );
        },
      ),
    );
    final repo = MarketplaceRepositoryImpl(api: MarketplaceApiDataSource(dio: dio));
    final brands = await repo.listPartnersLoad(type: 'brand');
    final clinics = await repo.listPartnersLoad(type: 'clinic');
    final salons = await repo.listPartnersLoad(type: 'salon');

    expect(brands.transport, CatalogTransport.localCatalog);
    expect(brands.contentMark, ContentMark.explicitDemo);
    expect(brands.value.map((p) => p.nameAr), contains('لوريال باريس'));
    expect(clinics.value.map((p) => p.nameAr), contains('عيادة نور الجلد'));
    expect(salons.value.map((p) => p.nameAr), contains('صالون روز بيوتي'));
  });
}

CatalogProduct _product() {
  return const CatalogProduct(
    id: 'test-product',
    partnerId: 'test-partner',
    partnerNameAr: 'بذرة اختبار',
    nameAr: 'منتج اختبار',
    nameEn: 'Test product',
    priceHalalas: 1000,
    priceLabel: '10 ر.س',
    externalUrl: 'https://example.invalid/product',
    matchScore: 0,
  );
}

CatalogService _service() {
  return const CatalogService(
    id: 'test-service',
    partnerId: 'test-partner',
    partnerNameAr: 'بذرة اختبار',
    partnerType: 'clinic',
    city: 'الرياض',
    nameAr: 'خدمة اختبار',
    nameEn: 'Test service',
    durationMin: 30,
    priceHalalas: 1000,
    priceLabel: '10 ر.س',
    matchScore: 0,
    bookingEnabled: false,
  );
}
