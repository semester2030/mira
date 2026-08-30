# Phase 3B — Fashion Provider Reachability

| Entry point | Production reachable | Auth | Provider | Failure behavior before 3B | Mock/synthetic possible | Current caller |
|---|---|---|---|---|---|---|
| `POST /ai/vision/outfit/analyze` | YES | Firebase | `FASHION_PROVIDER=vision_platform`: FASHN + OpenAI | explicit provider/config/quality error | NO | primary Flutter |
| `POST /ai/vision/outfit/recolor` | YES | Firebase | FASHN Edit | explicit failure/QEL rejection | NO | Flutter recolor |
| `POST /ai/outfit-segmentation` | YES | Firebase | FASHN geometry | explicit failure; trust gate rejects unusable output | no score synthesis | Flutter support path |
| `POST /ai/outfit-analysis` and alias | YES | Firebase | `OUTFIT_PROVIDER` | mock blocked only when selector is mock; `fashn` adapter falls back to mock/defaults | YES | legacy repository/history |
| `POST /ai/full-mira-analysis` | YES | Firebase | delegates legacy outfit service | same legacy behavior | YES | no caller found |
| `POST /ai/outfit-intelligence` | YES | Firebase | Vision + LLM | deterministic visual and analysis fallbacks | YES | endpoint constant only |
| mock providers directly | DI only | N/A | test/dev | return fixtures/scores | YES | tests/dev |

The canonical Fashion path already fails closed for missing credentials,
401/403/429/5xx, timeout, malformed/empty provider output, quality rejection
and invalid provider selection.

Residual production risks:

1. `FashnOutfitProvider` converts missing configuration and every request error
   to `MockOutfitAnalysisProvider`; malformed success also receives defaults.
2. `OutfitHybridIntelligenceService` converts Vision/LLM failures to
   deterministic scores.
3. `ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD=true` can bypass the legacy mock block.

## Minimal remediation design

- disable every legacy outfit-analysis provider path in production regardless
  of selector or escape hatch;
- make the escape hatch a fatal production-integrity error;
- disable hybrid outfit intelligence in production before any provider call;
- preserve mocks and deterministic fixtures in development/test;
- do not alter Vision, GI, OI, Styling, FK, Claim Lock or Advisor laws.

Result required: `SYNTHETIC_PRODUCTION_SUCCESS = 0`.
