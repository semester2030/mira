# PHASE 9O — Activation Rollback Policy

Runtime kill order (conceptual):
1. Set all `MIRA_FACE_*_V1` OFF (or remote config equivalent)
2. Confirm legacy capture/report paths
3. If needed, revert release containing activation wiring

Separate from architecture freeze rollback.
