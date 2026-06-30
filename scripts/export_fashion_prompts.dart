// ignore_for_file: avoid_print

import 'dart:convert';
import 'dart:io';

/// Exports three prompt types per piece for batch AI asset generation.
void main() {
  final catalog = jsonDecode(
    File('assets/fashion/catalog.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  final pieces = (catalog['pieces'] as List<dynamic>).cast<Map<String, dynamic>>();
  final outDir = Directory('assets/fashion/_prompts');
  outDir.createSync(recursive: true);

  final manifest = <Map<String, dynamic>>[];

  for (final piece in pieces) {
    final file = piece['file'] as String;
    final id = piece['id'] as String;
    final name = id.replaceAll('/', '_');
    final prompts = piece['prompts'] as Map<String, dynamic>? ?? {
      'generation': piece['aiPrompt'],
      'editing': 'Enhance fabric texture, studio lighting, luxury ecommerce finish.',
      'backgroundRemoval': 'Remove background, transparent PNG, preserve edges.',
    };

    for (final type in ['generation', 'editing', 'backgroundRemoval']) {
      final text = prompts[type] as String? ?? '';
      File('${outDir.path}/${name}_$type.txt').writeAsStringSync(text);
    }

    final angles = piece['angles'] as Map<String, dynamic>? ?? {'front': file};
    manifest.add({
      'id': id,
      'output': 'assets/fashion/$file',
      'prompts': {
        'generation': 'assets/fashion/_prompts/${name}_generation.txt',
        'editing': 'assets/fashion/_prompts/${name}_editing.txt',
        'backgroundRemoval': 'assets/fashion/_prompts/${name}_backgroundRemoval.txt',
      },
      'angles': angles,
    });
  }

  File('${outDir.path}/manifest.json').writeAsStringSync(
    const JsonEncoder.withIndent('  ').convert(manifest),
  );

  print('✓ Exported ${pieces.length} × 3 prompts → assets/fashion/_prompts/');
  print('  manifest.json includes generation / editing / backgroundRemoval per piece');
}
