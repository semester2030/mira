# MIRA Production Closure — Phase 1 Commerce Security Audit

Captured: 2026-08-30

## Scope

This closure is intentionally bounded to subscription and partner production
integrity. It does not add a payment product, implement store verification,
change schema or secrets, deploy, or alter Render configuration.

## Closed findings

1. **Unsigned subscription webhook appeared successful and reflected input.**
   `POST /subscriptions/webhook` now fails closed with HTTP 501. Its handler
   accepts no body argument, performs no mutation, and returns no request data.
2. **Production could start with local commerce bypasses.**
   The existing startup integrity gate now treats `AUTH_SKIP=true` and
   `PARTNER_AUTO_APPROVE=true` as fatal production configuration errors.
3. **Development premium activation could mutate production entitlement.**
   The backend rejects the dev activation path before user lookup or subscription
   mutation when `NODE_ENV=production`. The Flutter CTA remains debug-only and
   its API data source also rejects non-debug builds.
4. **Public partner application status disclosed a login credential.**
   The public status service no longer loads partner users or returns
   `accessToken`. The status page no longer renders, stores, or uses that token;
   approved applicants are directed to the separately controlled communication
   channel.
5. **Owner-scoped partner CRUD was preserved.**
   Product and service update/delete paths retain the existing
   `id + partnerId` ownership lookup before mutation. A focused cross-owner
   product-update test asserts that no update occurs.

## Adversarial checks added

- Production integrity rejects `AUTH_SKIP=true`.
- Production integrity rejects `PARTNER_AUTO_APPROVE=true`.
- An attacker-controlled webhook payload results in `NotImplementedException`
  and is not returned.
- Production dev-premium activation fails before user lookup or database update.
- Approved public application status does not contain `accessToken`, even if a
  mocked related partner user contains one.
- Cross-owner product update is rejected before mutation.

## Verification

- IDE diagnostics on all changed TypeScript files: no errors.
- Focused TypeScript compile of the four changed production backend files:
  passed.
- Emitted Phase 0 integrity schema suite: passed, 12 checks.
- Focused runtime adversarial checks against emitted backend code: passed,
  2 subscription checks and 2 partner/ownership checks.
- `npm run build`: passed after the Phase 1 test double was made type-safe.
- `npx tsc -p tsconfig.build.json --noEmit`: passed.
- `phase-prod-closure1-commerce-security.schema-tests`: passed against emitted
  backend code.
- Focused Jest specs could not be executed because this repository has no local
  Jest executable or test script. The focused specs were added and are covered
  by static IDE diagnostics.

## Remaining risks and release gates

- The webhook is deliberately unavailable. Real commerce must remain disabled
  until provider signature verification, replay protection, event validation,
  idempotency, and auditable entitlement reconciliation are implemented and
  tested.
- Partner approval credentials are still returned by the authenticated/admin
  approval operation and by successful credential login, as required by the
  existing flow. They are no longer available through public status lookup.
- Status tokens remain bearer links. They disclose application metadata and
  approved login email, so expiry/rotation and response minimization remain
  future hardening items.
- Source identity remains a separate release blocker because the working tree is
  not a clean immutable release baseline.
