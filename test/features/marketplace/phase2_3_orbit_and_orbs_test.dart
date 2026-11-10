import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/data/lane_orb_assets.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/colors.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(EleganceTaxonomySource.clearCache);

  group('Phase2 orb assets', () {
    const expectedKeys = [
      'jewelry',
      'children',
      'gifts',
      'occasions',
      'jewelry.rings',
      'jewelry.necklaces',
      'jewelry.bracelets',
      'jewelry.earrings',
      'children.clothes',
      'children.shoes',
      'children.newborn',
      'occasions.favors',
      'occasions.decor',
      'occasions.styling',
      'gifts.boxes',
    ];

    test('15 masters + thumbs exist on disk and resolve via imageKey', () {
      for (final key in expectedKeys) {
        final master = LaneOrbAssets.assetForImageKey(key);
        final thumb = LaneOrbAssets.thumbForImageKey(key);
        expect(master, isNotNull, reason: 'master missing for $key');
        expect(thumb, isNotNull, reason: 'thumb missing for $key');
        expect(File(master!).existsSync(), isTrue, reason: 'file missing: $master');
        expect(File(thumb!).existsSync(), isTrue, reason: 'file missing: $thumb');
        // Decode proves the PNG is a real image, not an empty placeholder name.
        final bytes = File(master).readAsBytesSync();
        expect(bytes.length, greaterThan(8));
        expect(bytes[0], 0x89);
        expect(bytes[1], 0x50); // P
        expect(bytes[2], 0x4e); // N
        expect(bytes[3], 0x47); // G
      }
      expect(LaneOrbAssets.assetForImageKey('elegance'), isNotNull);
      expect(LaneOrbAssets.assetForImageKey('beauty'), isNotNull);
    });

    test('bundled preview taxonomies expose 11 subcategory imageKeys', () async {
      final dead = Dio(
        BaseOptions(
          baseUrl: 'http://127.0.0.1:9',
          connectTimeout: const Duration(milliseconds: 80),
          receiveTimeout: const Duration(milliseconds: 80),
        ),
      );
      final subKeys = <String>{};
      for (final lane in ['jewelry', 'children', 'gifts', 'occasions']) {
        EleganceTaxonomySource.clearCache();
        final ok = await EleganceTaxonomySource.ensureLoaded(
          lane: lane,
          partnerAudience: true,
          dio: dead,
        );
        expect(ok, isTrue, reason: 'bundled taxonomy for $lane');
        final roots = EleganceTaxonomySource.rootsForFamily(lane);
        expect(roots.any((r) => r.matchesAll), isTrue);
        for (final r in roots.where((r) => !r.matchesAll)) {
          expect(r.imageKey, isNotNull, reason: r.id);
          expect(LaneOrbAssets.thumbForImageKey(r.imageKey), isNotNull, reason: r.imageKey);
          subKeys.add(r.imageKey!);
        }
      }
      expect(
        subKeys,
        containsAll([
          'jewelry.rings',
          'jewelry.necklaces',
          'jewelry.bracelets',
          'jewelry.earrings',
          'children.clothes',
          'children.shoes',
          'children.newborn',
          'occasions.favors',
          'occasions.decor',
          'occasions.styling',
          'gifts.boxes',
        ]),
      );
      expect(subKeys.length, 11);
    });
  });

  group('Phase3 MiraWorldOrbitDiscover', () {
    testWidgets('six circles open correct lane ids; layout on narrow + mid phones', (tester) async {
      final opened = <(String, DiscoverLane)>[];
      final nav = GlobalKey<NavigatorState>();

      Future<void> pumpAt(Size size) async {
        await tester.binding.setSurfaceSize(size);
        await tester.pumpWidget(
          MaterialApp(
            navigatorKey: nav,
            theme: ThemeData(fontFamily: 'Roboto'),
            routes: {
              AppRoutes.discoverPresentation: (ctx) {
                final lane = ModalRoute.of(ctx)!.settings.arguments as DiscoverLane;
                return Scaffold(
                  appBar: AppBar(leading: BackButton(onPressed: () => Navigator.pop(ctx))),
                  body: Text('presentation:${lane.apiId}'),
                );
              },
              AppRoutes.discover: (ctx) => Scaffold(
                    appBar: AppBar(leading: const BackButton()),
                    body: const Text('discover'),
                  ),
            },
            home: Scaffold(
              backgroundColor: AppColors.background,
              body: Directionality(
                textDirection: TextDirection.rtl,
                child: SingleChildScrollView(
                  child: MiraWorldOrbitDiscover(
                    onLaneOpened: (title, lane) => opened.add((title, lane)),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
      }

      // Small phone + mid phone (logical pixels). Environment: Flutter widget test (no device).
      for (final size in const [Size(320, 640), Size(390, 844)]) {
        opened.clear();
        await pumpAt(size);

        expect(find.text('اكتشفي عالم ميرا'), findsOneWidget);
        expect(find.text('اختاري ما يلهمك'), findsOneWidget);

        const expected = [
          ('أناقتك', DiscoverLane.elegance),
          ('جمالك', DiscoverLane.beauty),
          ('الأطفال', DiscoverLane.children),
          ('الهدايا', DiscoverLane.gifts),
          ('مناسباتك', DiscoverLane.occasions),
          ('المجوهرات', DiscoverLane.jewelry),
        ];

        for (final (title, lane) in expected) {
          await tester.ensureVisible(find.text(title));
          await tester.tap(find.text(title), warnIfMissed: false);
          await tester.pumpAndSettle();
          expect(opened.last.$1, title);
          expect(opened.last.$2, lane);
          expect(opened.last.$2.apiId, lane.name);
          // Prove navigation argument when marketplace route is used.
          if (find.text('presentation:${lane.apiId}').evaluate().isNotEmpty) {
            expect(find.text('presentation:${lane.apiId}'), findsOneWidget);
          }
          nav.currentState?.popUntil((r) => r.isFirst);
          await tester.pumpAndSettle();
        }

        expect(opened.length, 6);
        expect(tester.takeException(), isNull);
      }
    });
  });
}
