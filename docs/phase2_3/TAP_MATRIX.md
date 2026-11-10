# Phase 3 — tap matrix (Flutter widget test)

**Environment:** macOS · Flutter 3.38.9 widget test · logical sizes **320×640** and **390×844** · no physical device.

| Circle (AR) | Lane id sent | Screen opened |
|---|---|---|
| أناقتك | `elegance` | `DiscoverPresentationScreen` args=`DiscoverLane.elegance` |
| جمالك | `beauty` | `DiscoverPresentationScreen` args=`DiscoverLane.beauty` |
| الأطفال | `children` | `DiscoverPresentationScreen` args=`DiscoverLane.children` |
| الهدايا | `gifts` | `DiscoverPresentationScreen` args=`DiscoverLane.gifts` |
| مناسباتك | `occasions` | `DiscoverPresentationScreen` args=`DiscoverLane.occasions` |
| المجوهرات | `jewelry` | `DiscoverPresentationScreen` args=`DiscoverLane.jewelry` |

Proven by `onLaneOpened` + route arguments in `test/features/marketplace/phase2_3_orbit_and_orbs_test.dart`.

**Sub images (11):** loaded from bundled taxonomy JSON when API unavailable; each `imageKey` resolves via `LaneOrbAssets` (PNG signature verified).

**Empty preview lanes:** jewelry/children/gifts/occasions do **not** reuse elegance/beauty visual-preview clips.
