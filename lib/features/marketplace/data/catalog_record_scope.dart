import '../../../core/config/mira_api_config.dart';
import 'catalog_provenance.dart';
import 'discover_catalog_gateway.dart';
import 'repositories/marketplace_repository_impl.dart';
import '../presentation/screens/catalog_record_page.dart';

/// Opens catalog details by id with a refetch, not a stale snapshot.
abstract final class CatalogRecordScope {
  static CatalogRecordPage page({
    required String kind,
    required String id,
    CatalogTransport? transport,
    DiscoverCatalogGateway? gateway,
    bool matchKnown = false,
    int matchScore = 0,
  }) {
    final resolvedTransport = transport ?? (MiraApiConfig.useBackend ? CatalogTransport.server : CatalogTransport.localCatalog);
    final useServer = resolvedTransport == CatalogTransport.server;
    return CatalogRecordPage(
      gateway: gateway ?? MarketplaceRepositoryImpl(useServer: useServer),
      kind: kind,
      id: id,
      transport: resolvedTransport,
      matchKnown: matchKnown,
      matchScore: matchScore,
    );
  }
}
