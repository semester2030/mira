import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/data/lane_orb_assets.dart';
import 'package:mirra/features/marketplace/presentation/marketplace_routes.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
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
        final bytes = File(master).readAsBytesSync();
        expect(bytes.length, greaterThan(8));
        expect(bytes[0], 0x89);
        expect(bytes[1], 0x50);
        expect(bytes[2], 0x4e);
        expect(bytes[3], 0x47);
      }
      expect(LaneOrbAssets.assetForImageKey('elegance'), isNotNull);
      expect(LaneOrbAssets.assetForImageKey('beauty'), isNotNull);
      expect(File(LaneOrbAssets.eleganceHomeOrbit).existsSync(), isTrue);
      expect(
        LaneOrbAssets.homeOrbitAssetForImageKey('elegance'),
        LaneOrbAssets.eleganceHomeOrbit,
      );
      // Non-home screens keep the previous elegance master.
      expect(
        LaneOrbAssets.assetForImageKey('elegance'),
        isNot(LaneOrbAssets.eleganceHomeOrbit),
      );
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
    testWidgets('six circles open DiscoverPresentationScreen with correct lane apiId', (tester) async {
      final opened = <(String, DiscoverLane)>[];
      final nav = GlobalKey<NavigatorState>();
      final tapRows = <String>[];

      Future<void> pumpAt(Size size) async {
        await tester.binding.setSurfaceSize(size);
        await tester.pumpWidget(
          MaterialApp(
            navigatorKey: nav,
            theme: ThemeData(fontFamily: 'Roboto'),
            onGenerateRoute: (settings) {
              if (MarketplaceRoutes.handles(settings.name)) {
                return MarketplaceRoutes.onGenerate(settings);
              }
              return null;
            },
            home: Scaffold(
              backgroundColor: AppColors.background,
              body: Directionality(
                textDirection: TextDirection.rtl,
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      const Text('نظرة سريعة'),
                      MiraWorldOrbitDiscover(
                        onLaneOpened: (title, lane) => opened.add((title, lane)),
                      ),
                      const Text('نصيحة اليوم'),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
      }

      const expected = [
        ('أناقتك', DiscoverLane.elegance),
        ('جمالك', DiscoverLane.beauty),
        ('الأطفال', DiscoverLane.children),
        ('الهدايا', DiscoverLane.gifts),
        ('مناسباتك', DiscoverLane.occasions),
        ('المجوهرات', DiscoverLane.jewelry),
      ];

      // Mid phone for navigation proof (logical pixels). Environment: Flutter widget test.
      await pumpAt(const Size(390, 844));

      expect(find.text('اكتشفي عالم ميرا'), findsOneWidget);
      expect(find.text('اختاري ما يلهمك'), findsOneWidget);
      expect(find.text('نظرة سريعة'), findsOneWidget);
      expect(find.text('نصيحة اليوم'), findsOneWidget);

      for (final (title, lane) in expected) {
        await tester.ensureVisible(find.text(title));
        await tester.tap(find.text(title));
        await tester.pumpAndSettle(const Duration(seconds: 2));

        expect(opened.isNotEmpty, isTrue, reason: 'tap did not fire for $title');
        expect(opened.last.$1, title);
        expect(opened.last.$2, lane);
        expect(opened.last.$2.apiId, lane.name);

        // Must open the real presentation destination with this lane — not hub / other lane.
        expect(
          find.byType(DiscoverPresentationScreen),
          findsOneWidget,
          reason: 'expected DiscoverPresentationScreen for $title → ${lane.apiId}',
        );
        expect(
          find.byKey(ValueKey('discover_presentation_lane_${lane.apiId}')),
          findsOneWidget,
          reason: 'lane scaffold key missing for ${lane.apiId}',
        );
        expect(
          find.text('presentation:${lane.apiId}'),
          findsOneWidget,
          reason: 'lane label missing for ${lane.apiId}',
        );
        // Wrong lane must not be visible.
        for (final other in DiscoverLane.values.where((l) => l != lane)) {
          expect(
            find.byKey(ValueKey('discover_presentation_lane_${other.apiId}')),
            findsNothing,
            reason: 'wrong lane ${other.apiId} visible while expecting ${lane.apiId}',
          );
        }

        tapRows.add('$title → ${lane.apiId} → DiscoverPresentationScreen OK');
        nav.currentState?.popUntil((r) => r.isFirst);
        await tester.pumpAndSettle();
        expect(find.byType(DiscoverPresentationScreen), findsNothing);
      }

      expect(opened.length, 6);
      expect(tester.takeException(), isNull);

      final out = File('docs/phase2_3/evidence/TAP_RESULTS.txt');
      out.parent.createSync(recursive: true);
      out.writeAsStringSync('${tapRows.join('\n')}\n');
    });

    testWidgets('capture home orbit goldens at 320x640 and 390x844', (tester) async {
      for (final size in const [Size(320, 640), Size(390, 844)]) {
        await tester.binding.setSurfaceSize(size);
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              backgroundColor: AppColors.background,
              body: Directionality(
                textDirection: TextDirection.rtl,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    width: size.width,
                    height: size.height,
                    child: const ColoredBox(
                      color: Color(0xFFF3EAF5),
                      child: SingleChildScrollView(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                        child: MiraWorldOrbitDiscover(),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('اكتشفي عالم ميرا'), findsOneWidget);
        expect(find.text('أناقتك'), findsOneWidget);
        final name = 'home_orbit_${size.width.toInt()}x${size.height.toInt()}.png';
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('goldens/$name'),
        );
      }
    });
  });
}
