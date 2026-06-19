import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';

import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

/// Camera frame helpers for outfit capture validation.
abstract final class OutfitCameraFrameUtils {
  OutfitCameraFrameUtils._();

  static InputImage? toInputImage(
    CameraImage image,
    CameraDescription camera, {
    required DeviceOrientation deviceOrientation,
  }) {
    if (Platform.isIOS) {
      return _fromBgra(image, camera, deviceOrientation);
    }
    return _fromNv21(image, camera, deviceOrientation);
  }

  static double averageBrightness(CameraImage image) {
    if (Platform.isIOS && image.planes.length == 1) {
      return _brightnessFromBgra(Uint8List.fromList(image.planes.first.bytes));
    }

    final plane = image.planes.first;
    final bytes = Uint8List.fromList(plane.bytes);
    if (bytes.isEmpty) return 0;

    final width = image.width;
    final rowStride = plane.bytesPerRow;
    var sum = 0.0;
    var count = 0;
    final yStep = math.max(1, image.height ~/ 72);
    final xStep = math.max(1, width ~/ 48);

    for (var y = 0; y < image.height; y += yStep) {
      for (var x = 0; x < width; x += xStep) {
        sum += _yValue(bytes, rowStride, x, y);
        count++;
      }
    }
    return count == 0 ? 0 : (sum / count) / 255;
  }

