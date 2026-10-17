import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/constants/report_face_map_spec.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_score_hero.dart';
import 'package:mirra/features/skin_analysis/data/models/skin_report_model.dart';

void main() {
  testWidgets('synthetic report shows the estimate wording and no lab-accuracy claim', (tester) async {
    final loader = FontLoader('Tajawal');
    for (final name in ['Tajawal-Regular.ttf', 'Tajawal-Medium.ttf', 'Tajawal-Bold.ttf']) {
      final bytes = File('assets/fonts/$name').readAsBytesSync();
      loader.addFont(Future<ByteData>.value(ByteData.sublistView(bytes)));
    }
    await loader.load();
    final report = LocalMiraReportBuilder.fromSkinReport(SkinReportModel.fromJson('synthetic-estimate', {
      'skinType': 'جافة',
      'score': 70,
      'hydration': 62,
      'oiliness': 30,
      'pores': 1,
      'wrinkles': 1,
      'spots': 1,
      'advice': 'ترطيب يومي',
      'createdAt': '2026-02-01T00:00:00.000',
    }));
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: RepaintBoundary(
            key: const Key('estimate-shot'),
            child: SizedBox(width: 390, child: BeautyScoreHero(report: report)),
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text(ReportFaceMapSpec.estimateAr), findsOneWidget);
    expect(find.textContaining('دقة 100'), findsNothing);
    expect(find.textContaining('قياس مخبري'), findsNothing);
    expect(find.textContaining('نسبة ماء في البشرة'), findsNothing);

    final shot = Platform.environment['MIRA_ESTIMATE_SHOT'];
    if (shot != null && shot.isNotEmpty) {
      await tester.runAsync(() async {
        final boundary = tester.renderObject(find.byKey(const Key('estimate-shot'))) as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        File(shot).writeAsBytesSync(bytes!.buffer.asUint8List());
      });
    }
  });
}
