import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/outfit_capture_validation.dart';
import '../../domain/services/outfit_capture_validator.dart';
import 'outfit_body_guide_overlay.dart';

/// Live outfit camera — full-body guide with real-time validation.
class OutfitCapturePanel extends StatefulWidget {
  final ValueChanged<File?> onImageChanged;
  final File? capturedImage;
  final ValueChanged<OutfitCaptureValidationResult>? onValidationChanged;

  const OutfitCapturePanel({
    super.key,
    required this.onImageChanged,
    this.capturedImage,
    this.onValidationChanged,
  });

  @override
  State<OutfitCapturePanel> createState() => _OutfitCapturePanelState();
}

class _OutfitCapturePanelState extends State<OutfitCapturePanel>
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
  DateTime _lastFrameProcessed = DateTime.fromMillisecondsSinceEpoch(0);

  OutfitCaptureValidationResult _validation = OutfitCaptureValidationResult.ready;

  late final AnimationController _pulseController;
  late final AnimationController _tipController;

  static const _tips = [
    'أظهري الرأس والكتفين وكامل الإطلالة والحذاء',
    'قفي على بعد 2–3 أمتار من الكاميرا',
    'إضاءة أمامية ناعمة بدون ظلال قوية',
    'ثبّتي الهاتف أو اطلبي من صديقة التصوير',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _tipController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    )..repeat();
    _initCamera();
  }

  @override
  void didUpdateWidget(covariant OutfitCapturePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.capturedImage == null && widget.capturedImage != null) {
      _stopStream();
      _pauseCamera();
      _validateStill(widget.capturedImage!);
    } else if (oldWidget.capturedImage != null && widget.capturedImage == null) {
      _validation = OutfitCaptureValidationResult.ready;
      _resumeCamera();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pulseController.dispose();
    _tipController.dispose();
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
    } else if (state == AppLifecycleState.resumed && widget.capturedImage == null) {
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

      if (widget.capturedImage == null) {
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
    if (!mounted || widget.capturedImage != null || _processingFrame) return;
    final now = DateTime.now();
    if (now.difference(_lastFrameProcessed).inMilliseconds < 900) return;

    _processingFrame = true;
    _lastFrameProcessed = now;

    // Process synchronously — async work on CameraImage buffers crashes iOS.
    final result = _validator.validateCameraFrameSync(image: image);
    if (mounted && widget.capturedImage == null) {
      setState(() => _validation = result);
    }
    _processingFrame = false;
  }

  Future<void> _validateStill(File file) async {
    setState(() => _validating = true);
    final result = await _validator.validateFile(file);
    if (!mounted) return;
    setState(() {
      _validation = result;
      _validating = false;
    });
  }

  bool get _canCapture => _cameraReady;

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
          SnackBar(
            content: Text(validation.hintAr),
            backgroundColor: AppColors.gold,
          ),
        );
        await _startStream(controller);
        return;
      }

      widget.onImageChanged(file);
      setState(() {
        _validation = validation;
        _capturing = false;
      });
      widget.onValidationChanged?.call(validation);
      await _pauseCamera();
    } catch (e) {
      if (!mounted) return;
      setState(() => _capturing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تعذر التقاط الصورة — أعيدي المحاولة'),
          backgroundColor: AppColors.error,
        ),
      );
      await _startStream(controller);
    }
  }

  Future<void> _retake() async {
    widget.onImageChanged(null);
    setState(() => _validation = OutfitCaptureValidationResult.ready);
    widget.onValidationChanged?.call(OutfitCaptureValidationResult.ready);
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
        SnackBar(
          content: Text(validation.hintAr),
          backgroundColor: AppColors.gold,
        ),
      );
      return;
    }

    await _pauseCamera();
    widget.onImageChanged(file);
    setState(() => _validation = validation);
    widget.onValidationChanged?.call(validation);
  }

  Future<void> _toggleCamera() async {
    if (widget.capturedImage != null) return;
    final next = _isFrontCamera ? CameraLensDirection.back : CameraLensDirection.front;
    await _initCamera(direction: next);
  }

  Widget _buildPreview(BoxConstraints constraints) {
    if (widget.capturedImage != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Image.file(
          widget.capturedImage!,
          fit: BoxFit.cover,
          width: constraints.maxWidth,
          height: constraints.maxHeight,
        ),
      );
    }

    if (_initializing) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.gold),
            const SizedBox(height: 16),
            Text(
              'تجهيز كاميرا MIRA...',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
            ),
          ],
        ),
      );
    }

    final controller = _controller;
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
    return AnimatedBuilder(
      animation: Listenable.merge([_pulseController, _tipController]),
      builder: (context, _) {
        final tipIndex = (_tipController.value * _tips.length).floor() % _tips.length;
        final hint = widget.capturedImage != null
            ? (_validation.isValid
                ? 'تم التقاط الإطلالة — تابعي لاختيار المناسبة'
                : _validation.hintAr)
            : (_validation.isValid ? _validation.hintAr : _validation.hintAr);

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
                        if (widget.capturedImage == null)
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
                hint.isNotEmpty ? hint : _tips[tipIndex],
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(
                  color: _validation.isValid ? AppColors.secondary : AppColors.gold,
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 14),
            _CaptureControls(
              enabled: _cameraReady,
              capturing: _capturing,
              canCapture: _canCapture,
              frameReady: _validation.isValid,
              hasCapture: widget.capturedImage != null,
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

class _CaptureControls extends StatelessWidget {
  final bool enabled;
  final bool capturing;
  final bool canCapture;
  final bool frameReady;
  final bool hasCapture;
  final VoidCallback onCapture;
  final VoidCallback onRetake;
  final VoidCallback onGallery;
  final VoidCallback onFlip;

  const _CaptureControls({
    required this.enabled,
    required this.capturing,
    required this.canCapture,
    required this.frameReady,
    required this.hasCapture,
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
            onTap: enabled && !hasCapture ? onGallery : null,
          ),
          GestureDetector(
            onTap: enabled && !capturing
                ? (hasCapture ? onRetake : (canCapture ? onCapture : null))
                : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: hasCapture ? 68 : 82,
              height: hasCapture ? 68 : 82,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: hasCapture
                      ? AppColors.secondary
                      : (frameReady ? AppColors.secondary : AppColors.gold),
                  width: 4,
                ),
                color: Colors.white.withValues(alpha: enabled && canCapture ? 0.15 : 0.05),
                boxShadow: enabled && canCapture && !hasCapture
                    ? [
                        BoxShadow(
                          color: (frameReady ? AppColors.secondary : AppColors.gold)
                              .withValues(alpha: 0.35),
                          blurRadius: 18,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: capturing
                  ? const Padding(
                      padding: EdgeInsets.all(18),
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.gold),
                    )
                  : Icon(
                      hasCapture ? Icons.refresh_rounded : Icons.circle,
                      size: hasCapture ? 30 : 58,
                      color: hasCapture ? AppColors.onPrimary : AppColors.gold,
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
