import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/data/repositories/skin_analysis_repository_impl.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_bloc.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_event.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_state.dart';
import '../../../skin_analysis/presentation/widgets/face_capture_panel.dart';

class NewAnalysisScreen extends StatefulWidget {
  const NewAnalysisScreen({super.key});

  @override
  State<NewAnalysisScreen> createState() => _NewAnalysisScreenState();
}

class _NewAnalysisScreenState extends State<NewAnalysisScreen> {
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
                    ? () {
                        context.read<SkinAnalysisBloc>().add(
                              StartSkinAnalysis(imagePath: _capturedImage!.path),
                            );
                      }
                    : null,
              ),
            ),
          );
        },
      ),
    );
  }
}
