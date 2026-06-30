// ignore_for_file: avoid_print

import 'dart:convert';
import 'dart:io';

/// Phase 11+ — adds ontology paths, body types, extended occasions (v3).
void main() {
  final catalogPath = File('assets/fashion/catalog.json');
  final catalog = jsonDecode(catalogPath.readAsStringSync()) as Map<String, dynamic>;
  catalog['version'] = 3;

  final pieces = (catalog['pieces'] as List<dynamic>).cast<Map<String, dynamic>>();
  for (final piece in pieces) {
    final id = piece['id'] as String;
    final extra = _v3[id] ?? _defaultsV3(piece);
    piece.addAll(extra);

    piece['ontologyPath'] = [
      piece['kind'],
      piece['category'],
      if (piece['subcategory'] != null) piece['subcategory'],
      ...(piece['styles'] as List<dynamic>? ?? []),
      ...(piece['archetypes'] as List<dynamic>? ?? []),
      piece['brandStyle'],
      piece['priceLevel'],
    ];
  }

  catalogPath.writeAsStringSync(const JsonEncoder.withIndent('  ').convert(catalog));
  print('✓ Enriched ${pieces.length} pieces → catalog.json v3');
}

Map<String, dynamic> _defaultsV3(Map<String, dynamic> piece) {
  return {
    'recommendedFor': ['hourglass', 'rectangle', 'slim', 'all'],
    'extendedOccasions': ['dinner', 'office'],
  };
}

final _v3 = <String, Map<String, dynamic>>{
  'blazer_beige_001': {
    'recommendedFor': ['hourglass', 'rectangle', 'tall'],
    'extendedOccasions': ['office', 'meeting', 'interview', 'business', 'dinner'],
  },
  'trousers_navy_001': {
    'recommendedFor': ['rectangle', 'hourglass', 'tall', 'slim'],
    'extendedOccasions': ['office', 'meeting', 'business', 'interview', 'airport'],
  },
  'corset_cream_001': {
    'recommendedFor': ['hourglass', 'slim', 'petite'],
    'extendedOccasions': ['wedding', 'dinner', 'party', 'eid'],
  },
  'satin_top_black_001': {
    'recommendedFor': ['hourglass', 'slim', 'rectangle'],
    'extendedOccasions': ['dinner', 'party', 'meeting', 'graduation'],
  },
  'skirt_silk_beige_001': {
    'recommendedFor': ['pear', 'hourglass', 'petite'],
    'extendedOccasions': ['wedding', 'dinner', 'eid', 'graduation'],
  },
  'cape_ivory_001': {
    'recommendedFor': ['tall', 'hourglass', 'slim'],
    'extendedOccasions': ['wedding', 'graduation', 'dinner', 'eid'],
  },
  'cardigan_gray_001': {
    'recommendedFor': ['rectangle', 'pear', 'plus_size', 'all'],
    'extendedOccasions': ['travel', 'airport', 'casual', 'ramadan'],
  },
  'heels_nude_001': {
    'recommendedFor': ['petite', 'hourglass', 'slim', 'all'],
    'extendedOccasions': ['office', 'wedding', 'dinner', 'graduation'],
  },
  'heels_black_001': {
    'recommendedFor': ['all'],
    'extendedOccasions': ['office', 'meeting', 'party', 'graduation', 'interview'],
  },
  'tote_beige_001': {
    'recommendedFor': ['all'],
    'extendedOccasions': ['travel', 'airport', 'casual'],
  },
  'sunglasses_tortoise_001': {
    'recommendedFor': ['all'],
    'extendedOccasions': ['travel', 'beach', 'airport'],
  },
  'shawl_wedding_001': {
    'recommendedFor': ['all'],
    'extendedOccasions': ['wedding', 'eid', 'ramadan', 'graduation'],
  },
  'pearl_earrings_001': {
    'recommendedFor': ['all'],
    'extendedOccasions': ['wedding', 'graduation', 'dinner', 'eid'],
  },
};
