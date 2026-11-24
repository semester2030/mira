/// Acceptance harness for celebrities v1 — avoids MediaPipe/TensorFlowLiteC
/// simulator link failures from the full app entrypoint.
///
///   flutter run -t lib/acceptance_celebrities_main.dart \
///     --dart-define=MIRA_API_BASE_URL=http://127.0.0.1:3000/api/v1 \
///     --dart-define=MIRA_MARKETPLACE_ENABLED=true
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/navigation/app_routes.dart';
import 'features/marketplace/data/lane_orb_assets.dart';
import 'features/marketplace/presentation/marketplace_routes.dart';
import 'features/marketplace/presentation/screens/celebrities_directory_screen.dart';
import 'features/marketplace/presentation/screens/celebrity_ad_player_screen.dart';
import 'features/marketplace/presentation/screens/celebrity_profile_screen.dart';
import 'shared/theme/colors.dart';
import 'shared/theme/theme.dart';
import 'shared/theme/typography.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CelebritiesAcceptanceApp());
}

Uri _routeUri(String? name) {
  final raw = (name == null || name.isEmpty) ? '/' : name;
  return Uri.parse(raw.startsWith('/') ? raw : '/$raw');
}

class CelebritiesAcceptanceApp extends StatelessWidget {
  const CelebritiesAcceptanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Mira Celebrities Acceptance',
      theme: AppTheme.lightTheme,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      initialRoute: '/',
      onGenerateRoute: (settings) {
        final uri = _routeUri(settings.name);
        if (settings.name == '/' || settings.name == null || uri.path == '/') {
          return MaterialPageRoute(builder: (_) => const _AcceptanceHome(), settings: settings);
        }
        if (uri.path == AppRoutes.celebritiesDirectory) {
          return MaterialPageRoute(
            builder: (_) => const CelebritiesDirectoryScreen(),
            settings: settings,
          );
        }
        // Deep-link helpers for acceptance CDP:
        //   /celebrities/profile/<id>  and  /celebrities/ad/<id>
        // (hash query strings are unreliable with Flutter web route names)
        final segs = uri.pathSegments;
        if (segs.length >= 3 && segs[0] == 'celebrities' && segs[1] == 'profile') {
          final id = (settings.arguments is String && (settings.arguments as String).isNotEmpty)
              ? settings.arguments as String
              : segs[2];
          if (id.isNotEmpty) {
            return MaterialPageRoute(
              builder: (_) => CelebrityProfileScreen(creatorId: id),
              settings: settings,
            );
          }
        }
        if (uri.path == AppRoutes.celebrityProfile) {
          final id = settings.arguments is String ? settings.arguments as String : '';
          if (id.isNotEmpty) {
            return MaterialPageRoute(
              builder: (_) => CelebrityProfileScreen(creatorId: id),
              settings: settings,
            );
          }
        }
        if (segs.length >= 3 && segs[0] == 'celebrities' && segs[1] == 'ad' && segs[2].isNotEmpty) {
          return MaterialPageRoute(
            builder: (_) => CelebrityAdPlayerScreen(adId: segs[2]),
            settings: settings,
          );
        }
        final market = MarketplaceRoutes.onGenerate(settings);
        if (market != null) return market;
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            appBar: AppBar(title: const Text('تفاصيل')),
            body: Center(child: Text('مسار: ${settings.name}', textAlign: TextAlign.center)),
          ),
          settings: settings,
        );
      },
    );
  }
}

/// Mirrors home orbit: celebrities orb above «اكتشفي عالم ميرا».
class _AcceptanceHome extends StatelessWidget {
  const _AcceptanceHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('ميرا — قبول المشاهير', style: AppTypography.titleLarge, textAlign: TextAlign.center),
              const SizedBox(height: 28),
              Center(
                child: GestureDetector(
                  key: const ValueKey('home-orb-celebrities'),
                  onTap: () => Navigator.of(context).pushNamed(AppRoutes.celebritiesDirectory),
                  child: Column(
                    children: [
                      Container(
                        width: 96,
                        height: 96,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xffffe7f0), width: 1.7),
                          boxShadow: const [
                            BoxShadow(
                              color: Color.fromRGBO(207, 55, 137, 0.18),
                              blurRadius: 8,
                              offset: Offset(0, 3),
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.asset(
                          LaneOrbAssets.celebritiesHomeOrbit,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text('المشاهير', style: AppTypography.labelLarge),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'اكتشفي عالم ميرا',
                key: const ValueKey('discover-mira-world'),
                style: AppTypography.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'اضغط دائرة المشاهير أعلاه — نفس موضع الرئيسية.',
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
