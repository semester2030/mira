import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import '../../domain/outfit_capture_availability.dart';

/// Gallery path used while outfit camera capture is paused.
/// The live camera screens stay in the project for a later professional capture.
class OutfitGalleryEntryScreen extends StatefulWidget {
  final OutfitAnalysisMode mode;

  const OutfitGalleryEntryScreen({super.key, this.mode = OutfitAnalysisMode.quick});

  @override
  State<OutfitGalleryEntryScreen> createState() => _OutfitGalleryEntryScreenState();
}

class _OutfitGalleryEntryScreenState extends State<OutfitGalleryEntryScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _picking = false;

  Future<void> _pick() async {
    if (_picking) return;
    setState(() => _picking = true);
    try {
      final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 88);
      if (picked == null || !mounted) return;
      await Navigator.pushNamed(
        context,
        AppRoutes.occasionSelect,
        arguments: OutfitOccasionRouteArgs(imagePath: File(picked.path).path, mode: widget.mode),
      );
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'تحليل الإطلالة'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.photo_library_outlined, size: 42, color: AppColors.gold),
              const SizedBox(height: 16),
              Text(
                outfitCameraPausedMessage,
                key: const Key('outfit-camera-paused'),
                style: AppTypography.bodyLarge.copyWith(height: 1.6),
              ),
              const Spacer(),
              PremiumButton(
                label: _picking ? 'جاري فتح الاستديو...' : 'اختيار صورة من الاستديو',
                icon: Icons.photo_outlined,
                onPressed: _picking ? null : _pick,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
