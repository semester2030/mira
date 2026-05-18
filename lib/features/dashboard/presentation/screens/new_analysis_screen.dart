import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/services/privacy_consent_storage.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../skin_analysis/data/repositories/skin_analysis_repository_impl.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_bloc.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_event.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_state.dart';
import '../../../skin_analysis/presentation/widgets/face_frame_overlay.dart';

class NewAnalysisScreen extends StatefulWidget {
  const NewAnalysisScreen({super.key});

  @override
  State<NewAnalysisScreen> createState() => _NewAnalysisScreenState();
}

class _NewAnalysisScreenState extends State<NewAnalysisScreen> {
  File? _capturedImage;
  bool _guestAnalyzing = false;
  bool _checkingConsent = true;
  final _picker = ImagePicker();
  final _guestRepo = GuestSkinAnalysisRepository();

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

  Future<void> _pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (file != null) setState(() => _capturedImage = File(file.path));
  }

  Future<void> _runGuestAnalysis(BuildContext context) async {
    if (_capturedImage == null) return;
    setState(() => _guestAnalyzing = true);
    try {
      final report = await _guestRepo.analyzeFromImage(_capturedImage!.path);
      AnalysisSession.setSkin(report);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'تجربة زائر — النتيجة للعرض فقط. سجّلي لحفظ تحليلاتك.',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
          ),
          backgroundColor: AppColors.secondary,
        ),
      );
      Navigator.pushNamed(context, AppRoutes.skinResult, arguments: report);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _guestAnalyzing = false);
    }
  }

  Widget _buildAnalysisBody({
    required bool loading,
    required VoidCallback? onAnalyze,
  }) {
    return FloatingGradientBackground(
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(
                title: 'تحليل البشرة بالذكاء الاصطناعي',
                subtitle: 'التقطي صورة واضحة — ميرا تحلل نوع بشرتك تلقائياً',
              ),
              const SizedBox(height: 20),
              Center(
                child: PressableScale(
                  onTap: loading ? null : _pickImage,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const FaceFrameOverlay(),
                      if (_capturedImage != null)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Image.file(
                            _capturedImage!,
                            width: 160,
                            height: 200,
                            fit: BoxFit.cover,
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.surface.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.camera_alt_rounded,
                            size: 36,
                            color: AppColors.primary,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              PremiumButton(
                label: loading ? 'جاري التحليل بالذكاء الاصطناعي...' : 'بدء التحليل',
                loading: loading,
                icon: Icons.auto_awesome_rounded,
                variant: PremiumButtonVariant.gold,
                onPressed: onAnalyze,
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingConsent) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final isGuest = AppSession.isGuest;

    if (!AppSession.canBrowse) {
      return Scaffold(
        appBar: AppBar(title: const Text('تحليل البشرة')),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'أو تصفّحي كزائرة من شاشة الدخول.',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    final canAnalyze = _capturedImage != null && !_guestAnalyzing;

    if (isGuest) {
      return Scaffold(
        appBar: AppBar(title: const Text('تحليل البشرة')),
        body: Column(
          children: [
            const GuestBanner(),
            Expanded(
              child: _buildAnalysisBody(
                loading: _guestAnalyzing,
                onAnalyze: canAnalyze ? () => _runGuestAnalysis(context) : null,
              ),
            ),
          ],
        ),
      );
    }

    return BlocProvider(
      create: (_) => SkinAnalysisBloc(),
      child: BlocConsumer<SkinAnalysisBloc, SkinAnalysisState>(
        listener: (context, state) {
          if (state is SkinAnalysisSuccess) {
            AnalysisSession.setSkin(state.report);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'تم التحليل بنجاح ✨',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
                ),
                backgroundColor: AppColors.success,
              ),
            );
            Navigator.pushNamed(context, AppRoutes.skinResult, arguments: state.report);
          } else if (state is SkinAnalysisFailure) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          final loading = state is SkinAnalysisLoading;
          return Scaffold(
            appBar: AppBar(title: const Text('تحليل البشرة')),
            body: _buildAnalysisBody(
              loading: loading,
              onAnalyze: canAnalyze && !loading
                  ? () {
                      context.read<SkinAnalysisBloc>().add(
                            StartSkinAnalysis(imagePath: _capturedImage!.path),
                          );
                    }
                  : null,
            ),
          );
        },
      ),
    );
  }
}
