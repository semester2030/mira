import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/lane_orb_assets.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/theme.dart';
import 'package:mirra/shared/widgets/premium/premium_exports.dart';

/// Isolated golden capture (no long-lived ImageStream after assert suite).
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
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          backgroundColor: const Color(0xFFF3EAF5),
          body: SafeArea(
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
    );
    await tester.pump();
    await tester.runAsync(() async {
      final ctx = tester.element(find.byType(MiraWorldOrbitDiscover));
      for (final k in ['elegance', 'beauty', 'children', 'gifts', 'occasions', 'jewelry']) {
        await precacheImage(AssetImage(LaneOrbAssets.homeOrbitAssetForImageKey(k)!), ctx);
      }
      await precacheImage(
        const AssetImage('assets/marketplace/discover/home_orbit/mira_center_logo.png'),
        ctx,
      );
    });
    for (var i = 0; i < 24; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.ensureVisible(find.byType(MiraWorldOrbitDiscover));
    await tester.pump(const Duration(milliseconds: 50));

    await expectLater(
      find.byType(MiraWorldOrbitDiscover),
      matchesGoldenFile('goldens/$fileName'),
    );

    final golden = File('test/features/marketplace/goldens/$fileName');
    final out = File('docs/phase2_3/evidence/screenshots/$fileName');
    out.parent.createSync(recursive: true);
    if (golden.existsSync()) {
      await golden.copy(out.path);
    }
  }

  testWidgets('capture dashboard orbit 320', (tester) async {
    await capture(tester, const Size(320, 640), 'home_orbit_dashboard_320x640.png');
  });

  testWidgets('capture dashboard orbit 390', (tester) async {
    await capture(tester, const Size(390, 844), 'home_orbit_dashboard_390x844.png');
  });
}
