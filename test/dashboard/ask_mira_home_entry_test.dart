import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/dashboard/presentation/widgets/ask_mira_home_entry.dart';

void main() {
  test('avatar logical size stays in handoff range 76–84', () {
    expect(AskMiraHomeEntry.avatarLogicalSize, inInclusiveRange(76, 84));
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
    await tester.pumpAndSettle();

    final entry = find.byKey(const Key('ask_mira_home_entry'));
    expect(entry, findsOneWidget);
    final box = tester.getRect(entry);
    // Visual right under RTL: right edge near the 390-wide parent.
    expect(box.right, greaterThan(300));
    expect(box.left, greaterThan(200));

    await tester.tap(entry);
    await tester.pumpAndSettle();
    expect(opened, 1);
    expect(routed, isTrue);
  });
}
