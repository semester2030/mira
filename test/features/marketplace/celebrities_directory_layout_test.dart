import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/entities/creator_profile.dart';
import 'package:mirra/features/marketplace/presentation/widgets/celebrity_avatar_orb.dart';
import 'package:mirra/shared/theme/theme.dart';

/// Layout proof: directory uses 3 columns; 7th item requires scroll on a short viewport.
void main() {
  testWidgets('directory grid is 3 columns and seventh item appears after scroll', (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(390, 520));

    final cards = [
      for (var i = 1; i <= 7; i++)
        CreatorDirectoryCard(id: 'c$i', partnerId: 'p$i', displayNameAr: 'مشهور $i'),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: GridView.builder(
              key: const ValueKey('dir-grid'),
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 16,
                crossAxisSpacing: 12,
                childAspectRatio: 0.72,
              ),
              itemCount: cards.length,
              itemBuilder: (context, index) {
                final card = cards[index];
                return Align(
                  key: ValueKey('orb-${card.id}'),
                  alignment: Alignment.topCenter,
                  child: CelebrityAvatarOrb(nameAr: card.displayNameAr, diameter: 88),
                );
              },
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('orb-c1')), findsOneWidget);
    expect(find.byKey(const ValueKey('orb-c6')), findsOneWidget);

    // Three columns: first two orbs share a row (similar Y), different X.
    final c1 = tester.getCenter(find.byKey(const ValueKey('orb-c1')));
    final c2 = tester.getCenter(find.byKey(const ValueKey('orb-c2')));
    final c4 = tester.getCenter(find.byKey(const ValueKey('orb-c4')));
    expect((c1.dy - c2.dy).abs(), lessThan(2));
    expect(c4.dy, greaterThan(c1.dy + 40));

    final seventhTopBefore = tester.getTopLeft(find.byKey(const ValueKey('orb-c7'))).dy;
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('orb-c7')),
      120,
      scrollable: find.descendant(
        of: find.byKey(const ValueKey('dir-grid')),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.pumpAndSettle();
    final seventhTopAfter = tester.getTopLeft(find.byKey(const ValueKey('orb-c7'))).dy;
    expect(seventhTopAfter, lessThan(seventhTopBefore));
    expect(seventhTopAfter, lessThan(520));
  });
}
