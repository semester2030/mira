# DEC-0001: owner decision on payment and checkout

Date: 2026-10-01
Status: accepted (owner decision, recorded here) — corrective clarification 2026-10-01

## Owner-approved (only these)

1. **Products** with `purchaseMode = internal_cod` are ordered inside Mira.
   - Payment is **cash on delivery (COD)** only.
   - Mira does not take, hold, or refund money.
   - The partner (or admin) records collection on `paymentCollectionStatus` **after delivery succeeds** — collection is a separate axis from fulfillment.
2. **Products** with `purchaseMode = external` (default) keep the external URL.
   - Buy opens the merchant link; the app states this is not a completed purchase.
3. **Services** use `payMode = pay_at_venue`.
   - Customer sends a booking *request*; partner confirms or rejects; payment at the venue.
4. No online payment gateway, wallet, or financial settlement is part of this decision.

## Not owner-approved (implementation / open policy)

These must **not** be labeled “owner decision”:

| Topic | Stance |
| --- | --- |
| Choosing the **maximum** delivery fee among cart lines | Rejected as policy. Implementation requires a **single known fee** shared by all lines; mismatched or null fees → fee unknown. |
| `acknowledgeUnknownDeliveryFee` allowing confirm with unknown fee | Rejected. Unknown fee blocks confirm; empty fee is never free. |
| Partner-set fee amount / city rules | Partner configures `deliveryFeeHalalas` on the product. Broader fee schedules need a separate owner decision. |
| View-count thresholds | Deferred — see `viewCountPolicy` in discover-phases.json. |

## Consequences in the product

| Area | Behaviour |
| --- | --- |
| Buy button | Preview: not a purchase. `internal_cod`: cart. `external`: open URL. Buy never opens appointment. |
| Delivery fee | Integer halalas. Null = unknown (not free). Confirm only when known and consistent. Customer sees COD breakdown before confirm. |
| Status | `fulfillmentStatus`, `deliveryStatus`, and `paymentCollectionStatus` are separate. Delivery change never auto-collects. |
| Booking | `requested` = not confirmed. Only `confirmed` is confirmed. |
| Stock | `stockQty = null` = untracked. Public JSON exposes sellable qty only. `failed_delivery` keeps reservation until cancel or retry. |
| Idempotency | One key per confirm session; same payload replays the same order. |
| Cart | One partner per cart; conflict is explicit. |

## Out of scope

- Online payment, refunds, wallet.
- Courier assignment / live tracking.
- View counting until its own owner decision.
