import 'catalog_product.dart';
import 'catalog_service.dart';

class MarketplaceMatch {
  final List<CatalogProduct> products;
  final List<CatalogService> services;

  const MarketplaceMatch({
    required this.products,
    required this.services,
  });

  static const empty = MarketplaceMatch(products: [], services: []);
}
