# Phase 3C Final — Existing Production Configuration Diagnostic

Date: 2026-08-31

Mode: read-only. No deployment, environment mutation, secret extraction,
provider request or infrastructure provisioning was performed.

## Render access root cause

- Render MCP `list_workspaces`: `unauthorized`;
- Render MCP reauthentication: reported success;
- post-reauth `list_workspaces`: still `unauthorized`;
- MCP selected workspace: none;
- MCP direct `get_service` for the known MIRA service: `unauthorized`;
- Cursor browser Render Dashboard session: absent (login page);
- local Render CLI: v2.23.0, authenticated;
- local CLI config: present, mode `0600`;
- local CLI active workspace: authenticated and contains `mira-api`;
- `mira-api`: exists, repository-linked, Node runtime, not suspended.

Therefore the earlier blanket Render UNKNOWN was caused by the Render MCP /
Dashboard audit context lacking workspace visibility, not by absence of the
MIRA Render service.

`RENDER ACCESS ROOT CAUSE = TOOL_PERMISSION_LIMITATION`

The authenticated CLI can enumerate service/datastore metadata, but its
read-only commands do not expose environment variable names. No token was read
or repurposed to bypass that limitation.

## Existing configuration and infrastructure

| Item | Verified state | Evidence boundary |
|---|---|---|
| Render API service | EXISTS_CONFIRMED | CLI metadata; repo-linked and active |
| Perfect configuration | CONFIG_PRESENT | live health selects `perfect_corp` and reports key set; base/adapter contract in source |
| FASHN configuration | UNKNOWN_DUE_TO_ACCESS | Blueprint contract exists; live env names unavailable |
| LLM configuration | UNKNOWN_DUE_TO_ACCESS | Blueprint contract exists; live env names unavailable |
| Firebase project | EXISTS_CONFIRMED | authenticated Firebase CLI |
| Firebase registered apps | EXISTS_CONFIRMED | 7 apps visible in configured project |
| Firebase Admin | CONFIG_INCOMPLETE | live backend has project ID/verification path; credential validity not inspected |
| Firebase Auth provider state | UNKNOWN_DUE_TO_ACCESS | project/apps exist; provider-console state not visible |
| Firebase Storage config | CONFIG_PRESENT | client bucket and rules path configured |
| Firebase Storage bucket/rules deployment | UNKNOWN_DUE_TO_ACCESS | unauthenticated endpoint returned 4xx/404; exact state cannot be distinguished safely |
| PostgreSQL | EXISTS_CONFIRMED | Render `mira-db` available plus prior live Prisma read |
| Render Key Value | NOT_FOUND | authenticated active workspace lists zero Key Value resources |
| External Redis via `REDIS_URL` | UNKNOWN_DUE_TO_ACCESS | live environment names unavailable |
| BlazeFace config | CONFIG_PRESENT | pinned dependency, bounded default and explicit strategy; env override optional/unknown |

The absence of a Render-managed Key Value resource does not prove all
production Redis is absent: `REDIS_URL` could point to an external service.
The correct aggregate classification remains:

`REDIS_UNKNOWN_DUE_TO_ACCESS`

## Previous blocker reclassification

| Blocker | Classification |
|---|---|
| Render service existence | EXISTS_AND_VISIBLE |
| Render environment-variable presence | EXISTS_BUT_NOT_VISIBLE_TO_CURSOR |
| Perfect configuration | EXISTS_AND_VISIBLE |
| Perfect real response | ACCEPTANCE_TEST_ONLY_REMAINING |
| FASHN configuration | EXISTS_BUT_NOT_VISIBLE_TO_CURSOR |
| LLM configuration | EXISTS_BUT_NOT_VISIBLE_TO_CURSOR |
| valid Firebase identity | ACCEPTANCE_TEST_ONLY_REMAINING |
| Storage rules deployment state | EXISTS_BUT_NOT_VISIBLE_TO_CURSOR |
| production Redis wiring | EXISTS_BUT_NOT_VISIBLE_TO_CURSOR |

- confirmed actually missing production services: `0`;
- visibility-caused prior blockers: `5`;
- acceptance-test-only items: `2`.

This diagnostic does not alter the Phase 3C Final verdict or website.
