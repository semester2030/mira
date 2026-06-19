import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import '../widgets/outfit_live_capture_panel.dart';

/// Premium live outfit capture — full-body guided camera (V2).
class OutfitLiveCaptureScreen extends StatefulWidget {
  const OutfitLiveCaptureScreen({super.key});

  @override
  State<OutfitLiveCaptureScreen> createState() => _OutfitLiveCaptureScreenState();
}

class _OutfitLiveCaptureScreenState extends State<OutfitLiveCaptureScreen> {
  File? _frozenImage;
  OutfitAnalysisMode _mode = OutfitAnalysisMode.quick;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args =
        ModalRoute.of(context)?.settings.arguments as OutfitLiveCaptureRouteArgs?;
    if (args != null) _mode = args.mode;
  }

  void _continue() {
    final image = _frozenImage;
    if (image == null) return;
    Navigator.pushNamed(
      context,
      AppRoutes.occasionSelect,
      arguments: OutfitOccasionRouteArgs(imagePath: image.path, mode: _mode),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!AppSession.canBrowse) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'التقط إطلالتك'),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'سجّلي دخولك لتحليل إطلالتك',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    final hasPhoto = _frozenImage != null;
    final modeLabel = _mode == OutfitAnalysisMode.quick
        ? 'تحليل سريع'
        : 'تحليل ذكي';

    return Theme(
      data: Theme.of(context).copyWith(
        appBarTheme: const AppBarTheme(
          foregroundColor: AppColors.onPrimary,
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
        ),
      ),
      child: Scaffold(
        extendBodyBehindAppBar: true,
        appBar: const MiraAppBar(pageTitle: 'التقط إطلالتك'),
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF2A1A24), Color(0xFF120C10)],
            ),
          ),
          child: SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'كاميرا إطلالة MIRA · $modeLabel',
                        style: AppTypography.headlineSmall.copyWith(color: AppColors.onPrimary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        hasPhoto
                            ? 'تم تجميد الإطار — راجعي الصورة ثم اختاري المناسبة'
                            : 'ضعي جسمك بالكامل داخل الإطار',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.onPrimary.withValues(alpha: 0.78),
                        ),
                      ),
                      if (!hasPhoto) ...[
                        const SizedBox(height: 4),
                        Text(
                          'يجب أن تظهر الرأس، القطع، والحذاء',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.gold.withValues(alpha: 0.85),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Expanded(
                  child: OutfitLiveCapturePanel(
                    frozenImage: _frozenImage,
                    onImageChanged: (file) => setState(() => _frozenImage = file),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                  child: PremiumButton(
                    label: hasPhoto ? 'اختيار المناسبة' : 'التقط إطلالتك أولاً',
                    icon: Icons.arrow_back_rounded,
                    variant: PremiumButtonVariant.gold,
                    onPressed: hasPhoto ? _continue : null,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
