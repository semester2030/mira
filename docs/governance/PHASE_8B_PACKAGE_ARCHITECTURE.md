# PHASE 8B — Package Architecture

```
lib/features/results_experience/
  contracts/       # public-safe VMs + enums
  semantics/       # score semantics contract
  visibility/      # first-surface + advice ownership
  localization/    # personalization, confidence, language policy
  projection/      # input, projector, MiraBeautyReport adapter
  validation/      # fail-closed validators
  versioning/      # presentation version ids
  flags/           # mira_results_experience_v2
  laws/            # #35 #36
  results_experience.dart
```

Ownership: Results Experience owns presentation projection only.  
Does not own Skin/Face/Fashion/Advisor intelligence.
