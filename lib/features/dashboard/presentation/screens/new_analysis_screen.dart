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
import '../../../skin_analysis/presentation/capture/perfect_camera_kit_gate.dart';
import '../../../skin_analysis/presentation/debug/mira_measure_trace.dart';
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

  /// Monotonic attempt id — stale responses / late timeouts must not win.
  int _analysisAttemptId = 0;
  int _activeAttemptId = 0;

  /// Matches SkinAnalysisApiDataSource receiveTimeout (180s) + small slack.
  static const _analysisTimeout = Duration(seconds: 185);

  @override
  void initState() {
    super.initState();
    MiraMeasureTrace.beginRun(
      'CKMEAS-${DateTime.now().toUtc().millisecondsSinceEpoch}',
    );
    MiraMeasureTrace.beginSession();
  }

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

  Future<void> _onReportRouteClosed(Object? result) async {
    final retake = result == FaceRetakePolicy.popResult;
    if (retake) {
      FaceHistoryAnalytics.retakeCompleted();
    }
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
    _analysisAttemptId += 1; // invalidate in-flight analysis
    setState(() {
      _capturedImage = null;
      _journey = FaceAnalysisJourneyPhase.idle;
      _journeyError = null;
      _submitLock = false;
      _motionHandoff = null;
    });
  }

  bool _isActiveAttempt(int attempt) => attempt == _analysisAttemptId;

  /// Starts analysis for the current capture. Always callable from capture
  /// callback — does NOT depend on build-time `onAnalyze` which was null
  /// while `_capturedImage == null` (stale closure bug).
  void _startAnalysisForCurrentCapture(BuildContext context) {
    if (_submitLock || _capturedImage == null) {
      debugPrint(
        'Mira analysis: start SKIPPED lock=$_submitLock '
        'hasPhoto=${_capturedImage != null} '
        'probe=${PerfectCameraKitGate.buildProbeTag}',
      );
      return;
    }
    final attempt = ++_analysisAttemptId;
    _activeAttemptId = attempt;
    final t0 = DateTime.now().toUtc().toIso8601String();
    MiraMeasureTrace.span(
      'T4_ANALYSIS_INVOKE',
      detail: 'attempt=$attempt guest=${AppSession.isGuest}',
    );
    debugPrint(
      'Mira analysis: START attempt=$attempt t0=$t0 '
      'guest=${AppSession.isGuest} '
      'path=${_capturedImage!.path} '
      'probe=${PerfectCameraKitGate.buildProbeTag}',
    );
    if (AppSession.isGuest) {
      unawaited(_runGuestAnalysis(context, attempt: attempt));
    } else {
      unawaited(_startSignedInAnalysis(context, attempt: attempt));
    }
  }

  Future<void> _runGuestAnalysis(
    BuildContext context, {
    required int attempt,
  }) async {
    if (!_isActiveAttempt(attempt)) return;
    if (_submitLock || _capturedImage == null) return;
    if (!await _captureStillValid()) {
      if (!_isActiveAttempt(attempt)) return;
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
    if (!_isActiveAttempt(attempt) || !context.mounted) return;
    _submitLock = true;
    setState(() {
      _guestAnalyzing = true;
      _journey = FaceAnalysisJourneyPhase.submitting;
      _journeyError = null;
    });
    final sw = Stopwatch()..start();
    try {
      final report = await _guestRepo
          .analyzeFromImage(
            _capturedImage!.path,
            onRemoteWaitStarted: () {
              if (!mounted || !_isActiveAttempt(attempt)) return;
              _beginProcessingMotion();
              setState(() => _journey = FaceAnalysisJourneyPhase.processing);
              debugPrint(
                'Mira analysis: PROCESSING attempt=$attempt '
                'elapsedMs=${sw.elapsedMilliseconds}',
              );
            },
          )
          .timeout(_analysisTimeout);
      if (!_isActiveAttempt(attempt)) {
        debugPrint(
          'Mira analysis: SUCCESS IGNORED stale attempt=$attempt '
          'current=$_analysisAttemptId',
        );
        return;
      }
      AnalysisSession.setSkin(report);
      if (!context.mounted) return;
      debugPrint(
        'Mira analysis: SUCCESS attempt=$attempt '
        'elapsedMs=${sw.elapsedMilliseconds}',
      );
      if (_motionOn) {
        setState(() => _journey = FaceAnalysisJourneyPhase.completed);
        await _awaitMotionHandoffIfNeeded();
        if (!context.mounted || !_isActiveAttempt(attempt)) return;
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
        captureImagePath: AnalysisSession.lastEphemeralFacePath,
      ).then(_onReportRouteClosed);
      MiraMeasureTrace.span('T11_RESULT_NAV_PUSHED', detail: 'guest=1');
    } on TimeoutException {
      if (!context.mounted || !_isActiveAttempt(attempt)) return;
      debugPrint(
        'Mira analysis: TIMEOUT attempt=$attempt '
        'elapsedMs=${sw.elapsedMilliseconds}',
      );
      final mapped = mapFaceAnalysisError(
        code: 'TIMEOUT',
        message: 'analysis_timeout',
      );
      setState(() {
        _journeyError = mapped;
        _journey = FaceAnalysisJourneyPhase.timeout;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(mapped.snackMessage),
          backgroundColor: AppColors.error,
          action: SnackBarAction(
            label: 'إعادة المحاولة',
            textColor: AppColors.onPrimary,
            onPressed: () {},
          ),
        ),
      );
    } catch (e) {
      if (!context.mounted || !_isActiveAttempt(attempt)) return;
      debugPrint(
        'Mira analysis: FAIL attempt=$attempt '
        'elapsedMs=${sw.elapsedMilliseconds} err=${friendlyMiraError(e)}',
      );
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
      if (!_isActiveAttempt(attempt)) {
        // Newer attempt owns UI — do not unlock/clear.
      } else if (mounted) {
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

  Future<void> _startSignedInAnalysis(
    BuildContext context, {
    required int attempt,
  }) async {
    if (!_isActiveAttempt(attempt)) return;
    if (_submitLock || _capturedImage == null) return;
    if (!await _captureStillValid()) {
      if (!_isActiveAttempt(attempt)) return;
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
    if (!context.mounted || !_isActiveAttempt(attempt)) return;
    if (MiraFeatures.packagesEnabled && !AppSession.isGuest) {
      final ok = await PackageCreditGate.ensureSkinCredits(context, ref);
      if (!ok || !context.mounted || !_isActiveAttempt(attempt)) return;
    }
    _submitLock = true;
    setState(() {
      _journey = FaceAnalysisJourneyPhase.submitting;
      _journeyError = null;
    });
    if (!context.mounted) {
      _submitLock = false;
      return;
    }
    debugPrint(
      'Mira analysis: DISPATCH StartSkinAnalysis attempt=$attempt '
      'path=${_capturedImage!.path}',
    );
    context.read<SkinAnalysisBloc>().add(
          StartSkinAnalysis(
            imagePath: _capturedImage!.path,
            attemptId: attempt,
          ),
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
      return 'ضعي وجهك داخل الإطار واضغطي للتصوير';
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
      case FaceAnalysisJourneyPhase.ready:
      case FaceAnalysisJourneyPhase.captured:
      case FaceAnalysisJourneyPhase.localValidation:
        if (busy) return 'جاري تجهيز الصورة...';
        // Truthful: capture accepted; analysis not yet running.
        return 'تم التقاط الصورة';
      default:
        return busy ? 'جاري تجهيز الصورة...' : 'تم التقاط الصورة';
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
    if (_journeyError?.requiresRecapture == true) return 'إعادة التصوير';
    if (_journeyError != null && _journeyError!.retryable) {
      return 'إعادة المحاولة';
    }
    if (hasPhoto) return 'بدء التحليل';
    return 'التقاط صورة';
  }

  Widget _buildAnalysisBody({
    required bool loading,
    required BuildContext analysisContext,
  }) {
    final hasPhoto = _capturedImage != null;
    final analyzing = loading || _guestAnalyzing;
    final softLaser = _softLaserActive && analyzing;
    final pipeline = pipelineStatusForSoftLaser(_journey) ??
        AnalysisPipelineStatus.idle;
    // Show CTA while analyzing (progress), on retryable errors, or as
    // fallback when capture exists but analysis has not started yet.
    final showBottomCta = analyzing ||
        hasPhoto ||
        (_journeyError != null &&
            (_journeyError!.requiresRecapture || _journeyError!.retryable));

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
                onImageChanged: (file) {
                  final becameCaptured =
                      file != null && _capturedImage == null;
                  setState(() {
                    _capturedImage = file;
                    _journey = file == null
                        ? FaceAnalysisJourneyPhase.idle
                        : FaceAnalysisJourneyPhase.ready;
                    _journeyError = null;
                    if (file == null) _submitLock = false;
                  });
                  if (!becameCaptured) return;
                  debugPrint(
                    'Mira analysis: capture ACCEPTED → schedule start '
                    'probe=${PerfectCameraKitGate.buildProbeTag}',
                  );
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (!mounted || _capturedImage == null) {
                      debugPrint(
                        'Mira analysis: post-frame SKIPPED '
                        'mounted=$mounted hasPhoto=${_capturedImage != null}',
                      );
                      return;
                    }
                    if (_submitLock || _guestAnalyzing) {
                      debugPrint(
                        'Mira analysis: post-frame SKIPPED already in-flight '
                        'lock=$_submitLock guest=$_guestAnalyzing',
                      );
                      return;
                    }
                    debugPrint('Mira analysis: post-frame INVOKING start');
                    _startAnalysisForCurrentCapture(analysisContext);
                  });
                },
              ),
            ),
            if (showBottomCta)
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
                          : () =>
                              _startAnalysisForCurrentCapture(analysisContext)),
                ),
              )
            else
              const SizedBox(height: 20),
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
                  analysisContext: context,
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
            if (state.attemptId != null &&
                state.attemptId != _activeAttemptId) {
              return;
            }
            setState(() {
              _journey = FaceAnalysisJourneyPhase.submitting;
              _journeyError = null;
            });
          } else if (state is SkinAnalysisProcessing) {
            if (state.attemptId != null &&
                state.attemptId != _activeAttemptId) {
              return;
            }
            _beginProcessingMotion();
            setState(() => _journey = FaceAnalysisJourneyPhase.processing);
          } else if (state is SkinAnalysisSuccess) {
            if (state.attemptId != null &&
                state.attemptId != _activeAttemptId) {
              debugPrint(
                'Mira analysis: SUCCESS IGNORED stale '
                'attempt=${state.attemptId} current=$_activeAttemptId',
              );
              return;
            }
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
            MiraMeasureTrace.span('T11_RESULT_NAV_PUSHED', detail: 'guest=0');
            MiraReportNavigation.openAfterAnalysis(
              context,
              state.report,
              captureImagePath: AnalysisSession.lastEphemeralFacePath,
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
            if (state.attemptId != null &&
                state.attemptId != _activeAttemptId) {
              debugPrint(
                'Mira analysis: FAILURE IGNORED stale '
                'attempt=${state.attemptId} current=$_activeAttemptId',
              );
              return;
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
                analysisContext: context,
              ),
            ),
          );
        },
      ),
    );
  }
}
