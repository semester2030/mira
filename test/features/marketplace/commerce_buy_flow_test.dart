import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/constants/marketplace_copy.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/marketplace/data/commerce_api_client.dart';
import 'package:mirra/features/marketplace/domain/commerce_models.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/commerce_cart_actions.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

class _FakeCommerce implements CommerceClient {
  _FakeCommerce({this.signedIn = true, this.conflictOnce = false});

  @override
  final bool signedIn;
  bool conflictOnce;
  final calls = <String>[];

  @override
  Future<CommerceCart> addCartItem({
    required String productId,
    int quantity = 1,
    Map<String, String> selections = const {},
    String? variantKey,
  }) async {
    calls.add('add:$productId:$quantity');
    if (conflictOnce) {
      conflictOnce = false;
      throw const CommerceApiException(
        code: CommerceApiException.partnerConflict,
        messageAr: 'خادم: سلة من متجر آخر',
        status: 409,
      );
    }
    return CommerceCart.empty;
  }

  @override
  Future<CommerceCart> clearCart() async {
    calls.add('clear');
    return CommerceCart.empty;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _QuietVideo extends PresentationVideoPort {
  @override
  PresentationSlot? activeSlot;
  @override
  PresentationPlayback playback = PresentationPlayback.idle;
  @override
  String? errorText;
  @override
  bool isPlaying = false;
  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {}
  @override
  Future<void> detach(PresentationSlot slot) async {}
  @override
  Future<void> pause() async {}
  @override
  Future<void> release() async {}
  @override
  Future<void> retry(PresentationSlot slot, String assetPath) async {}
  @override
  Widget? buildView() => null;
}

CatalogProduct _product({
  String mode = CatalogPurchaseMode.external,
  int? stock,
  int price = 1000,
  bool priceKnown = true,
  String url = 'https://example.invalid/product',
}) {
  return CatalogProduct(
    id: 'prod-1',
    partnerId: 'partner-1',
    partnerNameAr: 'متجر اختبار',
    nameAr: 'منتج اختبار',
    nameEn: 'Sample',
    priceHalalas: price,
    priceLabel: '10 ر.س',
    priceKnown: priceKnown,
    externalUrl: url,
    matchScore: 0,
    purchaseMode: mode,
    stockQty: stock,
  );
}

PresentationSlide _slide(CatalogProduct product, {bool preview = false}) {
  return PresentationSlide(
    entityId: product.id,
    partnerId: product.partnerId,
    title: product.nameAr,
    partnerName: product.partnerNameAr,
    kindLabel: 'منتج',
    priceLabel: product.priceLabel,
    sampleMedia: true,
    preview: preview,
    product: product,
    media: const [PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.portrait)],
  );
}

Future<List<String>> _pump(WidgetTester tester, PresentationSlide slide, CommerceClient client) async {
  final opened = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightTheme,
      onGenerateRoute: (settings) {
        opened.add(settings.name ?? '');
        return MaterialPageRoute<void>(settings: settings, builder: (_) => Text('opened:${settings.name}'));
      },
      home: DiscoverPresentationScreen(slides: [slide], videoPort: _QuietVideo(), commerce: client),
    ),
  );
  return opened;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('decideBuyRoute', () {
    test('preview and missing product never transact', () {
      expect(decideBuyRoute(product: _product(mode: CatalogPurchaseMode.internalCod), preview: true), BuyRoute.preview);
      expect(decideBuyRoute(product: null, preview: false), BuyRoute.preview);
    });

    test('internal_cod goes in-app, external opens the link, neither is an appointment', () {
      expect(decideBuyRoute(product: _product(mode: CatalogPurchaseMode.internalCod), preview: false), BuyRoute.inApp);
      expect(decideBuyRoute(product: _product(), preview: false), BuyRoute.external);
      expect(decideBuyRoute(product: _product(url: ''), preview: false), BuyRoute.none);
    });

    test('internal_cod refuses an empty shelf or an unknown price', () {
      expect(decideBuyRoute(product: _product(mode: CatalogPurchaseMode.internalCod, stock: 0), preview: false), BuyRoute.outOfStock);
      expect(decideBuyRoute(product: _product(mode: CatalogPurchaseMode.internalCod, priceKnown: false), preview: false), BuyRoute.unavailable);
      expect(decideBuyRoute(product: _product(mode: CatalogPurchaseMode.internalCod, stock: 3), preview: false), BuyRoute.inApp);
    });

    test('canOrderInMira follows mode, price and stock', () {
      expect(_product().canOrderInMira, isFalse);
      expect(_product(mode: CatalogPurchaseMode.internalCod).canOrderInMira, isTrue);
      expect(_product(mode: CatalogPurchaseMode.internalCod, stock: 0).canOrderInMira, isFalse);
      expect(_product(mode: CatalogPurchaseMode.internalCod, price: 0).canOrderInMira, isFalse);
    });
  });

  test('share text links a real record and never links a preview', () {
    final real = discoverShareText(_slide(_product()));
    expect(real, contains('/discover/product/prod-1'));
    expect(real, contains('منتج اختبار'));
    final preview = discoverShareText(_slide(_product(), preview: true));
    expect(preview, isNot(contains('/discover/')));
  });

  testWidgets('preview buy shows the preview message and never the appointment message', (tester) async {
    final client = _FakeCommerce();
    await _pump(tester, _slide(_product(mode: CatalogPurchaseMode.internalCod), preview: true), client);
    await tester.tap(find.text('اشتري الآن'));
    await tester.pump();
    expect(find.text(MarketplaceCopy.previewBuy), findsOneWidget);
    expect(find.textContaining('لم يُرسل طلب موعد'), findsNothing);
    expect(client.calls, isEmpty);
  });

  testWidgets('internal_cod buy adds to the cart and offers the cart, no external link', (tester) async {
    final client = _FakeCommerce();
    await _pump(tester, _slide(_product(mode: CatalogPurchaseMode.internalCod, stock: 5)), client);
    expect(find.text(MarketplaceCopy.addToCart), findsOneWidget);
    await tester.tap(find.text(MarketplaceCopy.addToCart));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(client.calls, ['add:prod-1:1']);
    expect(find.text(MarketplaceCopy.addedToCart), findsOneWidget);
    expect(find.text(MarketplaceCopy.viewCart), findsOneWidget);
    expect(find.textContaining('لم يُرسل طلب موعد'), findsNothing);
    expect(find.textContaining('ليس شراءً مكتملًا'), findsNothing);
  });

  testWidgets('internal_cod buy asks for login instead of failing silently', (tester) async {
    final client = _FakeCommerce(signedIn: false);
    await _pump(tester, _slide(_product(mode: CatalogPurchaseMode.internalCod)), client);
    await tester.tap(find.text(MarketplaceCopy.addToCart));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text(MarketplaceCopy.loginRequiredCart), findsOneWidget);
    expect(client.calls, isEmpty);
  });

  testWidgets('out of stock is stated and nothing is added', (tester) async {
    final client = _FakeCommerce();
    await _pump(tester, _slide(_product(mode: CatalogPurchaseMode.internalCod, stock: 0)), client);
    await tester.tap(find.text(MarketplaceCopy.addToCart));
    await tester.pump();
    expect(find.text(MarketplaceCopy.outOfStock), findsOneWidget);
    expect(client.calls, isEmpty);
  });

  testWidgets('external buy opens the link with an honest toast and never touches the cart', (tester) async {
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/url_launcher'),
      (call) async => true,
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('plugins.flutter.io/url_launcher'), null);
    });
    final client = _FakeCommerce();
    await _pump(tester, _slide(_product()), client);
    await tester.tap(find.text('اشتري الآن'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.textContaining('ليس شراءً مكتملًا'), findsOneWidget);
    expect(client.calls, isEmpty);
  });

  testWidgets('a cart from another store shows the Arabic conflict dialog and does not replace silently', (tester) async {
    final client = _FakeCommerce(conflictOnce: true);
    final opened = await _pump(tester, _slide(_product(mode: CatalogPurchaseMode.internalCod)), client);
    await tester.tap(find.text(MarketplaceCopy.addToCart));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text(MarketplaceCopy.cartPartnerConflictTitle), findsOneWidget);
    expect(find.text(MarketplaceCopy.cartPartnerConflictBody), findsOneWidget);
    expect(find.text(MarketplaceCopy.cartPartnerConflictKeep), findsOneWidget);
    expect(find.text(MarketplaceCopy.cartPartnerConflictReplace), findsOneWidget);
    expect(client.calls, ['add:prod-1:1'], reason: 'the cart is untouched until the customer chooses');

    await tester.tap(find.text(MarketplaceCopy.cartPartnerConflictKeep));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(client.calls, ['add:prod-1:1']);
    expect(opened, contains(AppRoutes.cart));
  });

  testWidgets('choosing to replace the cart clears it and then adds the product', (tester) async {
    final client = _FakeCommerce(conflictOnce: true);
    await _pump(tester, _slide(_product(mode: CatalogPurchaseMode.internalCod)), client);
    await tester.tap(find.text(MarketplaceCopy.addToCart));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text(MarketplaceCopy.cartPartnerConflictReplace));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(client.calls, ['add:prod-1:1', 'clear', 'add:prod-1:1']);
    expect(find.text(MarketplaceCopy.addedToCart), findsOneWidget);
  });
}
