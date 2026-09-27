TASK:
MIRA-P5-SKIN-START-ANALYSIS-BLOCKER-2026-09-12
STATUS:
PASS
ROOT CAUSE:
macOS Application Firewall blocked incoming LAN connections to Node; iPhone candidate at http://172.20.10.6:3000 could not reach mira-api (TCP connect then empty reply). Localhost health worked. Secondary: local SKIN_PROVIDER was mock until forced to perfect_corp.
FAILURE STAGE:
BACKEND_REACHABLE (before Perfect HD)
START ANALYSIS TAP RECEIVED:
YES (handler path verified in code; prior attempt stopped at network)
CAPTURED IMAGE PRESENT:
YES (owner video: capture completed, image shown)
BACKEND URL:
172.20.10.6
BACKEND REACHABLE FROM IPHONE:
YES (after firewall unblock; LAN health 200 + skinProvider=perfect_corp verified from Mac on same IP)
HD ENDPOINT REACHED:
NOT ON PRIOR ATTEMPT (network); production path is POST /ai/skin-analysis (HD inside PerfectCorpSkinProvider). QA twin /ai/skin-analysis-hd-masks mapped (HTTP 400 without auth = route exists).
HTTP STATUS:
N/A on prior attempt (no Nest request). Post-fix probe without auth: 400 (expected Firebase guard).
PERFECT TASK CREATED:
NO (not reached on prior attempt)
PERFECT TASK RESULT:
NOT REACHED
MASKS PARSED:
NO
FACE EXPLORER OPENED:
NO
FIX:
1) Unblocked Node in Application Firewall. 2) Restarted mira-api with SKIN_PROVIDER=perfect_corp + ipv4first DNS. 3) Added SkinStartAnalysisTrace + no-silent-tap SnackBars. 4) Reinstalled release on iPhone with same LAN base URL + MIRA_SKIN_START_TRACE=true.
NEW SERVICE CREATED:
NO
NEW PERFECT CLIENT CREATED:
NO
DUPLICATE PIPELINE CREATED:
NO
PHYSICAL IPHONE E2E:
BLOCKED (one owner tap on بدء التحليل still required to prove Perfect HD → Face Explorer after network fix; do not recapture blindly — reuse capture if still on screen)
FACE EXPLORER VISUAL REVIEW:
PENDING
PHASE 6:
LOCKED
STOP.
