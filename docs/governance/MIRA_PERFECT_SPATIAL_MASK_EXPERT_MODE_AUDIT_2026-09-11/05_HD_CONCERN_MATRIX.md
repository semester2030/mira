# 05 — HD Skin Concerns Matrix

## MIRA configuration signal

`.env.example` comment only:

> Comma-separated SD concerns (do not mix HD + SD)

Default / Render actions are **SD IDs** (`wrinkle`, `pore`, …) — not `hd_*`.

## HD IDs investigated

| HD id | In MIRA `dst_actions` | In MIRA source as Perfect action | Account entitled |
|-------|----------------------|----------------------------------|------------------|
| `hd_age_spot` | NO | **0** references | **NOT PROVEN** |
| `hd_pore` | NO | **0** | **NOT PROVEN** |
| `hd_wrinkle` | NO | **0** | **NOT PROVEN** |
| `hd_texture` | NO | **0** | **NOT PROVEN** |
| `hd_acne` | NO | **0** | **NOT PROVEN** |
| HD redness equivalent | NO | **0** | **NOT PROVEN** |

| Layer | State |
|-------|-------|
| Documented by Perfect (inside MIRA repo) | **UNKNOWN** — no Perfect HD Skin contract file committed |
| Available to MIRA account | **NOT PROVEN** |
| Used by MIRA code | **NO** |

**Do not mix HD+SD** note implies engineering awareness of a Perfect constraint, **not** proof of entitlement.
