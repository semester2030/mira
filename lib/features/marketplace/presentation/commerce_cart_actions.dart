import 'package:flutter/material.dart';

import '../../../core/constants/marketplace_copy.dart';
import '../../../core/navigation/app_routes.dart';
import '../data/commerce_api_client.dart';
import '../domain/entities/catalog_product.dart';

/// What the Buy button does for one product. Buy never routes to an appointment path.
enum BuyRoute {
  /// Visual preview or no product. Honest message, no transaction.
  preview,

  /// `internal_cod`: add to the Mira cart.
  inApp,

  /// `internal_cod` with no stock left.
  outOfStock,

  /// `internal_cod` without a usable price or other reason to refuse.
  unavailable,

  /// `external`: open the merchant URL. Not a purchase inside Mira.
  external,

  /// No purchase path at all.
  none,
}

BuyRoute decideBuyRoute({required CatalogProduct? product, required bool preview}) {
  if (preview || product == null) return BuyRoute.preview;
  if (product.isInternalCod) {
    if (product.outOfStock) return BuyRoute.outOfStock;
    return product.canOrderInMira ? BuyRoute.inApp : BuyRoute.unavailable;
  }
  final uri = Uri.tryParse(product.externalUrl.trim());
  return uri != null && uri.hasScheme && uri.host.isNotEmpty ? BuyRoute.external : BuyRoute.none;
}

enum AddToCartOutcome { added, notSignedIn, optionsIncomplete, variantUnavailable, partnerConflict, cancelled, failed }

abstract final class CommerceCartActions {
  static void _tell(BuildContext context, String message, {SnackBarAction? action}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), action: action));
  }

  static void showLoginRequired(BuildContext context, {String message = MarketplaceCopy.loginRequiredCart}) {
    final navigator = Navigator.of(context);
    _tell(
      context,
      message,
      action: SnackBarAction(label: MarketplaceCopy.loginAction, onPressed: () => navigator.pushNamed(AppRoutes.login)),
    );
  }

  /// Adds one product line to the cart. Requires login, complete options, and never replaces a
  /// cart from another store without an explicit choice.
  static Future<AddToCartOutcome> addToCart(
    BuildContext context, {
    required CommerceClient client,
    required CatalogProduct product,
    Map<String, String> selected = const {},
    int quantity = 1,
  }) async {
    if (!client.signedIn) {
      showLoginRequired(context);
      return AddToCartOutcome.notSignedIn;
    }
    if (product.outOfStock) {
      _tell(context, MarketplaceCopy.outOfStock);
      return AddToCartOutcome.failed;
    }

    final missing = CatalogOptionJson.firstMissing(groups: product.optionGroups, selected: selected);
    if (missing != null) {
      _tell(context, MarketplaceCopy.chooseOption(missing.labelAr));
      return AddToCartOutcome.optionsIncomplete;
    }
    String? variantKey;
    if (product.variants.isNotEmpty) {
      final variant = CatalogOptionMatrix.match(variants: product.variants, selected: selected);
      if (variant == null || !variant.available) {
        _tell(context, MarketplaceCopy.variantUnavailable);
        return AddToCartOutcome.variantUnavailable;
      }
      variantKey = variant.id;
    }

    Future<void> send() => client.addCartItem(
          productId: product.id,
          quantity: quantity,
          selections: selected,
          variantKey: variantKey,
        );

    try {
      await send();
    } on CommerceAuthException {
      if (context.mounted) showLoginRequired(context);
      return AddToCartOutcome.notSignedIn;
    } on CommerceApiException catch (error) {
      if (!context.mounted) return AddToCartOutcome.failed;
      if (!error.isPartnerConflict) {
        _tell(context, error.messageAr);
        return AddToCartOutcome.failed;
      }
      final choice = await showPartnerConflictDialog(context);
      if (!context.mounted) return AddToCartOutcome.cancelled;
      switch (choice) {
        case PartnerConflictChoice.keepCart:
          await Navigator.of(context).pushNamed(AppRoutes.cart);
          return AddToCartOutcome.partnerConflict;
        case PartnerConflictChoice.replaceCart:
          try {
            await client.clearCart();
            await send();
          } on CommerceApiException catch (retry) {
            if (context.mounted) _tell(context, retry.messageAr);
            return AddToCartOutcome.failed;
          } on CommerceAuthException {
            if (context.mounted) showLoginRequired(context);
            return AddToCartOutcome.notSignedIn;
          }
        case PartnerConflictChoice.cancel:
          return AddToCartOutcome.cancelled;
      }
    }

    if (!context.mounted) return AddToCartOutcome.added;
    final navigator = Navigator.of(context);
    _tell(
      context,
      MarketplaceCopy.addedToCart,
      action: SnackBarAction(label: MarketplaceCopy.viewCart, onPressed: () => navigator.pushNamed(AppRoutes.cart)),
    );
    return AddToCartOutcome.added;
  }

  static Future<PartnerConflictChoice> showPartnerConflictDialog(BuildContext context) async {
    final choice = await showDialog<PartnerConflictChoice>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text(MarketplaceCopy.cartPartnerConflictTitle),
        content: const Text(MarketplaceCopy.cartPartnerConflictBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, PartnerConflictChoice.cancel),
            child: const Text(MarketplaceCopy.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, PartnerConflictChoice.keepCart),
            child: const Text(MarketplaceCopy.cartPartnerConflictKeep),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, PartnerConflictChoice.replaceCart),
            child: const Text(MarketplaceCopy.cartPartnerConflictReplace),
          ),
        ],
      ),
    );
    return choice ?? PartnerConflictChoice.cancel;
  }
}

enum PartnerConflictChoice { keepCart, replaceCart, cancel }
