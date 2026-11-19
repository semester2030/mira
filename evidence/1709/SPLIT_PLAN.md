# Split plan — manual source >700 LOC (video-first)

Organizational target: manual source usually <700 lines. Split by responsibility, not by line count. Separate extract commits from behavior commits.

## Portal load path (single source)

| File | Role |
|---|---|
| `partners-portal/web/js/catalog-journey.js` | **Canonical** source |
| `partners-portal/web/js/catalog-journey.bags1.js` | Legacy alias — must stay byte-identical (`sync-catalog-journey-alias.sh`) |
| `partners-portal/web/dashboard.html` | Loads **catalog-journey.js** (as of 1709) |
| Probe HTML (`rc5`–`rc8`) | Already loads `catalog-journey.js` |

## Batch 0 — video/media (do before broad refactors)

| File | Why large | Keep in place | Extract to | Risk |
|---|---|---|---|---|
| `presentation_video_port.dart` (~1519) | Player lifecycle + audio + warm/park + settle metrics | Ownership, attach/detach, generation | `video_port_audio.dart`, `video_port_warm_park.dart`, `video_port_settle_metrics.dart` | High — shared controllers |
| `discover_video_disk_cache.dart` (~1602) | Proxy + Range + LRU + locks | Mutex, prioritize, resolvePlaySource | `disk_cache_http.dart`, `disk_cache_proxy_server.dart`, `disk_cache_complete.dart` | High — write lock |
| `discover_presentation_screen.dart` (~3103) | UI + chrome + video sync + commerce affordances | PageView + `_syncVideo` ownership | chrome already partial; extract `_OfferPage` / media frame / session wiring | Medium |
| `discover_visual_chrome.dart` (~1155) | Overlays/dots/actions | Interaction containers | dots, share/fav strip, captions | Medium |
| `catalog-journey.js` (8058) | Partner media + form + persist | Media gallery (≤3v/10i) orchestration | media-gallery.js, persist.js, options.js | High for deploy drift |

**Rule:** one owner for shared state (`AssetVideoPort`, `DiscoverVideoDiskCache`, portal media list). No circular imports.

## Later batches (not blocking video fix)

1. Portal: `bulk-add.js`, `bulk-group-journey.js`, `e2b-*-shell.js`, `registry-attribute-fields.js`
2. API: `commerce.service.ts`, `marketplace.service.ts`, `partners-portal.service.ts`, upload-sessions
3. App non-video: advisor, outfit studio, face capture, results projector
4. Docs/generated/tests: do **not** hand-split

## This build (1709)

- Behavior fixes only for 1708 review items + correlation logs.
- No wide extract (avoids mixing rename/API with playback behavior).
- Portal dashboard pointed at canonical `catalog-journey.js`.
