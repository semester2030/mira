import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as im;
import 'package:mirra/features/results_experience/domain/perfect_mask_presentation_decoder.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';

Uint8List _pngWashWithLesion() {
  final img = im.Image(width: 32, height: 32, numChannels: 4);
  for (var y = 0; y < 32; y++) {
    for (var x = 0; x < 32; x++) {
      // Face-wide Perfect gray wash (measured encoding family).
      img.setPixelRgba(x, y, 61, 61, 61, 92);
    }
  }
  // Sparse high-luminance lesion / pore signal.
  img.setPixelRgba(16, 16, 250, 248, 245, 255);
  img.setPixelRgba(17, 16, 248, 246, 240, 255);
  return Uint8List.fromList(im.encodePng(img));
}

void main() {
  test('CPU remap: wash → A=0; lesion remains; same dimensions', () {
    final raw = _pngWashWithLesion();
    final profile = PerfectMaskPresentationProfile.pores;
    final remapped = PerfectMaskPresentationDecoder.remapToPresentationPng(
      perfectPngBytes: raw,
      profile: profile,
    );
    expect(remapped, isNotNull);
    final out = im.decodeImage(remapped!);
    expect(out, isNotNull);
    expect(out!.width, 32);
    expect(out.height, 32);

    // Wash pixel must not paint (background / hair wash leak).
    expect(out.getPixel(0, 0).a.toInt(), 0);
    expect(out.getPixel(8, 8).a.toInt(), 0);

    // Lesion cores remain present.
    expect(out.getPixel(16, 16).a.toInt(), greaterThan(80));
    expect(out.getPixel(17, 16).a.toInt(), greaterThan(80));
  });

  test('audit: dominant wash + presentation bbox is sparse', () {
    final raw = _pngWashWithLesion();
    final audit = PerfectMaskPresentationDecoder.audit(
      perfectPngBytes: raw,
      profile: PerfectMaskPresentationProfile.pores,
    );
    expect(audit, isNotNull);
    expect(audit!.dominantR, 61);
    expect(audit.dominantG, 61);
    expect(audit.dominantB, 61);
    expect(audit.dominantA, 92);
    expect(
      audit.nonzeroAlphaCount,
      greaterThan(audit.presentationNonzeroCount),
    );
    expect(audit.presentationNonzeroCount, greaterThan(0));
    expect(audit.presentationNonzeroCount, lessThan(audit.pixelCount ~/ 4));
  });

  test('Perfect A=0 stays presentation 0', () {
    final img = im.Image(width: 4, height: 4, numChannels: 4);
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        img.setPixelRgba(x, y, 200, 200, 200, 0);
      }
    }
    final raw = Uint8List.fromList(im.encodePng(img));
    final remapped = PerfectMaskPresentationDecoder.remapToPresentationPng(
      perfectPngBytes: raw,
      profile: PerfectMaskPresentationProfile.pores,
    );
    final out = im.decodeImage(remapped!);
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        expect(out!.getPixel(x, y).a.toInt(), 0);
      }
    }
  });
}
