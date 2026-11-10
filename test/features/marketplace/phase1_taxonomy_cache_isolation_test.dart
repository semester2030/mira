import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/config/mira_api_config.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';

/// Elegance → jewelry → elegance without clearCache/force between steps.
void main() {
  tearDown(EleganceTaxonomySource.clearCache);

  test('lane cache isolation: elegance↔jewelry without clearCache/force', () async {
    final base = MiraApiConfig.baseUrl;
    expect(base.contains('127.0.0.1') || base.contains('localhost'), isTrue);

    const eleganceMarker = String.fromEnvironment('PHASE1_ELEGANCE_MARKER', defaultValue: 'clothes');
    const jewelryMarker = String.fromEnvironment('PHASE1_JEWELRY_MARKER');
    expect(jewelryMarker.isNotEmpty, isTrue);

    final dio = Dio(
      BaseOptions(
        baseUrl: base.endsWith('/') ? base.substring(0, base.length - 1) : base,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
      ),
    );

    // Step 1: أناقتك
    expect(
      await EleganceTaxonomySource.ensureLoaded(dio: dio, lane: 'elegance'),
      isTrue,
    );
    expect(EleganceTaxonomySource.nodes.any((n) => n.id == eleganceMarker), isTrue);
    expect(EleganceTaxonomySource.nodes.any((n) => n.id == jewelryMarker), isFalse);

    // Step 2: المجوهرات — no clearCache, no force
    expect(
      await EleganceTaxonomySource.ensureLoaded(
        dio: dio,
        lane: 'jewelry',
        partnerAudience: true,
      ),
      isTrue,
    );
    expect(EleganceTaxonomySource.nodes.any((n) => n.id == jewelryMarker), isTrue);
    expect(EleganceTaxonomySource.nodes.any((n) => n.id == eleganceMarker), isFalse);

    // Step 3: أناقتك again — must not keep jewelry nodes
    expect(
      await EleganceTaxonomySource.ensureLoaded(dio: dio, lane: 'elegance'),
      isTrue,
    );
    expect(EleganceTaxonomySource.nodes.any((n) => n.id == eleganceMarker), isTrue);
    expect(EleganceTaxonomySource.nodes.any((n) => n.id == jewelryMarker), isFalse);
    expect(EleganceTaxonomySource.cachedLane, 'elegance');
  });
}
