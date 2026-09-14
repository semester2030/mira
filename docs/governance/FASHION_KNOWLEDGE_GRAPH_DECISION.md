# FK-1 — Knowledge Graph Decision

**Decision: D — FKG remains later optimization**

- Primary store = versioned rules registry
- Optional graph **projection** for related rule discovery (B later)
- Existing Flutter `knowledge_graph.json` is **catalog SKU graph**, not platform FKG

Rationale: provenance + claim lock fit rules better than edge weights alone.
