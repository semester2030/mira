import Flutter
import UIKit
import AVFoundation
import CoreVideo
import CoreMedia
import ImageIO
import QuartzCore
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
    PerfectCameraKitOwner.shared = owner
    methods.setMethodCallHandler { call, result in
      owner.handle(call: call, result: result)
    }
  }
}

private final class PerfectCameraKitOwner: NSObject, FlutterStreamHandler, CameraKitDelegate {
  fileprivate static weak var shared: PerfectCameraKitOwner?

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
  private var sessionId: Int64 = 0
  private var configuredLevel: String = "moderate"
  private var experimentalLightingLower = false
  private var lightingOverrideApplied = false
  private var loggedFirstFrameConfig = false
  private var pendingNativeFrames = 0
  private var buildProbe: String = "CKCAP-unknown"
  /// True once an original AVCapture sample reached CameraKit (not Dart rebuild).
  private var nativeFeedActive = false
  private var feedSource: String = "dart_rebuild"
  private var lastBlockReason: String = "init"
  private var lastLoggedPixelFmt: UInt32 = 0

  func handle(call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "isAvailable":
      result(true)
    case "initialize":
      initialize(call: call, result: result)
    case "setLevel":
      // Kept for diagnostics only — resets overwrite per SDK contract.
      guard let args = call.arguments as? [String: Any],
            let level = args["level"] as? String
      else {
        result(
          FlutterError(code: "bad_args", message: "level required", details: nil)
        )
        return
      }
      let before = snapshotParams()
      applyLevel(level)
      lightingOverrideApplied = false
      experimentalLightingLower = false
      let after = snapshotParams()
      NSLog(
        "Mira: setLevel ALONE level=%@ lightL before=%.2f after=%.2f (SDK resets overwrite)",
        level,
        before["lightingLower"] as? Float ?? -1,
        after["lightingLower"] as? Float ?? -1
      )
      result(after)
    case "onCameraOpen":
      let isFront = (call.arguments as? [String: Any])?["isFront"] as? Bool ?? true
      cameraKit?.onCameraOpen(isFront)
      cameraOpenNotified = true
      NSLog("Mira: CameraKit onCameraOpen isFront=%d session=%lld", isFront ? 1 : 0, sessionId)
      result(nil)
    case "sendFrameYv12":
      sendFrame(call: call, result: result)
    case "logAttempt":
      let msg = (call.arguments as? [String: Any])?["message"] as? String ?? ""
      NSLog("Mira: %@", msg)
      result(nil)
    case "dispose":
      disposeKit()
      result(nil)
    case "status":
      var snap = snapshotParams()
      snap["initialized"] = initialized
      snap["error"] = initError as Any
      snap["version"] = PerfectLibCameraKitVer
      snap["sendCameraBufferCount"] = sendCameraBufferCount
      snap["qualityCallbackCount"] = qualityCallbackCount
      snap["cameraOpenNotified"] = cameraOpenNotified
      snap["pendingNativeFrames"] = pendingNativeFrames
      snap["sessionId"] = sessionId
      snap["buildProbe"] = buildProbe
      result(snap)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func initialize(call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    let level = (args["level"] as? String) ?? "moderate"
    let experimental = args["experimentalLightingLower"] as? Bool ?? false
    buildProbe = (args["buildProbe"] as? String) ?? buildProbe

    if initialized, cameraKit != nil {
      // Re-apply requested configure atomically for this session.
      configureKit(level: level, experimentalLightingLower: experimental)
      result(snapshotParams(ok: true))
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
      self.sessionId += 1
      self.loggedFirstFrameConfig = false
      self.configureKit(level: level, experimentalLightingLower: experimental)
      self.initialized = true
      self.initError = nil
      var snap = self.snapshotParams(ok: true)
      snap["modelPath"] = path
      NSLog(
        "Mira: PerfectCameraKit FINAL_CONFIG probe=%@ session=%lld v=%@ level=%@ yaw=%.1f size=%.2f lightL=%.2f lightU=%.2f experimental=%d override=%d",
        self.buildProbe,
        self.sessionId,
        PerfectLibCameraKitVer,
        self.configuredLevel,
        snap["faceYaw"] as? Float ?? 0,
        snap["faceSizeRatio"] as? Float ?? 0,
        snap["lightingLower"] as? Float ?? 0,
        snap["lightingUpper"] as? Float ?? 0,
        self.experimentalLightingLower ? 1 : 0,
        self.lightingOverrideApplied ? 1 : 0
      )
      result(snap)
    }
  }

  /// Single deterministic path: setLevel first, then optional experimental overwrite.
  /// Official SDK: calling setCameraKitLevel again resets overwrite presets.
  private func configureKit(level: String, experimentalLightingLower enabled: Bool) {
    guard let kit = cameraKit else { return }
    configuredLevel = level.lowercased()
    experimentalLightingLower = enabled
    applyLevel(configuredLevel)
    lightingOverrideApplied = false
    if enabled {
      lightingOverrideApplied = Self.applyIndoorLightingLowerOverride(kit)
    }
  }

  /// Experimental only — not production default.
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

  private func snapshotParams(ok: Bool = true) -> [String: Any] {
    let p = cameraKit?.currentParameter
    return [
      "ok": ok,
      "version": PerfectLibCameraKitVer,
      "level": configuredLevel,
      "faceSizeRatio": p?.faceSizeRatio as Any,
      "faceYaw": p?.faceYaw as Any,
      "facePitchUpper": p?.facePitchUpper as Any,
      "facePitchLower": p?.facePitchLower as Any,
      "lightingUpper": p?.lightingUpper as Any,
      "lightingLower": p?.lightingLower as Any,
      "experimentalLightingLower": experimentalLightingLower,
      "lightingOverride": lightingOverrideApplied,
      "sessionId": sessionId,
      "buildProbe": buildProbe,
      "preferNativeFeed": true,
      "nativeFeedActive": nativeFeedActive,
      "feedSource": feedSource,
      "lastBlockReason": lastBlockReason,
    ]
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
    // Prefer original AVCapture samples when the native bridge is live.
    // Avoid double-feeding CameraKit (native + Dart rebuild).
    if nativeFeedActive {
      result(nil)
      return
    }
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
    // Acknowledge receipt on channel; native work continues asynchronously.
    result(nil)
    let y = yData.data
    let uv = uvData.data
    let yStride = Self.intArg(args["yBytesPerRow"], fallback: width)
    let uvStride = Self.intArg(args["uvBytesPerRow"], fallback: width)
    // 875704422 = FullRange ('420f'); 875704438 = VideoRange ('420v').
    // Contract: CameraKit wants FullRange. Expand ONLY known VideoRange.
    // Missing/unknown raw must NOT default to expand (that washed luma and
    // left lightingQuality stuck at .unknown while area/pose could still be .good).
    let pixelFormatRaw = Self.intArg(args["pixelFormatRaw"], fallback: 0)
    let sourceIsFullRange = pixelFormatRaw == 875704422
    let sourceIsVideoRange = pixelFormatRaw == 875704438
    let expandFromVideoRange = sourceIsVideoRange
    let expectedY = yStride * height
    let expectedUv = uvStride * (height / 2)
    guard y.count >= expectedY, uv.count >= expectedUv else {
      NSLog(
        "Mira: drop partial frame y=%d needY=%d uv=%d needUv=%d",
        y.count,
        expectedY,
        uv.count,
        expectedUv
      )
      return
    }
    // Host receive time for sample timing (NOT original AVCapture PTS — Flutter
    // image stream does not expose capture PTS to Dart).
    let hostMs = Int64(CACurrentMediaTime() * 1000.0)
    pendingNativeFrames += 1
    processQueue.async {
      defer {
        self.pendingNativeFrames = max(0, self.pendingNativeFrames - 1)
      }
      if !self.loggedFirstFrameConfig {
        self.loggedFirstFrameConfig = true
        let snap = self.snapshotParams()
        NSLog(
          "Mira: FIRST_FRAME_CONFIG session=%lld probe=%@ level=%@ lightL=%@ size=%@ yaw=%@ pending=%d w=%d h=%d yStride=%d pixelFmt=%d fullRange=%d videoRange=%d expand=%d",
          self.sessionId,
          self.buildProbe,
          snap["level"] as? String ?? "?",
          String(describing: snap["lightingLower"]),
          String(describing: snap["faceSizeRatio"]),
          String(describing: snap["faceYaw"]),
          self.pendingNativeFrames,
          width,
          height,
          yStride,
          pixelFormatRaw,
          sourceIsFullRange ? 1 : 0,
          sourceIsVideoRange ? 1 : 0,
          expandFromVideoRange ? 1 : 0
        )
      }
      guard let sample = Self.makeNv12SampleBuffer(
        width: width,
        height: height,
        y: y,
        uv: uv,
        yStride: yStride,
        uvStride: uvStride,
        hostTimeMs: hostMs,
        expandFromVideoRange: expandFromVideoRange
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
        let srcLabel: String
        if sourceIsFullRange {
          srcLabel = "FullRange"
        } else if sourceIsVideoRange {
          srcLabel = "VideoRange"
        } else {
          srcLabel = "raw=\(pixelFormatRaw)"
        }
        NSLog(
          "Mira: sendCameraBuffer count=%lld pending=%d w=%d h=%d yStride=%d uvStride=%d meanY=%.1f src=%@ expand=%@",
          self.sendCameraBufferCount,
          self.pendingNativeFrames,
          width,
          height,
          yStride,
          uvStride,
          meanY,
          srcLabel,
          expandFromVideoRange ? "VideoRange→FullRange" : "passthrough"
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
      "Mira: CameraKit dispose session=%lld send=%lld quality=%lld pending=%d",
      sessionId,
      sendCameraBufferCount,
      qualityCallbackCount,
      pendingNativeFrames
    )
    cameraKit?.delegate = nil
    cameraKit = nil
    initialized = false
    cameraOpenNotified = false
    initError = nil
    sendCameraBufferCount = 0
    qualityCallbackCount = 0
    pendingNativeFrames = 0
    loggedFirstFrameConfig = false
    lightingOverrideApplied = false
    experimentalLightingLower = false
    nativeFeedActive = false
    feedSource = "dart_rebuild"
    lastBlockReason = "disposed"
    sessionId += 1
  }

  /// Original AVCapture sample for CameraKit.
  /// Factor under test: sibling video-data output WITHOUT videoOrientation
  /// (see DefaultCamera.installMiraCameraKitSampleFeedIfPresent).
  fileprivate func ingestNativeSample(_ sampleBuffer: CMSampleBuffer) {
    guard initialized, let kit = cameraKit else { return }
    let pb = CMSampleBufferGetImageBuffer(sampleBuffer)
    let pixelFmt = pb.map { CVPixelBufferGetPixelFormatType($0) } ?? 0
    // CameraKit contract: NV12 FullRange (or VideoRange with expand). Drop BGRA/etc.
    let isFull = pixelFmt == 875704422
    let isVideo = pixelFmt == 875704438
    if !isFull && !isVideo {
      let now = Int64(Date().timeIntervalSince1970 * 1000)
      if now - lastFrameLogMs >= 1000 {
        lastFrameLogMs = now
        NSLog(
          "Mira: DROP_NON_NV12 pixelFmt=%u (waiting for FullRange yuv420)",
          pixelFmt
        )
      }
      return
    }
    if loggedFirstFrameConfig && lastLoggedPixelFmt != 0 && lastLoggedPixelFmt != pixelFmt {
      loggedFirstFrameConfig = false
    }
    lastLoggedPixelFmt = pixelFmt
    nativeFeedActive = true
    feedSource = "native_avcapture"
    if !loggedFirstFrameConfig {
      loggedFirstFrameConfig = true
      let width = pb.map { CVPixelBufferGetWidth($0) } ?? 0
      let height = pb.map { CVPixelBufferGetHeight($0) } ?? 0
      let yStride = pb.map { CVPixelBufferGetBytesPerRowOfPlane($0, 0) } ?? 0
      let snap = snapshotParams()
      var iso: Float = -1
      var expSec: Double = -1
      if let attach = CMCopyDictionaryOfAttachments(
        allocator: kCFAllocatorDefault,
        target: sampleBuffer,
        attachmentMode: kCMAttachmentMode_ShouldPropagate
      ) as? [String: Any],
        let exif = attach[kCGImagePropertyExifDictionary as String] as? [String: Any]
      {
        if let v = exif[kCGImagePropertyExifISOSpeedRatings as String] as? [NSNumber],
           let first = v.first
        {
          iso = first.floatValue
        }
        if let v = exif[kCGImagePropertyExifExposureTime as String] as? NSNumber {
          expSec = v.doubleValue
        }
      }
      NSLog(
        "Mira: FIRST_FRAME_CONFIG session=%lld probe=%@ level=%@ lightL=%@ size=%@ yaw=%@ pending=%d w=%d h=%d yStride=%d pixelFmt=%u fullRange=%d videoRange=%d expand=0 feed=%@ factor=discard_late_false iso=%.1f expSec=%.6f",
        sessionId,
        buildProbe,
        snap["level"] as? String ?? "?",
        String(describing: snap["lightingLower"]),
        String(describing: snap["faceSizeRatio"]),
        String(describing: snap["faceYaw"]),
        pendingNativeFrames,
        width,
        height,
        yStride,
        pixelFmt,
        isFull ? 1 : 0,
        isVideo ? 1 : 0,
        feedSource,
        iso,
        expSec
      )
    }
    kit.sendCameraBuffer(sampleBuffer)
    sendCameraBufferCount += 1
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    if now - lastFrameLogMs >= 1000 {
      lastFrameLogMs = now
      NSLog(
        "Mira: sendCameraBuffer count=%lld pending=%d feed=%@ factor=discard_late_false expand=passthrough pixelFmt=%u",
        sendCameraBufferCount,
        pendingNativeFrames,
        feedSource,
        pixelFmt
      )
    }
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
    // Official CameraKit 2.5 sample canCapture(): area.isOk && pose.isOk && lighting.isOk
    // (good|normal). It does NOT AND isValid. Device session CKCFG-20260915B observed
    // valid=0 on every callback including good/good/normal — gating on isValid blocked READY.
    let ready = faceAreaOk && facePoseOk && lightingOk
    // Degree is always a float from SDK; treat as unreliable when stuck at 0
    // across pose changes (observed on device). Do not invent a measurement.
    let deg = checkedResult.facePoseDegree
    let degReliable = abs(deg) > 0.01
    let lightRaw = checkedResult.lightingQuality.rawValue
    let areaRaw = checkedResult.faceAreaQuality.rawValue
    let poseRaw = checkedResult.facePoseQuality.rawValue
    let block: String
    if ready {
      block = "none"
    } else if !faceAreaOk {
      block = "engine_area"
    } else if !facePoseOk {
      block = "engine_pose"
    } else if !lightingOk {
      block = "engine_lighting"
    } else {
      block = "engine_other"
    }
    lastBlockReason = block

    NSLog(
      "Mira: CameraKit quality session=%lld n=%lld ready=%d valid=%d area=%@ pose=%@ light=%@ areaRaw=%lu poseRaw=%lu lightRaw=%lu areaOk=%d poseOk=%d lightOk=%d block=%@ feed=%@ deg=%.1f degReliable=%d send=%lld meanY=%.1f",
      sessionId,
      qualityCallbackCount,
      ready ? 1 : 0,
      checkedResult.isValid ? 1 : 0,
      Self.faceAreaName(checkedResult.faceAreaQuality),
      Self.facePoseName(checkedResult.facePoseQuality),
      Self.lightingName(checkedResult.lightingQuality),
      areaRaw,
      poseRaw,
      lightRaw,
      faceAreaOk ? 1 : 0,
      facePoseOk ? 1 : 0,
      lightingOk ? 1 : 0,
      block,
      feedSource,
      deg,
      degReliable ? 1 : 0,
      sendCameraBufferCount,
      Self.lastMeanY
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
      "facePoseDegree": deg,
      "facePoseDegreeReliable": degReliable,
      "guidanceCode": Self.guidanceCode(
        faceArea: checkedResult.faceAreaQuality,
        facePose: checkedResult.facePoseQuality,
        lighting: checkedResult.lightingQuality,
        ready: ready
      ),
      "sendCameraBufferCount": sendCameraBufferCount,
      "qualityCallbackCount": qualityCallbackCount,
      "sessionId": sessionId,
      "buildProbe": buildProbe,
      "feedSource": feedSource,
      "nativeFeedActive": nativeFeedActive,
      "blockReason": block,
      "lightingRaw": lightRaw,
      "faceAreaRaw": areaRaw,
      "facePoseRaw": poseRaw,
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
    case .unknown: return "lighting_pending"
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
    case .unknown: return "unknown"
    default: return "unknown_raw_\(v.rawValue)"
    }
  }

  private static func makeNv12SampleBuffer(
    width: Int,
    height: Int,
    y: Data,
    uv: Data,
    yStride: Int,
    uvStride: Int,
    hostTimeMs: Int64,
    expandFromVideoRange: Bool
  ) -> CMSampleBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let attrs: [CFString: Any] = [
      kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary
    ]
    // CameraKit contract requires FullRange NV12.
    // When Flutter already delivers FullRange, copy planes as-is (no expand).
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
          let value: UInt8
          if expandFromVideoRange {
            value = Self.videoRangeYToFull(src[srcOff + col])
          } else {
            value = src[srcOff + col]
          }
          dstRow[col] = value
          ySum += Int64(value)
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
          if expandFromVideoRange {
            dstRow[col] = Self.videoRangeUVToFull(src[srcOff + col])
          } else {
            dstRow[col] = src[srcOff + col]
          }
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
      // Host receive time (ms) — NOT original camera PTS (unavailable via Flutter stream).
      presentationTimeStamp: CMTime(value: CMTimeValue(hostTimeMs), timescale: 1000),
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

  private static var lastMeanY: Double = 0
}

/// Weak hook target for `camera_avfoundation` MiraCameraKitFrameBridge (dlsym).
@_cdecl("MiraCameraKitFeedEmit")
public func MiraCameraKitFeedEmit(_ sampleBuffer: CMSampleBuffer) {
  PerfectCameraKitOwner.shared?.ingestNativeSample(sampleBuffer)
}
