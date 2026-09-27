# Privacy and cost

## Privacy

- PERSISTENT FACE STORAGE = 0
- PERSISTENT MASK STORAGE = 0
- ZIP excludes face images and mask PNGs
- Ephemeral session path: `/tmp/mira_hd_ephemeral_session.json` (local RAM/tmp only)
- Signed provider URL query params redacted; ZIP evidence uses hostname-only hosts

## Cost / units

- Units consumed: **unknown** (Perfect account tooling did not expose unit counters in this path)
- HD analyses executed this acceptance: **2**
  1. First successful proof (foundation)
  2. Justified re-run with `MIRA_HD_EPHEMERAL_SESSION=1` to materialize iPhone technical viewer (first proof did not retain mask bytes after URL redaction)
- Do not treat NOT RUN as failure; both runs returned task_success with all four core masks
