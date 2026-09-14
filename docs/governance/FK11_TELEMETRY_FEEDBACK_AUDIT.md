# FK-11 — Telemetry / Feedback Audit (FK-9)

- Flag default false; bridge records only if telemetry enabled
- Consent: `DOCUMENTED_GAP` — no runtime consent gate if flag forced true (**CRITICAL if enabled in prod without consent**)
- Law #39: like≠true enforced in policy/tests
- Telemetry has no Registry write surface (asserted)

While telemetry remains default-off, production safety holds; enabling without consent is a critical policy failure mode.
