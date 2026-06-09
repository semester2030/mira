/// Thrown when a photo fails on-device face validation.
class FaceGateException implements Exception {
  final String messageAr;
  final String? reasonCode;

  const FaceGateException(this.messageAr, {this.reasonCode});

  @override
  String toString() => messageAr;
}
