# FK-3 — Context Projection

`projectFashionLlmContext` copies only public-safe garment/outfit/preference fields.
Rejects garments carrying rawProviderPayload / decisionLedger / evidenceGraphBody.
Does not import frozen fashion-intelligence modules.
