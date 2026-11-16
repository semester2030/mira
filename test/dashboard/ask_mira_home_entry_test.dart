import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/dashboard/presentation/widgets/ask_mira_home_entry.dart';

void main() {
  test('avatar logical size stays large enough for a clear face', () {
    expect(AskMiraHomeEntry.avatarLogicalSize, inInclusiveRange(120, 140));
  });

  test('home alignment is directional start (visual right in RTL)', () {
    expect(AskMiraHomeEntry.homeAlignment, AlignmentDirectional.centerStart);
  });

  testWidgets('RTL: entry sits on the visual right and tap opens route',
      (tester) async {
    var opened = 0;
    var routed = false;
    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: (settings) {
          if (settings.name == AppRoutes.miraAdvisor) {
            routed = true;
            return MaterialPageRoute<void>(
              builder: (_) => const Scaffold(body: Text('advisor')),
            );
          }
          return null;
        },
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: SizedBox(
              width: 390,
              child: AskMiraHomeEntry(onOpened: () => opened++),
            ),
          ),
        ),
      ),
    );
    // Repeating pulse animation never settles — pump frames instead.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final entry = find.byKey(const Key('ask_mira_home_entry'));
    expect(entry, findsOneWidget);
    final box = tester.getRect(entry);
    // Visual right under RTL: right edge near the 390-wide parent.
    expect(box.right, greaterThan(300));
    expect(box.left, greaterThan(180));

    await tester.tap(entry);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(opened, 1);
    expect(routed, isTrue);
  });
}
