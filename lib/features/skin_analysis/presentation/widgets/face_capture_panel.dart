import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/face_gate/face_gate_result.dart';
import '../../../face_analysis_experience/capture/capture.dart';
import '../../../face_analysis_experience/presentation/analysis/analysis_motion.dart';
import '../../../face_analysis_experience/presentation/capture/capture_mirror.dart';
import '../../domain/image_quality/post_capture_minimal_gate.dart';
import '../capture/perfect_camera_kit_gate.dart';
import '../debug/mira_measure_trace.dart';
import '../live_face_map/face_mapping_context.dart';
import '../live_face_map/live_face_overlay_controller.dart';
import '../live_face_map/models/face_mesh_models.dart';
import '../live_face_map/scan_region_animation.dart';
import '../live_face_map/widgets/live_face_analysis_overlay.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../utils/face_image_processor.dart';

/// In-app front camera — mirrored preview matches captured review (no jump left/right).
class FaceCapturePanel extends StatefulWidget {
  final ValueChanged<File?> onImageChanged;
  final File? capturedImage;
  final bool enabled;
  final bool isAnalyzing;

  /// Phase 9D — when [FaceAnalysisMotionFlag] is on, drives Soft Laser stages.
  final AnalysisPipelineStatus analysisPipelineStatus;
  final String? analysisErrorMessage;
  final VoidCallback? onAnalysisMotionHandoff;

  const FaceCapturePanel({
    super.key,
    required this.onImageChanged,
    this.capturedImage,
    this.enabled = true,
    this.isAnalyzing = false,
    this.analysisPipelineStatus = AnalysisPipelineStatus.idle,
    this.analysisErrorMessage,
    this.onAnalysisMotionHandoff,
  });

  @override
  State<FaceCapturePanel> createState() => _FaceCapturePanelState();
}

