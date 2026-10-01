import 'package:flutter/material.dart';

import '../../../core/config/mira_features.dart';
import '../../../core/navigation/app_routes.dart';
import '../../../core/navigation/premium_page_route.dart';
import '../data/catalog_record_scope.dart';
import '../domain/entities/catalog_product.dart';
import '../domain/entities/catalog_service.dart';
import '../data/discover_catalog_query.dart';
import 'screens/booking_request_screen.dart';
import 'screens/bookings_list_screen.dart';
import 'screens/cart_screen.dart';
import 'screens/catalog_record_page.dart';
import 'screens/checkout_screen.dart';
import 'screens/discover_hub_screen.dart';
import 'screens/discover_presentation_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/order_detail_screen.dart';
import 'screens/orders_list_screen.dart';

/// Discover routes. The production default keeps [MiraFeatures.marketplaceEnabled] false.
abstract final class MarketplaceRoutes {
  MarketplaceRoutes._();

  static bool handles(String? name) {
    return name == AppRoutes.discover ||
        name == AppRoutes.discoverPresentation ||
        name == AppRoutes.discoverList ||
        name == AppRoutes.productDetail ||
        name == AppRoutes.serviceDetail ||
        name == AppRoutes.cart ||
        name == AppRoutes.checkout ||
        name == AppRoutes.myOrders ||
        name == AppRoutes.orderDetail ||
        name == AppRoutes.myBookings ||
        name == AppRoutes.bookingRequest ||
        name == AppRoutes.favorites;
  }

  static Route<dynamic>? onGenerate(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.discover:
        return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
      case AppRoutes.discoverPresentation:
        if (!MiraFeatures.marketplaceEnabled) {
          return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
        }
        final lane = settings.arguments is DiscoverLane ? settings.arguments as DiscoverLane : DiscoverLane.elegance;
        return PremiumPageRoute(
          page: DiscoverPresentationScreen(lane: lane),
          settings: settings,
        );
      case AppRoutes.discoverList:
        if (!MiraFeatures.marketplaceEnabled) {
          return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
        }
        final type = settings.arguments as String? ?? 'brand';
        final redirected = type == 'clinic' || type == 'salon' ? DiscoverLane.beauty : DiscoverLane.elegance;
        return PremiumPageRoute(
          page: DiscoverPresentationScreen(lane: redirected),
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
      case AppRoutes.cart:
      case AppRoutes.checkout:
      case AppRoutes.myOrders:
      case AppRoutes.orderDetail:
      case AppRoutes.myBookings:
      case AppRoutes.bookingRequest:
      case AppRoutes.favorites:
        return _commerce(settings);
      default:
        return null;
    }
  }

  /// Commerce screens follow the same gate as the rest of Discover.
  static Route<dynamic>? _commerce(RouteSettings settings) {
    if (!MiraFeatures.marketplaceEnabled) {
      return PremiumPageRoute(page: const DiscoverHubScreen(), settings: settings);
    }
    switch (settings.name) {
      case AppRoutes.cart:
        return PremiumPageRoute(page: const CartScreen(), settings: settings);
      case AppRoutes.checkout:
        return PremiumPageRoute(page: const CheckoutScreen(), settings: settings);
      case AppRoutes.myOrders:
        return PremiumPageRoute(page: const OrdersListScreen(), settings: settings);
      case AppRoutes.orderDetail:
        final id = settings.arguments;
        if (id is! String || id.isEmpty) return null;
        return PremiumPageRoute(page: OrderDetailScreen(orderId: id), settings: settings);
      case AppRoutes.myBookings:
        return PremiumPageRoute(page: const BookingsListScreen(), settings: settings);
      case AppRoutes.bookingRequest:
        final service = settings.arguments;
        if (service is! CatalogService) return null;
        return PremiumPageRoute(page: BookingRequestScreen(service: service), settings: settings);
      case AppRoutes.favorites:
        return PremiumPageRoute(page: const FavoritesScreen(), settings: settings);
      default:
        return null;
    }
  }

  static CatalogRecordPage _record(String kind, String id, bool matchKnown, int matchScore) {
    return CatalogRecordScope.page(kind: kind, id: id, matchKnown: matchKnown, matchScore: matchScore);
  }
}
