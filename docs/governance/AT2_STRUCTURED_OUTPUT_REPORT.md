# AT-2 — Structured Output

Mechanism: Chat Completions + `json_object` + strict post-parse (`parseOpenAiFashionDraftJson`).
Success path requires parseable FashionAdviceCandidateDraft shape.
Malformed / empty / CoT leakage fields → `malformed` fail-closed.
Enum legality enforced by FK-3 `validateFashionLlmDraft`.
