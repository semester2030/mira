import 'catalog_provenance.dart';
import 'discover_catalog_query.dart';
import 'discover_published_ad.dart';
import '../domain/entities/catalog_product.dart';
import '../domain/entities/catalog_service.dart';

class CatalogSourceException implements Exception {
  const CatalogSourceException();
}

class CatalogCursorException implements Exception {
  const CatalogCursorException();
}

enum CatalogRecordStatus { ready, missing, network }

class CatalogRecordResult {
  const CatalogRecordResult({
    required this.status,
    this.product,
    this.service,
    this.transport,
    this.contentMark,
  });

  final CatalogRecordStatus status;
  final CatalogProduct? product;
  final CatalogService? service;
  final CatalogTransport? transport;
  final ContentMark? contentMark;
}

class DiscoverBrowseResponse {
  const DiscoverBrowseResponse({
    required this.failed,
    this.invalidCursor = false,
    this.transport,
    this.contentMark,
    this.items = const [],
    this.nextCursor,
    this.cities = const [],
  });

  final bool failed;
  final bool invalidCursor;
  final CatalogTransport? transport;
  final ContentMark? contentMark;
  final List<DiscoverOffer> items;
  final String? nextCursor;
  final List<String> cities;

  bool get succeeded => !failed && !invalidCursor;
}

abstract class DiscoverCatalogGateway {
  bool get serverEnabled;

  Future<DiscoverBrowseResponse> browse(
    DiscoverCatalogQuery query, {
    String? cursor,
    int limit = 4,
  });

  Future<CatalogRecordResult> loadRecord({
    required String kind,
    required String id,
    required CatalogTransport? transport,
  });

  /// Published ads from the same catalog source. An empty feed is not a local substitute.
  Future<DiscoverAdFeed> publishedAds();
}
