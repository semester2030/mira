import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'face_mapping_context.dart';
import 'face_mesh_service.dart';
import 'models/face_mesh_models.dart';

/// Drives live face-map state, smoothing, and animation phases.
class LiveFaceOverlayController extends ChangeNotifier {
  LiveFaceOverlayController({FaceMeshService? meshService})
      : _meshService = meshService ?? FaceMeshService();

  final FaceMeshService _meshService;

  FaceMeshFrame _frame = FaceMeshFrame.empty;
  FaceMeshFrame _rawFrame = FaceMeshFrame.empty;
  FaceOverlayPhase _phase = FaceOverlayPhase.idle;
  double _revealProgress = 0;
  double _scanProgress = 0;
  bool _analyzing = false;
  bool _streamActive = false;
  int _frameSkip = 0;

  static const _frameSkipCount = 2;
  static const _smoothFactor = 0.62;

  FaceMeshFrame get frame => _frame;
  FaceOverlayPhase get phase => _phase;
  double get revealProgress => _revealProgress;
  double get scanProgress => _scanProgress;
  bool get analyzing => _analyzing;

  Future<void> processCameraImage({
    required CameraImage image,
    required CameraDescription camera,
    required DeviceOrientation deviceOrientation,
    required FaceMappingContext mapping,
  }) async {
    if (!_streamActive || _meshService.isProcessing) return;

    _frameSkip++;
    if (_frameSkip < _frameSkipCount) return;
    _frameSkip = 0;

    final next = await _meshService.processCameraFrame(
      image: image,
      mapping: mapping,
      camera: camera,
      deviceOrientation: deviceOrientation,
    );

    _applyFrame(next);
  }

  Future<void> processStillImage({
    required File file,
    required FaceMappingContext mapping,
  }) async {
    final next = await _meshService.processFile(file: file, mapping: mapping);
    _applyFrame(next, forceMeshReady: true, snap: true);
  }

  void _applyFrame(
    FaceMeshFrame next, {
    bool forceMeshReady = false,
    bool snap = false,
  }) {
    final hadFace = _rawFrame.hasFace;
    _rawFrame = next;

    if (!next.hasFace) {
      _frame = next;
      _phase = FaceOverlayPhase.idle;
      _revealProgress = 0;
      notifyListeners();
      return;
    }

    _frame = snap || !_frame.hasFace
        ? next
        : _frame.lerp(next, _smoothFactor);

    if (!hadFace || forceMeshReady) {
      _phase = FaceOverlayPhase.faceDetected;
      _advancePhase();
    }

    notifyListeners();
  }

  void _advancePhase() {
    Future<void>.delayed(const Duration(milliseconds: 180), () {
      if (!_rawFrame.hasFace) return;
      _phase = FaceOverlayPhase.meshReady;
      notifyListeners();

      Future<void>.delayed(const Duration(milliseconds: 220), () {
        if (!_rawFrame.hasFace) return;
        _phase = FaceOverlayPhase.regionsRevealing;
        _animateReveal();
      });
    });
  }

  void _animateReveal() {
    const steps = 12;
    var step = 0;
    void tick() {
      if (_phase != FaceOverlayPhase.regionsRevealing) return;
      step++;
      _revealProgress = (step / steps).clamp(0.0, 1.0);
      notifyListeners();
      if (step < steps) {
        Future<void>.delayed(const Duration(milliseconds: 45), tick);
      } else if (_analyzing) {
        _phase = FaceOverlayPhase.scanning;
        notifyListeners();
      }
    }

    tick();
  }

  void setAnalyzing(bool value) {
    if (_analyzing == value) return;
    _analyzing = value;
    if (value && _rawFrame.hasFace) {
      _phase = FaceOverlayPhase.scanning;
    }
    notifyListeners();
  }

  void updateScanProgress(double value) {
    _scanProgress = value;
    if (_analyzing && _rawFrame.hasFace) {
      _phase = FaceOverlayPhase.scanning;
    }
    notifyListeners();
  }

  void startStream() {
    _streamActive = true;
    _meshService.initialize();
  }

  void stopStream() {
    _streamActive = false;
    _frameSkip = 0;
  }

  void reset() {
    _frame = FaceMeshFrame.empty;
    _rawFrame = FaceMeshFrame.empty;
    _phase = FaceOverlayPhase.idle;
    _revealProgress = 0;
    _scanProgress = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    _meshService.dispose();
    super.dispose();
  }
}
