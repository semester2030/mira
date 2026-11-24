# Celebrities v1 acceptance results

- Tested SHA: `d1b0bf4956e179061d3731f2432497d967835d95` (`d1b0bf49`)
- Base: `5dc38be`
- Run: `acc-1795552714839`
- API: `http://127.0.0.1:3000/api/v1` (portal + Flutter harness)
- Date: 2026-11-24T21:26:00Z

## Git checks

- Product/service offer ordering by `createdAt` is on the tested tip (`catalog-ad.service.ts`, `creator-profile.service.ts`).
- Public `hasStore` / `hasServices` use published offer counts only (`hasProducts > 0` / `hasServicesCount > 0`) in `creator-profile.service.ts` — tip commit: `fix(marketplace): gate celebrity store/services on published offers`.

## Portal (usual partners login)

| Step | Result |
|---|---|
| Login developer test account via `/login.html` | PASS |
| Celebrity profile + published ads | PASS (product media=3 videos, service media=11) |
| Ad editor media list | PASS — `shots/portal-ad-editor-media-11.png` (وسائط محفوظة: 11) |
| Add first product/service CTAs | PASS (أزرار إضافة منتج / إضافة خدمة) |

## Public flags

| Case | Result |
|---|---|
| Developer with own published product+service | `hasStore=true`, `hasServices=true` |
| Ads-only then first own offer | Covered earlier in `STEPS_HASSTORE` + HTTP integration (false until first own product/service) |

## App journey

Harness: `lib/acceptance_celebrities_main.dart` on Chrome against the same API. Physical iPhone Ld failed after Xcode (disk/gRPC) — see below.

| Step | Result | Evidence |
|---|---|---|
| Home orb above «اكتشفي عالم ميرا» | PASS | `shots/j01-home.png`, `shots/v01-home.png` |
| Directory first 6 names | PASS | `shots/app-01-celebrities-directory.png` |
| Scroll / 7th + back | PARTIAL UI + PASS API (page2 starts with مشهورة حمراء) | `shots/v04-directory-scrolled.png` |
| Fayez profile + متجر/خدمات orbs | PASS | profile shots with both orbs |
| Product ad 3 videos (1/3) | PASS | `shots/v10-product-video-3.png` |
| Service ad 11 media (1/11…3/11) | PASS | `shots/v13-service-media-2.png`, `shots/f14-service-detail.png` |
| Details CTA عرض المنتج / عرض الخدمة | PASS | `shots/f11-product-detail.png`, `shots/f14-service-detail.png`; routes `#/product-detail` / `#/service-detail` |
| Screen recording | PASS (real UI frames) | `recording/celebrities-acceptance-journey.mp4` |

## CocoaPods / iPhone

- Corrupt truncated JSON: sandbox cache `.../gRPC-Core/1.69.0/gRPC-Core.podspec.json` (47173 bytes, unterminated string). Fixed by removing sandbox cocoapods cache and `pod install` with `CP_HOME_DIR=$HOME/.cocoapods` (real trunk 1.69.0 = 227945 bytes). Podfile.lock versions kept (`gRPC-Core 1.69.0`).
- Wired iPhone: Xcode build finished (~219s) then `Ld` failed; disk dropped to ~1.6Gi during gRPC-Core object rename (`No such file or directory`). Full-app simulator still blocked by MediaPipe/TFLiteC device-vs-simulator link.

## Delivery hygiene

- `CREDS.txt` and `_portal_inject.json` excluded from the delivery ZIP.
- Do not redistribute acceptance passwords.
