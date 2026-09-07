import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/dev_tools/presentation/screens/fashion_icon_system_preview_screen.dart';
import 'package:mirra/shared/icons/fashion/mira_fashion_icon_registry.dart';

void main() {
  testWidgets('Fashion icon preview lists all 36 semantic labels', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      const MaterialApp(
        home: FashionIconSystemPreviewScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('36'), findsWidgets);
    expect(find.text('فستان'), findsOneWidget);
    expect(find.text('عباية'), findsOneWidget);
    expect(MiraFashionIconRegistry.all.length, 36);

    final list = find.byType(Scrollable).first;
    await tester.drag(list, const Offset(0, -3600));
    await tester.pumpAndSettle();
    expect(find.text('اسألي ميرا'), findsOneWidget);
    expect(find.text('خزانة الملابس'), findsOneWidget);
  });
}
