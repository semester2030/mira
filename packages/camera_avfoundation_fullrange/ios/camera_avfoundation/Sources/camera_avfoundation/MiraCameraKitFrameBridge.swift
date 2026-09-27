// Copyright 2013 The Flutter Authors / MIRA surgical extension.
// Weak hook: when Runner defines MiraCameraKitFeedEmit, forward the ORIGINAL
// AVCapture CMSampleBuffer to Perfect CameraKit (no Dart YUV rebuild).

import AVFoundation
import CoreMedia
import Darwin

enum MiraCameraKitFrameBridge {
  private static let emitSym: (@convention(c) (CMSampleBuffer) -> Void)? = {
    // RTLD_DEFAULT
    guard let raw = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "MiraCameraKitFeedEmit")
    else { return nil }
    return unsafeBitCast(raw, to: (@convention(c) (CMSampleBuffer) -> Void).self)
  }()

  /// Best-effort forward of the live capture sample (same session as Flutter preview).
  static func emitIfPresent(_ sampleBuffer: CMSampleBuffer) {
    emitSym?(sampleBuffer)
  }
}
