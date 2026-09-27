# 06 — NEXT ACTION

1. **Do not** change lighting/size/pose thresholds.
2. Isolate **one** Mira frame-path variable against the proven sample baseline:
   - Prefer: feed CameraKit from a native AVCapture FullRange path (or prove VideoRange expand is lossy via A/B meanY + lighting labels).
3. Re-run the same sample→Mira sequential matrix after that single change.
4. Only then consider orientation/mirror/crop if format A/B does not close the gap.

No SDK vendor ticket required yet — Case A points to Mira integration, with enough local reproduction.
