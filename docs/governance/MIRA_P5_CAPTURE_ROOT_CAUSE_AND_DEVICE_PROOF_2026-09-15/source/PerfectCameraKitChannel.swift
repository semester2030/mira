import Flutter
import UIKit
import AVFoundation
import CoreVideo
import PerfectLibCameraKit

/// ONE CameraKit owner for Skin capture quality.
/// Extends existing Flutter camera preview — does not open a second camera.
enum PerfectCameraKitChannel {
  static let name = "mira/perfect_camerakit"
  private static let owner = PerfectCameraKitOwner()

  static func register(with messenger: FlutterBinaryMessenger) {
    let methods = FlutterMethodChannel(name: name, binaryMessenger: messenger)
    let events = FlutterEventChannel(
      name: "\(name)/quality",
      binaryMessenger: messenger
    )
    events.setStreamHandler(owner)
    methods.setMethodCallHandler { call, result in
      owner.handle(call: call, result: result)
    }
  }
}

private final class PerfectCameraKitOwner: NSObject, FlutterStreamHandler, CameraKitDelegate {
  private var cameraKit: CameraKit?
  private var eventSink: FlutterEventSink?
  private var initialized = false
  private var initError: String?
  private var cameraOpenNotified = false
  private let processQueue = DispatchQueue(label: "mira.perfect.camerakit.frames")
  private var lastEmitMs: Int64 = 0
  private var sendCameraBufferCount: Int64 = 0
  private var qualityCallbackCount: Int64 = 0
  private var lastFrameLogMs: Int64 = 0

