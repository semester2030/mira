import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_visual_chrome.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('occasions rail enlarges circles ~20% vs default band', (tester) async {
    const long = 'تنظيم وباقات حفلات';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              DiscoverCategoryRail(
                key: const Key('default_rail'),
                labels: const ['الكل', long],
                assetFamily: 'elegance',
                selected: 0,
                onSelected: (_) {},
              ),
              DiscoverCategoryRail(
                key: const Key('occasions_rail'),
                labels: const ['الكل', long],
                assetFamily: 'occasions',
                enlargeCircles: true,
                selected: 0,
                onSelected: (_) {},
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final defaultRail = tester.getSize(find.byKey(const Key('default_rail')));
    final occasionsRail = tester.getSize(find.byKey(const Key('occasions_rail')));
    expect(
      occasionsRail.height,
      greaterThan(defaultRail.height),
      reason: 'enlarged occasions circles + full wrap need a taller strip',
    );
    expect(
      DiscoverCategoryRail.baseMinDiameter * DiscoverCategoryRail.occasionsCircleScale,
      closeTo(92.4, 0.01),
    );
  });

  testWidgets('long Arabic taxonomy label is fully visible without ellipsis', (tester) async {
    const long = 'تنظيم وباقات حفلات';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 360,
              child: DiscoverCategoryRail(
                labels: const ['الكل', long, 'زفاف'],
                assetFamily: 'occasions',
                enlargeCircles: true,
                selected: 1,
                onSelected: (_) {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(long), findsOneWidget);
    final text = tester.widget<Text>(find.text(long));
    expect(text.overflow, TextOverflow.visible);
    expect(text.softWrap, isTrue);
    expect(text.maxLines, isNull);

    final box = tester.getRect(find.text(long));
    expect(box.width, greaterThan(0));
    expect(box.height, greaterThan(10), reason: 'wrapped label must occupy vertical space');

    // Ellipsis glyph must not appear in the rendered string.
    final paragraph = tester.renderObject<RenderParagraph>(find.text(long));
    expect(paragraph.text.toPlainText(), long);
    expect(paragraph.text.toPlainText().contains('…'), isFalse);
    expect(paragraph.text.toPlainText().contains('...'), isFalse);
  });

  testWidgets('default-lane long label also avoids ellipsis at normal diameter', (tester) async {
    const long = 'مستحضرات العناية بالبشرة اليومية';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 390,
            child: DiscoverCategoryRail(
              labels: const ['الكل', long],
              assetFamily: 'beauty',
              selected: 1,
              onSelected: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final text = tester.widget<Text>(find.text(long));
    expect(text.overflow, TextOverflow.visible);
    expect(find.textContaining('…'), findsNothing);
  });
}
