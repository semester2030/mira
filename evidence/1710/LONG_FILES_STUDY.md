# Long-file study (manual source >700) — 1710

Target: usually <700 LOC by **responsibility**, not line chopping.
Baseline before extracts: inventory in `LONG_FILES_INVENTORY.md` (regenerated from tree).

## Portal single source

| Path | Role |
|---|---|
| `partners-portal/web/js/catalog-journey.js` | Canonical (dashboard loads this) |
| `partners-portal/web/js/catalog-journey.bags1.js` | Alias — keep byte-identical via `sync-catalog-journey-alias.sh` |

## Video-path files (priority)

| File | LOC≈ | Responsibilities | Shared-state owner | Callers | Tests | Suggested split | Risk |
|---|---:|---|---|---|---|---|---|
| `discover_presentation_screen.dart` | 3103 | Vertical/horizontal PageView, offer chrome hooks, `_syncVideo` ownership, commerce affordances | `_PresentationPage` holds `_held` slot; port owns players | Discover routes, orbit | presentation/sync widget tests | Extract offer chrome wiring; keep `_syncVideo` with page | High |
| `discover_video_disk_cache.dart` | ~1650 | LRU, proxy Range, write lock, trusted complete markers, HEAD/GET | `DiscoverVideoDiskCache` singleton/instance | AssetVideoPort, prefetch | `discover_video_disk_cache_test.dart` (raw logs in `raw/`) | `disk_cache_http.dart`, `disk_cache_proxy.dart`, `disk_cache_complete.dart` | High |
| `presentation_video_port.dart` | ~1520 | attach/detach, warm/park/prepared, audio cut, settle metrics | `AssetVideoPort` + `DiscoverVideoSession` | Presentation pages | `asset_video_port_test.dart` | audio / warm_park / settle modules | High |
| `discover_visual_chrome.dart` | 1155 | Dots, actions, overlays | Stateless UI + callbacks | Presentation page | visual capture tests | dots / actions | Medium |
| `catalog-journey.js` | 8058 | Partner form + media gallery + persist | DOM/module globals | dashboard.html | portal mjs tests | media-gallery / persist / options | High (deploy drift) |

## Backend / portal (next after video)

| File | LOC≈ | Note |
|---|---:|---|
| `mira-api/.../commerce.service.ts` | 2162 | Commerce policies — not Discover playback |
| `partners-portal/.../bulk-add.js` | 2990 | Bulk ingest |
| `mira-api/.../marketplace.service.ts` | 1230 | Catalog API |
| upload-sessions services/tests | 700–1600 | Media upload pipeline for ≤3v+10i |

## Excluded from hand-split

Generated (`data.generated.js`), docs/governance copies, large acceptance/schema tests — study only.

## Executed this build

- **No large extract** (behavior fixes isolated).
- Study completed for video-critical set + portal alias policy.
- Next extract commits only after device latency baseline recorded.
