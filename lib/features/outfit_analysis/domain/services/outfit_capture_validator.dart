import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_capture_validation.dart';
import 'outfit_body_pose_analyzer.dart';
import 'outfit_capture_rules.dart';
import '../../presentation/utils/outfit_camera_frame_utils.dart';

/// Validates live outfit camera frames and captured stills.
class OutfitCaptureValidator {
  OutfitCaptureValidator({
    FaceDetector? faceDetector,
    OutfitBodyPoseAnalyzer? poseAnalyzer,
  })  : _faceDetectorOverride = faceDetector,
        _poseAnalyzer = poseAnalyzer ?? OutfitBodyPoseAnalyzer();

  FaceDetector? _faceDetectorOverride;
  final OutfitBodyPoseAnalyzer _poseAnalyzer;

  FaceDetector get _faceDetector {
    _faceDetectorOverride ??= FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.fast,
        minFaceSize: 0.03,
        enableContours: false,
        enableClassification: false,
        enableLandmarks: false,
        enableTracking: false,
      ),
    );
    return _faceDetectorOverride!;
  }

  /// Synchronous brightness/blur only — safe on camera callback thread.
  OutfitCaptureValidationResult validateCameraFrameSync({
    required CameraImage image,
    OutfitBodyPoseMetrics pose = OutfitBodyPoseMetrics.none,
  }) {
    final brightness = OutfitCameraFrameUtils.averageBrightness(image);
    final blurScore = OutfitCameraFrameUtils.blurScore(image);
    return OutfitCaptureRules.evaluateLive(
      OutfitCaptureFrameMetrics(
        brightness: brightness,
        blurScore: blurScore,
        faceCount: 0,
        faceAreaRatio: 0,
        faceCenterYNormalized: 0.5,
        faceBottomYNormalized: 0.5,
        pose: pose,
      ),
    );
  }

  Future<OutfitBodyPoseMetrics> analyzePoseFromFile(File file) =>
      _poseAnalyzer.analyzeFile(file);

  Future<OutfitCaptureValidationResult> validateFile(File file) async {
    if (!await file.exists()) {
      return OutfitCaptureRules.evaluateStill(OutfitCaptureFrameMetrics.neutral);
    }

    final bytes = await file.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      return OutfitCaptureRules.evaluateStill(OutfitCaptureFrameMetrics.neutral);
    }

    final oriented = img.bakeOrientation(decoded);
    final temp = File(
      '${Directory.systemTemp.path}/mira_outfit_val_${DateTime.now().millisecondsSinceEpoch}.jpg',
    );
    await temp.writeAsBytes(img.encodeJpg(oriented, quality: 92), flush: true);

    try {
      final pose = await _poseAnalyzer.analyzeFile(temp);
      final metrics = await _metricsFromImage(
        oriented,
        filePath: temp.path,
        pose: pose,
      );
      return OutfitCaptureRules.evaluateStill(metrics);
    } finally {
      if (await temp.exists()) {
        await temp.delete();
      }
    }
  }

  Future<OutfitCaptureFrameMetrics> _metricsFromImage(
    img.Image image, {
    required String filePath,
    required OutfitBodyPoseMetrics pose,
  }) async {
    final brightness = _brightnessFromImage(image);
    final blurScore = _blurScoreFromImage(image);
    final inputImage = InputImage.fromFilePath(filePath);
    final faces = await _faceDetector.processImage(inputImage);
    return _metricsFromFaces(
      faces: faces,
      inputImage: inputImage,
      brightness: brightness,
      blurScore: blurScore,
      pose: pose,
    );
  }

  OutfitCaptureFrameMetrics _metricsFromFaces({
    required List<Face> faces,
    required InputImage inputImage,
    required double brightness,
    required double blurScore,
    required OutfitBodyPoseMetrics pose,
  }) {
    if (faces.isEmpty) {
      return OutfitCaptureFrameMetrics(
        brightness: brightness,
        blurScore: blurScore,
        faceCount: 0,
        faceAreaRatio: 0,
        faceCenterYNormalized: 0.5,
        faceBottomYNormalized: 0.5,
        pose: pose,
      );
    }

    final (imageWidth, imageHeight) = _resolveImageSize(inputImage, faces);
    faces.sort(
      (a, b) => _faceArea(b).compareTo(_faceArea(a)),
    );
    final box = faces.first.boundingBox;
    final faceArea = box.width * box.height;
    final imageArea = imageWidth * imageHeight;

    return OutfitCaptureFrameMetrics(
      brightness: brightness,
      blurScore: blurScore,
      faceCount: faces.length,
      faceAreaRatio: imageArea <= 0 ? 0 : faceArea / imageArea,
      faceCenterYNormalized: box.center.dy / imageHeight,
      faceBottomYNormalized: box.bottom / imageHeight,
      pose: pose,
    );
  }

  (double width, double height) _resolveImageSize(
    InputImage inputImage,
    List<Face> faces,
  ) {
    final metadata = inputImage.metadata;
    if (metadata != null && metadata.size.width > 0 && metadata.size.height > 0) {
      return (metadata.size.width, metadata.size.height);
    }
    if (faces.isNotEmpty) {
      final box = faces.first.boundingBox;
      return (box.right / 0.65, box.bottom / 0.35);
    }
    return (1080, 1920);
  }

  double _brightnessFromImage(img.Image image) {
    var sum = 0.0;
    var count = 0;
    final step = math.max(1, (image.width * image.height ~/ 5000));
    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final pixel = image.getPixel(x, y);
        sum += (pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114) / 255;
        count++;
      }
    }
    return count == 0 ? 0 : sum / count;
  }

  double _blurScoreFromImage(img.Image image) {
    final sample = img.copyResize(
      image,
      width: 64,
      height: 96,
      interpolation: img.Interpolation.average,
    );
    var sum = 0.0;
    var sumSq = 0.0;
    var count = 0;
    for (var y = 1; y < sample.height - 1; y++) {
      for (var x = 1; x < sample.width - 1; x++) {
        final c = sample.getPixel(x, y).r.toDouble();
        final lap = (-4 * c +
                sample.getPixel(x - 1, y).r +
                sample.getPixel(x + 1, y).r +
                sample.getPixel(x, y - 1).r +
                sample.getPixel(x, y + 1).r)
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

  double _faceArea(Face face) {
    final box = face.boundingBox;
    return box.width * box.height;
  }

  Future<void> dispose() async {
    await _faceDetectorOverride?.close();
    _faceDetectorOverride = null;
    await _poseAnalyzer.dispose();
  }
}
