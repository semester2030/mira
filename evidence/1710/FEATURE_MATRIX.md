# Feature matrix — 1710

Legend: `PASS` = exercised this pass with evidence | `UNTESTED` | `OPEN` = known open | `PRIOR` = pre-existing

| Path | Status | Evidence |
|---|---|---|
| App entry | UNTESTED | |
| Home / Discover orbit | UNTESTED | Device user |
| Sections / circles / labels | UNTESTED | |
| Search / filters | UNTESTED | |
| Vertical video swipe | OPEN | Perf open since 1708 device |
| Horizontal media + dots | UNTESTED | Widget fling blocked by chrome hit-test |
| Image slides | UNTESTED | |
| Share / favorite / views | UNTESTED | |
| Details / cart / buy / book | UNTESTED | Intent unchanged |
| Location | UNTESTED | |
| Face camera | UNTESTED | Must keep working |
| Body capture disabled | UNTESTED | Must stay disabled |
| Outfit analysis | UNTESTED | |
| Advisor | UNTESTED | |
| Partner portal ≤3v+10i E2E publish→app | UNTESTED | Caps in code; live journey not run |
| Admin portal | UNTESTED | |
| Unit disk cache (incl. persist/HEAD/unify/lock) | PASS | `raw/flutter_test_disk_1710c.log` exit 0 |
| Unit AssetVideoPort A→image→A | PASS | `raw/flutter_test_port_1710c.log` |
| Screen-sync ownership pattern | PASS | `discover_sync_video_a_image_a_test.dart` |
| DiscoverPresentationScreen horizontal fling | UNTESTED | Chrome overlays intercept test hits |
| API health | PASS | curl 200 `mira-api-n4p3.onrender.com` |
| Install identity | PASS | See SOURCE_IDENTITY / install log |

Body capture remains intentionally disabled (no change this pass).
