import 'package:flutter/services.dart';

/// Thin MethodChannel bridge for the Apple person-matting POC only.
/// Not a production service / repository / state owner.
abstract final class ApplePersonMattingPocBridge {
  ApplePersonMattingPocBridge._();

  static const MethodChannel _channel =
      MethodChannel('mira/apple_person_matting');

  static Future<ApplePersonMattePocResult> generatePersonMatte(
    Uint8List imageBytes,
  ) async {
    final raw = await _channel.invokeMapMethod<String, dynamic>(
      'generatePersonMatte',
      <String, dynamic>{'imageBytes': imageBytes},
    );
    if (raw == null) {
      throw StateError('Apple person matting returned null');
    }
    return ApplePersonMattePocResult.fromMap(raw);
  }
}

class ApplePersonMattePocResult {
  const ApplePersonMattePocResult({
    required this.api,
    required this.qualityLevel,
    required this.width,
    required this.height,
    required this.maskNativeWidth,
    required this.maskNativeHeight,
    required this.processingMs,
    required this.alphaPng,
    required this.blackCompositePng,
  });

  final String api;
  final String qualityLevel;
  final int width;
  final int height;
  final int maskNativeWidth;
  final int maskNativeHeight;
  final int processingMs;
  final Uint8List alphaPng;
  final Uint8List blackCompositePng;

  factory ApplePersonMattePocResult.fromMap(Map<String, dynamic> map) {
    Uint8List asBytes(Object? v) {
      if (v is Uint8List) return v;
      if (v is ByteData) return v.buffer.asUint8List();
      if (v is List<int>) return Uint8List.fromList(v);
      throw StateError('Expected image bytes, got ${v.runtimeType}');
    }

    return ApplePersonMattePocResult(
      api: '${map['api'] ?? ''}',
      qualityLevel: '${map['qualityLevel'] ?? ''}',
      width: (map['width'] as num).toInt(),
      height: (map['height'] as num).toInt(),
      maskNativeWidth: (map['maskNativeWidth'] as num?)?.toInt() ?? 0,
      maskNativeHeight: (map['maskNativeHeight'] as num?)?.toInt() ?? 0,
      processingMs: (map['processingMs'] as num).toInt(),
      alphaPng: asBytes(map['alphaPng']),
      blackCompositePng: asBytes(map['blackCompositePng']),
    );
  }
}
