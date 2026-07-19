# AI Beauty Advisor v1.0.0 — Compatibility Matrix

**Freeze date:** 2026-07-19  
**Compat pin:** `advisor-compat-v1`

| Peer / Consumer | Compatibility | Notes |
|-----------------|---------------|-------|
| **Skin Intelligence v1.0.0** | **Compatible (consumer)** | Public report / summary projection; never re-evaluates |
| **Face Intelligence v1.0.0** | **Forward-compatible** | Route exists; Canonical projection thin (accepted debt) |
| **Wardrobe Foundation v1.0.0** | **Forward-compatible** | Refs / bind actions only |
| **Garment Intelligence v1.0.0** | **Forward-compatible** | Route + provenance-gated Canonical claims only |
| **Outfit Intelligence v1.0.0** | **Forward-compatible** | Must not label legacy MCE outfit as OI |
| **Styling Intelligence v1.0.0** | **Compatible (consumer)** | Narrates Canonical Style facts via envelope only |
| **Beauty Experience** | **Activation Ready (sibling)** | Action routing only; no BE internals |
| **Future Recommendation Engine** | **Forward-compatible (separate owner)** | Shopping/reco out of Advisor scope |
| **MCE consultation** | **Coexistence** | Separate surface; not replaced by this freeze |

## Breaking compatibility triggers

- Weakening Law #33 / #34  
- Grounded narration of stale evidence  
- False frozen-subsystem attribution  
- Implementing evaluation inside Advisor
