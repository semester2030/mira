import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/services/privacy_consent_storage.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class OutfitUploadScreen extends StatefulWidget {
  const OutfitUploadScreen({super.key});

  @override
  State<OutfitUploadScreen> createState() => _OutfitUploadScreenState();
}

class _OutfitUploadScreenState extends State<OutfitUploadScreen> {
  File? _image;
  bool _checkingConsent = true;
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _ensureConsent();
  }

  Future<void> _ensureConsent() async {
    final accepted = await PrivacyConsentStorage.isAccepted();
    if (!accepted && mounted) {
      final result = await Navigator.pushNamed<bool>(context, AppRoutes.privacyConsent);
      if (result != true && mounted) {
        Navigator.pop(context);
        return;
      }
    }
    if (mounted) setState(() => _checkingConsent = false);
  }

  Future<void> _pickImage(ImageSource source) async {
    final file = await _picker.pickImage(source: source, imageQuality: 85);
    if (file != null) setState(() => _image = File(file.path));
  }

  void _continue() {
    if (_image == null) return;
    Navigator.pushNamed(
      context,
      AppRoutes.occasionSelect,
      arguments: OutfitOccasionRouteArgs(imagePath: _image!.path),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingConsent) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!AppSession.canBrowse) {
      return Scaffold(
        appBar: AppBar(title: const Text('تحليل الإطلالة')),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'سجّلي دخولك لتحليل إطلالتك بشكل خاص',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('تحليل الإطلالة')),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (AppSession.isGuest) const GuestBanner(),
                const SectionHeader(
                  title: 'صورة إطلالتك',
                  subtitle: 'التقطي أو اختاري صورة واضحة — لا نحفظ الصورة بعد التحليل',
                ),
                const SizedBox(height: 20),
                PressableScale(
                  onTap: () => _showPickSheet(context),
                  child: Container(
                    width: double.infinity,
                    height: 220,
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: _image != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: Image.file(_image!, fit: BoxFit.cover, width: double.infinity),
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.checkroom_outlined,
                                size: 48,
                                color: AppColors.primary.withValues(alpha: 0.8),
                              ),
                              const SizedBox(height: 12),
                              Text('اضغطي لإضافة صورة', style: AppTypography.titleMedium),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 28),
                PremiumButton(
                  label: 'اختيار المناسبة',
                  icon: Icons.arrow_back_rounded,
                  onPressed: _image != null ? _continue : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showPickSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded),
              title: const Text('الكاميرا'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('المعرض'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }
}
