/// Face tracking quality — educational overlay visibility gate.
enum FaceTrackingQuality { high, medium, low }

extension FaceTrackingQualityLabels on FaceTrackingQuality {
  String get labelAr => switch (this) {
        FaceTrackingQuality.high => 'ممتاز',
        FaceTrackingQuality.medium => 'جيد',
        FaceTrackingQuality.low => 'ضعيف',
      };

  bool get showRegions => this != FaceTrackingQuality.low;

  String get badgeMessageAr => switch (this) {
        FaceTrackingQuality.low => 'ثبّتي وجهك داخل الإطار',
        FaceTrackingQuality.high => 'جاهز للتصوير',
        FaceTrackingQuality.medium => 'جاهز للتصوير',
      };
}
