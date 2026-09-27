# Phase 3C — Perfect Corp Acceptance

## Revalidated contract

- production selector: `SKIN_PROVIDER=perfect_corp`;
- adapter: `PerfectCorpSkinAdapter` → `PerfectCorpService`;
- flow: File API → object upload → task creation → bounded polling → strict
  mapper → canonical Skin port;
- required credential name: `PERFECT_API_KEY`;
- configured base URL is versioned YouCam S2S v2.0;
- Phase 3B requires eight finite `ui_score` fields and rejects incomplete
  results without synthetic replacement.

## Configuration/account evidence

- local ignored environment credential: `MISSING`;
- live health credential-presence boolean: `PRESENT`;
- live selector: Perfect Corp;
- vendor edge: reachable (`HTTP 404` at unauthenticated S2S root, 1501 ms);
- Render workspace/account inspection: unauthorized;
- account, product entitlement, quota, billing and license: `UNKNOWN`.

## Real acceptance

A paid analysis was not sent. The live credential is not available to the
approved local harness, and no dedicated Firebase test identity exists for a
safe live MIRA request. Creating a customer-like production identity or asking
the owner to transmit a key would violate the acceptance boundary.

- real request: `NOT_TESTED`
- real response: `NOT PROVEN`
- canonical real mapping: `NOT PROVEN`
- mock used: `NO`
- provider calls: `0`

Phase 3B adversarial coverage reran successfully, including incomplete,
malformed, HTTP, timeout and partial-result behavior.

## Verdict

`BLOCKED_OWNER_ACTION`

Required: verify the existing account/product/quota/license in the vendor
dashboard and expose the existing credential only through an approved secure
non-production acceptance environment or provide a dedicated test identity for
the existing live API. Do not purchase or upgrade anything.
