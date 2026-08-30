# PHASE 9O — Technical Debt Register (Accepted)

| ID | Description | Why accepted | User impact | Remediation trigger | Class |
|---|---|---|---|---|---|
| TD-FACE-01 | CapturePanel full-tree rebuild | Perf debt; not correctness | Possible jank on weak devices | activation QA / crash/jank reports | PATCH |
| TD-FACE-02 | Image hold silent-fail → placeholder | UX residual | Missing continuity image | activation QA | PATCH |
| TD-FACE-03 | Historical image placeholder | No parallel selfie store by design | History without photo | product decision | PATCH/MINOR |
| TD-FACE-04 | Legacy MCE Ask Mira coexistence | Flags OFF preserve legacy | Confusion if users hit legacy path | activation | activation track |
| TD-FACE-05 | Client-controlled evidenceStale | Pre-9M design; not claim forgery | Under-report stale possible | security/activation CR | MINOR/PATCH harden |
| TD-FACE-06 | nest build Fashion schema-test TS errors | Unrelated pre-existing | CI noise | Fashion owners | OUT_OF_SCOPE Face |
| TD-FACE-07 | Capture Law #40 tabular manifest incomplete | Enum+manifests elsewhere | Audit friction | CR | PATCH docs/code |
