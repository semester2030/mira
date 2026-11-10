import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/network/api_client.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_favorite_client.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/data/repositories/marketplace_repository_impl.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

import 'discover_fonts.dart';

class _NoopFavorites extends DiscoverFavoriteClient {
  @override
  String? get accountKey => 'e3-app';

  @override
  bool get readFailed => false;

  @override
  bool saved(String kind, String id) => false;

  @override
  bool saving(String kind, String id) => false;

  @override
  Future<void> refresh() async {}

  @override
  Future<void> set({required String kind, required String id, required bool saved}) async {}

  @override
  Future<bool> toggle({required String kind, required String id}) async => false;
}

Future<void> _pumpFrames(WidgetTester tester, int n) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 40));
  }
}

Future<void> _flushHttp(WidgetTester tester, {int rounds = 12, int ms = 150}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration(milliseconds: ms));
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }
}

List<String?> _visibleTexts(WidgetTester tester) {
  return find
      .byType(Text)
      .evaluate()
      .map((e) => (e.widget as Text).data)
      .where((t) => t != null && t!.trim().isNotEmpty)
      .toList();
}


Future<bool> _swipeUntilText(
  WidgetTester tester,
  String text, {
  int maxPages = 12,
}) async {
  for (var i = 0; i < maxPages; i++) {
    if (find.text(text).evaluate().isNotEmpty) return true;
    await tester.drag(find.byType(PageView).first, const Offset(0, -600));
    await _flushHttp(tester, rounds: 4, ms: 80);
    await _pumpFrames(tester, 20);
  }
  return find.text(text).evaluate().isNotEmpty;
}

Future<bool> _waitForFile(String path, {Duration timeout = const Duration(seconds: 45)}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    if (File(path).existsSync()) return true;
    await Future<void>.delayed(const Duration(milliseconds: 150));
  }
  return File(path).existsSync();
}

