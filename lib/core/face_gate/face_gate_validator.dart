import 'dart:io';
import 'dart:ui';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../features/skin_analysis/presentation/utils/face_image_processor.dart';
import 'face_gate_exception.dart';
import 'face_gate_result.dart';
import 'face_gate_rules.dart';

/// On-device face gate — blocks non-face photos before upload/analysis.
class FaceGateValidator {
  FaceGateValidator._();

  static final FaceGateValidator instance = FaceGateValidator._();

  FaceDetector? _detector;

  FaceDetector get _faceDetector {
    _detector ??= FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.accurate,
        minFaceSize: 0.08,
        enableContours: false,
        enableClassification: false,
        enableLandmarks: true,
        enableTracking: false,
      ),
    );
    return _detector!;
  }

  Future<FaceGateResult> validate(File imageFile) async {
    if (!await imageFile.exists()) {
      return const FaceGateResult.rejected(
        reasonCode: 'missing_file',
        messageAr: 'لم يتم العثور على الصورة — أعيدي المحاولة.',
      );
    }

    try {
      // Match on-screen preview: EXIF orientation + center crop.
      final oriented = await _orientedPreviewFile(imageFile);
      try {
        final primary = await _detectOnFile(oriented);
        if (primary != null) return primary;

        // Fallback: raw camera file (some gallery picks).
        if (oriented.path != imageFile.path) {
          final fallback = await _detectOnFile(imageFile);
          if (fallback != null) return fallback;
        }

        return FaceGateRules.evaluate(faceCount: 0, faceAreaRatio: 0);
      } finally {
        if (oriented.path != imageFile.path) {
          if (await oriented.exists()) {
            await oriented.delete();
          }
        }
      }
    } catch (_) {
      return const FaceGateResult.rejected(
        reasonCode: 'detector_error',
        messageAr:
            'تعذر فحص الصورة — أعيدي التقاط selfie واضح بإضاءة جيدة.',
      );
    }
  }

  Future<File> _orientedPreviewFile(File source) async {
    final aspect = FaceImageProcessor.viewportAspectRatio;
    final bytes = await FaceImageProcessor.readOrientedJpegBytes(
      source,
      targetAspectRatio: aspect,
    );
    final path =
        '${Directory.systemTemp.path}/mira_face_gate_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final out = File(path);
    await out.writeAsBytes(bytes, flush: true);
    return out;
  }

  Future<FaceGateResult?> _detectOnFile(File file) async {
    final inputImage = InputImage.fromFilePath(file.path);
    final faces = await _faceDetector.processImage(inputImage);
    final (imageWidth, imageHeight) = _resolveImageSize(inputImage, faces);

    if (faces.isEmpty) return null;

    faces.sort(
      (a, b) => _faceBoxArea(b).compareTo(_faceBoxArea(a)),
    );
    final primary = faces.first;
    final box = primary.boundingBox;
    final ratio = FaceGateRules.faceAreaRatio(
      boxWidth: box.width,
      boxHeight: box.height,
      imageWidth: imageWidth,
      imageHeight: imageHeight,
    );

    final centerOffsetX = (box.center.dx / imageWidth) - 0.5;
    final centerOffsetY = (box.center.dy / imageHeight) - 0.46;

    final rules = FaceGateRules.evaluate(
      faceCount: faces.length,
      faceAreaRatio: ratio,
      headYawDegrees: primary.headEulerAngleY,
      headRollDegrees: primary.headEulerAngleZ,
      centerOffsetXRatio: centerOffsetX,
      centerOffsetYRatio: centerOffsetY,
    );

    if (!rules.isAccepted) return rules;

    return FaceGateResult.acceptedWithFace(
      faceBox: Rect.fromLTRB(box.left, box.top, box.right, box.bottom),
      imageSize: Size(imageWidth, imageHeight),
    );
  }

  /// Throws [FaceGateException] when the photo is not acceptable.
  Future<void> assertAccepted(File imageFile) async {
    final result = await validate(imageFile);
    if (!result.isAccepted) {
      throw FaceGateException(
        result.messageAr,
        reasonCode: result.reasonCode,
      );
    }
  }

  Future<void> dispose() async {
    await _detector?.close();
    _detector = null;
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
      final inferredW = box.right / 0.75;
      final inferredH = box.bottom / 0.75;
      if (inferredW > 0 && inferredH > 0) {
        return (inferredW, inferredH);
      }
    }

    return (1080, 1440);
  }

  double _faceBoxArea(Face face) {
    final box = face.boundingBox;
    return box.width * box.height;
  }
}
