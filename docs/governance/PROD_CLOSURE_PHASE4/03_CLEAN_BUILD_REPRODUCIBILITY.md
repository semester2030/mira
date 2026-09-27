# Clean Build Reproducibility

## BUILD evidence

Detached worktree: `/tmp/mira-p4a-clean`

Verified sequence from the approved SHA:

1. `npm ci --ignore-scripts` using committed `package-lock.json`
2. `npx prisma generate`
3. `npm run build` (`nest build`)
4. `git status --short`
5. `git rev-parse HEAD`

Result:

- Dependency installation: `PASS` (541 locked packages)
- Prisma Client generation: `PASS` (v6.19.3)
- TypeScript/Nest production build: `PASS`
- Clean source status after build: `PASS`
- Final clean-worktree SHA: approved SHA
- `CLEAN_CHECKOUT_BUILD = PASS`

No dependency upgrade or audit remediation was performed. Existing npm
advisories were observed but are not a Phase 4A deployment stop condition.
