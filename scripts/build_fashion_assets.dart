// ignore_for_file: avoid_print

import 'dart:io';

import 'package:image/image.dart' as img;

/// Generates luxury catalog PNGs under assets/fashion/.
void main() {
  final root = Directory('assets/fashion');
  _write(root, 'tops/blazer_beige.png', _product(0xD4, 0xC4, 0xA8, tall: true));
  _write(root, 'tops/corset_cream.png', _product(0xF5, 0xE6, 0xD3, tall: true));
  _write(root, 'tops/satin_top_black.png', _product(0x1A, 0x1A, 0x1A, tall: true));
  _write(root, 'bottoms/skirt_silk_beige.png', _product(0xE8, 0xDC, 0xC8, wide: true));
  _write(root, 'bottoms/trousers_navy.png', _product(0x1E, 0x2A, 0x4A, wide: true));
  _write(root, 'bottoms/skirt_classic_black.png', _product(0x14, 0x14, 0x14, wide: true));
  _write(root, 'outerwear/cape_elegant_ivory.png', _product(0xF7, 0xF2, 0xEA, cape: true));
  _write(root, 'outerwear/cardigan_soft_gray.png', _product(0xC8, 0xC4, 0xBE, tall: true));
  _write(root, 'outerwear/shawl_wedding.png', _product(0xED, 0xE4, 0xF0, wide: true));
  _write(root, 'bags/clutch_silver.png', _product(0xC0, 0xC0, 0xC8, bag: true));
  _write(root, 'bags/bag_black_leather.png', _product(0x1C, 0x1C, 0x1C, bag: true));
  _write(root, 'bags/tote_casual_beige.png', _product(0xD9, 0xCD, 0xB8, bag: true));
  _write(root, 'heels/heels_nude.png', _product(0xE3, 0xC4, 0xA8, shoes: true));
  _write(root, 'heels/heels_black.png', _product(0x11, 0x11, 0x11, shoes: true));
  _write(root, 'jewelry/pearl_earrings.png', _product(0xF5, 0xF0, 0xE8, jewel: true));
  _write(root, 'jewelry/silver_necklace.png', _product(0xB8, 0xB8, 0xC0, jewel: true));
  _write(root, 'jewelry/diamond_bracelet.png', _product(0xE8, 0xE8, 0xF0, jewel: true));
  _write(root, 'jewelry/watch_gold.png', _product(0xC9, 0xA9, 0x62, jewel: true));
  _write(root, 'jewelry/sunglasses_tortoise.png', _product(0x6B, 0x4A, 0x32, jewel: true));
  _write(root, 'scarves/silk_scarf_beige.png', _product(0xE5, 0xD5, 0xBC, wide: true));
  print('Generated fashion assets in ${root.path}');
}

void _write(Directory root, String rel, img.Image image) {
  final file = File('${root.path}/$rel');
  file.parent.createSync(recursive: true);
  file.writeAsBytesSync(img.encodePng(image));
}

img.Image _product(
  int r,
  int g,
  int b, {
  bool tall = false,
  bool wide = false,
  bool cape = false,
  bool bag = false,
  bool shoes = false,
  bool jewel = false,
}) {
  final c = img.Image(width: 280, height: 360);
  for (var y = 0; y < c.height; y++) {
    final t = y / c.height;
    final bgR = (252 + (245 - 252) * t).round();
    final bgG = (252 + (246 - 252) * t).round();
    final bgB = (255 + (250 - 255) * t).round();
    img.fillRect(
      c,
      x1: 0,
      y1: y,
      x2: c.width,
      y2: y + 1,
      color: img.ColorRgb8(bgR, bgG, bgB),
    );
  }

  img.fillCircle(
    c,
    x: 140,
    y: 280,
    radius: 62,
    color: img.ColorRgba8(0, 0, 0, 24),
  );

  final color = img.ColorRgb8(r, g, b);
  final shade = img.ColorRgb8(
    (r * 0.82).round().clamp(0, 255),
    (g * 0.82).round().clamp(0, 255),
    (b * 0.82).round().clamp(0, 255),
  );

  if (shoes) {
    img.fillRect(c, x1: 70, y1: 210, x2: 130, y2: 255, radius: 10, color: color);
    img.fillRect(c, x1: 150, y1: 215, x2: 210, y2: 260, radius: 10, color: shade);
  } else if (bag) {
    img.fillRect(c, x1: 88, y1: 150, x2: 192, y2: 250, radius: 18, color: color);
    img.fillRect(c, x1: 118, y1: 125, x2: 162, y2: 150, radius: 8, color: shade);
  } else if (jewel) {
    img.fillCircle(c, x: 140, y: 190, radius: 36, color: color);
    img.fillCircle(c, x: 128, y: 178, radius: 10, color: img.ColorRgb8(255, 255, 255));
  } else if (cape) {
    img.fillRect(c, x1: 52, y1: 95, x2: 228, y2: 290, radius: 28, color: color);
    img.fillRect(c, x1: 118, y1: 85, x2: 162, y2: 120, radius: 8, color: shade);
  } else if (wide) {
    img.fillRect(c, x1: 72, y1: 140, x2: 208, y2: 285, radius: 22, color: color);
  } else {
    img.fillRect(c, x1: 82, y1: tall ? 95 : 120, x2: 198, y2: tall ? 270 : 285, radius: 20, color: color);
    img.fillRect(c, x1: 128, y1: tall ? 110 : 130, x2: 152, y2: tall ? 250 : 270, radius: 6, color: shade);
  }

  return c;
}
