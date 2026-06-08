import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'core/navigation/app_navigator.dart';
import 'core/navigation/app_routes.dart';
import 'core/navigation/route_args.dart';
import 'core/navigation/premium_page_route.dart';
import 'core/services/guest_session_service.dart';
import 'core/services/onboarding_storage.dart';
import 'core/services/theme_storage.dart';
import 'features/splash/presentation/screens/splash_screen.dart';
import 'features/onboarding/presentation/screens/onboarding_screen.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/dashboard/presentation/screens/dashboard_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/profile/presentation/screens/settings_screen.dart';
import 'features/dashboard/presentation/screens/analysis_screen.dart';
import 'features/dashboard/presentation/screens/points_screen.dart';
import 'features/dashboard/presentation/screens/tips_screen.dart';
import 'features/dashboard/presentation/screens/new_analysis_screen.dart';
import 'features/skin_analysis/presentation/screens/scan_screen.dart';
import 'features/intelligence/presentation/screens/beauty_progress_screen.dart';
import 'features/intelligence/presentation/screens/mira_beauty_report_screen.dart';
import 'features/skin_analysis/presentation/screens/skin_routine_screen.dart';
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
import 'features/recommendations/presentation/screens/recommendation_history_screen.dart';
import 'features/subscription/presentation/screens/paywall_screen.dart';
import 'features/subscription/presentation/screens/manage_subscription_screen.dart';
import 'features/feedback/presentation/screens/feedback_screen.dart';
import 'features/settings/presentation/screens/notifications_settings_screen.dart';
import 'features/settings/presentation/screens/help_screen.dart';
import 'features/settings/presentation/screens/about_screen.dart';
import 'features/marketplace/presentation/screens/discover_hub_screen.dart';
import 'features/marketplace/presentation/screens/partner_list_screen.dart';
import 'features/marketplace/presentation/screens/product_detail_screen.dart';
import 'features/marketplace/presentation/screens/service_detail_screen.dart';
import 'features/marketplace/domain/entities/catalog_product.dart';
import 'features/marketplace/domain/entities/catalog_service.dart';
import 'shared/theme/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('FlutterError: ${details.exceptionAsString()}');
  };
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await GuestSessionService.load();
  final themeMode = await ThemeStorage.load();
  final onboardingComplete = await OnboardingStorage.isComplete();
  runApp(MirraApp(
    initialThemeMode: themeMode,
    showOnboarding: !onboardingComplete,
  ));
}

class MirraApp extends StatefulWidget {
  final ThemeMode initialThemeMode;
  final bool showOnboarding;

  const MirraApp({
    super.key,
    required this.initialThemeMode,
    required this.showOnboarding,
  });

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
      navigatorKey: rootNavigatorKey,
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
      initialRoute: widget.showOnboarding ? AppRoutes.onboarding : AppRoutes.splash,
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
      case AppRoutes.register:
        return PremiumPageRoute(page: const LoginScreen(), settings: settings);
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
      case AppRoutes.miraBeautyReport:
        final args = settings.arguments;
        if (args is MiraReportRouteArgs) {
          return PremiumPageRoute(
            page: MiraBeautyReportScreen(
              report: args.report,
              showCelebration: args.celebrate,
            ),
            settings: settings,
          );
        }
        final report = args as SkinReport?;
        if (report == null) return null;
        return PremiumPageRoute(
          page: MiraBeautyReportScreen(
            report: report,
            showCelebration: settings.name == AppRoutes.miraBeautyReport,
          ),
          settings: settings,
        );
      case AppRoutes.beautyProgress:
        return PremiumPageRoute(
          page: const BeautyProgressScreen(),
          settings: settings,
        );
      case AppRoutes.skinRoutine:
        final routineReport = settings.arguments as SkinReport?;
        if (routineReport == null) return null;
        return PremiumPageRoute(
          page: SkinRoutineScreen(report: routineReport),
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
      case AppRoutes.recommendationHistory:
        return PremiumPageRoute(page: const RecommendationHistoryScreen(), settings: settings);
      case AppRoutes.paywall:
        return PremiumPageRoute(page: const PaywallScreen(), settings: settings);
      case AppRoutes.manageSubscription:
        return PremiumPageRoute(page: const ManageSubscriptionScreen(), settings: settings);
      case AppRoutes.feedback:
        return PremiumPageRoute(page: const FeedbackScreen(), settings: settings);
      case AppRoutes.notificationsSettings:
        return PremiumPageRoute(page: const NotificationsSettingsScreen(), settings: settings);
      case AppRoutes.help:
        return PremiumPageRoute(page: const HelpScreen(), settings: settings);
      case AppRoutes.about:
        return PremiumPageRoute(page: const AboutScreen(), settings: settings);
      case AppRoutes.discover:
        return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
      case AppRoutes.discoverList:
        final type = settings.arguments as String? ?? 'brand';
        return PremiumPageRoute(
          page: PartnerListScreen(partnerType: type),
          settings: settings,
        );
      case AppRoutes.productDetail:
        final product = settings.arguments as CatalogProduct?;
        if (product == null) return null;
        return PremiumPageRoute(
          page: ProductDetailScreen(product: product),
          settings: settings,
        );
      case AppRoutes.serviceDetail:
        final service = settings.arguments as CatalogService?;
        if (service == null) return null;
        return PremiumPageRoute(
          page: ServiceDetailScreen(service: service),
          settings: settings,
        );
      default:
        return null;
    }
  }
}
