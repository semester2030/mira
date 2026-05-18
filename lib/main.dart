import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'core/navigation/app_routes.dart';
import 'core/navigation/premium_page_route.dart';
import 'core/services/guest_session_service.dart';
import 'core/services/theme_storage.dart';
import 'features/splash/presentation/screens/splash_screen.dart';
import 'features/onboarding/presentation/screens/onboarding_screen.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/register_screen.dart';
import 'features/auth/presentation/screens/forgot_password_screen.dart';
import 'features/dashboard/presentation/screens/dashboard_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/profile/presentation/screens/settings_screen.dart';
import 'features/dashboard/presentation/screens/analysis_screen.dart';
import 'features/dashboard/presentation/screens/points_screen.dart';
import 'features/dashboard/presentation/screens/tips_screen.dart';
import 'features/dashboard/presentation/screens/new_analysis_screen.dart';
import 'features/skin_analysis/presentation/screens/scan_screen.dart';
import 'features/skin_analysis/presentation/screens/result_screen.dart';
import 'features/skin_analysis/presentation/screens/history_screen.dart';
import 'features/skin_analysis/domain/entities/skin_report.dart';
import 'features/privacy/presentation/screens/privacy_consent_screen.dart';
import 'features/privacy/presentation/screens/privacy_policy_screen.dart';
import 'features/outfit_analysis/presentation/screens/outfit_upload_screen.dart';
import 'features/outfit_analysis/presentation/screens/occasion_select_screen.dart';
import 'features/outfit_analysis/presentation/screens/outfit_result_screen.dart';
import 'features/outfit_analysis/presentation/screens/outfit_history_screen.dart';
import 'features/outfit_analysis/domain/entities/outfit_report.dart';
import 'features/recommendations/presentation/screens/recommendations_screen.dart';
import 'features/subscription/presentation/screens/paywall_screen.dart';
import 'features/subscription/presentation/screens/manage_subscription_screen.dart';
import 'features/feedback/presentation/screens/feedback_screen.dart';
import 'shared/theme/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await GuestSessionService.load();
  final themeMode = await ThemeStorage.load();
  runApp(MirraApp(initialThemeMode: themeMode));
}

class MirraApp extends StatefulWidget {
  final ThemeMode initialThemeMode;

  const MirraApp({super.key, required this.initialThemeMode});

  static MirraAppState? of(BuildContext context) =>
      context.findAncestorStateOfType<MirraAppState>();

  @override
  State<MirraApp> createState() => MirraAppState();
}

class MirraAppState extends State<MirraApp> {
  late ThemeMode _themeMode;

  ThemeMode get themeMode => _themeMode;

  @override
  void initState() {
    super.initState();
    _themeMode = widget.initialThemeMode;
  }

  void setThemeMode(ThemeMode mode) {
    setState(() => _themeMode = mode);
    ThemeStorage.save(mode);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mira',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _themeMode,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        );
      },
      initialRoute: AppRoutes.splash,
      onGenerateRoute: _onGenerateRoute,
    );
  }

  Route<dynamic>? _onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.splash:
        return PremiumPageRoute(page: const SplashScreen(), settings: settings);
      case AppRoutes.onboarding:
        return PremiumPageRoute(page: const OnboardingScreen(), settings: settings);
      case AppRoutes.login:
        return PremiumPageRoute(page: const LoginScreen(), settings: settings);
      case AppRoutes.register:
        return PremiumPageRoute(page: const RegisterScreen(), settings: settings);
      case AppRoutes.forgot:
        return PremiumPageRoute(page: const ForgotPasswordScreen(), settings: settings);
      case AppRoutes.dashboard:
        return PremiumPageRoute(page: const DashboardScreen(), settings: settings);
      case AppRoutes.profile:
        return PremiumPageRoute(page: const ProfileScreen(), settings: settings);
      case AppRoutes.settings:
        return PremiumPageRoute(page: const SettingsScreen(), settings: settings);
      case AppRoutes.analysis:
        return PremiumPageRoute(page: const AnalysisScreen(), settings: settings);
      case AppRoutes.history:
        return PremiumPageRoute(page: const HistoryScreen(), settings: settings);
      case AppRoutes.points:
        return PremiumPageRoute(page: const PointsScreen(), settings: settings);
      case AppRoutes.tips:
        return PremiumPageRoute(page: const TipsScreen(), settings: settings);
      case AppRoutes.newAnalysis:
        return PremiumPageRoute(page: const NewAnalysisScreen(), settings: settings);
      case AppRoutes.skinScan:
        return PremiumPageRoute(page: const ScanScreen(), settings: settings);
      case AppRoutes.skinResult:
        final report = settings.arguments as SkinReport?;
        if (report == null) return null;
        return PremiumPageRoute(
          page: ResultScreen(report: report),
          settings: settings,
        );
      case AppRoutes.privacyConsent:
        return PremiumPageRoute(page: const PrivacyConsentScreen(), settings: settings);
      case AppRoutes.privacyPolicy:
        return PremiumPageRoute(page: const PrivacyPolicyScreen(), settings: settings);
      case AppRoutes.outfitUpload:
        return PremiumPageRoute(page: const OutfitUploadScreen(), settings: settings);
      case AppRoutes.occasionSelect:
        return PremiumPageRoute(page: const OccasionSelectScreen(), settings: settings);
      case AppRoutes.outfitResult:
        final outfit = settings.arguments as OutfitReport?;
        if (outfit == null) return null;
        return PremiumPageRoute(page: OutfitResultScreen(report: outfit), settings: settings);
      case AppRoutes.outfitHistory:
        return PremiumPageRoute(page: const OutfitHistoryScreen(), settings: settings);
      case AppRoutes.recommendations:
        return PremiumPageRoute(page: const RecommendationsScreen(), settings: settings);
      case AppRoutes.paywall:
        return PremiumPageRoute(page: const PaywallScreen(), settings: settings);
      case AppRoutes.manageSubscription:
        return PremiumPageRoute(page: const ManageSubscriptionScreen(), settings: settings);
      case AppRoutes.feedback:
        return PremiumPageRoute(page: const FeedbackScreen(), settings: settings);
      default:
        return null;
    }
  }
}
