import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/face_gate/face_gate_result.dart';
import '../../../../core/face_gate/face_gate_validator.dart';
import '../../../face_analysis_experience/capture/capture.dart';
import '../../../face_analysis_experience/presentation/analysis/analysis_motion.dart';
import '../../../face_analysis_experience/presentation/capture/capture_mirror.dart';
import '../../domain/image_quality/image_quality_evaluator.dart';
import '../live_face_map/face_mapping_context.dart';
import '../live_face_map/face_mesh_quality_gate.dart';
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
  FaceCaptureGuidanceVm? _mirrorGuidance;
  double _mirrorHoldProgress = 0;
  double _captureFlashOpacity = 0;
  bool _mirrorAutoCaptureQueued = false;

  static const _tips = [
    'ثبّتي وجهك في منتصف الدائرة',
    'قرّبي الجوال حتى يملأ الإطار',
    'إضاءة أمامية طبيعية',
    'انظري للكاميرا مباشرة',
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
    if (FaceCaptureMirrorFlag.enabled) {
      _mirrorCoordinator = CaptureMirrorCoordinator();
    }
    _initCamera();
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
      _mirrorGuidance = null;
      _mirrorHoldProgress = 0;
      _captureFlashOpacity = 0;
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
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: Platform.isIOS
            ? ImageFormatGroup.bgra8888
            : ImageFormatGroup.yuv420,
      );

      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }

      await controller.setFlashMode(FlashMode.off);

      setState(() {
        _controller = controller;
        _isFrontCamera = selected.lensDirection == CameraLensDirection.front;
        _initializing = false;
      });
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

    if (_previewBoxSize == Size.zero) return;

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

    if (_mirrorEnabled &&
        !widget.isAnalyzing &&
        widget.capturedImage == null &&
        guidance != null) {
      return InteractiveCaptureMirrorOverlay(
        frame: _faceOverlayController.frame,
        guidance: guidance,
        poseHint: mirrorTick?.result.pose ?? PoseKind.unknown,
        holdProgress01: _mirrorHoldProgress,
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
      hintText: canTakePhoto
          ? 'الإطار جاهز — اضغطي زر التصوير'
          : _tips[tipIndex],
    );
  }

  bool get _mirrorEnabled => FaceCaptureMirrorFlag.enabled;

  bool get _canTakePhoto {
    if (_previewBoxSize == Size.zero) return false;
    if (_mirrorEnabled) {
      return _mirrorGuidance?.canManualCapture == true;
    }
    return FaceMeshQualityGate.canTakePhoto(_faceOverlayController.frame);
  }

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
    _mirrorGuidance = tick.guidance;
    _mirrorHoldProgress = tick.holdProgress01;

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
      final gate = await FaceGateValidator.instance.validate(file);
      if (!mounted) return null;
      if (!gate.isAccepted) {
        _showGateMessage(gate.messageAr);
        return gate;
      }

      // Phase 2: real blur/brightness/exposure before accepting capture.
      final quality = await ImageQualityEvaluator.evaluateFile(
        file,
        faceGate: gate,
      );
      if (!quality.mayProceedToProvider) {
        _showGateMessage(quality.messageAr);
        return FaceGateResult.rejected(
          reasonCode: quality.blockingReasons.isNotEmpty
              ? quality.blockingReasons.first
              : 'quality_blocked',
          messageAr: quality.messageAr,
          messageEn: quality.messageEn,
        );
      }

      if (!FaceMeshQualityGate.canTakePhoto(_faceOverlayController.frame)) {
        _showGateMessage(
          'ثبّتي وجهك وانظري للكاميرا ثم أعيدي المحاولة.',
        );
        return const FaceGateResult.rejected(
          reasonCode: 'mesh_low_quality',
          messageAr: 'ثبّتي وجهك وانظري للكاميرا ثم أعيدي المحاولة.',
          messageEn: 'Hold still, look at the camera, then try again.',
        );
      }

      return gate;
    } finally {
      if (mounted) setState(() => _validatingFace = false);
    }
  }

  Future<File> _normalizeAcceptedCapture(File raw, FaceGateResult gate) async {
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
    if (controller == null || !controller.value.isInitialized || _capturing) return;
    if (!widget.enabled || widget.isAnalyzing || _validatingFace) return;

    if (_mirrorEnabled) {
      final canManual = _mirrorGuidance?.canManualCapture == true;
      if (!fromAuto && !canManual) {
        _showGateMessage(
          _mirrorGuidance?.instructionAr ??
              'ثبّتي وجهك داخل الإطار حتى تصبح جاهزة.',
        );
        return;
      }
      if (fromAuto && _mirrorCoordinator?.latchPhase != CaptureLatchPhase.firing) {
        // Auto path must go through latch.beginFiring first.
        return;
      }
    } else if (!_canTakePhoto) {
      _showGateMessage(
        'ثبّتي وجهك داخل الإطار الذهبي حتى يظهر التتبع بوضوح.',
      );
      return;
    }

    setState(() => _capturing = true);
    try {
      if (_mirrorEnabled) {
        await CaptureMirrorHaptics.onShutter();
        await _playCaptureFlash();
      } else {
        await HapticFeedback.mediumImpact();
      }
      final photo = await controller.takePicture();
      _mirrorCapturedPreview = _isFrontCamera;
      await _pauseCamera();
      final file = File(photo.path);
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
    } catch (e) {
      _mirrorCoordinator?.releaseAfterFailure();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تعذر التقاط الصورة — ${e.toString()}'),
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
    _mirrorGuidance = null;
    _mirrorHoldProgress = 0;
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
            final interactive = widget.enabled && !widget.isAnalyzing && !_validatingFace;
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

            final guidance = _mirrorGuidance;
            final shutterEnabled = interactive &&
                !_initializing &&
                _error == null &&
                (widget.capturedImage != null ||
                    (_mirrorEnabled
                        ? (guidance?.canManualCapture == true ||
                            widget.capturedImage != null)
                        : canTakePhoto));

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
                  onGallery: _pickFromGallery,
                  onFlip: _toggleCamera,
                  mirrorStyle: _mirrorEnabled,
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
  final VoidCallback onGallery;
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
