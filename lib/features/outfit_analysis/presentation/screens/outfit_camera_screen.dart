import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../widgets/outfit_capture_panel.dart';

/// Guided full-body outfit camera — same luxury UX as skin analysis capture.
class OutfitCameraScreen extends StatefulWidget {
  const OutfitCameraScreen({super.key});

  @override
  State<OutfitCameraScreen> createState() => _OutfitCameraScreenState();
}

class _OutfitCameraScreenState extends State<OutfitCameraScreen> {
  File? _capturedImage;
  bool _captureTrusted = false;

  void _continue() {
    final image = _capturedImage;
    if (image == null) return;
    Navigator.pushNamed(
      context,
      AppRoutes.occasionSelect,
      arguments: OutfitOccasionRouteArgs(
        imagePath: image.path,
        mode: OutfitAnalysisMode.quick,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasPhoto = _capturedImage != null;

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
        appBar: const MiraAppBar(pageTitle: 'التقطي إطلالتك'),
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
                        'كاميرا إطلالة MIRA',
                        style: AppTypography.headlineSmall.copyWith(color: AppColors.onPrimary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        hasPhoto
                            ? 'راجعي الصورة ثم اختاري المناسبة'
                            : 'أظهري الرأس والكتفين وكامل الإطلالة والحذاء داخل الإطار',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.onPrimary.withValues(alpha: 0.78),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: OutfitCapturePanel(
                    capturedImage: _capturedImage,
                    onImageChanged: (file) => setState(() => _capturedImage = file),
                    onValidationChanged: (v) => setState(() => _captureTrusted = v.isValid),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                  child: PremiumButton(
                    label: hasPhoto ? 'اختيار المناسبة' : 'التقطي إطلالتك أولاً',
                    icon: Icons.arrow_back_rounded,
                    variant: PremiumButtonVariant.gold,
                    onPressed: hasPhoto && _captureTrusted ? _continue : null,
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
