import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import 'face_mapping_context.dart';
import 'face_mesh_point_mapper.dart';
import 'mediapipe_region_builder.dart';
import 'models/face_mesh_models.dart';
import 'utils/face_mesh_camera_image_adapter.dart';

/// Production face mesh via MediaPipe 468-point landmarks.
class FaceMeshService {
  FaceMeshService({
    MediapipeRegionBuilder? regionBuilder,
  }) : _regionBuilder = regionBuilder ?? const MediapipeRegionBuilder();

  final MediapipeRegionBuilder _regionBuilder;

  FaceMeshInferencePipeline? _pipeline;
  FaceDetectorProcessor? _detector;
  FaceMeshProcessor? _meshProcessor;
  bool _isProcessing = false;
  bool _initializing = false;

  static const _orientationDegrees = {
    DeviceOrientation.portraitUp: 0,
    DeviceOrientation.landscapeLeft: 90,
    DeviceOrientation.portraitDown: 180,
    DeviceOrientation.landscapeRight: 270,
  };

  bool get isReady => _pipeline != null;
  bool get isProcessing => _isProcessing;

  Future<void> initialize() async {
    if (_pipeline != null || _initializing) return;
    _initializing = true;
    try {
      final detector = await FaceDetectorProcessor.create(
        model: FaceDetectionModel.fullRangeSparse,
        delegate: FaceMeshDelegate.xnnpack,
        maxResults: 1,
        roiScaleY: 1.6,
        roiShiftY: -0.1,
      );
      final mesh = await FaceMeshProcessor.create(
        delegate: FaceMeshDelegate.xnnpack,
        enableSmoothing: true,
        enableRoiTracking: true,
        enableIris: true,
      );
      _detector = detector;
      _meshProcessor = mesh;
      _pipeline = FaceMeshInferencePipeline(detector: detector, mesh: mesh);
    } finally {
      _initializing = false;
    }
  }

  Future<FaceMeshFrame> processCameraFrame({
    required CameraImage image,
    required CameraDescription camera,
    required DeviceOrientation deviceOrientation,
    required FaceMappingContext mapping,
  }) async {
    if (_isProcessing || !mapping.isValid) return FaceMeshFrame.empty;
    await initialize();
    final pipeline = _pipeline;
    if (pipeline == null) return FaceMeshFrame.empty;

    _isProcessing = true;
    try {
      final rotation = _rotationDegrees(
        camera: camera,
        deviceOrientation: deviceOrientation,
      );
      if (rotation == null) return FaceMeshFrame.empty;

      final FaceMeshInferenceResult result;
      if (Platform.isAndroid) {
        final nv21 = FaceMeshCameraImageAdapter.toNv21(image);
        if (nv21 == null) return FaceMeshFrame.empty;
        result = pipeline.processNv21(nv21, rotationDegrees: rotation);
      } else {
        final bgra = FaceMeshCameraImageAdapter.toBgra(image);
        if (bgra == null) return FaceMeshFrame.empty;
        result = pipeline.process(bgra, rotationDegrees: rotation);
      }

      return _mapResult(
        result.meshResult,
        mapping: mapping,
        rotationDegrees: rotation,
      );
    } catch (_) {
      return FaceMeshFrame.empty;
    } finally {
      _isProcessing = false;
    }
  }

  Future<FaceMeshFrame> processFile({
    required File file,
    required FaceMappingContext mapping,
  }) async {
    if (_isProcessing || !mapping.isValid) return FaceMeshFrame.empty;
    await initialize();
    final pipeline = _pipeline;
    if (pipeline == null) return FaceMeshFrame.empty;

    _isProcessing = true;
    try {
      final bytes = await file.readAsBytes();
      final decoded = img.decodeImage(bytes);
      if (decoded == null) return FaceMeshFrame.empty;

      final rgba = img.Image(width: decoded.width, height: decoded.height);
      for (var y = 0; y < decoded.height; y++) {
        for (var x = 0; x < decoded.width; x++) {
          rgba.setPixel(x, y, decoded.getPixel(x, y));
        }
      }
      final buffer = Uint8List(rgba.width * rgba.height * 4);
      var i = 0;
      for (var y = 0; y < rgba.height; y++) {
        for (var x = 0; x < rgba.width; x++) {
          final p = rgba.getPixel(x, y);
          buffer[i++] = p.r.toInt();
          buffer[i++] = p.g.toInt();
          buffer[i++] = p.b.toInt();
          buffer[i++] = p.a.toInt();
        }
      }

      final input = FaceMeshImage(
        pixels: buffer,
        width: rgba.width,
        height: rgba.height,
        pixelFormat: FaceMeshPixelFormat.rgba,
      );

      final result = pipeline.process(input, rotationDegrees: 0);
      return _mapResult(
        result.meshResult,
        mapping: mapping,
        rotationDegrees: 0,
      );
    } catch (_) {
      return FaceMeshFrame.empty;
    } finally {
      _isProcessing = false;
    }
  }

  FaceMeshFrame _mapResult(
    FaceMeshResult? mesh, {
    required FaceMappingContext mapping,
    required int rotationDegrees,
  }) {
    if (mesh == null || mesh.landmarks.length < 468) return FaceMeshFrame.empty;

    final mapper = FaceMeshPointMapper(
      mesh: mesh,
      context: mapping,
      rotationDegrees: rotationDegrees,
    );

    return _regionBuilder.build(mesh: mesh, mapper: mapper);
  }

  int? _rotationDegrees({
    required CameraDescription camera,
    required DeviceOrientation deviceOrientation,
  }) {
    if (Platform.isIOS) {
      return _orientationDegrees[deviceOrientation];
    }
    final deviceRotation = _orientationDegrees[deviceOrientation];
    if (deviceRotation == null) return null;
    if (camera.lensDirection == CameraLensDirection.front) {
      return (camera.sensorOrientation + deviceRotation) % 360;
    }
    return (camera.sensorOrientation - deviceRotation + 360) % 360;
  }

  Future<void> dispose() async {
    _detector?.close();
    _meshProcessor?.close();
    _detector = null;
    _meshProcessor = null;
    _pipeline = null;
  }
}
