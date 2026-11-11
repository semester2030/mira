import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/core/network/api_client.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_favorite_client.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/theme.dart';
import 'package:mirra/shared/widgets/premium/premium_exports.dart';

Future<void> _loadAppFonts() async {
  final loader = FontLoader('Tajawal')
    ..addFont(rootBundle.load('assets/fonts/Tajawal-Regular.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Tajawal-Medium.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Tajawal-Bold.ttf'));
  await loader.load();
}

Future<void> _lockTaxonomy(String lane, {bool partnerAudience = true}) async {
  if (lane == 'elegance') {
    EleganceTaxonomySource.replaceForTest(
      const [
        EleganceTaxonomyNode(
          id: 'elegance.all',
          labelAr: 'الكل',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
        ),
        EleganceTaxonomyNode(
          id: 'clothes',
          labelAr: 'الملابس',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
        ),
        EleganceTaxonomyNode(
          id: 'bags',
          labelAr: 'الشنط',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
        ),
        EleganceTaxonomyNode(
          id: 'shoes',
          labelAr: 'الأحذية',
          sort: 30,
          active: true,
          browseOnly: false,
          writeEnabled: true,
        ),
        EleganceTaxonomyNode(
          id: 'accessories',
          labelAr: 'الإكسسوارات',
          sort: 40,
          active: true,
          browseOnly: false,
          writeEnabled: true,
        ),
      ],
      definitionsVersion: 'phase3-elegance-lock',
      lane: 'elegance',
    );
    return;
  }
  final path = 'assets/marketplace/taxonomy/$lane-taxonomy.v1.json';
  final raw = await rootBundle.loadString(path);
  final data = jsonDecode(raw) as Map<String, dynamic>;
  final nodes = (data['nodes'] as List)
      .whereType<Map>()
      .map((e) => EleganceTaxonomyNode.fromJson(Map<String, dynamic>.from(e)))
      .toList();
  EleganceTaxonomySource.replaceForTest(
    nodes,
    definitionsVersion: data['definitionsVersion']?.toString(),
    lane: lane,
    partnerAudience: partnerAudience,
  );
}

class _EmptyCatalogGateway implements DiscoverCatalogGateway {
  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(
    DiscoverCatalogQuery query, {
    String? cursor,
    int limit = 4,
  }) async {
    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: const [],
      cities: const [],
    );
  }

  @override
  Future<CatalogRecordResult> loadRecord({
    required String kind,
    required String id,
    required CatalogTransport? transport,
  }) async {
    return const CatalogRecordResult(status: CatalogRecordStatus.missing);
  }

  @override
  Future<DiscoverAdFeed> publishedAds() async => DiscoverAdFeed.empty;
}

class _NoopFavorites extends DiscoverFavoriteClient {
  @override
  String? get accountKey => null;

  @override
  bool get readFailed => false;

  @override
  Future<void> refresh() async {}

  @override
  bool saved(String kind, String id) => false;

  @override
  bool saving(String kind, String id) => false;

  @override
  Future<void> set({required String kind, required String id, required bool saved}) async {}

  @override
  Future<bool> toggle({required String kind, required String id}) async => false;
}

