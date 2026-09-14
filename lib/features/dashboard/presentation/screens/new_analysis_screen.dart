import 'dart:async';
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
import '../../../face_analysis_experience/presentation/analysis/analysis_motion.dart';
import '../../../face_analysis_experience/presentation/result/result_mirror.dart';
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
  bool _submitLock = false;
  final _guestRepo = GuestSkinAnalysisRepository();

  FaceAnalysisJourneyPhase _journey = FaceAnalysisJourneyPhase.idle;
  FaceAnalysisJourneyError? _journeyError;
  Completer<void>? _motionHandoff;
  String? _resultMirrorHoldPath;

  bool get _motionOn => FaceAnalysisMotionFlag.enabled;

  bool get _softLaserActive =>
      _motionOn && faceAnalysisAllowsSoftLaser(_journey);

  void _beginProcessingMotion() {
    if (!_motionOn) return;
    _motionHandoff = Completer<void>();
  }

  void _onMotionHandoff() {
    final gate = _motionHandoff;
    if (gate != null && !gate.isCompleted) {
      gate.complete();
    }
  }

  Future<void> _awaitMotionHandoffIfNeeded() async {
    if (!_motionOn) return;
    final gate = _motionHandoff;
    if (gate == null) return;
    final maxWait = AnalysisMotionTimingPolicy.defaults.softMinChoreography +
        AnalysisMotionTimingPolicy.defaults.maxDelayAfterSuccess +
        AnalysisMotionTimingPolicy.defaults.completing +
        const Duration(milliseconds: 200);
    try {
      await gate.future.timeout(maxWait);
    } on TimeoutException {
      // Never hold navigation purely for theatre.
    }
  }

  Future<String?> _prepareResultMirrorHold() async {
    if (!FaceResultMirrorFlag.enabled || _capturedImage == null) return null;
    return FaceResultMirrorImageHold.prepareFrom(_capturedImage!.path);
  }

  Future<void> _onReportRouteClosed(Object? result) async {
    final retake = result == FaceRetakePolicy.popResult;
    if (retake) {
      FaceHistoryAnalytics.retakeCompleted();
    }
    _resultMirrorHoldPath = null;
    if (!mounted) return;
    if (!retake) return;
    setState(() {
      _capturedImage = null;
      _journey = FaceAnalysisJourneyPhase.idle;
      _journeyError = null;
      _motionHandoff = null;
      _submitLock = false;
    });
  }

  Future<bool> _captureStillValid() async {
    final file = _capturedImage;
    if (file == null) return false;
    try {
      return await file.exists();
    } catch (_) {
      return false;
    }
  }

  Future<void> _clearCaptureForRecapture() async {
    setState(() {
      _capturedImage = null;
      _journey = FaceAnalysisJourneyPhase.idle;
      _journeyError = null;
      _submitLock = false;
      _motionHandoff = null;
    });
  }

  Future<void> _runGuestAnalysis(BuildContext context) async {
    if (_submitLock || _capturedImage == null) return;
    if (!await _captureStillValid()) {
      await _clearCaptureForRecapture();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('الصورة غير متاحة — أعيدي التصوير.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }
    _submitLock = true;
    setState(() {
      _guestAnalyzing = true;
      _journey = FaceAnalysisJourneyPhase.submitting;
      _journeyError = null;
    });
    final mirrorHold = await _prepareResultMirrorHold();
    _resultMirrorHoldPath = mirrorHold;
    try {
      final report = await _guestRepo.analyzeFromImage(
        _capturedImage!.path,
        onRemoteWaitStarted: () {
          if (!mounted) return;
          _beginProcessingMotion();
          setState(() => _journey = FaceAnalysisJourneyPhase.processing);
        },
      );
      AnalysisSession.setSkin(report);
      if (!context.mounted) return;
      if (_motionOn) {
        setState(() => _journey = FaceAnalysisJourneyPhase.completed);
        await _awaitMotionHandoffIfNeeded();
        if (!context.mounted) return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'تجربة زائر — النتيجة للعرض فقط. سجّلي لحفظ تحليلاتك.',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
          ),
          backgroundColor: AppColors.secondary,
        ),
      );
      MiraReportNavigation.openAfterAnalysis(
        context,
        report,
        captureImagePath: mirrorHold,
      ).then(_onReportRouteClosed);
    } catch (e) {
      await FaceResultMirrorImageHold.release(mirrorHold);
      _resultMirrorHoldPath = null;
      if (!context.mounted) return;
      final mapped = mapFaceAnalysisError(message: friendlyMiraError(e));
      setState(() {
        _journeyError = mapped;
        _journey = mapped.requiresRecapture
            ? FaceAnalysisJourneyPhase.captureRejected
            : FaceAnalysisJourneyPhase.serviceUnavailable;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(mapped.snackMessage),
          backgroundColor: AppColors.error,
          action: SnackBarAction(
            label: mapped.requiresRecapture ? 'إعادة التصوير' : 'إعادة المحاولة',
            textColor: AppColors.onPrimary,
            onPressed: () {
              if (mapped.requiresRecapture) {
                _clearCaptureForRecapture();
              }
            },
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _guestAnalyzing = false;
          _submitLock = false;
          if (_journey == FaceAnalysisJourneyPhase.completed ||
              _journey == FaceAnalysisJourneyPhase.processing ||
              _journey == FaceAnalysisJourneyPhase.submitting) {
            _journey = FaceAnalysisJourneyPhase.ready;
            _journeyError = null;
          }
        });
      } else {
        _submitLock = false;
      }
    }
  }

  Future<void> _startSignedInAnalysis(BuildContext context) async {
    if (_submitLock || _capturedImage == null) return;
    if (!await _captureStillValid()) {
      await _clearCaptureForRecapture();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('الصورة غير متاحة — أعيدي التصوير.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }
    if (MiraFeatures.packagesEnabled && !AppSession.isGuest) {
      final ok = await PackageCreditGate.ensureSkinCredits(context, ref);
      if (!ok || !context.mounted) return;
    }
    _submitLock = true;
    setState(() {
      _journey = FaceAnalysisJourneyPhase.submitting;
      _journeyError = null;
    });
    _resultMirrorHoldPath = await _prepareResultMirrorHold();
    if (!context.mounted) {
      _submitLock = false;
      return;
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
          SnackBar(
            content: Text(friendlyMiraError(e)),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
    }
  }

  String _statusCopy({required bool hasPhoto, required bool busy}) {
    if (!hasPhoto) {
      return 'كاميرا ميرا الاحترافية — ثبّتي وجهك داخل الإطار';
    }
    switch (_journey) {
      case FaceAnalysisJourneyPhase.submitting:
        return 'جاري تجهيز الصورة...';
      case FaceAnalysisJourneyPhase.processing:
      case FaceAnalysisJourneyPhase.accepted:
        return 'جاري تحليل الوجه...';
      case FaceAnalysisJourneyPhase.completed:
        return 'اكتمل تحليل الوجه';
      case FaceAnalysisJourneyPhase.captureRejected:
        return _journeyError?.titleAr ?? 'تعذر اعتماد الصورة';
      case FaceAnalysisJourneyPhase.serviceUnavailable:
      case FaceAnalysisJourneyPhase.timeout:
      case FaceAnalysisJourneyPhase.submissionFailed:
      case FaceAnalysisJourneyPhase.processingFailed:
        return _journeyError?.titleAr ?? 'تعذر بدء التحليل حاليًا';
      default:
        return busy ? 'جاري بدء التحليل...' : 'تم التقاط الصورة';
    }
  }

  String _buttonLabel({required bool hasPhoto, required bool busy}) {
    if (busy) {
      if (_journey == FaceAnalysisJourneyPhase.processing ||
          _journey == FaceAnalysisJourneyPhase.accepted) {
        return 'جاري تحليل الوجه...';
      }
      if (_journey == FaceAnalysisJourneyPhase.completed) {
        return 'اكتمل تحليل الوجه';
      }
      return 'جاري بدء التحليل...';
    }
    if (!hasPhoto) return 'التقطي صورتك أولاً';
    if (_journeyError?.requiresRecapture == true) return 'إعادة التصوير';
    if (_journeyError != null && _journeyError!.retryable) {
      return 'إعادة المحاولة';
    }
    return 'بدء التحليل';
  }

  Widget _buildAnalysisBody({
    required bool loading,
    required VoidCallback? onAnalyze,
  }) {
    final hasPhoto = _capturedImage != null;
    final analyzing = loading || _guestAnalyzing;
    final softLaser = _softLaserActive && analyzing;
    final pipeline = pipelineStatusForSoftLaser(_journey) ??
        AnalysisPipelineStatus.idle;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            FaceExperienceTokens.captureGradientTop,
            FaceExperienceTokens.captureGradientBottom,
          ],
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
                    'تحليل الوجه',
                    style: AppTypography.headlineSmall
                        .copyWith(color: AppColors.onPrimary),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _statusCopy(hasPhoto: hasPhoto, busy: analyzing),
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.onPrimary.withValues(alpha: 0.78),
                    ),
                  ),
                  if (_journeyError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _journeyError!.bodyAr,
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.onPrimary.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: FaceCapturePanel(
                capturedImage: _capturedImage,
                enabled: !analyzing && !_submitLock,
                isAnalyzing: softLaser,
                analysisPipelineStatus:
                    softLaser ? pipeline : AnalysisPipelineStatus.idle,
                analysisErrorMessage: _journeyError?.snackMessage,
                onAnalysisMotionHandoff: _onMotionHandoff,
                onImageChanged: (file) => setState(() {
                  _capturedImage = file;
                  _journey = file == null
                      ? FaceAnalysisJourneyPhase.idle
                      : FaceAnalysisJourneyPhase.ready;
                  _journeyError = null;
                  _submitLock = false;
                }),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              child: PremiumButton(
                label: _buttonLabel(hasPhoto: hasPhoto, busy: analyzing),
                loading: analyzing,
                icon: Icons.auto_awesome_rounded,
                variant: PremiumButtonVariant.gold,
                onPressed: analyzing || _submitLock
                    ? null
                    : (_journeyError?.requiresRecapture == true
                        ? () => _clearCaptureForRecapture()
                        : onAnalyze),
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
        appBar: const MiraAppBar(pageTitle: 'تحليل الوجه'),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'أو تصفّحي كزائرة من شاشة الدخول.',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    final canAnalyze = _capturedImage != null && !_guestAnalyzing && !_submitLock;

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
          appBar: const MiraAppBar(pageTitle: 'تحليل الوجه'),
          body: Column(
            children: [
              const GuestBanner(),
              Expanded(
                child: _buildAnalysisBody(
                  loading: _guestAnalyzing,
                  onAnalyze:
                      canAnalyze ? () => _runGuestAnalysis(context) : null,
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
          if (state is SkinAnalysisSubmitting) {
            setState(() {
              _journey = FaceAnalysisJourneyPhase.submitting;
              _journeyError = null;
            });
          } else if (state is SkinAnalysisProcessing) {
            _beginProcessingMotion();
            setState(() => _journey = FaceAnalysisJourneyPhase.processing);
          } else if (state is SkinAnalysisSuccess) {
            await _onSkinAnalysisSuccess(context);
            if (!context.mounted) return;
            AnalysisSession.setSkin(state.report);
            if (_motionOn) {
              setState(() => _journey = FaceAnalysisJourneyPhase.completed);
              await _awaitMotionHandoffIfNeeded();
              if (!context.mounted) return;
            }
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'اكتمل تحليل الوجه ✨',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.onPrimary),
                ),
                backgroundColor: AppColors.success,
              ),
            );
            MiraReportNavigation.openAfterAnalysis(
              context,
              state.report,
              captureImagePath: _resultMirrorHoldPath,
            ).then((result) async {
              await _onReportRouteClosed(result);
            });
            if (mounted) {
              setState(() {
                _journey = FaceAnalysisJourneyPhase.ready;
                _journeyError = null;
                _submitLock = false;
              });
            }
          } else if (state is SkinAnalysisFailure) {
            if (_resultMirrorHoldPath != null) {
              await FaceResultMirrorImageHold.release(_resultMirrorHoldPath);
              _resultMirrorHoldPath = null;
            }
            final err = state.journeyError ??
                mapFaceAnalysisError(message: state.message);
            if (!mounted) return;
            setState(() {
              _journeyError = err;
              _submitLock = false;
              _journey = err.requiresRecapture
                  ? FaceAnalysisJourneyPhase.captureRejected
                  : (err.code == 'TIMEOUT'
                      ? FaceAnalysisJourneyPhase.timeout
                      : FaceAnalysisJourneyPhase.serviceUnavailable);
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(err.snackMessage),
                backgroundColor: AppColors.error,
                action: SnackBarAction(
                  label: err.requiresRecapture
                      ? 'إعادة التصوير'
                      : 'إعادة المحاولة',
                  textColor: AppColors.onPrimary,
                  onPressed: () {
                    if (err.requiresRecapture) {
                      _clearCaptureForRecapture();
                    }
                  },
                ),
              ),
            );
          }
        },
        builder: (context, state) {
          final loading = state is SkinAnalysisSubmitting ||
              state is SkinAnalysisProcessing ||
              state is SkinAnalysisLoading ||
              (_motionOn &&
                  _journey == FaceAnalysisJourneyPhase.completed &&
                  state is SkinAnalysisSuccess);
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
              appBar: const MiraAppBar(pageTitle: 'تحليل الوجه'),
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