  func handle(call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "isAvailable":
      result(true)
    case "initialize":
      initialize(result: result)
    case "setLevel":
      guard let args = call.arguments as? [String: Any],
            let level = args["level"] as? String
      else {
        result(
          FlutterError(code: "bad_args", message: "level required", details: nil)
        )
        return
      }
      applyLevel(level)
      result(nil)
    case "onCameraOpen":
      let isFront = (call.arguments as? [String: Any])?["isFront"] as? Bool ?? true
      cameraKit?.onCameraOpen(isFront)
      cameraOpenNotified = true
      NSLog("Mira: CameraKit onCameraOpen isFront=%d", isFront ? 1 : 0)
      result(nil)
    case "sendFrameYv12":
      sendFrame(call: call, result: result)
    case "dispose":
      disposeKit()
      result(nil)
    case "status":
      result(
        [
          "initialized": initialized,
          "error": initError as Any,
          "version": PerfectLibCameraKitVer,
          "level": "moderate",
          "sendCameraBufferCount": sendCameraBufferCount,
          "qualityCallbackCount": qualityCallbackCount,
          "cameraOpenNotified": cameraOpenNotified,
        ] as [String: Any]
      )
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func initialize(result: @escaping FlutterResult) {
    if initialized, cameraKit != nil {
      result(
        [
          "ok": true,
          "version": PerfectLibCameraKitVer,
          "modelPath": modelPath() as Any,
        ] as [String: Any]
      )
      return
    }
    let path = modelPath()
    guard let path else {
      initError = "Perfect CameraKit model bundle missing"
      result(
        FlutterError(
          code: "model_missing",
          message: initError,
          details: nil
        )
      )
      return
    }
    CameraKit.create(withModelPath: path) { [weak self] kit, error in
      guard let self else { return }
      if let error {
        self.initError = error.localizedDescription
        self.initialized = false
        result(
          FlutterError(
            code: "init_failed",
            message: error.localizedDescription,
            details: nil
          )
        )
        return
      }
      guard let kit else {
        self.initError = "CameraKit create returned nil"
        result(
          FlutterError(
            code: "init_failed",
            message: self.initError,
            details: nil
          )
        )
        return
      }
      self.cameraKit = kit
      kit.delegate = self
      kit.setCameraKitLevel(PFCameraKitLevel.moderate)
      // Physical evidence (80179): area=good + pose=good repeatedly while
      // light=under_exposed blocked READY (65/65). Frame expand did not remove it.
      // Override lightingLower only: MODERATE 0.70 → RELAXED floor 0.55.
      // Pose (yaw/pitch) and faceSizeRatio stay MODERATE presets.
      let lightingOverrideApplied = Self.applyIndoorLightingLowerOverride(kit)
      self.initialized = true
      self.initError = nil
      let p = kit.currentParameter
      NSLog(
        "Mira: PerfectCameraKit initialized v=%@ model=%@ yaw=%.1f size=%.2f lightL=%.2f lightU=%.2f lightingOverride=%d",
        PerfectLibCameraKitVer,
        path,
        p.faceYaw,
        p.faceSizeRatio,
        p.lightingLower,
        p.lightingUpper,
        lightingOverrideApplied ? 1 : 0
      )
      result(
        [
          "ok": true,
          "version": PerfectLibCameraKitVer,
          "modelPath": path,
          "level": "moderate",
          "faceSizeRatio": p.faceSizeRatio,
          "faceYaw": p.faceYaw,
          "facePitchUpper": p.facePitchUpper,
          "facePitchLower": p.facePitchLower,
          "lightingUpper": p.lightingUpper,
          "lightingLower": p.lightingLower,
          "lightingOverride": lightingOverrideApplied,
          "lightingOverrideLower": 0.55,
        ] as [String: Any]
      )
    }
  }

  /// Indoor usability: soften lighting floor only. Valid SDK range 0.55…1.0.
  ///
  /// Physical session 80179 (VERIFIED): 65× (area=good, pose=good) and
  /// 65/65 were light=under_exposed; ready_true=0. MODERATE lightingLower=0.70
  /// blocked READY. Pose/size left at MODERATE. Use RELAXED lighting floor 0.55.
  @discardableResult
  private static func applyIndoorLightingLowerOverride(_ kit: CameraKit) -> Bool {
    let targetLower: Float = 0.55
    let builder = kit.currentParameter.parameterBuilder
    builder.setLightingLower(targetLower)
    do {
      let parameter = try builder.build()
      kit.setCameraKitOverwrite(parameter)
      return true
    } catch {
      NSLog(
        "Mira: CameraKit lightingLower override failed: %@",
        error.localizedDescription
      )
      return false
    }
  }

  private func applyLevel(_ level: String) {
    switch level.lowercased() {
    case "strict":
      cameraKit?.setCameraKitLevel(PFCameraKitLevel.strict)
    case "relaxed":
      cameraKit?.setCameraKitLevel(PFCameraKitLevel.relaxed)
    default:
      cameraKit?.setCameraKitLevel(PFCameraKitLevel.moderate)
    }
  }

  private func modelPath() -> String? {
    if let bundle = Bundle(identifier: "org.cocoapods.PerfectCameraKitModels")
      ?? Bundle(path: Bundle.main.bundlePath + "/Frameworks/PerfectCameraKitModels.bundle")
      ?? Bundle.main.url(forResource: "PerfectCameraKitModels", withExtension: "bundle").flatMap({
        Bundle(url: $0)
      })
    {
      return bundle.resourcePath
    }
    // Fallback: look for known model file in main bundle
    if let url = Bundle.main.url(
      forResource: "YMK_Davinci_20200512_fp16",
      withExtension: "mnn"
    ) {
      return url.deletingLastPathComponent().path
    }
    return nil
  }

  private func sendFrame(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let kit = cameraKit, initialized else {
      result(
        FlutterError(
          code: "not_ready",
          message: initError ?? "CameraKit not initialized",
          details: nil
        )
      )
      return
    }
    guard let args = call.arguments as? [String: Any],
          let yData = args["y"] as? FlutterStandardTypedData,
          let uvData = args["uv"] as? FlutterStandardTypedData
    else {
      result(
        FlutterError(
          code: "bad_args",
          message: "width/height/y/uv required (NV12)",
          details: nil
        )
      )
      return
    }
    // Flutter may send NSNumber as Int or Int64 — accept both.
    let width = Self.intArg(args["width"])
    let height = Self.intArg(args["height"])
    guard width > 0, height > 0 else {
      result(
        FlutterError(
          code: "bad_args",
          message: "invalid width/height",
          details: nil
        )
      )
      return
    }
    if !cameraOpenNotified {
      let isFront = args["isFront"] as? Bool ?? true
      kit.onCameraOpen(isFront)
      cameraOpenNotified = true
      NSLog("Mira: CameraKit onCameraOpen(lazy) isFront=%d", isFront ? 1 : 0)
    }
    // Acknowledge immediately — do not block Flutter camera stream.
    result(nil)
    let y = yData.data
    let uv = uvData.data
    let yStride = Self.intArg(args["yBytesPerRow"], fallback: width)
    let uvStride = Self.intArg(args["uvBytesPerRow"], fallback: width)
    processQueue.async {
      guard let sample = Self.makeNv12SampleBuffer(
        width: width,
        height: height,
        y: y,
        uv: uv,
        yStride: yStride,
        uvStride: uvStride
      ) else {
        NSLog("Mira: CameraKit makeNv12SampleBuffer FAILED w=%d h=%d", width, height)
        return
      }
      kit.sendCameraBuffer(sample)
      self.sendCameraBufferCount += 1
      let now = Int64(Date().timeIntervalSince1970 * 1000)
      if now - self.lastFrameLogMs >= 1000 {
        self.lastFrameLogMs = now
        let meanY = Self.lastMeanY
        NSLog(
          "Mira: sendCameraBuffer count=%lld w=%d h=%d yStride=%d uvStride=%d yBytes=%d uvBytes=%d meanY=%.1f fullRangeExpand=1",
          self.sendCameraBufferCount,
          width,
          height,
          yStride,
          uvStride,
          y.count,
          uv.count,
          meanY
        )
      }
    }
  }

  private static func intArg(_ raw: Any?, fallback: Int = 0) -> Int {
    if let v = raw as? Int { return v }
    if let v = raw as? Int64 { return Int(v) }
    if let v = raw as? NSNumber { return v.intValue }
    return fallback
  }

  private func disposeKit() {
    NSLog(
      "Mira: CameraKit dispose send=%lld quality=%lld",
      sendCameraBufferCount,
      qualityCallbackCount
    )
    cameraKit?.delegate = nil
    cameraKit = nil
    initialized = false
    cameraOpenNotified = false
    initError = nil
    sendCameraBufferCount = 0
    qualityCallbackCount = 0
  }

  // MARK: - CameraKitDelegate

  func cameraKit(_ cameraKit: CameraKit, checkedResult: CameraKitQualityCheck) {
    qualityCallbackCount += 1
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    // Throttle UI events ~15 Hz; CameraKit still receives every frame.
    if now - lastEmitMs < 66 { return }
    lastEmitMs = now

    let faceAreaOk = checkedResult.faceAreaQuality == .good
    let facePoseOk = checkedResult.facePoseQuality == .good
    let lightingOk =
      checkedResult.lightingQuality == .good
      || checkedResult.lightingQuality == .normal
    let ready = faceAreaOk && facePoseOk && lightingOk && checkedResult.isValid

    NSLog(
      "Mira: CameraKit quality n=%lld ready=%d valid=%d area=%@ pose=%@ light=%@ deg=%.1f send=%lld",
      qualityCallbackCount,
      ready ? 1 : 0,
      checkedResult.isValid ? 1 : 0,
      Self.faceAreaName(checkedResult.faceAreaQuality),
      Self.facePoseName(checkedResult.facePoseQuality),
      Self.lightingName(checkedResult.lightingQuality),
      checkedResult.facePoseDegree,
      sendCameraBufferCount
    )

    guard let sink = eventSink else { return }

    let payload: [String: Any] = [
      "ready": ready,
      "isValid": checkedResult.isValid,
      "faceAreaOk": faceAreaOk,
      "facePoseOk": facePoseOk,
      "lightingOk": lightingOk,
      "faceArea": Self.faceAreaName(checkedResult.faceAreaQuality),
      "facePose": Self.facePoseName(checkedResult.facePoseQuality),
      "lighting": Self.lightingName(checkedResult.lightingQuality),
      "facePoseDegree": checkedResult.facePoseDegree,
      "guidanceCode": Self.guidanceCode(
        faceArea: checkedResult.faceAreaQuality,
        facePose: checkedResult.facePoseQuality,
        lighting: checkedResult.lightingQuality,
        ready: ready
      ),
      "sendCameraBufferCount": sendCameraBufferCount,
      "qualityCallbackCount": qualityCallbackCount,
    ]
    DispatchQueue.main.async { sink(payload) }
  }

  // MARK: - FlutterStreamHandler

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink)
    -> FlutterError?
  {
    eventSink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    eventSink = nil
    return nil
  }

