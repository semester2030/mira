import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Frame dump: logo fill→empty, then press glow on أناقتك (no navigation).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('record logo fill then press glow', (tester) async {
    final loader = FontLoader('Tajawal')
      ..addFont(rootBundle.load('assets/fonts/Tajawal-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Tajawal-Bold.ttf'));
    await loader.load();
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const Scaffold(
          backgroundColor: Color(0xFFF3EAF5),
          body: SafeArea(
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: RepaintBoundary(
                key: ValueKey('rec'),
                child: SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(20, 8, 20, 32),
                  child: MiraWorldOrbitDiscover(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    final dir = Directory('docs/phase2_3/evidence/motion_merge/frames');
    dir.createSync(recursive: true);

    Future<void> shot(int i) async {
      final boundary =
          tester.renderObject(find.byKey(const ValueKey('rec')))
              as RenderRepaintBoundary;
      late ui.Image image;
      await tester.runAsync(() async {
        image = await boundary.toImage(pixelRatio: 1.0);
      });
      late ByteData? bd;
      await tester.runAsync(() async {
        bd = await image.toByteData(format: ui.ImageByteFormat.png);
        image.dispose();
      });
      File(
        '${dir.path}/f${i.toString().padLeft(2, '0')}.png',
      ).writeAsBytesSync(bd!.buffer.asUint8List());
    }

    // Fill / hold / empty (~2s fill + pause + reverse).
    var i = 0;
    for (; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 140));
      await shot(i);
    }
    // Press glow on elegance orb (cancel before open).
    final orb = find.byKey(const ValueKey('home-orb-elegance'));
    await tester.ensureVisible(orb);
    final gesture = await tester.startGesture(tester.getCenter(orb));
    await tester.pump(const Duration(milliseconds: 80));
    await shot(i++);
    await tester.pump(const Duration(milliseconds: 80));
    await shot(i++);
    await gesture.cancel();
    await tester.pump(const Duration(milliseconds: 200));
    await shot(i++);

    expect(dir.listSync().length, greaterThanOrEqualTo(20));
  }, timeout: const Timeout(Duration(seconds: 90)));
}
