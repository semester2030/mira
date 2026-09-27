import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:async';

import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/data/repositories/marketplace_repository_impl.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/features/marketplace/data/discover_favorite_client.dart';
import 'package:mirra/shared/theme/theme.dart';

import 'discover_fonts.dart';

class _FakeFavoriteClient extends DiscoverFavoriteClient {
  _FakeFavoriteClient({required this.accountKeyValue, this.initial = const {}}) {
    _saved.addAll(initial);
  }

  final String accountKeyValue;
  final Set<String> initial;
  final _saved = <String>{};
  final _saving = <String>{};

  @override
  String? get accountKey => accountKeyValue;

  @override
  bool get readFailed => false;

  @override
  bool saved(String kind, String id) => _saved.contains('$kind:$id');

  @override
  bool saving(String kind, String id) => _saving.contains('$kind:$id');

  @override
  Future<void> refresh() async {}

  @override
  Future<void> set({required String kind, required String id, required bool saved}) async {
    final key = '$kind:$id';
    if (saved) {
      _saved.add(key);
    } else {
      _saved.remove(key);
    }
    notifyListeners();
  }

  @override
  Future<bool> toggle({required String kind, required String id}) async {
    final key = '$kind:$id';
    _saving.add(key);
    notifyListeners();
    await Future<void>.delayed(Duration.zero);
    _saving.remove(key);
    if (_saved.contains(key)) {
      _saved.remove(key);
      notifyListeners();
      return false;
    }
    _saved.add(key);
    notifyListeners();
    return true;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadDiscoverFonts);