class _FaceCapturePanelState extends State<FaceCapturePanel>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  CameraController? _controller;
  bool _isFrontCamera = true;
  bool _mirrorCapturedPreview = false;
  bool _initializing = true;
  String? _error;
  bool _capturing = false;
  bool _validatingFace = false;

  late final AnimationController _pulseController;
  late final AnimationController _scanController;
  late final AnimationController _sweepController;
  late final AnimationController _tipController;
  late final LiveFaceOverlayController _faceOverlayController;
  bool _imageStreamActive = false;
  Size _previewBoxSize = Size.zero;

  /// Phase 9C mirror — only constructed/used when flag ON.
  CaptureMirrorCoordinator? _mirrorCoordinator;
  double _captureFlashOpacity = 0;
  bool _mirrorAutoCaptureQueued = false;
  bool _cameraKitActive = false;
  String? _cameraKitGuidanceAr;
  /// Auto-capture disabled (manual shutter is the production path).
  static const bool _autoCaptureEnabled = false;
  /// Correlates press → takePicture → validate → analysis handoff.
  String? _manualAttemptId;

  static const _tips = [
    'ضعي وجهك داخل الإطار واضغطي للتصوير',
    'إضاءة أمامية تساعد على وضوح التحليل',
    'انظري للكاميرا مباشرة إن أمكن',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _scanController = AnimationController(
      vsync: this,
      duration: ScanRegionAnimation.cycleDuration,
    )..repeat();
    _sweepController = AnimationController(
      vsync: this,
      duration: ScanRegionAnimation.sweepDuration,
    )..repeat();
    _tipController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    )..repeat();
    _faceOverlayController = LiveFaceOverlayController();
    // Capture Mirror remains available as HUD chrome; CameraKit owns final gate on iOS.
    if (FaceCaptureMirrorFlag.enabled ||
        MiraFeatures.skinInteractiveReportV1) {
      _mirrorCoordinator = CaptureMirrorCoordinator();
    }
    PerfectCameraKitGate.addListener(_onCameraKitQuality);
    _initCameraKitThenCamera();
  }

  Future<void> _initCameraKitThenCamera() async {
    if (PerfectCameraKitGate.isPlatformSupported) {
      final ok = await PerfectCameraKitGate.initialize(
        level: 'moderate',
        // Production default: official MODERATE only. Experimental lighting
        // lower is opt-in and must not run unless explicitly enabled for A/B.
        experimentalLightingLower: false,
      );
      if (!mounted) return;
      setState(() {
        _cameraKitActive = ok;
      });
      if (!ok) {
        // CameraKit is guidance-only now — continue with mesh manual shutter.
        debugPrint(
          'Mira CameraKit init failed — continuing mesh manual capture. '
          'err=${PerfectCameraKitGate.initError}',
        );
      }
    }
    if (!mounted) return;
    await _initCamera();
  }

  @override
  void didUpdateWidget(covariant FaceCapturePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.capturedImage == null && widget.capturedImage != null) {
      _stopFaceStream();
      _pauseCamera();
      _detectFaceOnStill(widget.capturedImage!);
    } else if (oldWidget.capturedImage != null && widget.capturedImage == null) {
      _mirrorCapturedPreview = false;
      _faceOverlayController.reset();
      _mirrorCoordinator?.resetForRetake();
      _captureFlashOpacity = 0;
      _cameraKitGuidanceAr = null;
      _resumeCamera();
    }

    if (!oldWidget.isAnalyzing && widget.isAnalyzing) {
      _faceOverlayController.setAnalyzing(true);
      final captured = widget.capturedImage;
      if (captured != null) {
        _detectFaceOnStill(captured);
      }
    } else if (oldWidget.isAnalyzing && !widget.isAnalyzing) {
      _faceOverlayController.setAnalyzing(false);
    }
  }

  @override
  void dispose() {
    PerfectCameraKitGate.removeListener(_onCameraKitQuality);
    unawaited(PerfectCameraKitGate.dispose());
    WidgetsBinding.instance.removeObserver(this);
    _pulseController.dispose();
    _scanController.dispose();
    _sweepController.dispose();
    _tipController.dispose();
    _stopFaceStream();
    _faceOverlayController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  void _onCameraKitQuality(PerfectCameraKitQuality q) {
    if (!mounted || widget.capturedImage != null || _capturing) return;
    // Lighting / distance / pose from CameraKit are advisory tips only —
    // never shutter eligibility and never "أعيدي المحاولة" readiness loops.
    final block = PerfectCameraKitGate.lastBlockReason;
    final tip = PerfectCameraKitGate.guidanceArForBlock(block, q);
    if (_cameraKitGuidanceAr != tip) {
      setState(() => _cameraKitGuidanceAr = tip);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      _mirrorCoordinator?.onLifecycleInterrupt();
      _mirrorAutoCaptureQueued = false;
      _pauseCamera();
    } else if (state == AppLifecycleState.resumed &&
        widget.capturedImage == null &&
        !widget.isAnalyzing) {
      _mirrorCoordinator?.onLifecycleInterrupt();
      _resumeCamera();
    }
  }

  Future<void> _initCamera({CameraLensDirection direction = CameraLensDirection.front}) async {
    setState(() {
      _initializing = true;
      _error = null;
    });

    await _controller?.dispose();
    _controller = null;

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw Exception('لم يتم العثور على كاميرا');
      }

      final selected = cameras.firstWhere(
        (c) => c.lensDirection == direction,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        selected,
        // Perfect HD requires short side ≥ 1080. ResolutionPreset.high is often
        // 1280×720 (short=720) and fails PostCaptureMinimalGate — do not upscale.
        ResolutionPreset.veryHigh,
        enableAudio: false,
        imageFormatGroup: Platform.isIOS
            ? (_cameraKitActive
                ? ImageFormatGroup.yuv420
                : ImageFormatGroup.bgra8888)
            : ImageFormatGroup.yuv420,
      );

      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      MiraMeasureTrace.span(
        'PREVIEW_READY',
        detail:
            'lens=${direction.name} camerakit=$_cameraKitActive '
            'build=1.0.0+2026091701 '
            'probe=${PerfectCameraKitGate.buildProbeTag}',
      );
      debugPrint(
        'Mira CAPTURE_BOOT build=1.0.0+2026091701 '
        'lens=${direction.name} camerakit=$_cameraKitActive '
        'shutterPolicy=camera_ready_only',
      );

      await controller.setFlashMode(FlashMode.off);
      if (_cameraKitActive) {
        // Correct real exposure for CameraKit — no beauty / artificial brighten.
        try {
          await controller.setExposureMode(ExposureMode.auto);
        } catch (_) {}
        try {
          await controller.setFocusMode(FocusMode.auto);
        } catch (_) {}
      }

      setState(() {
        _controller = controller;
        _isFrontCamera = selected.lensDirection == CameraLensDirection.front;
        _initializing = false;
      });
      if (_cameraKitActive) {
        await PerfectCameraKitGate.onCameraOpen(isFront: _isFrontCamera);
        PerfectCameraKitGate.markAttemptStart();
      }
      if (widget.capturedImage == null && !widget.isAnalyzing) {
        await _startFaceStream(controller);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _pauseCamera() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    await _stopFaceStream();
    if (controller.value.isPreviewPaused) return;
    await controller.pausePreview();
  }

  Future<void> _resumeCamera() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (!controller.value.isPreviewPaused) return;
    await controller.resumePreview();
    if (widget.capturedImage == null && !widget.isAnalyzing) {
      await _startFaceStream(controller);
    }
  }

  Future<void> _startFaceStream(CameraController controller) async {
    if (_imageStreamActive || !controller.value.isInitialized) return;
    try {
      _faceOverlayController.startStream();
      await controller.startImageStream(_onCameraImage);
      _imageStreamActive = true;
    } catch (_) {
      _imageStreamActive = false;
    }
  }

  Future<void> _stopFaceStream() async {
    final controller = _controller;
    _faceOverlayController.stopStream();
    if (!_imageStreamActive || controller == null) return;
    try {
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }
    } catch (_) {}
    _imageStreamActive = false;
  }

  void _onCameraImage(CameraImage image) {
    final controller = _controller;
    if (!mounted || controller == null || widget.capturedImage != null) return;

    if (_cameraKitActive) {
      unawaited(
        PerfectCameraKitGate.sendCameraImage(
          image,
          isFront: _isFrontCamera,
        ),
      );
    }

    if (_previewBoxSize == Size.zero) return;

    // MediaPipe overlay only — NOT the final Skin capture gate when CameraKit active.
    final (contentW, contentH) = _cameraPreviewDimensions(controller);
    _faceOverlayController.processCameraImage(
      image: image,
      camera: controller.description,
      deviceOrientation: controller.value.deviceOrientation,
      mapping: FaceMappingContext(
        rawImageSize: Size(image.width.toDouble(), image.height.toDouble()),
        contentSize: Size(contentW, contentH),
        viewportSize: _previewBoxSize,
        lensDirection: controller.description.lensDirection,
        mirrorPreview: _isFrontCamera,
      ),
    );
  }

  Future<void> _detectFaceOnStill(File file) async {
    if (!mounted || _previewBoxSize == Size.zero) return;

    File? temp;
    try {
      final aspect = _previewBoxSize.width / _previewBoxSize.height;
      final bytes = await FaceImageProcessor.readOrientedJpegBytes(
        file,
        targetAspectRatio: aspect,
      );
      temp = File(
        '${Directory.systemTemp.path}/mira_face_map_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await temp.writeAsBytes(bytes, flush: true);
      final contentSize = await FaceImageProcessor.decodeOrientedSize(temp);

      await _faceOverlayController.processStillImage(
        file: temp,
        mapping: FaceMappingContext(
          rawImageSize: contentSize,
          contentSize: contentSize,
          viewportSize: _previewBoxSize,
          lensDirection: _mirrorCapturedPreview
              ? CameraLensDirection.front
              : CameraLensDirection.back,
          mirrorPreview: _mirrorCapturedPreview,
        ),
      );
    } finally {
      if (temp != null && await temp.exists()) {
        await temp.delete();
      }
    }
  }

  bool get _motionEnabled => FaceAnalysisMotionFlag.enabled;

  Widget _buildOverlayLayer({
    required int tipIndex,
    required bool canTakePhoto,
    required LiveCameraOverlayState overlayState,
    required FaceCaptureGuidanceVm? guidance,
    required CaptureMirrorTick? mirrorTick,
  }) {
    // Phase 9D — Soft Laser during real analysis wait only (not shutter validation).
    if (_motionEnabled &&
        widget.isAnalyzing &&
        widget.capturedImage != null &&
        !_validatingFace) {
      final status = widget.analysisPipelineStatus == AnalysisPipelineStatus.idle
          ? AnalysisPipelineStatus.running
          : widget.analysisPipelineStatus;
      return AnalysisMotionOverlay(
        frame: _faceOverlayController.frame,
        pipelineStatus: status,
        errorMessageAr: widget.analysisErrorMessage,
        reduceMotion: _reduceMotion,
        onHandoffReady: widget.onAnalysisMotionHandoff,
      );
    }

    if (_cameraKitActive &&
        !widget.isAnalyzing &&
        widget.capturedImage == null) {
      final meshGuidance = _manualGuidanceVm;
      return InteractiveCaptureMirrorOverlay(
        frame: _faceOverlayController.frame,
        guidance: meshGuidance,
        poseHint: PoseKind.good,
        holdProgress01: 0,
        pulse: _pulseController.value,
        flashOpacity: _captureFlashOpacity,
        reduceMotion: _reduceMotion,
        forCameraKit: true,
      );
    }

    if (_mirrorEnabled &&
        !widget.isAnalyzing &&
        widget.capturedImage == null) {
      return InteractiveCaptureMirrorOverlay(
        frame: _faceOverlayController.frame,
        guidance: _manualGuidanceVm,
        poseHint: mirrorTick?.result.pose ?? PoseKind.unknown,
        holdProgress01: 0,
        pulse: _pulseController.value,
        flashOpacity: _captureFlashOpacity,
        reduceMotion: _reduceMotion,
      );
    }

    return LiveFaceAnalysisOverlay(
      controller: _faceOverlayController,
      uiState: overlayState,
      pulse: _pulseController.value,
      scanProgress: _scanController.value,
      sweepProgress: _sweepController.value,
      hintText: 'ضعي وجهك داخل الإطار واضغطي للتصوير',
    );
  }

  /// Skin product path: Capture Mirror HUD only when CameraKit is inactive.
  bool get _mirrorEnabled =>
      !_cameraKitActive &&
      (FaceCaptureMirrorFlag.enabled || MiraFeatures.skinInteractiveReportV1);

  static const _guideInstructionAr =
      'ضعي وجهك داخل الإطار واضغطي للتصوير';

  /// Guidance chrome only — never gates the shutter.
  FaceCaptureGuidanceVm get _manualGuidanceVm {
    final tip = _cameraKitGuidanceAr;
    final instruction = (tip != null && tip.trim().isNotEmpty)
        ? '$_guideInstructionAr — $tip'
        : _guideInstructionAr;
    final camOk = _cameraHardwareReady;
    return FaceCaptureGuidanceVm(
      state: camOk
          ? FaceCaptureReadinessState.ready
          : FaceCaptureReadinessState.alignFace,
      titleAr: camOk ? 'جاهزة للتصوير' : 'جاري تجهيز الكاميرا',
      instructionAr: instruction,
      accessibilityLabel: instruction,
      severity: 0,
      isReady: camOk,
      canManualCapture: camOk && _shutterIdle,
      autoCaptureEligible: false,
      truthClass: FaceCaptureTruthClass.derivedCapturePolicy,
      reasonCode: camOk ? 'camera_ready_manual' : 'camera_warming',
    );
  }

  /// Camera + permissions ready; NOT FaceMesh / CameraKit quality.
  bool get _cameraHardwareReady {
    if (_previewBoxSize == Size.zero) return false;
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return false;
    if (_initializing) return false;
    if (_error != null) return false;
    return true;
  }

  bool get _shutterIdle =>
      !_capturing &&
      !_validatingFace &&
      widget.enabled &&
      !widget.isAnalyzing &&
      widget.capturedImage == null;

  /// Shutter enable = camera ready + idle. Mesh/CK are guidance only.
  bool get _canTakePhoto => _cameraHardwareReady && _shutterIdle;

  bool get _reduceMotion {
    final mq = MediaQuery.maybeOf(context);
    return mq?.disableAnimations ?? false;
  }

  CaptureMirrorTick? _evaluateMirrorTick() {
    final coordinator = _mirrorCoordinator;
    if (!_mirrorEnabled || coordinator == null) return null;
    if (_previewBoxSize == Size.zero) return null;

    final controller = _controller;
    final permissionDenied = _error != null &&
        (_error!.toLowerCase().contains('permission') ||
            _error!.contains('رفض') ||
            _error!.contains('إذن'));
    final cameraReady =
        controller != null && controller.value.isInitialized && !_initializing;
    final paused = controller?.value.isPreviewPaused == true;

    final input = coordinator.inputFromMesh(
      frame: widget.capturedImage != null ? null : _faceOverlayController.frame,
      viewport: _previewBoxSize,
      now: DateTime.now(),
      cameraReady: cameraReady,
      permissionGranted: permissionDenied ? false : true,
      cameraPaused: paused,
      controllerDisposed: controller == null && !_initializing,
    );

    return coordinator.tick(
      input: input,
      captureInProgress: _capturing || _validatingFace,
      alreadyCaptured: widget.capturedImage != null,
    );
  }

  void _applyMirrorTick(CaptureMirrorTick tick) {
    // Hold progress intentionally unused — auto-capture path disabled.

    final needsSideEffects = tick.shouldHapticReady ||
        tick.shouldHapticEligible ||
        tick.shouldAutoCapture;
    if (!needsSideEffects) return;

    final captured = tick;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (captured.shouldHapticReady) {
        CaptureMirrorHaptics.onReadyEntered();
      }
      if (captured.shouldHapticEligible) {
        CaptureMirrorHaptics.onAutoEligible();
      }
      if (captured.shouldAutoCapture &&
          _autoCaptureEnabled &&
          !_mirrorAutoCaptureQueued &&
          !_capturing &&
          widget.capturedImage == null &&
          widget.enabled &&
          !widget.isAnalyzing) {
        _mirrorAutoCaptureQueued = true;
        _runMirrorAutoCapture();
      }
    });
  }

  Future<void> _runMirrorAutoCapture() async {
    final coordinator = _mirrorCoordinator;
    if (coordinator == null) return;
    if (_capturing || widget.capturedImage != null) {
      _mirrorAutoCaptureQueued = false;
      return;
    }
    coordinator.beginFiring(DateTime.now());
    await _capture(fromAuto: true);
    _mirrorAutoCaptureQueued = false;
  }

  Future<void> _playCaptureFlash() async {
    if (!mounted) return;
    setState(() => _captureFlashOpacity = 0.72);
    await Future<void>.delayed(const Duration(milliseconds: 90));
    if (!mounted) return;
    setState(() => _captureFlashOpacity = 0);
  }

  void _showGateMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  Future<FaceGateResult?> _validateFile(File file) async {
    if (!mounted) return null;
    setState(() => _validatingFace = true);
    try {
      // Minimal post-capture gate for ALL paths (including CameraKit):
      // presence/area + HD short side — not legacy full IQ / pose stack.
      final gate = await PostCaptureMinimalGate.validate(file);
      if (!mounted) return null;
      if (!gate.isAccepted) {
        _showGateMessage(gate.messageAr);
      }
      return gate;
    } finally {
      if (mounted) setState(() => _validatingFace = false);
    }
  }

  Future<File> _normalizeAcceptedCapture(File raw, FaceGateResult gate) async {
    // CameraKit path: ZERO post-capture rotation/warp (protect Perfect mask alignment).
    if (_cameraKitActive) {
      return raw;
    }
    if (gate.faceBox == null || gate.imageSize == null) return raw;
    final aligned = await FaceImageProcessor.alignForAnalysis(
      raw,
      faceBox: gate.faceBox!,
      imageSize: gate.imageSize!,
      rollDegrees: gate.headRollDegrees,
    );
    if (aligned.path != raw.path) {
      await _detectFaceOnStill(aligned);
    }
    return aligned;
  }

  Future<void> _capture({bool fromAuto = false}) async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _capturing) {
      debugPrint(
        'Mira CAPTURE_ATTEMPT shutter=press_ignored '
        'reason=${controller == null ? "no_controller" : !controller.value.isInitialized ? "not_init" : "busy"}',
      );
      return;
    }
    if (!widget.enabled || widget.isAnalyzing || _validatingFace) {
      debugPrint(
        'Mira CAPTURE_ATTEMPT shutter=press_ignored '
        'reason=${widget.isAnalyzing ? "analyzing" : _validatingFace ? "validating" : "disabled"}',
      );
      return;
    }

    if (fromAuto && !_autoCaptureEnabled) {
      debugPrint(
        'Mira CAPTURE_ATTEMPT shutter=auto_blocked takePicture=not_called '
        'reason=auto_capture_disabled',
      );
      return;
    }

    // Camera hardware only — never FaceMesh freshness / containment / CameraKit ready.
    if (!_cameraHardwareReady) {
      debugPrint(
        'Mira CAPTURE_ATTEMPT shutter=manual_blocked takePicture=not_called '
        'reason=camera_not_ready',
      );
      _showGateMessage('الكاميرا غير جاهزة بعد — انتظري لحظة ثم اضغطي.');
      return;
    }

    final attemptId =
        'MAN-${DateTime.now().millisecondsSinceEpoch}-${_manualAttemptId == null ? "0" : "n"}';
    _manualAttemptId = attemptId;
    setState(() => _capturing = true);
    final t0 = MiraMeasureTrace.monoMs;
    MiraMeasureTrace.span(
      'T0_CAPTURE_REQUEST',
      detail: 'attemptId=$attemptId fromAuto=$fromAuto',
    );
    debugPrint(
      'Mira CAPTURE_ATTEMPT attemptId=$attemptId phase=press '
      'shutter=manual takePicture=calling '
      'ckReady=${PerfectCameraKitGate.isReady} '
      'meshHasFace=${_faceOverlayController.frame.hasFace} '
      'meshAgeMs=${DateTime.now().difference(_faceOverlayController.frame.timestamp).inMilliseconds} '
      'probe=${PerfectCameraKitGate.buildProbeTag}',
    );
    try {
      if (_mirrorEnabled) {
        await CaptureMirrorHaptics.onShutter();
        await _playCaptureFlash();
      } else {
        await HapticFeedback.mediumImpact();
      }
      final photo = await controller.takePicture();
      MiraMeasureTrace.span(
        'T1_TAKE_PICTURE_OK',
        t0Ms: t0,
        detail: 'attemptId=$attemptId',
      );
      final bytes = await photo.readAsBytes();
      int? w;
      int? h;
      try {
        final decoded = await decodeImageFromList(bytes);
        w = decoded.width;
        h = decoded.height;
      } catch (_) {}
      final short =
          (w != null && h != null) ? (w < h ? w : h) : null;
      debugPrint(
        'Mira CAPTURE_ATTEMPT attemptId=$attemptId phase=takePicture_ok '
        'savedDims=${w ?? "?"}x${h ?? "?"} savedShort=${short ?? "?"} '
        'bytes=${bytes.length} elapsedMs=${MiraMeasureTrace.monoMs - t0}',
      );
      _mirrorCapturedPreview = _isFrontCamera;
      await _pauseCamera();
      final tPanel0 = MiraMeasureTrace.monoMs;
      MiraMeasureTrace.span(
        'T2_PANEL_PROCESS_BEGIN',
        t0Ms: t0,
        detail: 'attemptId=$attemptId',
      );
      final file = File(photo.path);
      // Still-face overlay is UX only — validation uses the saved file.
      await _detectFaceOnStill(file);
      final gate = await _validateFile(file);
      if (gate == null || !gate.isAccepted) {
        MiraMeasureTrace.span(
          'T2_PANEL_PROCESS_REJECT',
          t0Ms: tPanel0,
          detail:
              'attemptId=$attemptId reason=${gate?.reasonCode ?? "null"}',
        );
        debugPrint(
          'Mira CAPTURE_ATTEMPT attemptId=$attemptId phase=validate_reject '
          'reason=${gate?.reasonCode ?? "null"} '
          'msg=${gate?.messageAr ?? "cancelled"}',
        );
        _faceOverlayController.reset();
        _mirrorCoordinator?.releaseAfterFailure();
        await _resumeCamera();
        return;
      }
      final normalized = await _normalizeAcceptedCapture(file, gate);
      int? nw;
      int? nh;
      try {
        final nb = await normalized.readAsBytes();
        final nd = await decodeImageFromList(nb);
        nw = nd.width;
        nh = nd.height;
      } catch (_) {}
      MiraMeasureTrace.span(
        'T2_PANEL_PROCESS_END',
        t0Ms: tPanel0,
        detail:
            'attemptId=$attemptId accepted=1 '
            'upload=${nw ?? "?"}x${nh ?? "?"}',
      );
      debugPrint(
        'Mira CAPTURE_ATTEMPT attemptId=$attemptId phase=validate_accept '
        'saved=${w ?? "?"}x${h ?? "?"} upload=${nw ?? "?"}x${nh ?? "?"} '
        '→ analysis_handoff',
      );
      _mirrorCoordinator?.markCaptured();
      MiraMeasureTrace.span(
        'T3_ON_IMAGE_CHANGED',
        t0Ms: t0,
        detail: 'attemptId=$attemptId',
      );
      widget.onImageChanged(normalized);
    } catch (e) {
      MiraMeasureTrace.span(
        'T0_CAPTURE_ERROR',
        t0Ms: t0,
        detail: 'attemptId=$attemptId',
      );
      debugPrint(
        'Mira CAPTURE_ATTEMPT attemptId=$attemptId phase=takePicture_error '
        'err=$e',
      );
      _mirrorCoordinator?.releaseAfterFailure();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تعذر التقاط الصورة — أعيدي المحاولة.'),
          backgroundColor: AppColors.error,
        ),
      );
      await _resumeCamera();
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _retake() async {
    if (widget.isAnalyzing) return;
    _mirrorCoordinator?.resetForRetake();
    _captureFlashOpacity = 0;
    _mirrorAutoCaptureQueued = false;
    widget.onImageChanged(null);
    await _resumeCamera();
  }

  Future<void> _pickFromGallery() async {
    if (!widget.enabled || widget.isAnalyzing || _validatingFace) return;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 92,
    );
    if (picked == null || !mounted) return;
    _mirrorCapturedPreview = false;
    await _pauseCamera();
    final file = File(picked.path);
    await _detectFaceOnStill(file);
    final gate = await _validateFile(file);
    if (gate == null || !gate.isAccepted) {
      _faceOverlayController.reset();
      _mirrorCoordinator?.releaseAfterFailure();
      await _resumeCamera();
      return;
    }
    final normalized = await _normalizeAcceptedCapture(file, gate);
    _mirrorCoordinator?.markCaptured();
    widget.onImageChanged(normalized);
  }

  Future<void> _toggleCamera() async {
    if (widget.capturedImage != null || widget.isAnalyzing) return;
    final next = _isFrontCamera ? CameraLensDirection.back : CameraLensDirection.front;
    await _initCamera(direction: next);
  }

  Widget _buildCoverPreview({
    required BoxConstraints constraints,
    required double contentWidth,
    required double contentHeight,
    required Widget child,
    required bool mirror,
  }) {
    final boxW = constraints.maxWidth;
    final boxH = constraints.maxHeight;
    if (boxW <= 0 || boxH <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      return const SizedBox.shrink();
    }

    Widget content = SizedBox(
      width: contentWidth,
      height: contentHeight,
      child: child,
    );

    if (mirror) {
      content = Transform.flip(flipX: true, child: content);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: SizedBox(
        width: boxW,
        height: boxH,
        child: FittedBox(
          fit: BoxFit.cover,
          alignment: Alignment.center,
          clipBehavior: Clip.hardEdge,
          child: content,
        ),
      ),
    );
  }

  (double width, double height) _cameraPreviewDimensions(CameraController controller) {
    final previewSize = controller.value.previewSize;
    if (previewSize == null) {
      final ar = controller.value.aspectRatio;
      return ar >= 1 ? (ar, 1.0) : (1.0, 1.0 / ar);
    }

    final isPortrait =
        MediaQuery.orientationOf(context) == Orientation.portrait;
    if (isPortrait) {
      return (previewSize.height.toDouble(), previewSize.width.toDouble());
    }
    return (previewSize.width.toDouble(), previewSize.height.toDouble());
  }

  Widget _buildLivePreview(CameraController controller, BoxConstraints constraints) {
    final (width, height) = _cameraPreviewDimensions(controller);
    return _buildCoverPreview(
      constraints: constraints,
      contentWidth: width,
      contentHeight: height,
      mirror: _isFrontCamera,
      child: CameraPreview(controller),
    );
  }

  Widget _buildCapturedPreview(File file, BoxConstraints constraints) {
    return _StableCapturedPreview(
      file: file,
      constraints: constraints,
      mirror: _mirrorCapturedPreview,
      builder: _buildCoverPreview,
    );
  }

  Widget _buildPreviewBox(BoxConstraints constraints) {
    if (widget.capturedImage != null) {
      return _buildCapturedPreview(widget.capturedImage!, constraints);
    }

    final controller = _controller;
    if (_initializing) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.gold),
            const SizedBox(height: 16),
            Text(
              'جاري تجهيز الكاميرا…',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
            ),
          ],
        ),
      );
    }

    if (_error != null || controller == null || !controller.value.isInitialized) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off_rounded, color: AppColors.error, size: 40),
              const SizedBox(height: 12),
              Text(
                _error ?? 'تعذر تشغيل الكاميرا',
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => _initCamera(),
                child: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
    }

    return _buildLivePreview(controller, constraints);
  }

  @override
  Widget build(BuildContext context) {
        return LayoutBuilder(
      builder: (context, constraints) {
        return AnimatedBuilder(
          animation: Listenable.merge([
            _pulseController,
            _scanController,
            _sweepController,
            _tipController,
            _faceOverlayController,
          ]),
          builder: (context, _) {
            final tipIndex = (_tipController.value * _tips.length).floor() % _tips.length;
            final mirrorTick = _mirrorEnabled ? _evaluateMirrorTick() : null;
            if (mirrorTick != null) {
              _applyMirrorTick(mirrorTick);
            }
            final canTakePhoto = _canTakePhoto;
            _faceOverlayController.updateScanProgress(_scanController.value);

            final overlayState = widget.isAnalyzing || _validatingFace
                ? LiveCameraOverlayState.analyzing
                : widget.capturedImage != null
                    ? LiveCameraOverlayState.captured
                    : _faceOverlayController.frame.hasFace
                        ? LiveCameraOverlayState.faceDetected
                        : LiveCameraOverlayState.initial;

            final guidance = _manualGuidanceVm;
            // Shutter: camera ready + idle — never mesh/CK quality.
            final shutterEnabled = canTakePhoto ||
                (widget.capturedImage != null &&
                    widget.enabled &&
                    !widget.isAnalyzing &&
                    !_capturing &&
                    !_validatingFace);

            return Column(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: LayoutBuilder(
                      builder: (context, previewConstraints) {
                        _previewBoxSize = previewConstraints.biggest;
                        FaceImageProcessor.viewportAspectRatio =
                            _previewBoxSize.width / _previewBoxSize.height;

                        return Stack(
                          alignment: Alignment.center,
                          children: [
                            Positioned.fill(
                              child: _buildPreviewBox(
                                BoxConstraints.loose(_previewBoxSize),
                              ),
                            ),
                            Positioned.fill(
                              child: IgnorePointer(
                                child: _buildOverlayLayer(
                                  tipIndex: tipIndex,
                                  canTakePhoto: canTakePhoto,
                                  overlayState: overlayState,
                                  guidance: guidance,
                                  mirrorTick: mirrorTick,
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _CaptureControls(
                  enabled: shutterEnabled,
                  capturing: _capturing,
                  hasCapture: widget.capturedImage != null,
                  onCapture: () => _capture(fromAuto: false),
                  onRetake: _retake,
                  onGallery: _cameraKitActive ? null : _pickFromGallery,
                  onFlip: _toggleCamera,
                  mirrorStyle: _mirrorEnabled || _cameraKitActive,
                ),
                const SizedBox(height: 8),
              ],
            );
          },
        );
      },
    );
  }
}

typedef _CoverPreviewBuilder = Widget Function({
  required BoxConstraints constraints,
  required double contentWidth,
  required double contentHeight,
  required Widget child,
  required bool mirror,
});

class _StableCapturedPreview extends StatefulWidget {
  final File file;
  final BoxConstraints constraints;
  final bool mirror;
  final _CoverPreviewBuilder builder;

  const _StableCapturedPreview({
    required this.file,
    required this.constraints,
    required this.mirror,
    required this.builder,
  });

  @override
  State<_StableCapturedPreview> createState() => _StableCapturedPreviewState();
}

class _StableCapturedPreviewState extends State<_StableCapturedPreview> {
  Uint8List? _orientedBytes;
  double? _contentWidth;
  double? _contentHeight;

  @override
  void initState() {
    super.initState();
    _loadOrientedImage();
  }

  @override
  void didUpdateWidget(covariant _StableCapturedPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.file.path != widget.file.path) {
      _orientedBytes = null;
      _contentWidth = null;
      _contentHeight = null;
      _loadOrientedImage();
    }
  }

  Future<void> _loadOrientedImage() async {
    try {
      final viewportAspect =
          widget.constraints.maxWidth / widget.constraints.maxHeight;
      final size = await FaceImageProcessor.decodeOrientedSize(widget.file);
      final bytes = await FaceImageProcessor.readOrientedJpegBytes(
        widget.file,
        targetAspectRatio: viewportAspect,
      );
      if (!mounted) return;

      var width = size.width;
      var height = size.height;
      final imageAspect = width / height;
      if ((imageAspect - viewportAspect).abs() >= 0.01) {
        if (imageAspect > viewportAspect) {
          width = height * viewportAspect;
        } else {
          height = width / viewportAspect;
        }
      }

      setState(() {
        _contentWidth = width;
        _contentHeight = height;
        _orientedBytes = bytes;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _contentWidth = 3;
        _contentHeight = 4;
        _orientedBytes = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_orientedBytes == null ||
        _contentWidth == null ||
        _contentHeight == null) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold, strokeWidth: 2),
      );
    }

    return widget.builder(
      constraints: widget.constraints,
      contentWidth: _contentWidth!,
      contentHeight: _contentHeight!,
      mirror: widget.mirror,
      child: Image.memory(
        _orientedBytes!,
        fit: BoxFit.fill,
        gaplessPlayback: true,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}

class _CaptureControls extends StatelessWidget {
  final bool enabled;
  final bool capturing;
  final bool hasCapture;
  final VoidCallback onCapture;
  final VoidCallback onRetake;
  final VoidCallback? onGallery;
  final VoidCallback onFlip;
  final bool mirrorStyle;

  const _CaptureControls({
    required this.enabled,
    required this.capturing,
    required this.hasCapture,
    required this.onCapture,
    required this.onRetake,
    required this.onGallery,
    required this.onFlip,
    this.mirrorStyle = false,
  });

  @override
  Widget build(BuildContext context) {
    final ring = mirrorStyle ? CaptureMirrorTokens.shutterRing : AppColors.gold;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _SideAction(
            icon: Icons.photo_library_outlined,
            label: 'الألبوم',
            onTap: enabled && !hasCapture ? onGallery : null,
          ),
          GestureDetector(
            onTap: enabled && !capturing ? (hasCapture ? onRetake : onCapture) : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: hasCapture ? 68 : (mirrorStyle ? 74 : 82),
              height: hasCapture ? 68 : (mirrorStyle ? 74 : 82),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: hasCapture ? AppColors.secondary : ring,
                  width: mirrorStyle ? 3 : 4,
                ),
                color: Colors.white.withValues(alpha: enabled ? 0.15 : 0.05),
                boxShadow: enabled && !hasCapture
                    ? [
                        BoxShadow(
                          color: ring.withValues(alpha: 0.35),
                          blurRadius: 18,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: capturing
                  ? Padding(
                      padding: const EdgeInsets.all(18),
                      child: CircularProgressIndicator(strokeWidth: 2, color: ring),
                    )
                  : Icon(
                      hasCapture ? Icons.refresh_rounded : Icons.circle,
                      size: hasCapture ? 30 : (mirrorStyle ? 48 : 58),
                      color: hasCapture ? AppColors.onPrimary : ring,
                    ),
            ),
          ),
          _SideAction(
            icon: Icons.cameraswitch_rounded,
            label: 'قلب',
            onTap: enabled && !hasCapture ? onFlip : null,
          ),
        ],
      ),
    );
  }
}

class _SideAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _SideAction({
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = onTap != null;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 64,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black.withValues(alpha: active ? 0.35 : 0.15),
                border: Border.all(
                  color: AppColors.onPrimary.withValues(alpha: active ? 0.35 : 0.12),
                ),
              ),
              child: Icon(
                icon,
                color: AppColors.onPrimary.withValues(alpha: active ? 0.95 : 0.35),
                size: 22,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.onPrimary.withValues(alpha: active ? 0.9 : 0.35),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
