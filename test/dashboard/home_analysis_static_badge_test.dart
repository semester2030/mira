import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/dashboard/presentation/widgets/home_analysis_static_badge.dart';

void main() {
  testWidgets('skin and outfit badges render circular assets', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Row(
            children: [
              HomeAnalysisStaticBadge(
                assetPath: HomeAnalysisStaticBadge.skinAsset,
              ),
              HomeAnalysisStaticBadge(
                assetPath: HomeAnalysisStaticBadge.outfitAsset,
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(HomeAnalysisStaticBadge), findsNWidgets(2));
    expect(find.byType(Image), findsNWidgets(2));
  });
}
