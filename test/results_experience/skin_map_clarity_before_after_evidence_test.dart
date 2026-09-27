import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as im;
import 'package:mirra/features/results_experience/domain/perfect_mask_presentation_decoder.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';

/// Synthetic before/after clarity proof (no user photos).
void main() {
  test(
    'writes synthetic before/after remaps for wrinkles acne pores hydration',
    () {
      final outDir = Directory(
        Platform.environment['MIRA_CLARITY_EVIDENCE_DIR'] ??
            '${Directory.systemTemp.path}/mira_skin_map_clarity_evidence',
      );
      if (!outDir.existsSync()) outDir.createSync(recursive: true);

      final cases = <_Case>[
        _Case(
          name: 'wrinkles',
          before: const PerfectMaskPresentationProfile(
            opacity: 0.54,
            tintAlpha: 0.88,
            softPresenceFactor: 0.0,
            softPresenceCap: 0.0,
            alphaMode: PerfectMaskAlphaMode.luminanceGate,
            alphaGain: 1.42,
            luminanceGateFloor: 82,
          ),
          after: PerfectMaskPresentationProfile.wrinkles,
          build: _wrinkleMask,
        ),
        _Case(
          name: 'acne',
          before: const PerfectMaskPresentationProfile(
            opacity: 0.76,
            tintAlpha: 0.96,
            softPresenceFactor: 0.0,
            softPresenceCap: 0.0,
            alphaMode: PerfectMaskAlphaMode.luminanceGate,
            alphaGain: 1.55,
            luminanceGateFloor: 68,
          ),
          after: PerfectMaskPresentationProfile.acne,
          build: _acneMask,
        ),
        _Case(
          name: 'pores',
          before: const PerfectMaskPresentationProfile(
            opacity: 0.78,
            tintAlpha: 0.96,
            softPresenceFactor: 0.0,
            softPresenceCap: 0.0,
            alphaMode: PerfectMaskAlphaMode.luminanceGate,
            alphaGain: 1.72,
            luminanceGateFloor: 62,
          ),
          after: PerfectMaskPresentationProfile.pores,
          build: _poresMask,
        ),
        _Case(
          name: 'hydration',
          before: const PerfectMaskPresentationProfile(
            opacity: 0.48,
            tintAlpha: 0.84,
            softPresenceFactor: 0.0,
            softPresenceCap: 0.0,
            alphaMode: PerfectMaskAlphaMode.luminanceGate,
            alphaGain: 1.25,
            luminanceGateFloor: 72,
          ),
          after: PerfectMaskPresentationProfile.hydration,
          build: _hydrationMask,
        ),
      ];

      final report = StringBuffer()
        ..writeln('# Skin map clarity — synthetic before/after')
        ..writeln()
        ..writeln('Same synthetic Perfect-style encoding per metric.')
        ..writeln(
          'No user photos. Wash RGBA≈61,61,61 must stay A=0 after remap.',
        )
        ..writeln();

      for (final c in cases) {
        final raw = c.build();
        File(
          '${outDir.path}/${c.name}_00_raw_perfect.png',
        ).writeAsBytesSync(raw);

        final beforePng = PerfectMaskPresentationDecoder.remapToPresentationPng(
          perfectPngBytes: raw,
          profile: c.before,
        )!;
        final afterPng = PerfectMaskPresentationDecoder.remapToPresentationPng(
          perfectPngBytes: raw,
          profile: c.after,
        )!;
        File(
          '${outDir.path}/${c.name}_01_before.png',
        ).writeAsBytesSync(beforePng);
        File(
          '${outDir.path}/${c.name}_02_after.png',
        ).writeAsBytesSync(afterPng);

        final beforeN = _nonzero(beforePng);
        final afterN = _nonzero(afterPng);
        expect(_washDead(afterPng), isTrue);
        expect(afterN, greaterThanOrEqualTo(beforeN));
        if (c.name == 'wrinkles') {
          // Mid strokes recovered → more visible pixels (mean may drop vs bright-only).
          expect(afterN, greaterThan(beforeN));
        } else {
          expect(
            _meanSignalAlpha(afterPng),
            greaterThanOrEqualTo(_meanSignalAlpha(beforePng)),
          );
        }

        report
          ..writeln('## ${c.name}')
          ..writeln(
            '- before floor=${c.before.luminanceGateFloor} '
            'gain=${c.before.alphaGain} opacity=${c.before.opacity} '
            'minVis=${c.before.minVisibleAlpha} nonzero=$beforeN '
            'meanA=${_meanSignalAlpha(beforePng).toStringAsFixed(1)}',
          )
          ..writeln(
            '- after  floor=${c.after.luminanceGateFloor} '
            'gain=${c.after.alphaGain} opacity=${c.after.opacity} '
            'minVis=${c.after.minVisibleAlpha} nonzero=$afterN '
            'meanA=${_meanSignalAlpha(afterPng).toStringAsFixed(1)}',
          )
          ..writeln('- wash still dead: ${_washDead(afterPng)}')
          ..writeln();
      }

      // Mid-luminance wrinkle stroke: killed by floor 82, kept by floor 68 + minVisible.
      final midBefore =
          SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
            r: 80,
            g: 78,
            b: 76,
            a: 200,
            profile: const PerfectMaskPresentationProfile(
              opacity: 0.54,
              tintAlpha: 0.88,
              softPresenceFactor: 0.0,
              softPresenceCap: 0.0,
              alphaMode: PerfectMaskAlphaMode.luminanceGate,
              alphaGain: 1.42,
              luminanceGateFloor: 82,
            ),
          );
      final midAfter = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 80,
        g: 78,
        b: 76,
        a: 200,
        profile: PerfectMaskPresentationProfile.wrinkles,
      );
      expect(midBefore, 0);
      expect(midAfter, greaterThan(0));
      report
        ..writeln('## mid-luminance wrinkle pixel')
        ..writeln(
          '- before(floor82)=$midBefore after(floor68+minVis)=$midAfter',
        )
        ..writeln();

      File('${outDir.path}/SUMMARY.md').writeAsStringSync(report.toString());
    },
  );
}

