import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/config/mira_api_config.dart';
import 'package:mirra/core/network/mira_api_endpoints.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';

/// Phase1 critical probe: real HTTP via [EleganceTaxonomySource] against local Nest.
/// Asserts id/parentId/profileId/definitionsVersion/fieldIds/filterKeys — not status alone.
void main() {
  tearDown(EleganceTaxonomySource.clearCache);

  test('Flutter taxonomy source reads injected jewelry probe from live API', () async {
    final base = MiraApiConfig.baseUrl;
    expect(base.contains('127.0.0.1') || base.contains('localhost'), isTrue,
        reason: 'probe must hit local server, got $base');

    const probeId = String.fromEnvironment('PHASE1_PROBE_ID');
    const parentId = String.fromEnvironment('PHASE1_PROBE_PARENT');
    const version = String.fromEnvironment('PHASE1_PROBE_VERSION');
    const profileId = String.fromEnvironment('PHASE1_PROBE_PROFILE');
    const fieldsCsv = String.fromEnvironment('PHASE1_PROBE_FIELDS');
    const filtersCsv = String.fromEnvironment('PHASE1_PROBE_FILTERS');
    expect(probeId.isNotEmpty, isTrue);
    expect(parentId.isNotEmpty, isTrue);
    expect(version.isNotEmpty, isTrue);
    expect(profileId.isNotEmpty, isTrue);
    expect(fieldsCsv.isNotEmpty, isTrue);
    expect(filtersCsv.isNotEmpty, isTrue);
    final expectedFields = fieldsCsv.split(',').where((s) => s.isNotEmpty).toList();
    final expectedFilters = filtersCsv.split(',').where((s) => s.isNotEmpty).toList();

    final dio = Dio(
      BaseOptions(
        baseUrl: base.endsWith('/') ? base.substring(0, base.length - 1) : base,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
      ),
    );

    // Same HTTP contract the source uses (must not inject node into Flutter).
    final raw = await dio.get<Map<String, dynamic>>(
      MiraApiEndpoints.marketplaceTaxonomy,
      queryParameters: const {'lane': 'jewelry', 'audience': 'partner'},
    );
    expect(raw.data, isNotNull);
    expect('${raw.data!['definitionsVersion']}', version);
    final rawNodes = raw.data!['nodes'];
    expect(rawNodes, isA<List>());
    final rawProbe = (rawNodes as List)
        .cast<Map>()
        .where((n) => '${n['id']}' == probeId)
        .toList();
    expect(rawProbe.length, 1, reason: 'missing probe branch on wire');
    expect('${rawProbe.single['parentId']}', parentId);
    expect('${rawProbe.single['profileId']}', profileId);
    final wireFields = (rawProbe.single['fieldIds'] as List?)?.map((e) => '$e').toList() ?? [];
    final wireFilters = (rawProbe.single['filterKeys'] as List?)?.map((e) => '$e').toList() ?? [];
    expect(wireFields, isNotEmpty);
    expect(wireFilters, isNotEmpty);
    for (final f in expectedFields) {
      expect(wireFields, contains(f), reason: 'wire missing field $f');
    }
    for (final f in expectedFilters) {
      expect(wireFilters, contains(f), reason: 'wire missing filter $f');
    }

    EleganceTaxonomySource.clearCache();
    final ok = await EleganceTaxonomySource.ensureLoaded(
      dio: dio,
      force: true,
      lane: 'jewelry',
      partnerAudience: true,
    );
    expect(ok, isTrue, reason: 'ensureLoaded must succeed against live jewelry taxonomy');
    expect(EleganceTaxonomySource.definitionsVersion, version);

    final node = EleganceTaxonomySource.nodes.where((n) => n.id == probeId).toList();
    expect(node.length, 1, reason: 'Flutter source missing probe node');
    expect(node.single.parentId, parentId);
    expect(node.single.profileId, profileId);
    expect(node.single.writeEnabled, isTrue);
    expect(node.single.browseOnly, isFalse);
    expect(node.single.fieldIds, isNotEmpty);
    expect(node.single.filterKeys, isNotEmpty);
    for (final f in expectedFields) {
      expect(node.single.fieldIds, contains(f), reason: 'source missing field $f');
    }
    for (final f in expectedFilters) {
      expect(node.single.filterKeys, contains(f), reason: 'source missing filter $f');
    }

    final kids = EleganceTaxonomySource.childrenOf(parentId);
    expect(kids.any((c) => c.id == probeId), isTrue);

    // Machine-readable evidence for the Node harness.
    // ignore: avoid_print
    print(
      'PHASE1_FLUTTER_READ=${jsonEncode({
        'id': node.single.id,
        'parentId': node.single.parentId,
        'profileId': node.single.profileId,
        'definitionsVersion': EleganceTaxonomySource.definitionsVersion,
        'fieldIds': node.single.fieldIds,
        'filterKeys': node.single.filterKeys,
      })}',
    );
  });
}
