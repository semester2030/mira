# Provider Capability Matrix

Source of truth: `mira-api/src/beauty-experience/provider-manager/provider-matrix.ts`

Each row: capability × provider → supported, modes, realtime, offline, cost, priority, feature flag, required assets.

Flutter never reads this matrix. Clients request **capabilities** only.
