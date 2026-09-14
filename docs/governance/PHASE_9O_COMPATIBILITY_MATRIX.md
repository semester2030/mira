# PHASE 9O — Compatibility Matrix

| Dependency | Compatibility |
|---|---|
| Face Intelligence v1.0.0 | CONSUME-ONLY |
| AI Beauty Advisor v1.0.0 | CONSUME-ONLY · Envelope Law #33/#34 |
| Skin report / MiraBeautyReport storage | Face embedded in stored miraReport; history reuses SkinAnalysisRepository |
| Flutter Face Experience package | `face-experience-compat-v1` |
| API `AdvisorFaceContextDto` | accepts legacy free text; ignores as evidence |
| Legacy capture / beauty report / MCE | coexist when flags OFF |
| Results V2 | separate flag path; not Face Experience activation |