  // MARK: - Helpers

  private static func guidanceCode(
    faceArea: PFCameraKitFaceAreaQuality,
    facePose: PFCameraKitFacePoseQuality,
    lighting: PFCameraKitLightingQuality,
    ready: Bool
  ) -> String {
    if ready { return "ready" }
    // Priority: what the user can fix first — distance → pose → lighting.
    switch faceArea {
    case .tooSmall: return "too_far"
    case .outOfBoundary: return "too_close"
    default: break
    }
    if facePose == .bad { return "look_straight" }
    switch lighting {
    case .underExposed: return "lighting_low"
    case .overExposed: return "lighting_high"
    case .backlighting, .uneven: return "lighting_uneven"
    default: break
    }
    return "align"
  }

  private static func faceAreaName(_ v: PFCameraKitFaceAreaQuality) -> String {
    switch v {
    case .good: return "good"
    case .tooSmall: return "too_small"
    case .outOfBoundary: return "out_of_boundary"
    default: return "unknown"
    }
  }

  private static func facePoseName(_ v: PFCameraKitFacePoseQuality) -> String {
    switch v {
    case .good: return "good"
    case .bad: return "bad"
    default: return "unknown"
    }
  }

  private static func lightingName(_ v: PFCameraKitLightingQuality) -> String {
    switch v {
    case .good: return "good"
    case .normal: return "normal"
    case .overExposed: return "over_exposed"
    case .underExposed: return "under_exposed"
    case .backlighting: return "backlighting"
    case .uneven: return "uneven"
    default: return "unknown"
    }
  }

