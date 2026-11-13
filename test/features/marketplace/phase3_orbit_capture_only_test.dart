import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/lane_orb_assets.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/theme.dart';
import 'package:mirra/shared/widgets/premium/premium_exports.dart';

/// Non-golden PNG dump for motion-merge evidence (avoids matchesGoldenFile hangs).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<void> loadFonts() async {
    final loader = FontLoader('Tajawal')
      ..addFont(rootBundle.load('assets/fonts/Tajawal-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Tajawal-Medium.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Tajawal-Bold.ttf'));
    await loader.load();
  }

  Future<void> capture(WidgetTester tester, Size size, String fileName) async {
    await loadFonts();
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        builder: (context, child) {
          final mq = MediaQuery.of(context);
          return MediaQuery(
            data: mq.copyWith(disableAnimations: true),
            child: child ?? const SizedBox.shrink(),
          );
        },
        home: Scaffold(
          backgroundColor: const Color(0xFFF3EAF5),
          body: SafeArea(
            child: RepaintBoundary(
              key: const ValueKey('orbit-capture-boundary'),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SectionHeader(title: 'نظرة سريعة'),
                      const SizedBox(height: 12),
                      const SizedBox(
                        height: 48,
                        child: ColoredBox(color: Color(0x33C45B8A)),
                      ),
                      const SizedBox(height: 24),
                      const MiraWorldOrbitDiscover(),
                      const SizedBox(height: 16),
                      const PremiumCard(
                        child: Text(
                          'نصيحة اليوم: احرصي على شرب الماء وواقي الشمس يوميًا لبشرة أكثر إشراقًا.',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.runAsync(() async {
      final ctx = tester.element(find.byType(MiraWorldOrbitDiscover));
      for (final k in [
        'elegance',
        'beauty',
        'children',
        'gifts',
        'occasions',
        'jewelry',
      ]) {
        await precacheImage(
          AssetImage(LaneOrbAssets.homeOrbitAssetForImageKey(k)!),
          ctx,
        );
      }
    });
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump();
    await tester.ensureVisible(find.byType(MiraWorldOrbitDiscover));
    await tester.pump();

    final boundary =
        tester.renderObject(find.byKey(const ValueKey('orbit-capture-boundary')))
            as RenderRepaintBoundary;
    late final ui.Image image;
    await tester.runAsync(() async {
      image = await boundary.toImage(pixelRatio: 1.0);
    });
    late final ByteData? bytes;
    await tester.runAsync(() async {
      bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
    });
    expect(bytes, isNotNull);

    final after = File('docs/phase2_3/evidence/motion_merge/AFTER_$fileName');
    after.parent.createSync(recursive: true);
    after.writeAsBytesSync(bytes!.buffer.asUint8List());
    expect(after.lengthSync(), greaterThan(1000));
  }

  testWidgets('capture dashboard orbit 320', (tester) async {
    await capture(tester, const Size(320, 640), 'home_orbit_dashboard_320x640.png');
  });

  testWidgets('capture dashboard orbit 390', (tester) async {
    await capture(tester, const Size(390, 844), 'home_orbit_dashboard_390x844.png');
  });

  testWidgets('capture dashboard orbit 430', (tester) async {
    await capture(tester, const Size(430, 932), 'home_orbit_dashboard_430x932.png');
  });
}
