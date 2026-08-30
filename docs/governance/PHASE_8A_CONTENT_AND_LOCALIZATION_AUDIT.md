# PHASE 8A — Content & Localization Audit

## Confirmed public leakage
| String / pattern | Location | Risk |
|------------------|----------|------|
| `provider_measured` / `locally_calculated` via `m.source` | `skin_intelligence_section.dart` | Internal provenance |
| `SVI … version` | same | Internal version id |
| `Trends` (English) inside Arabic summary | `local_progress_builder.dart` L38 | Mixed language |
| `MCE` in CTA | `ask_mira_section.dart` | Internal engine name |
| `MIRA SKIN REPORT` Latin eyebrow | `beauty_score_hero.dart` | Brand OK; not internal |
| `concern` / severity enums | builders | Should map to public labels only |

## Public Result Language Policy (proposal)
1. Public UI may only show approved glossary terms.  
2. Forbidden: provider_*, canonical, raw=, Mapped from, projection engine names, evidence graph, runtime traces, MCE, SVI version strings, source enums.  
3. Prefer: مؤشر الحيوية، ثقة التحليل، تقدير يحتاج متابعة، خريطة إرشادية، تطابق مقترح.  
4. Disclaimers: one primary + expandable “اعرف أكثر”.  
5. Arabic-first; no mid-sentence English jargon.
