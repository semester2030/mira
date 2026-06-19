import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/outfit_body_pose_metrics.dart';
import '../../domain/entities/outfit_capture_validation.dart';
import '../../domain/services/outfit_capture_rules.dart';
import '../../domain/services/outfit_capture_validator.dart';
import '../utils/outfit_camera_frame_utils.dart';
import 'outfit_body_guide_overlay.dart';

/// V2 live outfit capture — pose validation, freeze frame, block until valid.
class OutfitLiveCapturePanel extends StatefulWidget {
  final ValueChanged<File?> onImageChanged;
  final File? frozenImage;

  const OutfitLiveCapturePanel({
    super.key,
    required this.onImageChanged,
    this.frozenImage,
  });

  @override
  State<OutfitLiveCapturePanel> createState() => _OutfitLiveCapturePanelState();
}

class _OutfitLiveCapturePanelState extends State<OutfitLiveCapturePanel>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  CameraController? _controller;
  final _validator = OutfitCaptureValidator();
  final _picker = ImagePicker();

  bool _initializing = true;
  bool _capturing = false;
  bool _validating = false;
  String? _error;
  bool _isFrontCamera = false;
  bool _streamActive = false;
  bool _processingFrame = false;
  bool _poseChecking = false;
  DateTime _lastFrameProcessed = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _lastPoseCheck = DateTime.fromMillisecondsSinceEpoch(0);

  OutfitBodyPoseMetrics _pose = OutfitBodyPoseMetrics.none;
  OutfitCaptureValidationResult _validation = OutfitCaptureValidationResult.ready;

  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _initCamera();
  }

  @override
  void didUpdateWidget(covariant OutfitLiveCapturePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.frozenImage == null && widget.frozenImage != null) {
      _stopStream();
      _pauseCamera();
    } else if (oldWidget.frozenImage != null && widget.frozenImage == null) {
      _pose = OutfitBodyPoseMetrics.none;
      _validation = OutfitCaptureValidationResult.ready;
      _resumeCamera();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pulseController.dispose();
    _stopStream();
    _validator.dispose();
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      _pauseCamera();
    } else if (state == AppLifecycleState.resumed && widget.frozenImage == null) {
      _resumeCamera();
    }
  }

  Future<void> _initCamera({CameraLensDirection direction = CameraLensDirection.back}) async {
    setState(() {
      _initializing = true;
      _error = null;
    });

    await _controller?.dispose();
    _controller = null;

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) throw Exception('لم يتم العثور على كاميرا');

      final selected = cameras.firstWhere(
        (c) => c.lensDirection == direction,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        selected,
        ResolutionPreset.medium,
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

      if (widget.frozenImage == null) {
        await _startStream(controller);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  bool get _cameraReady =>
      !_initializing && _error == null && _controller?.value.isInitialized == true;

  bool get _canCapture => _cameraReady;

  Future<void> _stopStreamFully() async {
    final controller = _controller;
    if (controller == null) return;
    try {
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }
    } catch (_) {}
    _streamActive = false;
    await Future<void>.delayed(const Duration(milliseconds: 120));
  }

  Future<void> _startStream(CameraController controller) async {
    if (_streamActive || !controller.value.isInitialized) return;
    try {
      await controller.startImageStream(_onCameraImage);
      _streamActive = true;
    } catch (_) {
      _streamActive = false;
    }
  }

  Future<void> _stopStream() async {
    final controller = _controller;
    if (controller == null || !_streamActive) return;
    try {
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }
    } catch (_) {}
    _streamActive = false;
  }

  Future<void> _pauseCamera() async {
    await _stopStream();
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (controller.value.isPreviewPaused) return;
    await controller.pausePreview();
  }

  Future<void> _resumeCamera() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (controller.value.isPreviewPaused) {
      await controller.resumePreview();
    }
    await _startStream(controller);
  }

  void _onCameraImage(CameraImage image) {
    if (!mounted || widget.frozenImage != null || _processingFrame) return;
    final now = DateTime.now();
    if (now.difference(_lastFrameProcessed).inMilliseconds < 900) return;

    _processingFrame = true;
    _lastFrameProcessed = now;

    final result = _validator.validateCameraFrameSync(image: image, pose: _pose);
    if (mounted && widget.frozenImage == null) {
      setState(() => _validation = result);
    }
    _processingFrame = false;

    if (result.metrics.brightness >= 0.18 && result.metrics.blurScore >= 2.5) {
      _schedulePoseCheck(image);
    }
  }

  Future<void> _schedulePoseCheck(CameraImage image) async {
    if (_poseChecking || widget.frozenImage != null) return;
    final now = DateTime.now();
    if (now.difference(_lastPoseCheck).inMilliseconds < 1400) return;

    _poseChecking = true;
    _lastPoseCheck = now;
    File? temp;
    try {
      temp = await OutfitCameraFrameUtils.writeTempPreviewJpeg(image);
      if (temp == null || !mounted || widget.frozenImage != null) return;

      final pose = await _validator.analyzePoseFromFile(temp);
      if (!mounted || widget.frozenImage != null) return;

      setState(() {
        _pose = pose;
        final metrics = _validation.metrics;
        _validation = OutfitCaptureRules.evaluateLive(
          OutfitCaptureFrameMetrics(
            brightness: metrics.brightness,
            blurScore: metrics.blurScore,
            faceCount: metrics.faceCount,
            faceAreaRatio: metrics.faceAreaRatio,
            faceCenterYNormalized: metrics.faceCenterYNormalized,
            faceBottomYNormalized: metrics.faceBottomYNormalized,
            pose: pose,
          ),
        );
      });
    } finally {
      _poseChecking = false;
      if (temp != null && await temp.exists()) {
        await temp.delete();
      }
    }
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || !_canCapture || _capturing) return;

    setState(() => _capturing = true);
    try {
      await HapticFeedback.mediumImpact();
      await _stopStreamFully();
      final photo = await controller.takePicture();
      final file = File(photo.path);
      final validation = await _validator.validateFile(file);
      if (!mounted) return;

      if (!validation.isValid) {
        setState(() {
          _validation = validation;
          _capturing = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(validation.hintAr), backgroundColor: AppColors.gold),
        );
        await _startStream(controller);
        return;
      }

      widget.onImageChanged(file);
      setState(() {
        _validation = validation;
        _capturing = false;
      });
      await _pauseCamera();
    } catch (_) {
      if (!mounted) return;
      setState(() => _capturing = false);
      await _startStream(controller);
    }
  }

  Future<void> _retake() async {
    widget.onImageChanged(null);
    setState(() {
      _pose = OutfitBodyPoseMetrics.none;
      _validation = OutfitCaptureValidationResult.ready;
    });
    await _resumeCamera();
  }

  Future<void> _pickFromGallery() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 88);
    if (picked == null || !mounted) return;

    final file = File(picked.path);
    final validation = await _validator.validateFile(file);
    if (!mounted) return;

    if (!validation.isValid) {
      setState(() => _validation = validation);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(validation.hintAr), backgroundColor: AppColors.gold),
      );
      return;
    }

    await _pauseCamera();
    widget.onImageChanged(file);
    setState(() => _validation = validation);
  }

  Future<void> _toggleCamera() async {
    if (widget.frozenImage != null) return;
    final next = _isFrontCamera ? CameraLensDirection.back : CameraLensDirection.front;
    await _initCamera(direction: next);
  }

  Widget _buildPreview(BoxConstraints constraints) {
    if (widget.frozenImage != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.file(widget.frozenImage!, fit: BoxFit.cover),
            Positioned(
              top: 12,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'إطار مجمّد',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.secondary),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_initializing) {
      return const Center(child: CircularProgressIndicator(color: AppColors.gold));
    }

    final controller = _controller;
    if (_error != null || controller == null || !controller.value.isInitialized) {
      return Center(
        child: Text(
          _error ?? 'تعذر تشغيل الكاميرا',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: FittedBox(
        fit: BoxFit.cover,
        clipBehavior: Clip.hardEdge,
        child: SizedBox(
          width: controller.value.previewSize?.height ?? constraints.maxWidth,
          height: controller.value.previewSize?.width ?? constraints.maxHeight,
          child: CameraPreview(controller),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasFrozen = widget.frozenImage != null;
    final hint = hasFrozen
        ? 'تم تجميد الإطار — راجعي الصورة ثم اختاري المناسبة'
        : _validation.hintAr;

    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, _) {
        return Column(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        Positioned.fill(child: _buildPreview(constraints)),
                        if (!hasFrozen)
                          Positioned.fill(
                            child: IgnorePointer(
                              child: OutfitBodyGuideOverlay(
                                frameReady: _validation.isValid,
                                pulse: _pulseController.value,
                              ),
                            ),
                          ),
                        if (_validating || _capturing)
                          Container(
                            color: Colors.black.withValues(alpha: 0.25),
                            child: const Center(
                              child: CircularProgressIndicator(color: AppColors.gold),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                hint,
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(
                  color: _validation.isValid ? AppColors.secondary : AppColors.gold,
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 14),
            _LiveCaptureControls(
              enabled: _cameraReady,
              capturing: _capturing,
              canCapture: _canCapture,
              frameReady: _validation.isValid,
              hasFrozen: hasFrozen,
              onCapture: _capture,
              onRetake: _retake,
              onGallery: _pickFromGallery,
              onFlip: _toggleCamera,
            ),
            const SizedBox(height: 8),
          ],
        );
      },
    );
  }
}

class _LiveCaptureControls extends StatelessWidget {
  final bool enabled;
  final bool capturing;
  final bool canCapture;
  final bool frameReady;
  final bool hasFrozen;
  final VoidCallback onCapture;
  final VoidCallback onRetake;
  final VoidCallback onGallery;
  final VoidCallback onFlip;

  const _LiveCaptureControls({
    required this.enabled,
    required this.capturing,
    required this.canCapture,
    required this.frameReady,
    required this.hasFrozen,
    required this.onCapture,
    required this.onRetake,
    required this.onGallery,
    required this.onFlip,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _SideAction(
            icon: Icons.photo_library_outlined,
            label: 'الألبوم',
            onTap: enabled && !hasFrozen ? onGallery : null,
          ),
          GestureDetector(
            onTap: enabled && !capturing
                ? (hasFrozen ? onRetake : (canCapture ? onCapture : null))
                : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: hasFrozen ? 68 : 82,
              height: hasFrozen ? 68 : 82,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: hasFrozen
                      ? AppColors.secondary
                      : (frameReady ? AppColors.secondary : AppColors.gold),
                  width: 4,
                ),
                color: Colors.white.withValues(alpha: enabled && canCapture ? 0.15 : 0.05),
              ),
              child: capturing
                  ? const Padding(
                      padding: EdgeInsets.all(18),
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.gold),
                    )
                  : Icon(
                      hasFrozen ? Icons.refresh_rounded : Icons.circle,
                      size: hasFrozen ? 30 : 58,
                      color: hasFrozen ? AppColors.onPrimary : AppColors.gold,
                    ),
            ),
          ),
          _SideAction(
            icon: Icons.cameraswitch_rounded,
            label: 'قلب',
            onTap: enabled && !hasFrozen ? onFlip : null,
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

  const _SideAction({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.35 : 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: AppColors.onPrimary, size: 26),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.onPrimary.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
