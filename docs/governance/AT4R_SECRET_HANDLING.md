# AT-4R — Secret Handling

## Method (repository convention)
1. Copy `mira-api/.env.qa.example` → `mira-api/.env.qa` (gitignored).
2. Set `LLM_API_KEY` on the developer machine only.
3. Load with `set -a && source scripts/at4r-export-qa-env.sh && set +a`.
4. Or run `npm run at4r:live` (loads `.env.qa` internally).

## Allowed alternatives
- Shell export: `export LLM_API_KEY=...` (session-only)
- Existing local `.env` (also gitignored) — not preferred for QA flags mixed with day-to-day Nest

## Forbidden
- Committing `.env.qa` / `.env` / keys
- Printing key values in logs, docs, CI output, proof JSON
- Copying production Render secrets into the repo

## Gitignore coverage (verified)
- Root: `mira-api/.env.qa`, `mira-api/.env.local`
- `mira-api/.gitignore`: `.env.qa`, `.env.local`

## Presence check (this machine)
`LLM_API_KEY` = **MISSING**
