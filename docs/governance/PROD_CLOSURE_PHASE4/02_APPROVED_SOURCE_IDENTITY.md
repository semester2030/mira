# Approved Source Identity

## SOURCE evidence

- Approved SHA: `a2484658aa74e10df9b2c046b065e4b823238e15`
- Local HEAD: `a2484658aa74e10df9b2c046b065e4b823238e15`
- Subject: `MIRA Phase 3C: enforce strict Fashion LLM output schema`
- Candidate identity match: `YES`
- Tracked modifications: `0`
- Staged files: `0`

The primary worktree contained pre-existing untracked governance evidence,
visual-test failures, and `mira-api/scripts/lan-forward.py`. None is in the
approved commit or deployment source. The deployable source was reconstructed
in a detached clean worktree and Render fetched the exact commit from the
remote `cursor/phase2-platform-docs-9309` ref.

Remote verification returned the exact approved SHA. The production service
continued to watch `main`; publishing the Cursor ref did not trigger an
automatic production deploy.
