# Commerce operational audit table

Date: 2026-10-01. "Before" is the state of the working tree when this wiring started. "Now" is what this change does.

| # | Area | Before | Now | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Backend commerce API (`/marketplace/commerce/*`, partner and admin routes) | Existed (controller, service, types) | Unchanged, used by the app | `mira-api/src/marketplace/commerce.*` |
| 2 | Public catalog JSON | No purchase mode, stock, fee, options or booking flags | `purchaseMode`, `stockQty` (sellable or null), `stockAvailable`, `deliveryFeeHalalas`, `optionsJson`, `variantsJson`; services get `bookingEnabled`, `payMode`, `availabilityPresent` | `commerce-public.ts`, `marketplace.service.ts`, `commerce-public.schema-tests.ts` |
| 3 | Partner product write | No commerce fields | DTO and service accept the fields. Validation: price above 0 for `internal_cod`, stock not below reserved, valid options and variants | `catalog.dto.ts`, `partners-portal.service.ts` |
| 4 | Partner portal UI | No commerce inputs, no orders view | Product form fields. Orders and bookings section with transition buttons | `catalog-journey.js`, `commerce-orders.js`, `dashboard.html` |
| 5 | Admin portal | No orders view | Read-only Orders tab on `/admin/commerce/orders` | `admin-portal/web/js/app.js` |
| 6 | `CatalogProduct` | No purchase fields | `purchaseMode`, `stockQty`, `deliveryFeeHalalas`, `canOrderInMira`, `outOfStock` | `catalog_product.dart` |
| 7 | Flutter API client | None | Authenticated like favorites (shared Dio, Firebase ID token). Coded Arabic errors | `commerce_api_client.dart` |
| 8 | Buy CTA, Discover | Preview and external only | `decideBuyRoute`: preview, in-app, out of stock, unavailable, external, none. Buy never calls the appointment path | `discover_presentation_screen.dart`, `commerce_cart_actions.dart` |
| 9 | Buy CTA, product detail | External link only | «أضيفي للسلة» for `internal_cod` after options are chosen. External path kept | `product_detail_screen.dart` |
| 10 | Cart and checkout | None | Cart, checkout (COD only, fee acknowledgement, UUID key per confirm session) | `cart_screen.dart`, `checkout_screen.dart` |
| 11 | Partner conflict | None | Arabic dialog with keep, replace, cancel. No silent replace | `commerce_cart_actions.dart` |
| 12 | Orders | None | List and detail with `publicNumber`. Fulfillment and payment collection shown separately | `orders_list_screen.dart`, `order_detail_screen.dart` |
| 13 | Service booking | Phone call or unavailable toast | Discover and service detail open `booking_request_screen` when real and `bookingEnabled`. Slots, idempotency key, «غير مؤكد» until confirmed | `booking_request_screen.dart`, `bookings_list_screen.dart` |
| 14 | Share | Product URL or title only | `https://mira.app/discover/{kind}/{id}` plus title. Preview and ads carry no link. Nothing is claimed on dismiss | `discoverShareText` |
| 15 | Favorites | Toggle only | Added a list screen and a Discover hub entry. Toggle untouched | `favorites_screen.dart`, `discover_hub_screen.dart` |
| 16 | Routes | Discover only | cart, checkout, myOrders, orderDetail, myBookings, bookingRequest, favorites. Gated on `marketplaceEnabled` | `marketplace_routes.dart`, `app_routes.dart` |
| 17 | View counting | Disabled | Still disabled. `DiscoverViewSnapshot.disabled` untouched | `discover_view_count.dart` not edited |

## Tests

- Flutter: `commerce_buy_flow_test.dart`, `booking_request_screen_test.dart` (new). `discover_activation_test.dart` updated for the new service CTA label.
- Node: `npm run test:commerce-pure` passes. The HTTP integration tests need a database and were not run.

## Known gaps

- Partner commerce edits apply to the live row and skip content review.
- No portal UI for a service's `availabilityJson`, `bookingEnabled` or `payMode`.
- The portal's options UI is localStorage only, so structured options go in the JSON text areas.
- The admin Orders tab is read-only.
- Deep-link opening of the share URL is not implemented.
- Browse items carry the other kind's commerce fields as null placeholders.
- Eight other marketplace widget tests fail from earlier uncommitted Discover chrome work (see the final report).