class _Case {
  const _Case({
    required this.name,
    required this.before,
    required this.after,
    required this.build,
  });
  final String name;
  final PerfectMaskPresentationProfile before;
  final PerfectMaskPresentationProfile after;
  final Uint8List Function() build;
}

Uint8List _wrinkleMask() {
  final img = im.Image(width: 96, height: 128, numChannels: 4);
  _fillWash(img);
  for (var x = 20; x < 76; x++) {
    final y = 40 + ((x - 20) * 0.15).round();
    // Mid stroke ~lum 78 — dead under floor 82, alive under floor 68.
    img.setPixelRgba(x, y, 80, 78, 76, 200);
    img.setPixelRgba(x, y + 1, 78, 76, 74, 180);
  }
  for (var x = 24; x < 72; x++) {
    final y = 70 + ((x - 24) * 0.08).round();
    img.setPixelRgba(x, y, 240, 235, 230, 220);
  }
  return Uint8List.fromList(im.encodePng(img));
}

Uint8List _acneMask() {
  final img = im.Image(width: 96, height: 128, numChannels: 4);
  _fillWash(img);
  void spot(int cx, int cy, int r, int g, int b, int a) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy <= 4) {
          img.setPixelRgba(cx + dx, cy + dy, r, g, b, a);
        }
      }
    }
  }

  spot(36, 48, 120, 110, 105, 220);
  spot(58, 62, 253, 248, 245, 255);
  spot(44, 80, 115, 108, 100, 200);
  return Uint8List.fromList(im.encodePng(img));
}

Uint8List _poresMask() {
  final img = im.Image(width: 96, height: 128, numChannels: 4);
  _fillWash(img);
  for (final p in const [
    (30, 50),
    (40, 55),
    (50, 48),
    (60, 58),
    (35, 70),
    (55, 72),
  ]) {
    img.setPixelRgba(p.$1, p.$2, 110, 108, 100, 210);
    img.setPixelRgba(p.$1 + 1, p.$2, 100, 98, 95, 180);
  }
  return Uint8List.fromList(im.encodePng(img));
}

Uint8List _hydrationMask() {
  final img = im.Image(width: 96, height: 128, numChannels: 4);
  _fillWash(img);
  for (var y = 36; y < 96; y++) {
    for (var x = 28; x < 68; x++) {
      img.setPixelRgba(x, y, 180, 160, 150, 180);
    }
  }
  return Uint8List.fromList(im.encodePng(img));
}

void _fillWash(im.Image img) {
  for (var y = 0; y < img.height; y++) {
    for (var x = 0; x < img.width; x++) {
      img.setPixelRgba(x, y, 61, 61, 61, 92);
    }
  }
}

int _nonzero(Uint8List png) {
  final d = im.decodeImage(png)!;
  var n = 0;
  for (var y = 0; y < d.height; y++) {
    for (var x = 0; x < d.width; x++) {
      if (d.getPixel(x, y).a.toInt() > 0) n++;
    }
  }
  return n;
}

bool _washDead(Uint8List png) {
  final d = im.decodeImage(png)!;
  return d.getPixel(0, 0).a.toInt() == 0 &&
      d.getPixel(d.width - 1, d.height - 1).a.toInt() == 0;
}

double _meanSignalAlpha(Uint8List png) {
  final d = im.decodeImage(png)!;
  var sum = 0;
  var n = 0;
  for (var y = 0; y < d.height; y++) {
    for (var x = 0; x < d.width; x++) {
      final a = d.getPixel(x, y).a.toInt();
      if (a > 0) {
        sum += a;
        n++;
      }
    }
  }
  if (n == 0) return 0;
  return sum / n;
}
