import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/onboarding_storage.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _index = 0;

  static const _pages = [
    _OnboardingPage(
      icon: Icons.lock_outline_rounded,
      title: 'خصوصية تامة',
      body: 'صورك وتحليلاتك لك وحدك. لا مشاركة عامة ولا منشورات.',
      accent: AppColors.secondary,
    ),
    _OnboardingPage(
      icon: Icons.auto_awesome_rounded,
      title: 'ذكاء يفهم بشرتك',
      body: 'تحليل شخصي ونصائح مخصصة لروتين عناية يناسبك.',
      accent: AppColors.primary,
    ),
    _OnboardingPage(
      icon: Icons.favorite_border_rounded,
      title: 'ثقة كل يوم',
      body: 'ميرا رفيقتك الهادئة في رحلة الجمال والعناية الذاتية.',
      accent: AppColors.gold,
    ),
  ];

  Future<void> _finish() async {
    await OnboardingStorage.setComplete();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, AppRoutes.login);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FloatingGradientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(
                  onPressed: _finish,
                  child: Text('تخطي', style: AppTypography.labelLarge),
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _pages.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (_, i) => _pages[i],
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_pages.length, (i) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: _index == i ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _index == i ? AppColors.primary : AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: PremiumButton(
                  label: _index == _pages.length - 1 ? 'ابدئي الآن' : 'التالي',
                  onPressed: () {
                    if (_index < _pages.length - 1) {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 400),
                        curve: Curves.easeOutCubic,
                      );
                    } else {
                      _finish();
                    }
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final Color accent;

  const _OnboardingPage({
    required this.icon,
    required this.title,
    required this.body,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          PremiumCard(
            glass: true,
            padding: const EdgeInsets.all(40),
            child: Icon(icon, size: 72, color: accent),
          ),
          const SizedBox(height: 40),
          Text(title, style: AppTypography.displaySmall, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          Text(
            body,
            style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary, height: 1.6),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