  testWidgets('catalog search, empty state, and store stay on the same ids', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        locale: const Locale('ar'),
        builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
        home: DiscoverPresentationScreen(gateway: MarketplaceRepositoryImpl(useServer: false)),
      ),
    );
    await tester.pumpAndSettle();
    final first = DiscoverCatalogQueryEngine.page(DiscoverCatalogQueryEngine.localOffers(), limit: 4).items.first;
    expect(find.text(first.nameAr), findsOneWidget);
    expect(find.text('عرض معاينة'), findsNothing);
    await _shot(tester, 'catalog-feed');

    await tester.enterText(find.byType(TextField), 'مكياج');
    await tester.pumpAndSettle();
    expect(find.text('مكياج مناسبة + عناية'), findsOneWidget);
    expect(find.text('سيروم فيتامين C'), findsNothing);
    await _shot(tester, 'search-makeup');

    await tester.enterText(find.byType(TextField), 'لا-نتيجة-بهذا-النص');
    await tester.pumpAndSettle();
    expect(find.textContaining('لا توجد نتائج'), findsOneWidget);
    await _shot(tester, 'empty-results');

    await tester.enterText(find.byType(TextField), 'سيروم');
    await tester.pumpAndSettle();
    expect(find.text('سيروم فيتامين C'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.tune));
    await tester.pumpAndSettle();
    expect(find.text('كل الأنواع'), findsOneWidget);
    expect(find.text('جدة'), findsOneWidget);
    await _shot(tester, 'filters');
    await tester.tap(find.text('كل الأنواع'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('المتجر'));
    await tester.pumpAndSettle();
    expect(find.text('لوريال باريس'), findsWidgets);
    expect(find.text('مكياج مناسبة + عناية'), findsNothing);
    await _shot(tester, 'store-loreal');
  });

  testWidgets('server entry shows loading, then the response, and not an older one', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    expect(find.text('جاري تحميل الكتالوج'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.textContaining('لا توجد نتائج'), findsNothing);
    final offer = DiscoverCatalogQueryEngine.localOffers().first;
    gateway.pending.first.complete(_ok([offer]));
    await tester.pumpAndSettle();
    expect(find.text(offer.nameAr), findsOneWidget);
    await _shot(tester, 'server-loaded');

    void search(String value) {
      final field = tester.widget<TextField>(find.byType(TextField));
      field.onChanged!(value);
    }

    search('قديم');
    await tester.pump();
    search('مكياج');
    await tester.pump();
    final stale = DiscoverCatalogQueryEngine.localOffers().firstWhere((item) => item.nameAr != offer.nameAr && item.id != 's-glam-makeup');
    final makeup = DiscoverCatalogQueryEngine.localOffers().firstWhere((item) => item.id == 's-glam-makeup');
    gateway.pending[1].complete(_ok([stale]));
    await tester.pump();
    expect(find.text(stale.nameAr), findsNothing);
    expect(find.text('جاري تحميل الكتالوج'), findsOneWidget);
    gateway.pending[2].complete(_ok([makeup]));
    await tester.pumpAndSettle();
    expect(find.text(makeup.nameAr), findsOneWidget);
    expect(find.text(stale.nameAr), findsNothing);
  });

  testWidgets('a failed catalog load is not an empty page, and retry can be empty', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    await _shot(tester, 'catalog-loading');
    gateway.pending.first.complete(const DiscoverBrowseResponse(failed: true));
    await tester.pumpAndSettle();
    expect(find.text('تعذر تحميل الكتالوج'), findsOneWidget);
    expect(find.textContaining('لا توجد نتائج'), findsNothing);
    await _shot(tester, 'catalog-error');
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pump();
    gateway.pending.last.complete(_ok(const []));
    await tester.pumpAndSettle();
    expect(find.textContaining('لا توجد نتائج'), findsOneWidget);
  });

  testWidgets('details, appointment, and favorite describe the real outcome', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    final service = DiscoverCatalogQueryEngine.localOffers().firstWhere((item) => item.kind == 'service');
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    gateway.pending.first.complete(_ok([service]));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.favorite_border));
    await tester.pump();
    expect(find.textContaining('يلزم تسجيل الدخول'), findsOneWidget);
    await tester.tap(find.text('التفاصيل'));
    await tester.pumpAndSettle();
    expect(find.textContaining('غير متاح أو لم يعد منشورًا'), findsOneWidget);
    expect(find.textContaining('التطابق'), findsNothing);
    await _shot(tester, 'details-missing');
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text(service.nameAr), findsOneWidget);
  });

  testWidgets('typing while the first response is pending keeps the search field', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    expect(find.byType(TextField), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'م');
    await tester.pump();
    expect(find.byType(TextField), findsOneWidget);
    final offer = DiscoverCatalogQueryEngine.localOffers().first;
    gateway.pending.first.complete(_ok([offer]));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('saved favorite shows a filled heart for a signed-in account', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    final offer = DiscoverCatalogQueryEngine.localOffers().first;
    final favorites = _FakeFavoriteClient(
      accountKeyValue: 'user-rc3',
      initial: {'${offer.kind}:${offer.id}'},
    );
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway, favorites: favorites)));
    await tester.pump();
    gateway.pending.first.complete(_ok([offer]));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.favorite), findsWidgets);
    expect(find.text('8900'), findsNothing);
    expect(find.textContaining('89'), findsWidgets);
  });

  testWidgets('appointment says the operational request is unavailable', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    final service = DiscoverCatalogQueryEngine.localOffers().firstWhere((item) => item.kind == 'service');
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    gateway.pending.first.complete(_ok([service]));
    await tester.pumpAndSettle();
    await tester.tap(find.text('اطلبي موعدًا'));
    await tester.pump();
    expect(find.textContaining('طلب الموعد غير متاح'), findsOneWidget);
    expect(find.textContaining('سُجّل طلب الموعد'), findsNothing);
    expect(find.textContaining('سيُفعّل'), findsNothing);
  });

  testWidgets('a vertical drag keeps one search field', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _HoldGateway();
    final offers = DiscoverCatalogQueryEngine.localOffers().take(2).toList();
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    expect(find.byType(TextField), findsOneWidget);
    gateway.pending.first.complete(_ok(offers));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
    await tester.drag(find.byType(PageView).first, const Offset(0, -280));
    await tester.pump();
    expect(find.byType(TextField), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.enterText(find.byType(TextField), 'م');
    await tester.pump();
    expect(find.byType(TextField), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller?.text, 'م');
    final before = tester.getRect(find.byType(TextField));
    final gesture = await tester.startGesture(const Offset(200, 700));
    await gesture.moveBy(const Offset(0, -180));
    await tester.pump();
    expect(tester.getRect(find.byType(TextField)).top, before.top);
    expect(find.byType(TextField), findsOneWidget);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byType(TextField)).top, before.top);
    expect(tester.takeException(), isNull);
  });

  testWidgets('search stays fixed through loading, empty, and failure', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    tester.view.devicePixelRatio = 1;
    tester.view.padding = const FakeViewPadding(top: 47);
    addTearDown(() {
      tester.view.resetPadding();
      tester.binding.setSurfaceSize(null);
    });
    final gateway = _HoldGateway();
    final offers = DiscoverCatalogQueryEngine.localOffers().take(2).toList();
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway)));
    await tester.pump();
    expect(find.text('جاري تحميل الكتالوج'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    final loading = tester.getRect(find.byType(TextField));
    await _shot(tester, 'rc5-search-loading');
    await tester.tap(find.byType(TextField));
    await tester.pump();
    gateway.pending.first.complete(_ok(offers));
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byType(TextField)).top, loading.top);
    expect(tester.widget<TextField>(find.byType(TextField)).focusNode?.hasFocus, isTrue);
    await tester.enterText(find.byType(TextField), 'ع');
    await tester.pump();
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.controller?.text, 'ع');
    expect(field.controller?.selection.extentOffset, 1);
    expect(tester.getRect(find.byType(TextField)).top, loading.top);
    expect(find.text('جاري تحميل الكتالوج'), findsOneWidget);
    gateway.pending.last.complete(_ok(const []));
    await tester.pumpAndSettle();
    expect(find.textContaining('لا توجد نتائج'), findsOneWidget);
    expect(tester.getRect(find.byType(TextField)).top, loading.top);
    expect(tester.widget<TextField>(find.byType(TextField)).controller?.text, 'ع');
    expect(tester.widget<TextField>(find.byType(TextField)).focusNode?.hasFocus, isTrue);
    await _shot(tester, 'rc5-search-empty');
    await tester.enterText(find.byType(TextField), 'فشل');
    await tester.pump();
    gateway.pending.last.complete(const DiscoverBrowseResponse(failed: true, transport: CatalogTransport.server));
    await tester.pumpAndSettle();
    expect(find.textContaining('تعذر تحميل الكتالوج'), findsOneWidget);
    expect(tester.getRect(find.byType(TextField)).top, loading.top);
    await _shot(tester, 'rc5-search-failed');
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pump();
    gateway.pending.last.complete(_ok(offers));
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byType(TextField)).top, loading.top);
    expect(find.byType(TextField), findsOneWidget);
    expect(tester.takeException(), isNull);
    await _shot(tester, 'rc5-search-results');
  });

  testWidgets('favorite read retry clears the error', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final transport = _FavoriteTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    addTearDown(() async {
      client.dispose();
      await accounts.close();
    });
    accounts.add('A');
    final gateway = _HoldGateway();
    await tester.pumpWidget(_app(DiscoverPresentationScreen(gateway: gateway, favorites: client)));
    await tester.pump();
    expect(transport.pendingLists, isNotEmpty);
    transport.pendingLists.last.completeError(Exception('read failed'));
    await tester.pump();
    await tester.pump();
    expect(client.readFailed, isTrue);
    expect(find.text('تعذر قراءة المفضلة'), findsWidgets);
    expect(client.readFailed, isTrue);
    await tester.tap(find.widgetWithText(TextButton, 'إعادة قراءة المفضلة').first);
    await tester.pump();
    transport.pendingLists.last.complete(<String>{});
    await tester.pump();
    await tester.pump();
    expect(client.readFailed, isFalse);
    expect(client.saved('product', 'missing'), isFalse);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('تعذر قراءة المفضلة'), findsNothing);
  });
}

