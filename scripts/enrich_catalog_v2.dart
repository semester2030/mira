// ignore_for_file: avoid_print

import 'dart:convert';
import 'dart:io';

/// Upgrades catalog.json to v2 schema with rich metadata, scores, prompts, angles.
void main() {
  final catalogPath = File('assets/fashion/catalog.json');
  final catalog = jsonDecode(catalogPath.readAsStringSync()) as Map<String, dynamic>;
  catalog['version'] = 2;

  final suffix = catalog['promptSuffix'] as String? ?? '';
  final bgPrompt =
      'Remove background completely, preserve garment edges, transparent PNG, no halo, luxury product cutout quality.';
  final editPrompt =
      'Enhance fabric texture, correct color accuracy, studio lighting balance, luxury ecommerce finish, no artifacts.';

  final pieces = (catalog['pieces'] as List<dynamic>).cast<Map<String, dynamic>>();
  for (final piece in pieces) {
    final id = piece['id'] as String;
    final meta = _meta[id] ?? _defaults(piece);
    piece.addAll(meta);

    final gen = piece['aiPrompt'] as String? ?? piece['prompts']?['generation'] as String? ?? '';
    piece['prompts'] = {
      'generation': '$gen, $suffix',
      'editing': editPrompt,
      'backgroundRemoval': '$bgPrompt Item: ${piece['titleAr']}.',
    };

    final file = piece['file'] as String;
    piece['angles'] = {
      'front': file,
      'back': piece['angles']?['back'] ?? file.replaceAll('.png', '_back.png'),
      'angle45': piece['angles']?['angle45'] ?? file.replaceAll('.png', '_45.png'),
      'detail': piece['angles']?['detail'] ?? file.replaceAll('.png', '_detail.png'),
      'fabric': piece['angles']?['fabric'] ?? file.replaceAll('.png', '_fabric.png'),
    };

    if (piece['styles'] is! List) {
      piece['styles'] = [piece['style'] ?? 'luxury'];
    }
    if (piece['imageQuality'] == null) piece['imageQuality'] = '8k';
    if (piece['transparent'] == null) piece['transparent'] = true;
  }

  catalogPath.writeAsStringSync(const JsonEncoder.withIndent('  ').convert(catalog));
  print('✓ Enriched ${pieces.length} pieces → catalog.json v2');
}

Map<String, dynamic> _defaults(Map<String, dynamic> piece) {
  return {
    'gender': 'female',
    'material': 'unknown',
    'fit': 'regular',
    'sleeve': 'none',
    'texture': 'matte',
    'pattern': 'solid',
    'countryStyle': 'European',
    'archetypes': ['minimal'],
    'scores': {'luxury': 85, 'formal': 75, 'minimal': 80, 'business': 70},
    'compatibleWith': <String>[],
  };
}

