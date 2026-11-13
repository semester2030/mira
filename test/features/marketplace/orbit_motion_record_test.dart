import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Frame dump: horizontal swipe across lane circles then settle on الأطفال.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('record horizontal swipe to children', (tester) async {
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
    await tester.pump(const Duration(milliseconds: 200));

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

    await shot(0);

    final row = find.descendant(
      of: find.byType(MiraWorldOrbitDiscover),
      matching: find.byType(SingleChildScrollView),
    );
    final start = tester.getCenter(row);
    final gesture = await tester.startGesture(start);
    // Drag toward the left in screen space → reveal later RTL items (الأطفال).
    for (var i = 1; i <= 12; i++) {
      await gesture.moveBy(const Offset(-28, 0));
      await tester.pump(const Duration(milliseconds: 40));
      await shot(i);
    }
    await gesture.up();
    await tester.pump(const Duration(milliseconds: 320));
    await shot(13);

    await tester.ensureVisible(find.byKey(const ValueKey('home-orb-children')));
    await tester.pump();
    await shot(14);

    expect(dir.listSync().length, greaterThanOrEqualTo(14));
  }, timeout: const Timeout(Duration(seconds: 90)));
}
