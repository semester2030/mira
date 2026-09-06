import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/presentation/analysis/contracts/face_analysis_journey.dart';

void main() {
  test('deleted temp image cannot be treated as retryable capture', () async {
    final dir = await Directory.systemTemp.createTemp('mira_face_retry_');
    final file = File('${dir.path}/capture.jpg');
    await file.writeAsBytes([0xFF, 0xD8, 0xFF, 0xD9]);
    expect(await file.exists(), isTrue);
    await file.delete();
    expect(await file.exists(), isFalse);

    // UI contract: missing file ⇒ require recapture (not silent retry).
    final err = mapFaceAnalysisError(
      code: 'CAPTURE_MISSING',
      requiresRecapture: true,
      message: 'الصورة غير متاحة — أعيدي التصوير.',
    );
    expect(err.requiresRecapture, isTrue);
    expect(err.userAction, FaceAnalysisUserAction.recapture);
    await dir.delete(recursive: true);
  });
}
