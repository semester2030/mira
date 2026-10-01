import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/marketplace_routes.dart';

void main() {
  test('discover share paths parse product and service ids', () {
    expect(
      MarketplaceRoutes.parseDiscoverDeepLink('/discover/product/abc-1'),
      (kind: 'product', id: 'abc-1'),
    );
    expect(
      MarketplaceRoutes.parseDiscoverDeepLink('https://mira.app/discover/service/svc%2F2'),
      (kind: 'service', id: 'svc/2'),
    );
    expect(MarketplaceRoutes.parseDiscoverDeepLink('/discover/product/'), isNull);
    expect(MarketplaceRoutes.parseDiscoverDeepLink('/cart'), isNull);
    expect(MarketplaceRoutes.handles('/discover/product/x'), isTrue);
  });
}