void main() {
  final binding = LiveTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;
  HttpOverrides.global = null;
  setUpAll(loadDiscoverFonts);
  tearDown(() {
    ApiClient.reset();
  });

  testWidgets('E3 open-screen refresh via live HTTP + lifecycle (no cache clear / no inject)', (
    tester,
  ) async {
    final seedPath = Platform.environment['E3_APP_SCREEN_SEED'];
    expect(seedPath, isNotNull, reason: 'E3_APP_SCREEN_SEED required');
    final seed = jsonDecode(File(seedPath!).readAsStringSync()) as Map<String, dynamic>;
    final apiRoot = seed['apiRoot'] as String;
    final productId = seed['productId'] as String;
    final partnerId = seed['partnerId'] as String?;
    final nameAr = seed['nameAr'] as String;
    final nameArAfter = seed['nameArAfter'] as String;
    final defsAtOpen = '${seed['definitionsVersionAtOpen']}';
    final defsAfterRefresh = '${seed['definitionsVersionAfterRefresh']}';
    final clothesLabelAtOpen = seed['clothesLabelAtOpen'] as String;
    final clothesLabelAfter = seed['clothesLabelAfterRefresh'] as String;
    final refreshMarkerPath = seed['refreshMarkerPath'] as String;
    final refreshDonePath = seed['refreshDonePath'] as String;

    final base = apiRoot.endsWith('/api/v1') ? apiRoot : '$apiRoot/api/v1';
    final browseQueries = <Map<String, dynamic>>[];
    final dio = Dio(
      BaseOptions(
        baseUrl: base,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Accept': 'application/json'},
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.contains('/marketplace/catalog') ||
              options.path.contains('/marketplace/browse') ||
              options.uri.path.contains('catalog') ||
              options.uri.path.contains('browse')) {
            browseQueries.add({
              'path': options.uri.path,
              'query': Map<String, dynamic>.from(options.queryParameters),
              'at': DateTime.now().toIso8601String(),
            });
          }
          handler.next(options);
        },
      ),
    );
    ApiClient.reset();
    ApiClient.debugDioOverride = dio;

    late final bool loaded;
    late final String? versionAtOpen;
    late final MarketplaceRepositoryImpl gateway;
    late final bool preBrowseOk;

    await tester.runAsync(() async {
      loaded = await EleganceTaxonomySource.ensureLoaded(dio: dio);
      versionAtOpen = EleganceTaxonomySource.definitionsVersion;
      gateway = MarketplaceRepositoryImpl(
        api: MarketplaceApiDataSource(dio: dio),
        useServer: true,
      );
      final preBrowse = await gateway.browse(
        DiscoverCatalogQuery(
          categoryId: 'clothes',
          subcategoryId: 'clothes.evening',
          lane: DiscoverLane.elegance,
          partnerId: partnerId,
        ),
      );
      preBrowseOk = !preBrowse.failed && preBrowse.items.any((o) => o.id == productId);
    });

    expect(loaded, isTrue, reason: 'live taxonomy HTTP must succeed');
    expect(versionAtOpen, defsAtOpen, reason: 'screen must open on the first definitions version');
    expect(
      EleganceTaxonomySource.nodes.any((n) => n.id == 'clothes' && n.labelAr == clothesLabelAtOpen),
      isTrue,
    );
    expect(gateway.serverEnabled, isTrue);
    expect(preBrowseOk, isTrue, reason: 'live catalog HTTP must include portal product');

    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        locale: const Locale('ar'),
        builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
        home: DiscoverPresentationScreen(
          lane: DiscoverLane.elegance,
          gateway: gateway,
          favorites: _NoopFavorites(),
        ),
      ),
    );

    await _flushHttp(tester, rounds: 16, ms: 120);
    await _pumpFrames(tester, 30);

    expect(EleganceTaxonomySource.definitionsVersion, defsAtOpen);
    if (find.text(clothesLabelAtOpen).evaluate().isEmpty) {
      fail('open label "$clothesLabelAtOpen" missing. visible=${_visibleTexts(tester)}');
    }
    await tester.ensureVisible(find.text(clothesLabelAtOpen).last);
    await tester.tap(find.text(clothesLabelAtOpen).last);
    await _flushHttp(tester, rounds: 8, ms: 100);
    await _pumpFrames(tester, 40);

    var eveningSelected = false;
    if (find.text('فساتين سهرة').evaluate().isNotEmpty) {
      await tester.ensureVisible(find.text('فساتين سهرة'));
      await tester.tap(find.text('فساتين سهرة'), warnIfMissed: false);
      await _flushHttp(tester, rounds: 10, ms: 120);
      await _pumpFrames(tester, 50);
      eveningSelected = true;
    }
    expect(eveningSelected, isTrue, reason: 'filter UI must select subcategory before refresh');

    // Product must already be on the filtered feed — swipe within results only (no search).
    final sawPortal = await _swipeUntilText(tester, nameAr);
    expect(
      sawPortal,
      isTrue,
      reason: 'portal product must appear via selected filters before refresh; visible=${_visibleTexts(tester)}',
    );

    final queriesBeforeRefresh = List<Map<String, dynamic>>.from(browseQueries);
    final hadEveningQuery = queriesBeforeRefresh.any((q) {
      final query = q['query'] as Map<String, dynamic>? ?? const {};
      final sub = '${query['subcategory'] ?? query['subcategoryId'] ?? ''}';
      final cat = '${query['category'] ?? query['categoryId'] ?? ''}';
      return cat.contains('clothes') && sub.contains('clothes.evening');
    });
    expect(hadEveningQuery, isTrue, reason: 'actual browse request must carry clothes + evening filters');

    File(refreshMarkerPath).writeAsStringSync(
      jsonEncode({
        'ready': true,
        'versionAtOpen': versionAtOpen,
        'eveningSelected': eveningSelected,
        'at': DateTime.now().toIso8601String(),
      }),
    );

    late final bool bumped;
    await tester.runAsync(() async {
      bumped = await _waitForFile(refreshDonePath);
    });
    expect(bumped, isTrue, reason: 'server must finish mid-session bump while screen is open');

    final done = jsonDecode(File(refreshDonePath).readAsStringSync()) as Map<String, dynamic>;
    expect('${done['definitionsVersion']}', defsAfterRefresh);

    // Real lifecycle path (same handler as production resume) — not a debug hook.
    binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await _flushHttp(tester, rounds: 24, ms: 120);
    await _pumpFrames(tester, 80);

    expect(
      EleganceTaxonomySource.definitionsVersion,
      defsAfterRefresh,
      reason: 'definitionsVersion must transition while screen stays open',
    );
    expect(
      EleganceTaxonomySource.nodes.any((n) => n.id == 'clothes' && n.labelAr == clothesLabelAfter),
      isTrue,
      reason: 'refreshed taxonomy label must load without clearCache/replaceForTest',
    );
    expect(
      EleganceTaxonomySource.nodes.any((n) => n.id == 'clothes.evening' && n.active),
      isFalse,
      reason: 'deactivated subcategory must disappear from live taxonomy',
    );

    expect(find.text(clothesLabelAfter), findsWidgets, reason: 'compatible clothes filter remains on rail');
    expect(
      find.text('فساتين سهرة').evaluate().isEmpty,
      isTrue,
      reason: 'incompatible evening subcategory must be cleared after refresh',
    );

    // New product name must appear without search fallback; old name alone is not enough.
    final sawUpdated = await _swipeUntilText(tester, nameArAfter);
    expect(
      sawUpdated,
      isTrue,
      reason: 'refreshed catalog must show the updated product name on the open screen; visible=${_visibleTexts(tester)}',
    );
    expect(
      find.text(nameAr).evaluate().isEmpty || find.text(nameArAfter).evaluate().isNotEmpty,
      isTrue,
    );

    final queriesAfterRefresh = browseQueries.skip(queriesBeforeRefresh.length).toList();
    final postRefreshClearedEvening = queriesAfterRefresh.any((q) {
      final query = q['query'] as Map<String, dynamic>? ?? const {};
      final sub = '${query['subcategory'] ?? query['subcategoryId'] ?? ''}';
      final cat = '${query['category'] ?? query['categoryId'] ?? ''}';
      return cat.contains('clothes') && sub.isEmpty;
    });
    expect(
      postRefreshClearedEvening,
      isTrue,
      reason: 'post-refresh browse must keep clothes and drop evening subcategory',
    );

    // No broad NetworkImage/404 swallow — unexpected errors fail acceptance.
    expect(tester.takeException(), isNull, reason: 'Unexpected Flutter error fails acceptance');

    final outPath = seed['resultPath'] as String?;
    if (outPath != null) {
      File(outPath).writeAsStringSync(
        jsonEncode({
          'ok': true,
          'productId': productId,
          'nameAr': nameAr,
          'nameArAfter': nameArAfter,
          'definitionsVersionAtOpen': defsAtOpen,
          'definitionsVersionAfterRefresh': EleganceTaxonomySource.definitionsVersion,
          'versionAtOpen': versionAtOpen,
          'screenSawProduct': true,
          'screenSawUpdatedProduct': find.text(nameArAfter).evaluate().isNotEmpty,
          'initialDefinitionsLoaded': versionAtOpen == defsAtOpen,
          'refreshWhileOpenVerified': EleganceTaxonomySource.definitionsVersion == defsAfterRefresh,
          'filterUiTransitionVerified':
              find.text(clothesLabelAfter).evaluate().isNotEmpty &&
              find.text('فساتين سهرة').evaluate().isEmpty &&
              postRefreshClearedEvening,
          'browseQueriesBefore': queriesBeforeRefresh,
          'browseQueriesAfter': queriesAfterRefresh,
          'catalogSource': 'live-http-marketplace-repository',
          'taxonomySource': 'live-http-ensureLoaded+lifecycle-resume-reload',
          'apiBase': base,
          'replaceForTestUsed': false,
          'cacheCleared': false,
          'appRelaunched': false,
          'debugRefreshUsed': false,
          'searchFallbackUsed': false,
          'preBrowseSawProduct': true,
          'knownOutOfScopeExceptions': <String>[],
        }),
      );
    }

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 400));
    });
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull, reason: 'Unexpected dispose error fails acceptance');
  });
}
