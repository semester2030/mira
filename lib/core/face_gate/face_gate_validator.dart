import 'dart:io';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

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
        minFaceSize: 0.12,
        enableContours: false,
        enableClassification: false,
        enableLandmarks: false,
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

    final inputImage = InputImage.fromFilePath(imageFile.path);

    try {
      final faces = await _faceDetector.processImage(inputImage);
      final (imageWidth, imageHeight) = _resolveImageSize(inputImage, faces);

      if (faces.isEmpty) {
        return FaceGateRules.evaluate(
          faceCount: 0,
          faceAreaRatio: 0,
        );
      }

      faces.sort(
        (a, b) => _faceBoxArea(b).compareTo(_faceBoxArea(a)),
      );
      final primary = faces.first;
      final ratio = FaceGateRules.faceAreaRatio(
        boxWidth: primary.boundingBox.width,
        boxHeight: primary.boundingBox.height,
        imageWidth: imageWidth,
        imageHeight: imageHeight,
      );

      return FaceGateRules.evaluate(
        faceCount: faces.length,
        faceAreaRatio: ratio,
        headYawDegrees: primary.headEulerAngleY,
        headRollDegrees: primary.headEulerAngleZ,
      );
    } catch (_) {
      return const FaceGateResult.rejected(
        reasonCode: 'detector_error',
        messageAr:
            'تعذر فحص الصورة — أعيدي التقاط selfie واضح بإضاءة جيدة.',
      );
    }
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
