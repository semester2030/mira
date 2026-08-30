# AT-3 — Fashion Route Architecture

```
Outfit Ask Mira (flag ON)
  → MiraAdvisorScreen
  → FashionAdvisorRouteDecision.advisorFashionChat
  → AdvisorApiDataSource.chat(message, fashion)
  → POST /advisor/chat

Outfit Ask Mira (flag OFF)
  → fashionUnavailable local safe message
  → NO MCE SSE

Skin Ask Mira
  → MCE SSE (unchanged)

Atelier QEL
  → MCE SSE (unchanged)
```

Product-context routing only — client does not recreate backend NLP.