final _meta = <String, Map<String, dynamic>>{
  'blazer_beige_001': {
    'subcategory': 'blazer',
    'colorId': 'beige_linen',
    'secondaryColorId': 'cream_soft',
    'material': 'linen',
    'styles': ['luxury', 'minimal', 'classic'],
    'archetypes': ['quiet_luxury', 'business', 'old_money'],
    'fit': 'regular',
    'sleeve': 'long',
    'texture': 'matte',
    'pattern': 'solid',
    'countryStyle': 'European',
    'scores': {'luxury': 93, 'formal': 88, 'minimal': 96, 'business': 90},
    'compatibleWith': [
      'trousers_navy_001',
      'skirt_classic_black_001',
      'heels_nude_001',
      'bag_black_leather_001',
      'watch_gold_001',
    ],
  },
  'corset_cream_001': {
    'subcategory': 'corset',
    'colorId': 'cream_soft',
    'secondaryColorId': 'beige_linen',
    'material': 'satin',
    'styles': ['luxury', 'classic', 'evening'],
    'archetypes': ['evening', 'wedding', 'old_money'],
    'fit': 'fitted',
    'sleeve': 'sleeveless',
    'texture': 'satin',
    'pattern': 'solid',
    'scores': {'luxury': 91, 'formal': 85, 'minimal': 78, 'business': 62},
    'compatibleWith': ['skirt_silk_beige_001', 'cape_ivory_001', 'pearl_earrings_001'],
  },
  'satin_top_black_001': {
    'subcategory': 'blouse',
    'colorId': 'black_pure',
    'secondaryColorId': 'silver_metal',
    'material': 'satin',
    'styles': ['luxury', 'formal', 'evening'],
    'archetypes': ['evening', 'business', 'minimal'],
    'fit': 'regular',
    'sleeve': 'long',
    'texture': 'satin',
    'scores': {'luxury': 90, 'formal': 92, 'minimal': 88, 'business': 86},
    'compatibleWith': ['trousers_navy_001', 'skirt_classic_black_001', 'heels_black_001'],
  },
  'skirt_silk_beige_001': {
    'subcategory': 'skirt',
    'colorId': 'beige_linen',
    'secondaryColorId': 'cream_soft',
    'material': 'silk',
    'styles': ['luxury', 'classic', 'evening'],
    'archetypes': ['quiet_luxury', 'evening', 'old_money'],
    'fit': 'A-line',
    'scores': {'luxury': 92, 'formal': 84, 'minimal': 90, 'business': 72},
    'compatibleWith': ['blazer_beige_001', 'corset_cream_001', 'heels_nude_001'],
  },
  'trousers_navy_001': {
    'subcategory': 'trousers',
    'colorId': 'navy_deep',
    'secondaryColorId': 'black_pure',
    'material': 'wool',
    'styles': ['luxury', 'formal', 'business'],
    'archetypes': ['business', 'old_money', 'minimal'],
    'fit': 'tailored',
    'scores': {'luxury': 88, 'formal': 94, 'minimal': 92, 'business': 96},
    'compatibleWith': ['blazer_beige_001', 'satin_top_black_001', 'heels_black_001'],
  },
  'skirt_classic_black_001': {
    'subcategory': 'skirt',
    'colorId': 'black_pure',
    'secondaryColorId': 'silver_metal',
    'material': 'wool',
    'styles': ['luxury', 'formal', 'classic'],
    'archetypes': ['business', 'evening', 'minimal'],
    'fit': 'pencil',
    'scores': {'luxury': 89, 'formal': 90, 'minimal': 94, 'business': 88},
    'compatibleWith': ['blazer_beige_001', 'satin_top_black_001', 'heels_black_001'],
  },
  'cape_ivory_001': {
    'subcategory': 'cape',
    'colorId': 'ivory_warm',
    'secondaryColorId': 'cream_soft',
    'material': 'wool',
    'styles': ['luxury', 'classic', 'evening'],
    'archetypes': ['wedding', 'evening', 'quiet_luxury'],
    'fit': 'oversized',
    'scores': {'luxury': 95, 'formal': 88, 'minimal': 82, 'business': 60},
    'compatibleWith': ['corset_cream_001', 'pearl_earrings_001', 'heels_nude_001'],
  },
  'cardigan_gray_001': {
    'subcategory': 'cardigan',
    'colorId': 'gray_soft',
    'secondaryColorId': 'beige_linen',
    'material': 'cashmere',
    'styles': ['luxury', 'casual', 'minimal'],
    'archetypes': ['casual', 'quiet_luxury', 'travel'],
    'fit': 'relaxed',
    'sleeve': 'long',
    'scores': {'luxury': 82, 'formal': 55, 'minimal': 88, 'business': 48},
    'compatibleWith': ['tote_beige_001', 'trousers_navy_001'],
  },
  'shawl_wedding_001': {
    'subcategory': 'shawl',
    'colorId': 'blush_lilac',
    'secondaryColorId': 'ivory_warm',
    'material': 'silk',
    'styles': ['luxury', 'wedding', 'evening'],
    'archetypes': ['wedding', 'evening'],
    'scores': {'luxury': 94, 'formal': 86, 'minimal': 70, 'business': 40},
    'compatibleWith': ['pearl_earrings_001', 'clutch_silver_001'],
  },
  'clutch_silver_001': {
    'subcategory': 'clutch',
    'colorId': 'silver_metal',
    'secondaryColorId': 'black_pure',
    'material': 'leather',
    'styles': ['luxury', 'formal', 'evening'],
    'archetypes': ['evening', 'wedding', 'business'],
    'scores': {'luxury': 92, 'formal': 90, 'minimal': 85, 'business': 78},
    'compatibleWith': ['heels_black_001', 'satin_top_black_001', 'diamond_bracelet_001'],
  },
  'bag_black_leather_001': {
    'subcategory': 'handbag',
    'colorId': 'black_pure',
    'secondaryColorId': 'gold_warm',
    'material': 'leather',
    'styles': ['luxury', 'formal', 'business'],
    'archetypes': ['business', 'quiet_luxury', 'old_money'],
    'scores': {'luxury': 93, 'formal': 88, 'minimal': 90, 'business': 92},
    'compatibleWith': ['blazer_beige_001', 'trousers_navy_001', 'watch_gold_001'],
  },
  'tote_beige_001': {
    'subcategory': 'tote',
    'colorId': 'beige_linen',
    'secondaryColorId': 'brown_tortoise',
    'material': 'leather',
    'styles': ['luxury', 'casual'],
    'archetypes': ['casual', 'travel', 'resort'],
    'scores': {'luxury': 78, 'formal': 42, 'minimal': 82, 'business': 55},
    'compatibleWith': ['cardigan_gray_001', 'sunglasses_tortoise_001'],
  },
  'heels_nude_001': {
    'subcategory': 'pump',
    'colorId': 'nude_heel',
    'secondaryColorId': 'beige_linen',
    'material': 'leather',
    'styles': ['luxury', 'classic', 'formal'],
    'archetypes': ['business', 'evening', 'old_money'],
    'scores': {'luxury': 90, 'formal': 86, 'minimal': 88, 'business': 84},
    'compatibleWith': ['blazer_beige_001', 'skirt_silk_beige_001', 'clutch_silver_001'],
  },
  'heels_black_001': {
    'subcategory': 'stiletto',
    'colorId': 'black_pure',
    'secondaryColorId': 'silver_metal',
    'material': 'patent_leather',
    'styles': ['luxury', 'formal', 'evening'],
    'archetypes': ['business', 'evening', 'minimal'],
    'scores': {'luxury': 91, 'formal': 92, 'minimal': 90, 'business': 88},
    'compatibleWith': ['trousers_navy_001', 'skirt_classic_black_001', 'clutch_silver_001'],
  },
  'pearl_earrings_001': {
    'subcategory': 'earrings',
    'colorId': 'pearl_white',
    'secondaryColorId': 'gold_warm',
    'material': 'pearl',
    'styles': ['luxury', 'classic', 'wedding'],
    'archetypes': ['wedding', 'evening', 'old_money'],
    'scores': {'luxury': 94, 'formal': 88, 'minimal': 80, 'business': 72},
    'compatibleWith': ['corset_cream_001', 'cape_ivory_001', 'shawl_wedding_001'],
  },
  'silver_necklace_001': {
    'subcategory': 'necklace',
    'colorId': 'silver_metal',
    'secondaryColorId': 'black_pure',
    'material': 'silver',
    'styles': ['luxury', 'classic', 'minimal'],
    'archetypes': ['evening', 'quiet_luxury', 'business'],
    'scores': {'luxury': 90, 'formal': 82, 'minimal': 92, 'business': 76},
    'compatibleWith': ['blazer_beige_001', 'satin_top_black_001', 'clutch_silver_001'],
  },
  'diamond_bracelet_001': {
    'subcategory': 'bracelet',
    'colorId': 'silver_metal',
    'secondaryColorId': 'gold_warm',
    'material': 'white_gold',
    'styles': ['luxury', 'evening', 'classic'],
    'archetypes': ['evening', 'wedding', 'old_money'],
    'scores': {'luxury': 96, 'formal': 86, 'minimal': 78, 'business': 65},
    'compatibleWith': ['clutch_silver_001', 'satin_top_black_001'],
  },
  'scarf_beige_001': {
    'subcategory': 'scarf',
    'colorId': 'beige_linen',
    'secondaryColorId': 'cream_soft',
    'material': 'silk',
    'styles': ['luxury', 'classic', 'casual'],
    'archetypes': ['quiet_luxury', 'travel', 'resort'],
    'scores': {'luxury': 86, 'formal': 70, 'minimal': 84, 'business': 68},
    'compatibleWith': ['blazer_beige_001', 'cardigan_gray_001'],
  },
  'watch_gold_001': {
    'subcategory': 'watch',
    'colorId': 'gold_warm',
    'secondaryColorId': 'black_pure',
    'material': 'gold',
    'styles': ['luxury', 'formal', 'business'],
    'archetypes': ['business', 'old_money', 'quiet_luxury'],
    'scores': {'luxury': 94, 'formal': 90, 'minimal': 88, 'business': 92},
    'compatibleWith': ['blazer_beige_001', 'bag_black_leather_001', 'trousers_navy_001'],
  },
  'sunglasses_tortoise_001': {
    'subcategory': 'sunglasses',
    'colorId': 'brown_tortoise',
    'secondaryColorId': 'gold_warm',
    'material': 'acetate',
    'styles': ['luxury', 'casual', 'resort'],
    'archetypes': ['casual', 'resort', 'travel', 'summer'],
    'scores': {'luxury': 84, 'formal': 45, 'minimal': 80, 'business': 40},
    'compatibleWith': ['tote_beige_001', 'cardigan_gray_001'],
  },
};
