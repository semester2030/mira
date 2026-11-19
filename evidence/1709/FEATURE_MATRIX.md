# Feature protection matrix — 1709

Legend: `OK` exercised this pass | `PRIOR` known pre-existing | `UNTESTED` not run this pass | `REG` new regression (none allowed to ship unresolved)

| Path | Status | Notes |
|---|---|---|
| App entry / splash | UNTESTED | |
| Home / Discover orbit | UNTESTED | Device user will exercise video |
| Sections / circles / labels | UNTESTED | |
| Search / filters | UNTESTED | |
| Vertical video swipe | UNTESTED | Open perf issue |
| Horizontal media swipe + dots | UNTESTED | Code path present; device pending |
| Images in gallery | UNTESTED | |
| Share / favorite / views | UNTESTED | |
| Details / cart / buy / book | UNTESTED | Intent: unchanged |
| Location | UNTESTED | |
| Face camera | UNTESTED | Must keep working |
| Body capture (disabled) | UNTESTED | Must stay disabled |
| Outfit analysis | UNTESTED | |
| Advisor | UNTESTED | |
| Partner portal media ≤3v+10i | UNTESTED | Caps in code from 1708; E2E publish pending |
| Admin portal | UNTESTED | |
| Unit: disk cache + video port | OK | flutter test green |
| Build identity | OK | `1.0.0+2026111709` |

Any new regression found on device → fix causing commit before expanding scope.
