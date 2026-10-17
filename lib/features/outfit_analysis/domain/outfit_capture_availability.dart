import '../../../core/config/mira_features.dart';

/// Shown wherever an outfit camera entry would have started.
const String outfitCameraPausedMessage =
    'تصوير الإطلالة بالكاميرا متوقف مؤقتًا للتطوير. اختاري صورة من الاستديو لتحليل إطلالتك';

enum OutfitCaptureEntry { liveCamera, galleryWhilePaused }

/// Central route decision. Face capture does not use this flag.
OutfitCaptureEntry resolveOutfitCaptureEntry({bool? cameraEnabled}) {
  final enabled = cameraEnabled ?? MiraFeatures.outfitCameraCaptureEnabled;
  return enabled ? OutfitCaptureEntry.liveCamera : OutfitCaptureEntry.galleryWhilePaused;
}

/// Face photography stays available while outfit camera is paused.
bool get faceCameraCaptureRemainsAvailable => true;
