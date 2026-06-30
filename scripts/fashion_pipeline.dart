// ignore_for_file: avoid_print

import 'dart:io';

/// Phase 30 — Enterprise fashion pipeline (full stack).
void main(List<String> args) {
  final dryRun = args.contains('--dry-run');
  print('Mira Enterprise Fashion Pipeline v3');
  print('====================================');

  final stages = [
    ('Metadata enrichment v3', ['dart', 'run', 'scripts/enrich_catalog_v3.dart']),
    ('Knowledge graph + ontology', ['dart', 'run', 'scripts/enrich_catalog_v2.dart']),
    ('Prompt generator (×3)', ['dart', 'run', 'scripts/export_fashion_prompts.dart']),
  ];

  for (final (label, cmd) in stages) {
    _run(label, cmd, dryRun);
  }

  if (!dryRun && !args.contains('--from-ai')) {
    print('');
    print('⏸  AI Image Generation — use assets/fashion/_prompts/manifest.json');
    print('   Then: dart run scripts/fashion_pipeline.dart --from ai');
    return;
  }

  final postStages = [
    ('Quality verification', ['dart', 'run', 'scripts/sync_fashion_catalog.dart']),
    ('Embedding + graph codegen', ['dart', 'run', 'scripts/sync_fashion_catalog.dart']),
    ('Recommendation tests', ['flutter', 'test', 'test/fashion_recommendation_engine_test.dart']),
    ('Intelligence tests', ['flutter', 'test', 'test/fashion_intelligence_engine_test.dart']),
  ];

  for (final (label, cmd) in postStages) {
    _run(label, cmd, dryRun);
  }

  print('');
  print('✓ Enterprise pipeline complete → Flutter assets ready');
}

void _run(String label, List<String> cmd, bool dryRun) {
  stdout.write('→ $label... ');
  if (dryRun) {
    print('skipped');
    return;
  }
  final result = Process.runSync(cmd[0], cmd.sublist(1), runInShell: true);
  if (result.stdout.toString().trim().isNotEmpty) print(result.stdout);
  else print('done');
  if (result.exitCode != 0) {
    stderr.writeln(result.stderr);
    exit(result.exitCode);
  }
}
