# Red + Yellow + Wedding — Capability Trace

| Decision | Status | Evidence |
|---|---|---|
| Detect blouse | CAN DO (PARTIAL) | GI category/type if vision classifies tops/blouse |
| Detect skirt | CAN DO (PARTIAL) | bottoms/skirt if classified |
| Detect red | CAN DO | attributes.colors |
| Detect yellow | CAN DO | attributes.colors |
| Know wedding | CAN DO | MiraOccasion.Wedding / occasionId |
| Understand red/yellow relationship | PARTIAL | Flutter hue theory can score; API isClashPair **excludes** red–yellow |
| Evaluate formality | PARTIAL | ontology formality; garment formality NOT on CanonicalGarment |
| Evaluate wedding suitability | PARTIAL | OI ContextEngine if invoked; not on canonical analyze wire |
| Suggest calmer alternative | PARTIAL/CANNOT (structured) | MCE may invent; no citeable rule; catalog may lack red/yellow wedding SKUs |
| Explain alternative | PARTIAL | MCE narrative OR Flutter templates; no rule provenance |
| Recommend shoes/bag/jewelry | PARTIAL | catalog graph / MCE; no Nest accessory engines |
| Respect bold preference | PARTIAL | SI memory/prefs if wired; MCE not preference-policy enforced |
| Distinguish convention vs rule | CANNOT | no subjectivity typing |
| Provide provenance for advice | CANNOT for principles | — |

### Critical proof
`isClashPair` only: red–pink, orange–red, green–red — **red–yellow is not a Nest soft clash**.