Widget _app(Widget home) {
  return MaterialApp(
    theme: AppTheme.lightTheme,
    locale: const Locale('ar'),
    builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
    home: home,
  );
}

DiscoverBrowseResponse _ok(List<DiscoverOffer> items) {
  return DiscoverBrowseResponse(
    failed: false,
    transport: CatalogTransport.server,
    contentMark: ContentMark.unmarked,
    items: items,
  );
}

class _FavoriteTransport implements DiscoverFavoriteTransport {
  final pendingLists = <Completer<Set<String>>>[];

  @override
  Future<Set<String>> listFavoriteKeys() {
    final gate = Completer<Set<String>>();
    pendingLists.add(gate);
    return gate.future;
  }

  @override
  Future<void> setFavorite({required String kind, required String id, required bool saved}) async {}
}

class _HoldGateway implements DiscoverCatalogGateway {
  final pending = <Completer<DiscoverBrowseResponse>>[];

  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(DiscoverCatalogQuery query, {String? cursor, int limit = 4}) {
    final completer = Completer<DiscoverBrowseResponse>();
    pending.add(completer);
    return completer.future;
  }

  @override
  Future<CatalogRecordResult> loadRecord({required String kind, required String id, required CatalogTransport? transport}) async {
    return const CatalogRecordResult(status: CatalogRecordStatus.missing);
  }

  @override
  Future<DiscoverAdFeed> publishedAds() async => DiscoverAdFeed.empty;
}

Future<void> _shot(WidgetTester tester, String name) async {
  if (find.byType(Image).evaluate().isNotEmpty) {
    final context = tester.element(find.byType(Image).first);
    for (final image in tester.widgetList<Image>(find.byType(Image))) {
      await tester.runAsync(() => precacheImage(image.image, context));
    }
    await tester.pump();
  }
  final sheet = find.text('كل الأنواع');
  final boundary = sheet.evaluate().isEmpty
      ? tester.renderObject<RenderRepaintBoundary>(find.byType(RepaintBoundary).first)
      : tester.renderObject<RenderRepaintBoundary>(
          find.ancestor(of: sheet, matching: find.byType(RepaintBoundary)).last,
        );
  final bytes = await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 1);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  });
  final dir = Directory('docs/mira-commerce-reference/evidence/visual/phase2');
  dir.createSync(recursive: true);
  File('${dir.path}/$name.png').writeAsBytesSync(bytes!);
}
