import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_visual_chrome.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('export occasions enlarged + beauty normal PNGs', (tester) async {
    final out = Directory('/Users/fayez/Desktop/mira-occasions-rail-1613')
      ..createSync(recursive: true);

    Future<void> export({
      required String fileName,
      required List<String> labels,
      required String family,
      required bool enlarge,
    }) async {
      final key = GlobalKey();
      await tester.binding.setSurfaceSize(const Size(390, 260));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            backgroundColor: const Color(0xFF1A0A12),
            body: Center(
              child: RepaintBoundary(
                key: key,
                child: SizedBox(
                  width: 390,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: DiscoverCategoryRail(
                      labels: labels,
                      assetFamily: family,
                      enlargeCircles: enlarge,
                      selected: 1,
                      onSelected: (_) {},
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await tester.runAsync(
        () => boundary.toImage(pixelRatio: 2),
      );
      expect(image, isNotNull);
      final bytes = await tester.runAsync(
        () => image!.toByteData(format: ui.ImageByteFormat.png),
      );
      File('${out.path}/$fileName').writeAsBytesSync(bytes!.buffer.asUint8List());
    }

    await export(
      fileName: '01-occasions-enlarged-full-label.png',
      labels: const ['الكل', 'تنظيم وباقات حفلات', 'زفاف', 'خطوبة'],
      family: 'occasions',
      enlarge: true,
    );
    await export(
      fileName: '02-beauty-normal-long-label.png',
      labels: const ['الكل', 'مستحضرات العناية بالبشرة اليومية', 'مكياج'],
      family: 'beauty',
      enlarge: false,
    );

    expect(File('${out.path}/01-occasions-enlarged-full-label.png').existsSync(), isTrue);
    expect(File('${out.path}/02-beauty-normal-long-label.png').existsSync(), isTrue);
    await tester.binding.setSurfaceSize(null);
  });
}
