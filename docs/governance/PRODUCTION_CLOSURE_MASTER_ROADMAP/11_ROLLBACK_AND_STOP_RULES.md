# Rollback and Stop Rules

Stop immediately when:

1. source identity changes unexpectedly;
2. a secret/token/private key is exposed;
3. provider failure becomes a successful-looking AI result;
4. critical Redis is unavailable or bypassed;
5. deployment identity cannot be proven;
6. real E2E fails—do not enter release closure;
7. iOS/Android artifacts cannot be reproduced—do not enter GO-LIVE;
8. any P0 security blocker remains—final verdict is NO-GO;
9. unauthorized billing, production mutation or customer data would be needed.

Phase 4 must preserve and test a rollback path before continuation. Severity
determines whether rollout is halted or rolled back immediately, but failure is
never hidden. Later-phase blockers return to the responsible prior phase.

At every phase end:

`STOP → PACKAGE EVIDENCE → WAIT FOR OWNER REVIEW → EXPLICIT NEXT-PHASE APPROVAL`

Cursor must never transition automatically.
