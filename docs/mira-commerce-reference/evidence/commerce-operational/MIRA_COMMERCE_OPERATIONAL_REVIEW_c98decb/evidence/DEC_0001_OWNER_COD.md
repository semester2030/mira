# DEC-0001: owner decision on payment and checkout

Date: 2026-10-01
Status: accepted (owner decision, recorded here)

## Decision

1. **Products** that a partner marks `purchaseMode = internal_cod` are ordered inside Mira.
   - Payment is cash on delivery (COD) only.
   - Mira does not take, hold or refund money.
   - The partner marks the payment as collected after delivery (`paymentCollectionStatus`).
2. **Products** with `purchaseMode = external` (the default) keep the external URL.
   - Buy opens the merchant link.
   - The app says plainly that this is not a completed purchase.
3. **Services** use `payMode = pay_at_venue`.
   - The customer sends a booking *request* for a slot.
   - The partner confirms or rejects it.
   - Payment happens at the venue.
4. No online payment gateway is part of this decision.

## Consequences in the product

| Area | Behaviour |
| --- | --- |
| Buy button | Preview: «هذه معاينة ولا تنفّذ شراءً». `internal_cod`: add to cart. `external`: open the URL. Buy never takes the appointment path. |
| Delivery fee | Integer halalas. If unknown, checkout needs `acknowledgeUnknownDeliveryFee`. The fee is not invented. |
| Status | `fulfillmentStatus` and `paymentCollectionStatus` are shown separately. |
| Booking status | `requested` is shown as «غير مؤكد». Only `confirmed` is confirmed. |
| Stock | `stockQty = null` means not tracked. Public JSON exposes sellable quantity only, never `reservedQty`. |
| Idempotency | One `Idempotency-Key` per confirm session. A retry with the same payload replays the same record. |
| Cart | One partner per cart. A second partner raises `CART_PARTNER_CONFLICT` and the customer chooses. Nothing is replaced silently. |

## Out of scope

- Online payment, refunds, wallet.
- Delivery tracking and courier assignment.
- View counting stays disabled until its own policy decision.
