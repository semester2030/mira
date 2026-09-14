# FK-11 — Documentation Truth Audit

| Claim | Docs (FK-10) | Code truth |
|-------|--------------|------------|
| Advisor Integration READY | Stated | **Overstated** — stub only on HTTP |
| Claim Lock before Advisor projection | Stated for path | True in library; **not** on `/advisor/chat` |
| MCE quarantine | Stated | True **only when flag ON** |
| ACTIVE=0 | Stated | **True** |
| No auto-promotion | Stated | **True** |
| Ready for FK-11 then freeze | Implied A path | Freeze **not** ready |

**Finding MAJOR:** governance readiness language does not match production wiring evidence.
