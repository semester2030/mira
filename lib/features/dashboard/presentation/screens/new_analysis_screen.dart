import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/mira_report_navigation.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../../core/utils/mira_api_error_message.dart';
import '../../../packages/presentation/providers/package_credit_provider.dart';
import '../../../skin_analysis/data/repositories/skin_analysis_repository_impl.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_bloc.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_event.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_state.dart';
import '../../../skin_analysis/presentation/widgets/face_capture_panel.dart';

class NewAnalysisScreen extends ConsumerStatefulWidget {
  const NewAnalysisScreen({super.key});

  @override
  ConsumerState<NewAnalysisScreen> createState() => _NewAnalysisScreenState();
}

class _NewAnalysisScreenState extends ConsumerState<NewAnalysisScreen> {
  File? _capturedImage;
  bool _guestAnalyzing = false;
  final _guestRepo = GuestSkinAnalysisRepository();

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
      MiraReportNavigation.openAfterAnalysis(context, report);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyMiraError(e)), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _guestAnalyzing = false);
    }
  }

  Future<void> _startSignedInAnalysis(BuildContext context) async {
    if (_capturedImage == null) return;
    if (MiraFeatures.packagesEnabled && !AppSession.isGuest) {
      final ok = await PackageCreditGate.ensureSkinCredits(context, ref);
      if (!ok || !context.mounted) return;
    }
    context.read<SkinAnalysisBloc>().add(
          StartSkinAnalysis(imagePath: _capturedImage!.path),
        );
  }

  Future<void> _onSkinAnalysisSuccess(BuildContext context) async {
    if (MiraFeatures.packagesEnabled && !AppSession.isGuest) {
      try {
        await ref.read(userPackageProvider.notifier).consumeSkinCredit();
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.error),
        );
        return;
      }
    }
  }

  Widget _buildAnalysisBody({
    required bool loading,
    required VoidCallback? onAnalyze,
  }) {
    final hasPhoto = _capturedImage != null;

    return Container(
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
                    'تحليل البشرة بالذكاء الاصطناعي',
                    style: AppTypography.headlineSmall.copyWith(color: AppColors.onPrimary),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    hasPhoto
                        ? 'راجعي صورتك — ثم ابدئي التحليل'
                        : 'كاميرا ميرا الاحترافية — ثبّتي وجهك داخل الإطار',
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.onPrimary.withValues(alpha: 0.78),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: FaceCapturePanel(
                capturedImage: _capturedImage,
                enabled: !loading && !_guestAnalyzing,
                isAnalyzing: loading || _guestAnalyzing,
                onImageChanged: (file) => setState(() => _capturedImage = file),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              child: PremiumButton(
                label: loading
                    ? 'جاري التحليل بالذكاء الاصطناعي...'
                    : hasPhoto
                        ? 'بدء التحليل'
                        : 'التقطي صورتك أولاً',
                loading: loading,
                icon: Icons.auto_awesome_rounded,
                variant: PremiumButtonVariant.gold,
                onPressed: hasPhoto ? onAnalyze : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isGuest = AppSession.isGuest;

    if (!AppSession.canBrowse) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'تحليل البشرة'),
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
      return Theme(
        data: Theme.of(context).copyWith(
          appBarTheme: AppBarTheme(
            foregroundColor: AppColors.onPrimary,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
          ),
        ),
        child: Scaffold(
          extendBodyBehindAppBar: true,
          appBar: const MiraAppBar(pageTitle: 'تحليل البشرة'),
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
        ),
      );
    }

    return BlocProvider(
      create: (_) => SkinAnalysisBloc(),
      child: BlocConsumer<SkinAnalysisBloc, SkinAnalysisState>(
        listener: (context, state) async {
          if (state is SkinAnalysisSuccess) {
            await _onSkinAnalysisSuccess(context);
            if (!context.mounted) return;
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
            MiraReportNavigation.openAfterAnalysis(context, state.report);
          } else if (state is SkinAnalysisFailure) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          final loading = state is SkinAnalysisLoading;
          return Theme(
            data: Theme.of(context).copyWith(
              appBarTheme: AppBarTheme(
                foregroundColor: AppColors.onPrimary,
                backgroundColor: Colors.transparent,
                surfaceTintColor: Colors.transparent,
              ),
            ),
            child: Scaffold(
              extendBodyBehindAppBar: true,
              appBar: const MiraAppBar(pageTitle: 'تحليل البشرة'),
              body: _buildAnalysisBody(
                loading: loading,
                onAnalyze: canAnalyze && !loading
                    ? () => _startSignedInAnalysis(context)
                    : null,
              ),
            ),
          );
        },
      ),
    );
  }
}
