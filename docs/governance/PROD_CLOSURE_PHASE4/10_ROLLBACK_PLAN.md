# Rollback Plan

## DEPLOYMENT evidence

- Rollback deploy ID: `dep-da5pb995efls73c3gl2g`
- Rollback source SHA: `dca189cdd42f73d63ac3a4ac3ee00471151c6e98`
- Source availability: remote `main`, verified
- Method: Render explicit-commit deploy to the existing service
- Command form: `render deploys create <service> --commit <rollback-sha> --wait`
- Expected time category: minutes / normal Render build-and-start cycle
- Database-state change: `NO` candidate migration difference

The installed Render CLI explicitly exposes `--commit`, and the previous
source/deploy are visible in deploy history.

- `ROLLBACK_TARGET_IDENTIFIED = YES`
- `ROLLBACK_METHOD_AVAILABLE = YES`
- Rollback execution during Phase 4A: `NO`
