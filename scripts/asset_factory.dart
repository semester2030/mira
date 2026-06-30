// ignore_for_file: avoid_print

import 'dart:io';

/// Phase 10 — AI Visual Asset Factory (automated production pipeline).
///
/// Stages:
///   catalog → prompts → [AI gen] → bg removal → upscale → QC → compress → sync
///
/// Usage:
///   dart run scripts/asset_factory.dart
///   dart run scripts/asset_factory.dart --stage prompts
///   dart run scripts/asset_factory.dart --stage sync
void main(List<String> args) {
  final stage = _argValue(args, '--stage') ?? 'all';
  print('Mira AI Visual Asset Factory');
  print('============================');

  if (stage == 'all' || stage == 'enrich') {
    _run('Metadata enrichment v3', ['dart', 'run', 'scripts/enrich_catalog_v3.dart']);
  }
  if (stage == 'all' || stage == 'prompts') {
    _run('Prompt generator', ['dart', 'run', 'scripts/export_fashion_prompts.dart']);
  }
  if (stage == 'all' || stage == 'ai') {
    print('');
    print('⏸  AI Generator — batch from assets/fashion/_prompts/manifest.json');
    print('   Hook: Midjourney / SDXL / DALL-E API → assets/fashion/{category}/');
    print('   Re-run: dart run scripts/asset_factory.dart --stage post');
    if (stage == 'ai') return;
  }
  if (stage == 'all' || stage == 'post') {
    _run('Background removal check', ['dart', 'run', 'scripts/sync_fashion_catalog.dart']);
    _run('Quality verification + codegen', ['dart', 'run', 'scripts/sync_fashion_catalog.dart']);
    _run('Tests', ['flutter', 'test', 'test/fashion_recommendation_engine_test.dart']);
  }
  if (stage == 'sync') {
    _run('Sync only', ['dart', 'run', 'scripts/sync_fashion_catalog.dart']);
  }

  print('');
  print('✓ Asset factory stage "$stage" complete');
}

String? _argValue(List<String> args, String flag) {
  final i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null;
}

void _run(String label, List<String> cmd) {
  stdout.write('→ $label... ');
  final result = Process.runSync(cmd[0], cmd.sublist(1), runInShell: true);
  if (result.stdout.toString().trim().isNotEmpty) print(result.stdout);
  else print('done');
  if (result.exitCode != 0) {
    stderr.writeln(result.stderr);
    exit(result.exitCode);
  }
}
