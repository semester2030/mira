import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/data/lane_orb_assets.dart';
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

/// Mirrors DashboardScreen orbit placement: after نظرة سريعة, before نصيحة اليوم.
Widget _dashboardOrbitHarness({Key? orbitKey}) {
  return Directionality(
    textDirection: TextDirection.rtl,
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionHeader(title: 'نظرة سريعة'),
          const SizedBox(height: 12),
          SizedBox(
            height: 72,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: const [
                SizedBox(width: 96, child: ColoredBox(color: Color(0x33C45B8A))),
                SizedBox(width: 12),
                SizedBox(width: 96, child: ColoredBox(color: Color(0x33C45B8A))),
              ],
            ),
          ),
          const SizedBox(height: 24),
          MiraWorldOrbitDiscover(key: orbitKey),
          const SizedBox(height: 16),
          const PremiumCard(
            child: Text('نصيحة اليوم: احرصي على شرب الماء وواقي الشمس يوميًا لبشرة أكثر إشراقًا.'),
          ),
        ],
      ),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    EleganceTaxonomySource.clearCache();
    imageCache.clear();
    imageCache.clearLiveImages();
  });

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
      expect(File(LaneOrbAssets.eleganceHomeOrbit).existsSync(), isTrue);
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
        for (final r in roots.where((r) => !r.matchesAll)) {
          expect(r.imageKey, isNotNull, reason: r.id);
          subKeys.add(r.imageKey!);
        }
      }
      expect(subKeys.length, greaterThanOrEqualTo(11));
    });
  });

  group('Phase3 DashboardScreen orbit', () {
    Future<void> assertDashboardLayout(WidgetTester tester, Size size) async {
      final outDir = Directory('docs/phase2_3/evidence/screenshots');
      outDir.createSync(recursive: true);

      const orbitKeys = ['elegance', 'beauty', 'children', 'gifts', 'occasions', 'jewelry'];
      for (final k in orbitKeys) {
        final path = LaneOrbAssets.homeOrbitAssetForImageKey(k)!;
        final data = await rootBundle.load(path);
        expect(data.lengthInBytes, greaterThan(1000), reason: path);
      }

      await tester.binding.setSurfaceSize(size);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            backgroundColor: const Color(0xFFF3EAF5),
            body: SafeArea(child: _dashboardOrbitHarness()),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('اكتشفي عالم ميرا'), findsOneWidget);
      expect(find.text('اختاري ما يلهمك'), findsOneWidget);
      expect(find.text('نظرة سريعة'), findsOneWidget);
      expect(find.textContaining('نصيحة اليوم'), findsOneWidget);

      // RTL row order: أناقتك then جمالك then peek of المجوهرات.
      const titles = ['أناقتك', 'جمالك', 'المجوهرات', 'مناسباتك', 'الهدايا', 'الأطفال'];
      for (final t in titles) {
        expect(find.text(t), findsWidgets, reason: 'missing label $t at $size');
        final text = tester.widget<Text>(find.text(t).first);
        expect(text.data, t);
        final box = tester.getSize(find.text(t).first);
        expect(box.width, greaterThan(20), reason: 'label width suggests missing glyphs: $t @$size');
      }
      expect(find.byType(Image), findsAtLeastNWidgets(6));
      expect(find.byType(MiraWorldOrbitDiscover), findsOneWidget);

      final eleganceOrb = find.byKey(const ValueKey('home-orb-elegance'));
      final beautyOrb = find.byKey(const ValueKey('home-orb-beauty'));
      final jewelryOrb = find.byKey(const ValueKey('home-orb-jewelry'));
      final eleganceImg = tester.getSize(
        find.descendant(of: eleganceOrb, matching: find.byType(Image)).first,
      );
      expect(eleganceImg.width, closeTo(eleganceImg.height, 0.5), reason: '1:1 circle @$size');
      expect(eleganceImg.width / size.width, greaterThan(0.30), reason: 'large circles ~40% @$size');

      final elegance = tester.getRect(eleganceOrb);
      final beauty = tester.getRect(beautyOrb);
      final jewelry = tester.getRect(jewelryOrb);
      // RTL: أناقتك on the right, جمالك beside it, المجوهرات peeks at the left.
      expect(elegance.right, greaterThan(beauty.right));
      expect(jewelry.right, lessThan(beauty.left + 1));
      expect(jewelry.right, greaterThan(0), reason: 'jewelry peek visible @$size');
      expect(jewelry.left, lessThan(eleganceImg.width * 0.55), reason: 'third circle only partial @$size');

      final orbitY = tester.getTopLeft(find.byType(MiraWorldOrbitDiscover)).dy;
      final tipY = tester.getTopLeft(find.textContaining('نصيحة اليوم')).dy;
      final quickY = tester.getTopLeft(find.text('نظرة سريعة')).dy;
      expect(orbitY, greaterThan(quickY));
      expect(tipY, greaterThan(orbitY));

      final name = 'home_orbit_dashboard_${size.width.toInt()}x${size.height.toInt()}.png';
      final golden = File('test/features/marketplace/goldens/$name');
      expect(
        golden.existsSync() && golden.lengthSync() > 20000,
        isTrue,
        reason: 'missing capture $name — run phase3_orbit_capture_only_test with --update-goldens',
      );
      golden.copySync('${outDir.path}/$name');
      final log = File('docs/phase2_3/evidence/DASHBOARD_CAPTURE_LOG.txt');
      final prev = log.existsSync() ? log.readAsStringSync() : '';
      log.writeAsStringSync('${prev}screenshot $name size=$size bytes=${golden.lengthSync()} ok\n');
    }

    testWidgets('fonts + images load; Arabic readable; no empty orbs on 320', (tester) async {
      await _loadAppFonts();
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await assertDashboardLayout(tester, const Size(320, 640));
    });

    testWidgets('fonts + images load; Arabic readable; no empty orbs on 390', (tester) async {
      await _loadAppFonts();
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await assertDashboardLayout(tester, const Size(390, 844));
    });
  });
}
