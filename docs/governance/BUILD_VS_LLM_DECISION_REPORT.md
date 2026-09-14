# Build vs LLM Decision Report

| Option | Speed | Quality consistency | Hallucination | Explainability | Provenance | Cost | Frozen impact |
|---|---|---|---|---|---|---|---|
| 1 LLM raw 12mo | Fast | Low | High | Low | None | High variable | Low code, high product risk |
| 2 LLM + strict frozen evidence | Medium | Medium | Controlled if enforced | Medium | Envelope only | Medium | Additive validators |
| 3 Structured KB now | Slower | High | Low | High | High | Build cost | Additive layer |
| 4 Hybrid LLM now + telemetry → KB | Fast start | Improves | Needs hard validators ASAP | Improves | Evolving | Medium | Best migration |

## Recommendation
**Option 4 with immediate Option-2 controls:** keep MCE for narrative only if claim-locked; start curated KB for color×occasion×accessory; do not reopen frozen GI/OI/SI.
