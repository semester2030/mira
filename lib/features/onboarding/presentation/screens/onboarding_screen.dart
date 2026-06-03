import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/onboarding_storage.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

/// شاشتان ترحيب — بدون مؤقت؛ الانتقال بزر فقط.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _page = 0;

  Future<void> _finish() async {
    await OnboardingStorage.setComplete();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, AppRoutes.login);
  }

  void _onContinue() {
    if (_page == 0) {
      setState(() => _page = 1);
      _pageController.animateToPage(
        1,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
      return;
    }
    _finish();
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
        showOrbs: false,
        showParticles: false,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Text(
                  _page == 0 ? '١ من ٢' : '٢ من ٢',
                  style: AppTypography.labelLarge.copyWith(color: AppColors.primary),
                ),
              ),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  children: const [
                    _WelcomePageOne(),
                    _WelcomePageTwo(),
                  ],
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(2, (i) {
                  final active = _page == i;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 280),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: active ? 28 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: PremiumButton(
                  label: _page == 0 ? 'التالي' : 'ابدئي رحلتك مع ميرا ✨',
                  icon: _page == 0 ? Icons.arrow_back_rounded : Icons.favorite_rounded,
                  onPressed: _onContinue,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WelcomePageOne extends StatelessWidget {
  const _WelcomePageOne();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: const MirraLogo.large(),
      ),
    );
  }
}

class _WelcomePageTwo extends StatelessWidget {
  const _WelcomePageTwo();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: PremiumCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            _feature(Icons.face_retouching_natural_rounded, 'تحليل البشرة', 'نصائح مخصّصة لنوع بشرتكِ'),
            const SizedBox(height: 16),
            _feature(Icons.checkroom_rounded, 'تحليل الإطلالة', 'توافق الألوان مع مناسبتكِ'),
            const SizedBox(height: 16),
            _feature(Icons.auto_awesome_rounded, 'توصيات ميرا', 'مكياج وإكسسوارات تناسبكِ'),
            const SizedBox(height: 16),
            _feature(Icons.shield_outlined, 'خصوصية أولاً', 'صوركِ للتحليل فقط — لا نُحفظها'),
          ],
        ),
      ),
    );
  }

  static Widget _feature(IconData icon, String title, String sub) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.primaryLight.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: AppColors.primary, size: 26),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTypography.titleMedium),
              const SizedBox(height: 4),
              Text(
                sub,
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