Widget _dashboardOrbitHarness() {
  return MediaQuery(
    data: const MediaQueryData(disableAnimations: true),
    child: Directionality(
      textDirection: TextDirection.rtl,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SectionHeader(title: 'نظرة سريعة'),
            const SizedBox(height: 12),
            const SizedBox(height: 48, child: ColoredBox(color: Color(0x33C45B8A))),
            const SizedBox(height: 24),
            const MiraWorldOrbitDiscover(),
            const SizedBox(height: 16),
            const PremiumCard(
              child: Text('نصيحة اليوم: احرصي على شرب الماء وواقي الشمس يوميًا لبشرة أكثر إشراقًا.'),
            ),
          ],
        ),
      ),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    EleganceTaxonomySource.clearCache();
    ApiClient.debugDioOverride = null;
    imageCache.clear();
    imageCache.clearLiveImages();
  });

  testWidgets('six taps from dashboard open lane with correct branches or empty state', (tester) async {
    await _loadAppFonts();
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final nav = GlobalKey<NavigatorState>();
    final rows = <String>[];
    final gateway = _EmptyCatalogGateway();
    final favorites = _NoopFavorites();

    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: nav,
        theme: AppTheme.lightTheme,
        onGenerateRoute: (settings) {
          if (settings.name == AppRoutes.discoverPresentation && settings.arguments is DiscoverLane) {
            final lane = settings.arguments! as DiscoverLane;
            return MaterialPageRoute<void>(
              settings: settings,
              builder: (_) => DiscoverPresentationScreen(
                lane: lane,
                gateway: gateway,
                favorites: favorites,
              ),
            );
          }
          return null;
        },
        home: Scaffold(
          backgroundColor: const Color(0xFFF3EAF5),
          body: SafeArea(child: _dashboardOrbitHarness()),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    final rejectDio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1'));
    rejectDio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.cancel,
              message: 'phase2_3_test_reject',
            ),
          );
        },
      ),
    );
    ApiClient.debugDioOverride = rejectDio;

    const expected = <(String, DiscoverLane, List<String>)>[
      ('أناقتك', DiscoverLane.elegance, ['الملابس', 'الشنط', 'الأحذية', 'الإكسسوارات']),
      ('جمالك', DiscoverLane.beauty, ['العيادات', 'المشاغل']),
      ('الأطفال', DiscoverLane.children, ['ملابس أطفال', 'أحذية أطفال', 'مستلزمات مواليد']),
      ('الهدايا', DiscoverLane.gifts, ['صناديق هدايا']),
      ('مناسباتك', DiscoverLane.occasions, ['توزيعات', 'ضيافة للبيع', 'تنسيق المناسبة']),
      ('المجوهرات', DiscoverLane.jewelry, ['خواتم', 'قلائد', 'أساور', 'أقراط']),
    ];

    for (final (title, lane, branchLabels) in expected) {
      if (lane != DiscoverLane.beauty) {
        await _lockTaxonomy(lane.apiId, partnerAudience: lane.isPreviewLane);
      }

      final imageKey = switch (lane) {
        DiscoverLane.elegance => 'elegance',
        DiscoverLane.beauty => 'beauty',
        DiscoverLane.children => 'children',
        DiscoverLane.gifts => 'gifts',
        DiscoverLane.occasions => 'occasions',
        DiscoverLane.jewelry => 'jewelry',
      };
      final orb = find.byKey(ValueKey('home-orb-$imageKey'));
      await tester.ensureVisible(orb);
      await tester.tap(orb);
      await tester.pump();
      // Orbit opens after ~150ms press settle (motion merge); allow margin.
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byType(DiscoverPresentationScreen), findsOneWidget, reason: title);
      expect(find.byKey(ValueKey('discover_presentation_lane_${lane.apiId}')), findsOneWidget);

      var foundAny = false;
      var emptyOk = false;
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
        foundAny = branchLabels.any((l) => find.text(l).evaluate().isNotEmpty);
        emptyOk = find.textContaining('لا توجد عروض').evaluate().isNotEmpty ||
            find.textContaining('لا توجد نتائج').evaluate().isNotEmpty ||
            find.textContaining('تعذر تحميل').evaluate().isNotEmpty;
        if (foundAny || emptyOk) break;
      }

      expect(
        foundAny || emptyOk,
        isTrue,
        reason: '$title → ${lane.apiId}: expected branches $branchLabels or empty/error state',
      );

      if (lane == DiscoverLane.jewelry) {
        expect(find.text('ملابس أطفال'), findsNothing);
        expect(find.text('صناديق هدايا'), findsNothing);
      }
      if (lane == DiscoverLane.children) {
        expect(find.text('خواتم'), findsNothing);
        expect(find.text('صناديق هدايا'), findsNothing);
      }
      if (lane == DiscoverLane.gifts) {
        expect(find.text('خواتم'), findsNothing);
        expect(find.text('ملابس أطفال'), findsNothing);
      }
      if (lane == DiscoverLane.occasions) {
        expect(find.text('خواتم'), findsNothing);
      }
      if (lane == DiscoverLane.elegance || lane == DiscoverLane.beauty) {
        expect(find.text('خواتم'), findsNothing);
        expect(find.text('ملابس أطفال'), findsNothing);
      }

      final visibleBranches = branchLabels.where((l) => find.text(l).evaluate().isNotEmpty).toList();
      final content = visibleBranches.isNotEmpty
          ? 'branches=${visibleBranches.join(",")}'
          : (emptyOk ? 'empty_state' : 'lane_screen_only');
      rows.add('$title | ${lane.apiId} | DiscoverPresentationScreen | $content | PASS');

      // Pop presentation; avoid pumpAndSettle (logo fill loop is infinite when animations on).
      expect(nav.currentState?.canPop(), isTrue, reason: '$title stack');
      nav.currentState!.pop();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      if (find.byType(DiscoverPresentationScreen).evaluate().isNotEmpty) {
        nav.currentState?.popUntil((r) => r.isFirst);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 400));
      }
      expect(find.byType(DiscoverPresentationScreen), findsNothing, reason: '$title after pop');
    }

    File('docs/phase2_3/evidence/TAP_CONTENT_RESULTS.txt').writeAsStringSync('${rows.join('\n')}\n');
    expect(rows.length, 6);
  });
}
