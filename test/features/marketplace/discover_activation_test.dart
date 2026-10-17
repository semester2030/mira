import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/config/mira_features.dart';
import 'package:mirra/core/constants/marketplace_copy.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/core/navigation/premium_page_route.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/repositories/marketplace_repository_impl.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/marketplace_routes.dart';
import 'package:mirra/features/marketplace/presentation/widgets/discover_lane_entries.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_hub_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/catalog_record_page.dart';
import 'package:mirra/features/marketplace/presentation/screens/product_detail_screen.dart';
import 'package:mirra/features/marketplace/presentation/screens/service_detail_screen.dart';

void main() {
  test('iOS production defines enable marketplace and keep preview and outfit camera off', () {
    final file = File('ios/Flutter/production_dart_defines.json');
    final data = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    expect(data['MIRA_MARKETPLACE_ENABLED'], 'true');
    expect(data['MIRA_DISCOVER_VISUAL_PREVIEW'], 'false');
    expect(data['MIRA_OUTFIT_CAMERA_CAPTURE'], 'false');
    expect(data.containsKey('MIRA_API_BASE_URL'), isFalse);
  });

  testWidgets('discover hub follows the marketplace build flag', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: DiscoverHubScreen()));
    await tester.pump();

    if (MiraFeatures.marketplaceEnabled) {
      expect(find.text('أناقتك وجمالك'), findsOneWidget);
      expect(find.text('أناقتك'), findsOneWidget);
      expect(find.text('جمالك'), findsOneWidget);
      expect(find.text('السلة'), findsOneWidget);
      expect(find.text('طلباتي'), findsOneWidget);
      expect(find.text('حجوزاتي'), findsOneWidget);
      expect(find.text(MarketplaceCopy.comingSoonHeadline), findsNothing);
    } else {
      expect(find.text(MarketplaceCopy.comingSoonHeadline), findsOneWidget);
      expect(find.text('شركاء ميرا'), findsNothing);
      expect(find.byIcon(Icons.schedule_rounded), findsNWidgets(3));
    }
  });

  testWidgets('closed marketplace entries open the coming-soon page', (tester) async {
    if (MiraFeatures.marketplaceEnabled) return;
    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: MarketplaceRoutes.onGenerate,
        home: const Scaffold(
          body: SizedBox(width: 400, child: DiscoverLaneEntries()),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('أناقتك'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.text(MarketplaceCopy.comingSoonHeadline), findsWidgets);
    expect(find.byType(DiscoverPresentationScreen), findsNothing);

    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    await tester.tap(find.text('جمالك'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.text(MarketplaceCopy.comingSoonHeadline), findsWidgets);
    expect(find.byType(DiscoverPresentationScreen), findsNothing);
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
    final elegance = MarketplaceRoutes.onGenerate(
      const RouteSettings(
        name: AppRoutes.discoverPresentation,
        arguments: DiscoverLane.elegance,
      ),
    )! as PremiumPageRoute<void>;
    final beauty = MarketplaceRoutes.onGenerate(
      const RouteSettings(
        name: AppRoutes.discoverPresentation,
        arguments: DiscoverLane.beauty,
      ),
    )! as PremiumPageRoute<void>;

    if (MiraFeatures.marketplaceEnabled) {
      expect(presentation.page, isA<DiscoverPresentationScreen>());
      expect((elegance.page as DiscoverPresentationScreen).lane, DiscoverLane.elegance);
      expect((beauty.page as DiscoverPresentationScreen).lane, DiscoverLane.beauty);
      expect((list.page as DiscoverPresentationScreen).lane, DiscoverLane.beauty);
      expect(product, isA<PremiumPageRoute<void>>());
      expect((product! as PremiumPageRoute<void>).page, isA<CatalogRecordPage>());
      expect(missingProduct, isNull);
    } else {
      expect(presentation.page, isA<DiscoverHubScreen>());
      expect(elegance.page, isA<DiscoverHubScreen>());
      expect(beauty.page, isA<DiscoverHubScreen>());
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

    expect(find.text('طلب الموعد'), findsOneWidget);
    expect(find.textContaining('تم الحجز'), findsNothing);
    expect(find.textContaining('سيُفعّل'), findsNothing);

    await tester.tap(find.text('طلب الموعد'));
    await tester.pump();
    expect(find.textContaining('طلب الموعد غير متاح'), findsWidgets);
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
