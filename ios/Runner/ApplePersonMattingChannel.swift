import Flutter
import UIKit
import Vision
import CoreImage

/// Isolated POC channel — VNGeneratePersonSegmentationRequest (.accurate) only.
/// No production owner. No Perfect coupling. No aggressive matte post-process.
enum ApplePersonMattingChannel {
  static let name = "mira/apple_person_matting"

  static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: name, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "generatePersonMatte" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let args = call.arguments as? [String: Any],
        let typed = args["imageBytes"] as? FlutterStandardTypedData
      else {
        result(
          FlutterError(
            code: "bad_args",
            message: "imageBytes (Uint8List) required",
            details: nil
          )
        )
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let payload = try process(imageData: typed.data)
          DispatchQueue.main.async { result(payload) }
        } catch {
          DispatchQueue.main.async {
            result(
              FlutterError(
                code: "matting_failed",
                message: error.localizedDescription,
                details: nil
              )
            )
          }
        }
      }
    }
  }

  private enum MatteError: LocalizedError {
    case decodeFailed
    case noMask
    case renderFailed

    var errorDescription: String? {
      switch self {
      case .decodeFailed: return "Failed to decode source image"
      case .noMask: return "VNGeneratePersonSegmentationRequest returned no mask"
      case .renderFailed: return "Failed to render matte outputs"
      }
    }
  }

  private static func process(imageData: Data) throws -> [String: Any] {
    let started = CFAbsoluteTimeGetCurrent()

    guard let uiImage = UIImage(data: imageData) else {
      throw MatteError.decodeFailed
    }

    // Bake orientation into a pixel buffer so Vision + Flutter Image.memory
    // share one upright coordinate system (no post-analysis warp).
    let oriented = orientedCGImage(from: uiImage)
    let width = oriented.width
    let height = oriented.height

    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .accurate
    request.outputPixelFormat = kCVPixelFormatType_OneComponent8

    let handler = VNImageRequestHandler(cgImage: oriented, options: [:])
    try handler.perform([request])

    guard let observation = request.results?.first else {
      throw MatteError.noMask
    }

    let maskBuffer = observation.pixelBuffer
    let maskW = CVPixelBufferGetWidth(maskBuffer)
    let maskH = CVPixelBufferGetHeight(maskBuffer)
    let ciContext = CIContext(options: nil)
    let maskCI = CIImage(cvPixelBuffer: maskBuffer)
    let scaleX = CGFloat(width) / CGFloat(maskW)
    let scaleY = CGFloat(height) / CGFloat(maskH)
    // Upsample mask to exact source pixel grid — no crop / oval.
    let scaledMask = maskCI.transformed(
      by: CGAffineTransform(scaleX: scaleX, y: scaleY)
    )

    guard
      let maskCG = ciContext.createCGImage(
        scaledMask,
        from: CGRect(x: 0, y: 0, width: width, height: height)
      )
    else {
      throw MatteError.renderFailed
    }

    let alphaPng = try renderAlphaPng(mask: maskCG, width: width, height: height)
    let blackPng = try renderBlackComposite(
      source: oriented,
      mask: maskCG,
      width: width,
      height: height
    )

    let ms = Int(((CFAbsoluteTimeGetCurrent() - started) * 1000.0).rounded())

    return [
      "api": "VNGeneratePersonSegmentationRequest",
      "qualityLevel": "accurate",
      "width": width,
      "height": height,
      "maskNativeWidth": maskW,
      "maskNativeHeight": maskH,
      "processingMs": ms,
      "alphaPng": FlutterStandardTypedData(bytes: alphaPng),
      "blackCompositePng": FlutterStandardTypedData(bytes: blackPng),
    ]
  }

  private static func orientedCGImage(from image: UIImage) -> CGImage {
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    let size = image.size
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let rendered = renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    return rendered.cgImage!
  }

  /// Grayscale PNG — Apple alpha as-is (no feathering / reconstruction).
  private static func renderAlphaPng(
    mask: CGImage,
    width: Int,
    height: Int
  ) throws -> Data {
    let colorSpace = CGColorSpaceCreateDeviceGray()
    guard
      let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.none.rawValue
      )
    else {
      throw MatteError.renderFailed
    }
    ctx.interpolationQuality = .high
    ctx.draw(mask, in: CGRect(x: 0, y: 0, width: width, height: height))
    guard let out = ctx.makeImage() else { throw MatteError.renderFailed }
    return try pngData(from: out)
  }

  /// Hard composite onto #000000 — exposes halo / leakage (no soft edge paint).
  private static func renderBlackComposite(
    source: CGImage,
    mask: CGImage,
    width: Int,
    height: Int
  ) throws -> Data {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    var srcPixels = [UInt8](repeating: 0, count: height * bytesPerRow)
    var maskPixels = [UInt8](repeating: 0, count: height * width)
    var outPixels = [UInt8](repeating: 0, count: height * bytesPerRow)

    guard
      let srcCtx = CGContext(
        data: &srcPixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ),
      let maskCtx = CGContext(
        data: &maskPixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width,
        space: CGColorSpaceCreateDeviceGray(),
        bitmapInfo: CGImageAlphaInfo.none.rawValue
      )
    else {
      throw MatteError.renderFailed
    }

    srcCtx.interpolationQuality = .none
    maskCtx.interpolationQuality = .high
    srcCtx.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
    maskCtx.draw(mask, in: CGRect(x: 0, y: 0, width: width, height: height))

    for i in 0..<(width * height) {
      let a = Float(maskPixels[i]) / 255.0
      let o = i * 4
      // Straight (non-premultiplied) composite over pure black.
      outPixels[o] = UInt8(Float(srcPixels[o]) * a)
      outPixels[o + 1] = UInt8(Float(srcPixels[o + 1]) * a)
      outPixels[o + 2] = UInt8(Float(srcPixels[o + 2]) * a)
      outPixels[o + 3] = 255
    }

    guard
      let outCtx = CGContext(
        data: &outPixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ),
      let outImage = outCtx.makeImage()
    else {
      throw MatteError.renderFailed
    }
    return try pngData(from: outImage)
  }

  private static func pngData(from image: CGImage) throws -> Data {
    let data = NSMutableData()
    guard
      let dest = CGImageDestinationCreateWithData(
        data,
        "public.png" as CFString,
        1,
        nil
      )
    else {
      throw MatteError.renderFailed
    }
    CGImageDestinationAddImage(dest, image, nil)
    guard CGImageDestinationFinalize(dest) else {
      throw MatteError.renderFailed
    }
    return data as Data
  }
}
