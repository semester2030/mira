# MIRA-P5-SKIN-START-ANALYSIS-BLOCKER-2026-09-12

## Root cause (proven)

1. **PRIMARY — iPhone backend unreachable:** macOS Application Firewall had **blocked incoming connections to Node**. Candidate base URL `http://172.20.10.6:3000/api/v1` accepted TCP then returned empty reply. Localhost health worked; LAN did not. Nest never saw iPhone requests.

2. **SECONDARY — would block Perfect HD after connectivity:** Local runtime was on `SKIN_PROVIDER=mock` (health `integrations.skinProvider=mock`). Forced restart with `SKIN_PROVIDER=perfect_corp`.

## Failure stage

`REQUEST_STARTED` → **BACKEND_REACHABLE = NO** (firewall) before Perfect HD.

## Exact button path (code)

`بدء التحليل` → `_startSignedInAnalysis` / `_runGuestAnalysis` → `StartSkinAnalysis` → `SkinAnalysisBloc` → `SkinAnalysisRepositoryImpl` → `SkinAnalysisApiDataSource.analyzeAndSave` → **POST `/ai/skin-analysis`** (production HD path via PerfectCorpSkinProvider; technical `/ai/skin-analysis-hd-masks` also mapped) → Perfect HD → parse → `PerfectMaskSession` → report navigation.

## Fix applied

1. Unblocked Node in Application Firewall (`Incoming connection … is permitted`).
2. Restarted mira-api with `SKIN_PROVIDER=perfect_corp` + `NODE_OPTIONS=--dns-result-order=ipv4first`.
3. Temporary `SkinStartAnalysisTrace` (dart-define `MIRA_SKIN_START_TRACE=true`) — no tokens/keys/face bytes.
4. Dead-tap guards: empty capture / lock now show explicit SnackBar (no silent return).
5. Reinstalled release candidate on physical iPhone with same LAN base URL + trace.

## Note

Production consumer endpoint remains `/ai/skin-analysis` (HD inside provider). `/ai/skin-analysis-hd-masks` is QA/acceptance only.
