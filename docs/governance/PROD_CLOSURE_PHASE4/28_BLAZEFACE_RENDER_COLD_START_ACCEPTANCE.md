# BlazeFace Render Cold-Start Acceptance

Render job: `job-daaocrgae00c73aekm5g`

The job started a fresh isolated process from the current production image;
the web service was not restarted.

Evidence:

- cold process: true
- production startup preload invoked: true
- TFHub/model dependency resolved: PASS
- model state: `AVAILABLE`
- observed preload: 1,570 ms
- configured timeout: 20,000 ms
- cache: process memory
- dedicated load-failure simulation: HTTP 503
- failure code: `face_detector_unavailable`
- fabricated Face result on failure: false

This provides dedicated cold-process evidence without production interruption.

- `BLAZEFACE_COLD_PROCESS = PROVEN`
- `BLAZEFACE_MODEL_PRELOAD = PASS`
- `BLAZEFACE_HEALTH = AVAILABLE`
- `BLAZEFACE_FAIL_CLOSED = PASS`
