import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/presentation/widgets/mira_world_orbit_discover.dart';
import 'package:mirra/shared/theme/theme.dart';

Future<void> _loadFonts() async {
  final loader = FontLoader('Tajawal')
    ..addFont(rootBundle.load('assets/fonts/Tajawal-Regular.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Tajawal-Bold.ttf'));
  await loader.load();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('row order, peek, swipe to children, tap destinations', (
    tester,
  ) async {
    await _loadFonts();
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(390, 844));

    final opened = <String>[];
    DiscoverLane? lastLane;
    final navKey = GlobalKey<NavigatorState>();

    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: navKey,
        theme: AppTheme.lightTheme,
        onGenerateRoute: (settings) {
          if (settings.name == AppRoutes.discoverPresentation) {
            final lane = settings.arguments! as DiscoverLane;
            lastLane = lane;
            return MaterialPageRoute<void>(
              settings: settings,
              builder: (_) => Scaffold(
                key: ValueKey('opened-lane-${lane.apiId}'),
                body: Center(child: Text('lane:${lane.apiId}')),
              ),
            );
          }
          return null;
        },
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Scaffold(
            backgroundColor: const Color(0xFFF3EAF5),
            body: SafeArea(
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: [
                    MiraWorldOrbitDiscover(
                      onLaneOpened: (title, lane) =>
                          opened.add('$title:${lane.apiId}'),
                    ),
                    const SizedBox(
                      height: 400,
                      child: ColoredBox(color: Color(0x11C45B8A)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('اكتشفي عالم ميرا'), findsOneWidget);
    for (final t in [
      'أناقتك',
      'جمالك',
      'المجوهرات',
      'مناسباتك',
      'الهدايا',
      'الأطفال',
    ]) {
      expect(find.text(t), findsOneWidget, reason: t);
    }

    final elegance = tester.getRect(
      find.byKey(const ValueKey('home-orb-elegance')),
    );
    final beauty = tester.getRect(find.byKey(const ValueKey('home-orb-beauty')));
    final jewelry = tester.getRect(
      find.byKey(const ValueKey('home-orb-jewelry')),
    );
    expect(elegance.right, greaterThan(beauty.right));
    expect(jewelry.right, greaterThan(0));
    expect(jewelry.left, lessThan(beauty.left));

    // Visible tap at start.
    await tester.tap(find.text('أناقتك'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(opened, ['أناقتك:elegance']);
    expect(find.byKey(const ValueKey('opened-lane-elegance')), findsOneWidget);
    navKey.currentState!.pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    // Drag should not open a lane.
    final row = find.descendant(
      of: find.byType(MiraWorldOrbitDiscover),
      matching: find.byType(SingleChildScrollView),
    );
    await tester.drag(row, const Offset(-260, 0));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(opened, ['أناقتك:elegance']);
    expect(find.textContaining('lane:'), findsNothing);

    final childrenOrb = find.byKey(const ValueKey('home-orb-children'));
    await tester.scrollUntilVisible(
      childrenOrb,
      80,
      scrollable: find
          .descendant(
            of: find.byType(MiraWorldOrbitDiscover),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('الأطفال'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(opened.last, 'الأطفال:children');
    expect(lastLane, DiscoverLane.children);
    expect(find.byKey(const ValueKey('opened-lane-children')), findsOneWidget);

    // Return keeps the row (and its scroll State) mounted.
    navKey.currentState!.pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byType(MiraWorldOrbitDiscover), findsOneWidget);
    expect(find.byKey(const ValueKey('home-orb-children')), findsOneWidget);
  });
}
