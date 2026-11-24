import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/app_routes.dart';
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

  testWidgets('المشاهير orb sits above اكتشفي عالم ميرا', (tester) async {
    await _loadFonts();
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(390, 844));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        onGenerateRoute: (settings) {
          if (settings.name == AppRoutes.celebritiesDirectory) {
            return MaterialPageRoute<void>(
              settings: settings,
              builder: (_) => const Scaffold(body: Text('directory-opened')),
            );
          }
          return null;
        },
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: const Scaffold(
            body: Directionality(
              textDirection: TextDirection.rtl,
              child: Padding(
                padding: EdgeInsets.all(20),
                child: MiraWorldOrbitDiscover(),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('المشاهير'), findsOneWidget);
    expect(find.text('اكتشفي عالم ميرا'), findsOneWidget);
    expect(find.byKey(const ValueKey('home-orb-celebrities')), findsOneWidget);

    final celebY = tester.getTopLeft(find.text('المشاهير')).dy;
    final titleY = tester.getTopLeft(find.text('اكتشفي عالم ميرا')).dy;
    expect(celebY, lessThan(titleY));

    await tester.tap(find.text('المشاهير'));
    await tester.pumpAndSettle();
    expect(find.text('directory-opened'), findsOneWidget);
  });
}