  private static func makeNv12SampleBuffer(
    width: Int,
    height: Int,
    y: Data,
    uv: Data,
    yStride: Int,
    uvStride: Int
  ) -> CMSampleBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let attrs: [CFString: Any] = [
      kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary
    ]
    // CameraKit contract requires FullRange NV12.
    // Flutter camera_avfoundation delivers VideoRange — expand luma/chroma.
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
      attrs as CFDictionary,
      &pixelBuffer
    )
    guard status == kCVReturnSuccess, let pixelBuffer else { return nil }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let yDest = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0),
          let uvDest = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 1)
    else { return nil }

    let yBytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
    let uvBytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 1)
    let srcYStride = max(yStride, width)
    let srcUvStride = max(uvStride, width)

    var ySum: Int64 = 0
    var yCount: Int64 = 0

    y.withUnsafeBytes { raw in
      guard let src = raw.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
      for row in 0..<height {
        let srcOff = row * srcYStride
        guard srcOff + width <= y.count else { break }
        let dstRow = yDest.advanced(by: row * yBytesPerRow).assumingMemoryBound(to: UInt8.self)
        for col in 0..<width {
          let expanded = Self.videoRangeYToFull(src[srcOff + col])
          dstRow[col] = expanded
          ySum += Int64(expanded)
          yCount += 1
        }
      }
    }
    uv.withUnsafeBytes { raw in
      guard let src = raw.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
      let uvHeight = height / 2
      for row in 0..<uvHeight {
        let srcOff = row * srcUvStride
        guard srcOff + width <= uv.count else { break }
        let dstRow = uvDest.advanced(by: row * uvBytesPerRow).assumingMemoryBound(to: UInt8.self)
        for col in 0..<width {
          dstRow[col] = Self.videoRangeUVToFull(src[srcOff + col])
        }
      }
    }

    if yCount > 0 {
      lastMeanY = Double(ySum) / Double(yCount)
    }

    var formatDesc: CMFormatDescription?
    CMVideoFormatDescriptionCreateForImageBuffer(
      allocator: kCFAllocatorDefault,
      imageBuffer: pixelBuffer,
      formatDescriptionOut: &formatDesc
    )
    guard let formatDesc else { return nil }

    var timing = CMSampleTimingInfo(
      duration: CMTime.invalid,
      presentationTimeStamp: CMTime(value: CMTimeValue(sendTick()), timescale: 1000),
      decodeTimeStamp: CMTime.invalid
    )
    var sampleBuffer: CMSampleBuffer?
    CMSampleBufferCreateReadyWithImageBuffer(
      allocator: kCFAllocatorDefault,
      imageBuffer: pixelBuffer,
      formatDescription: formatDesc,
      sampleTiming: &timing,
      sampleBufferOut: &sampleBuffer
    )
    return sampleBuffer
  }

  /// BT.601 limited-range Y (16…235) → full-range (0…255).
  private static func videoRangeYToFull(_ y: UInt8) -> UInt8 {
    let v = (Int(y) - 16) * 255 / 219
    if v < 0 { return 0 }
    if v > 255 { return 255 }
    return UInt8(v)
  }

  /// Limited-range chroma (16…240) → full-range around 128.
  private static func videoRangeUVToFull(_ uv: UInt8) -> UInt8 {
    let v = (Int(uv) - 128) * 255 / 224 + 128
    if v < 0 { return 0 }
    if v > 255 { return 255 }
    return UInt8(v)
  }

  private static var _tick: Int64 = 0
  private static var lastMeanY: Double = 0
  private static func sendTick() -> Int64 {
    _tick += 1
    return _tick
  }
}
