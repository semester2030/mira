# Independent lanes + Discovery Motion — acceptance status

## Commit / build
- Worktree: `mira-wt/elegance-e1` · branch `mira/elegance-e1-taxonomy-foundation`
- Base HEAD: `a15f3b5` — lane + motion fixes **uncommitted** on top (**not** `9690bb8`)
- App: `1.0.0+2026110301`

## Fixes
1. Jewelry sim / Failed-to-fetch: labeled allowlist + static `phase2-taxonomy` fallback; clear stale banners on inactive `serviceForm`.
2. Occasions→beauty: `event_planner` in `usesCatalogAsServices()`; form-scoped service orbs; occasions-only filter.
3. Motion: real `mira_world_orbit_discover.dart` — `0.316` orbs, no ring, press + logo fill (see motion_merge/).

## Local verified
- `verify_lane_entries_smoke.mjs` → PASS (jewelry orbs, occasions orbs=`occasions`, no beauty leak, no visible sim/fetch error)
- Flutter taps + orbit captures 320/390/430 → passed

## Not closed (do not mark shipped)
- Live partner save → app section filter → buy/book
- iPhone run (disk full during Xcode)
- Production deploy (Render workspace not selected in MCP)
