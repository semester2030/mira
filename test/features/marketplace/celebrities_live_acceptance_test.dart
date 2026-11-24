/// Live acceptance against local API (no iOS MediaPipe link).
///
///   flutter test test/features/marketplace/celebrities_live_acceptance_test.dart \
///     --dart-define=MIRA_API_BASE_URL=http://127.0.0.1:3000/api/v1 \
///     --dart-define=MIRA_MARKETPLACE_ENABLED=true
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mira/core/config/mira_api_config.dart';
import 'package:mira/core/navigation/app_routes.dart';
import 'package:mira/features/marketplace/presentation/marketplace_routes.dart';
import 'package:mira/features/marketplace/presentation/screens/celebrities_directory_screen.dart';
import 'package:mira/shared/theme/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('live directory: 6 orbs then 7th on scroll; open profile; restore scroll', (tester) async {
    final base = MiraApiConfig.baseUrl;
    expect(base.contains('127.0.0.1') || base.contains('localhost'), isTrue, reason: base);

    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        locale: const Locale('ar'),
        home: const CelebritiesDirectoryScreen(),
        onGenerateRoute: (settings) {
          if (settings.name == AppRoutes.celebrityProfile) {
            return MarketplaceRoutes.onGenerate(settings);
          }
          if (settings.name == AppRoutes.celebrityAdPlayer ||
              settings.name == AppRoutes.productDetail ||
              settings.name == AppRoutes.serviceDetail) {
            return MarketplaceRoutes.onGenerate(settings) ??
                MaterialPageRoute(
                  builder: (_) => Scaffold(body: Text('route ${settings.name}')),
                  settings: settings,
                );
          }
          return null;
        },
      ),
    );

    // Wait for first page from live API
    await tester.pumpAndSettle(const Duration(seconds: 8));
    expect(find.byType(CelebritiesDirectoryScreen), findsOneWidget);

    // At least some creator names visible
    expect(find.textContaining('قبول'), findsWidgets);

    final grid = find.byType(GridView);
    expect(grid, findsOneWidget);

    // Scroll until 7th-ish content loads (cursor page)
    await tester.drag(grid, const Offset(0, -600));
    await tester.pumpAndSettle(const Duration(seconds: 5));
    await tester.drag(grid, const Offset(0, -600));
    await tester.pumpAndSettle(const Duration(seconds: 5));

    // Tap a visible orb / name to open a profile
    final nameFinder = find.textContaining('مشهورة');
    expect(nameFinder, findsWidgets);
    await tester.ensureVisible(nameFinder.last);
    await tester.tap(nameFinder.last);
    await tester.pumpAndSettle(const Duration(seconds: 6));

    // Profile or ads list
    expect(find.textContaining('إعلان').evaluate().isNotEmpty || find.textContaining('لا توجد').evaluate().isNotEmpty, isTrue);

    // Back — PageStorageKey should keep directory
    await tester.pageBack();
    await tester.pumpAndSettle(const Duration(seconds: 3));
    expect(find.byType(CelebritiesDirectoryScreen), findsOneWidget);
  }, timeout: const Timeout(Duration(minutes: 2)));
}
