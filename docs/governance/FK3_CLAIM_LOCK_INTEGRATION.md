# FK-3 — Claim Lock Integration

`runFashionKnowledgeLlm` always calls `evaluateFashionClaimLock` after successful map.
No bypass, no trusted-LLM mode, no debug shortcut.
`audit.claimLockInvoked` must be true for successful draft paths.
