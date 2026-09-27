import 'package:flutter/material.dart';

import '../../../core/config/mira_features.dart';
import '../../../core/navigation/app_routes.dart';
import '../../../core/navigation/premium_page_route.dart';
import '../data/catalog_record_scope.dart';
import '../domain/entities/catalog_product.dart';
import '../domain/entities/catalog_service.dart';
import 'screens/catalog_record_page.dart';
import 'screens/discover_hub_screen.dart';
import 'screens/discover_presentation_screen.dart';
import 'screens/partner_list_screen.dart';

/// Discover routes. The production default keeps [MiraFeatures.marketplaceEnabled] false.
abstract final class MarketplaceRoutes {
  MarketplaceRoutes._();

  static bool handles(String? name) {
    return name == AppRoutes.discover ||
        name == AppRoutes.discoverPresentation ||
        name == AppRoutes.discoverList ||
        name == AppRoutes.productDetail ||
        name == AppRoutes.serviceDetail;
  }

  static Route<dynamic>? onGenerate(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.discover:
        return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
      case AppRoutes.discoverPresentation:
        if (!MiraFeatures.marketplaceEnabled) {
          return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
        }
        return PremiumPageRoute(
          page: const DiscoverPresentationScreen(),
          settings: settings,
        );
      case AppRoutes.discoverList:
        if (!MiraFeatures.marketplaceEnabled) {
          return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
        }
        final type = settings.arguments as String? ?? 'brand';
        return PremiumPageRoute(
          page: PartnerListScreen(partnerType: type),
          settings: settings,
        );
      case AppRoutes.productDetail:
        if (!MiraFeatures.marketplaceEnabled) {
          return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
        }
        final product = settings.arguments as CatalogProduct?;
        if (product == null) return null;
        return PremiumPageRoute(
          page: _record('product', product.id, product.matchKnown, product.matchScore),
          settings: settings,
        );
      case AppRoutes.serviceDetail:
        if (!MiraFeatures.marketplaceEnabled) {
          return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
        }
        final service = settings.arguments as CatalogService?;
        if (service == null) return null;
        return PremiumPageRoute(
          page: _record('service', service.id, service.matchKnown, service.matchScore),
          settings: settings,
        );
      default:
        return null;
    }
  }

  static CatalogRecordPage _record(String kind, String id, bool matchKnown, int matchScore) {
    return CatalogRecordScope.page(kind: kind, id: id, matchKnown: matchKnown, matchScore: matchScore);
  }
}