  static double blurScore(CameraImage image) {
    if (Platform.isIOS && image.planes.length == 1) {
      return _blurFromBgra(image, copiedBytes: Uint8List.fromList(image.planes.first.bytes));
    }

    final plane = image.planes.first;
    final bytes = Uint8List.fromList(plane.bytes);
    final width = image.width;
    final height = image.height;
    final rowStride = plane.bytesPerRow;
    if (width < 8 || height < 8) return 0;

    var sum = 0.0;
    var sumSq = 0.0;
    var count = 0;
    final xStep = math.max(1, width ~/ 48);
    final yStep = math.max(1, height ~/ 72);

    for (var y = yStep; y < height - yStep; y += yStep) {
      for (var x = xStep; x < width - xStep; x += xStep) {
        final center = _yValue(bytes, rowStride, x, y);
        final lap = (-4 * center +
                _yValue(bytes, rowStride, x - xStep, y) +
                _yValue(bytes, rowStride, x + xStep, y) +
                _yValue(bytes, rowStride, x, y - yStep) +
                _yValue(bytes, rowStride, x, y + yStep))
            .abs();
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    if (count == 0) return 0;
    final mean = sum / count;
    final variance = (sumSq / count) - (mean * mean);
    return math.sqrt(math.max(variance, 0));
  }

  static double _brightnessFromBgra(Uint8List bytes) {
    if (bytes.length < 4) return 0;
    var sum = 0.0;
    var count = 0;
    final step = math.max(4, bytes.length ~/ 4000) * 4;
    for (var i = 0; i < bytes.length - 3; i += step) {
      final b = bytes[i];
      final g = bytes[i + 1];
      final r = bytes[i + 2];
      sum += (r * 0.299 + g * 0.587 + b * 0.114);
      count++;
    }
    return count == 0 ? 0 : (sum / count) / 255;
  }

  static double _blurFromBgra(CameraImage image, {Uint8List? copiedBytes}) {
    final bytes = copiedBytes ?? Uint8List.fromList(image.planes.first.bytes);
    final width = image.width;
    final height = image.height;
    final rowStride = image.planes.first.bytesPerRow;
    if (width < 8 || height < 8) return 0;

    var sum = 0.0;
    var sumSq = 0.0;
    var count = 0;
    final xStep = math.max(1, width ~/ 48);
    final yStep = math.max(1, height ~/ 72);

    for (var y = yStep; y < height - yStep; y += yStep) {
      for (var x = xStep; x < width - xStep; x += xStep) {
        final center = _lumaBgra(bytes, rowStride, x, y);
        final lap = (-4 * center +
                _lumaBgra(bytes, rowStride, x - xStep, y) +
                _lumaBgra(bytes, rowStride, x + xStep, y) +
                _lumaBgra(bytes, rowStride, x, y - yStep) +
                _lumaBgra(bytes, rowStride, x, y + yStep))
            .abs();
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    if (count == 0) return 0;
    final mean = sum / count;
    final variance = (sumSq / count) - (mean * mean);
    return math.sqrt(math.max(variance, 0));
  }

  static double _lumaBgra(Uint8List bytes, int rowStride, int x, int y) {
    final index = y * rowStride + x * 4;
    if (index + 2 >= bytes.length) return 0;
    final b = bytes[index];
    final g = bytes[index + 1];
    final r = bytes[index + 2];
    return r * 0.299 + g * 0.587 + b * 0.114;
  }

  static int _yValue(Uint8List bytes, int rowStride, int x, int y) {
    final index = y * rowStride + x;
    if (index >= bytes.length) return 0;
    return bytes[index];
  }

  static InputImage? _fromBgra(
    CameraImage image,
    CameraDescription camera,
    DeviceOrientation deviceOrientation,
  ) {
    if (image.planes.length != 1) return null;
    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: _rotation(camera, deviceOrientation),
        format: InputImageFormat.bgra8888,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  static InputImage? _fromNv21(
    CameraImage image,
    CameraDescription camera,
    DeviceOrientation deviceOrientation,
  ) {
    final bytes = _nv21Bytes(image);
    if (bytes == null) return null;
    return InputImage.fromBytes(
      bytes: bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: _rotation(camera, deviceOrientation),
        format: InputImageFormat.nv21,
        bytesPerRow: image.planes.first.bytesPerRow,
      ),
    );
  }

  static Uint8List? _nv21Bytes(CameraImage image) {
    if (image.planes.length == 1) {
      return Uint8List.fromList(image.planes.first.bytes);
    }
    if (image.planes.length < 2) return null;

    final yPlane = image.planes[0];
    final uvPlane = image.planes[1];
    final out = Uint8List(yPlane.bytes.length + uvPlane.bytes.length);
    out.setRange(0, yPlane.bytes.length, yPlane.bytes);
    out.setRange(yPlane.bytes.length, out.length, uvPlane.bytes);
    return out;
  }

  static InputImageRotation _rotation(
    CameraDescription camera,
    DeviceOrientation deviceOrientation,
  ) {
    if (Platform.isIOS) {
      return _rotationFromDegrees(_orientationDegrees[deviceOrientation] ?? 0);
    }

    final deviceRotation = _orientationDegrees[deviceOrientation] ?? 0;
    final rotation = camera.lensDirection == CameraLensDirection.front
        ? (camera.sensorOrientation + deviceRotation) % 360
        : (camera.sensorOrientation - deviceRotation + 360) % 360;
    return _rotationFromDegrees(rotation);
  }

  static InputImageRotation _rotationFromDegrees(int degrees) {
    switch (degrees) {
      case 90:
        return InputImageRotation.rotation90deg;
      case 180:
        return InputImageRotation.rotation180deg;
      case 270:
        return InputImageRotation.rotation270deg;
      default:
        return InputImageRotation.rotation0deg;
    }
  }

  static const _orientationDegrees = {
    DeviceOrientation.portraitUp: 0,
    DeviceOrientation.landscapeLeft: 90,
    DeviceOrientation.portraitDown: 180,
    DeviceOrientation.landscapeRight: 270,
  };

  /// Downscale camera frame to temp JPEG for pose checks (iOS-safe).
  static Future<File?> writeTempPreviewJpeg(CameraImage image) async {
    try {
      img.Image? decoded;
      if (Platform.isIOS && image.planes.length == 1) {
        decoded = _bgraToImage(
          Uint8List.fromList(image.planes.first.bytes),
          image.width,
          image.height,
          image.planes.first.bytesPerRow,
        );
      } else if (image.planes.isNotEmpty) {
        decoded = _yPlaneToImage(
          Uint8List.fromList(image.planes.first.bytes),
          image.width,
          image.height,
          image.planes.first.bytesPerRow,
        );
      }
      if (decoded == null) return null;

      final preview = img.copyResize(
        decoded,
        width: 360,
        height: (360 * decoded.height / decoded.width).round(),
      );
      final temp = File(
        '${Directory.systemTemp.path}/mira_outfit_pose_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await temp.writeAsBytes(img.encodeJpg(preview, quality: 82), flush: true);
      return temp;
    } catch (_) {
      return null;
    }
  }

  static img.Image? _bgraToImage(
    Uint8List bytes,
    int width,
    int height,
    int rowStride,
  ) {
    final image = img.Image(width: width, height: height);
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        final index = y * rowStride + x * 4;
        if (index + 2 >= bytes.length) continue;
        image.setPixelRgba(
          x,
          y,
          bytes[index + 2],
          bytes[index + 1],
          bytes[index],
          255,
        );
      }
    }
    return image;
  }

  static img.Image? _yPlaneToImage(
    Uint8List bytes,
    int width,
    int height,
    int rowStride,
  ) {
    final image = img.Image(width: width, height: height);
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        final index = y * rowStride + x;
        if (index >= bytes.length) continue;
        final yVal = bytes[index];
        image.setPixelRgba(x, y, yVal, yVal, yVal, 255);
      }
    }
    return image;
  }
}
