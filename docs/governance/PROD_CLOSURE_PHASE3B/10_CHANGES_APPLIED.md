# Phase 3B — Changes Applied

## Production safety changes

1. Perfect Corp: strict required score validation; all synthetic score
   backfills removed.
2. Fashion: all legacy scored paths disabled in production, unsafe escape hatch
   made fatal, canonical Vision path preserved.
3. Avatar: canonical owner-scoped object path plus matching MIME/size rules and
   client metadata.
4. BlazeFace: bounded production startup preload, explicit failure and
   non-secret runtime state.
5. Redis: critical counters fail closed, quota/rate errors map to 503, canonical
   paid-provider routes are guarded, optional FAQ cache remains best-effort.

## Test and governance additions

- four backend adversarial schema suites;
- Flutter avatar contract test;
- isolated Firebase Auth/Storage emulator test and config;
- Phase 3B governance set and Technical Reference closure data;
- documented startup timeout environment contract.

## Not changed

No Render/Firebase deployment, secret/environment mutation, database schema or
migration, subscription, paid provider call, real user upload, production data
write, global feature activation, mobile publishing, provider scoring law,
frozen Skin/Face/GI/OI/Styling/FK/Advisor engine, or large model artifact.
