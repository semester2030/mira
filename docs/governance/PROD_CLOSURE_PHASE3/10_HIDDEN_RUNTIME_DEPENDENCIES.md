# Phase 3 — Hidden Runtime Dependencies

| Dependency | Trigger | Cold/offline behavior | Timeout/cache | Criticality |
|---|---|---|---|---|
| TensorFlow Hub BlazeFace model | first server face-gate call invokes package `blazeface.load()` | remote model download; failure prevents detector initialization and image analysis path | no application timeout or durable bundled cache; direct probe timed out | PRODUCTION_CRITICAL |
| Google ML Kit Face/Pose | Flutter capture validation | on-device SDK / Android Play Services dependency; offline/device availability varies | plugin-managed | FEATURE_CRITICAL |
| MediaPipe Face Mesh | client live face mapping | on-device package | plugin-managed | FEATURE_CRITICAL |
| Firebase Auth endpoints | OTP/login/token refresh | login unavailable offline | SDK-managed | PRODUCTION_CRITICAL |
| Firestore | profile/stats | profile updates/streams fail; some auth flow degrades | SDK-managed | FEATURE_CRITICAL |
| Firebase Storage | avatar | avatar upload fails | SDK-managed | OPTIONAL |
| Google Fonts CDN | static sites | fallback font | browser cache | OPTIONAL |
| external marketplace URLs | user taps product | external browser/site may fail | none | OPTIONAL |
| `mira.app` | privacy/support links | legal/support links fail | none | RELEASE_RELEVANT |
| package registries | build/install only | no runtime impact after built | lockfiles | BUILD_ONLY |

BlazeFace package code resolves its default model from
`tfhub.dev/tensorflow/tfjs-model/blazeface/...`; the application does not pass a
local model URL. A safe 20-second retrieval probe returned timeout/HTTP `000`.
This proves neither a vendor outage nor Render egress failure, but it disproves
current reachability proof and exposes an unbounded cold-start dependency.

No runtime CDN fonts are used by Flutter; app fonts and Fashion JSON are
bundled. No SMTP, maps, push sender or remote-config runtime was found.
