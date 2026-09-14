# FK-4 — Security Report

- Trusted only after validation
- Malformed JSON rejected
- Oversized / script-like payloads rejected where checked
- No eval / no executable rule text
- Path traversal blocked for file refs
- Fake provenance / invalid ids fail validation
- Production loader rejects TEST_ONLY leakage
