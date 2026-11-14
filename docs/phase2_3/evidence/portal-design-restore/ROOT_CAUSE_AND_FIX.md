# Partners portal design regression — root cause & fix

## Three references

| Role | Commit / artifact | Notes |
|---|---|---|
| Approved design (shell + orbs + e2b editors) | `8a17b27` / `a15f3b5` (+ later taxonomy) | `dashboard.html` loads `e2b-product-editor.css`, `portal-shell.js`, `e2b-*-shell.js`, `editor-v2.js`, drafts/bulk/settings |
| Commerce features intended to ship | `ea4a862` … `40476fa` | Ops tracking, public refs MO/MB search — **but `ea4a862` also stripped the shell** |
| What Render served after that push | `640bfdb` / `40476fa` static deploy | Live `dashboard.html` ~10 KB **without** portal-shell / e2b CSS links (matched stripped source) |

Visual proof of regression (owner screenshots): legacy «إضافة محتوى» card + plain «وسائط العرض الرئيسي» without shell rail/orbs.

## Root cause (first divergence)

**Source commit `ea4a862` (`feat(commerce): ops tracking…`) deleted ~575 lines from `partners-portal/web/dashboard.html`.**

It removed:
- `css/e2b-product-editor.css`
- script tags: `product-commerce-fields`, `registry-attribute-fields`, `inventory-editor-state`, `editor-v2`, `lane-entries`, `bulk-add`, `bulk-group-journey`, `portal-shell`, `e2b-product-shell`, `e2b-service-shell`
- markup: `#goBulk`, `#laneEntries`, `#bulkSection`, `#editorDraftsSection`, `#partnerSettingsSection`
- `MiraPortalShell.boot()` / navigate wiring in the page script

It kept only a thin catalog-journey page + commerce tabs, and added `#commerceSearch`.

**Not** a wrong Render root directory, and **not** primarily CDN alone: the published HTML sha matched the stripped Git file. JS/CSS for the shell still existed on the static host (200) but were **never loaded** by the live HTML. Account type / developer path was irrelevant — the template itself was the old chrome.

Cloudflare `s-maxage=300` can briefly show a prior HTML blob after a good deploy; bypass with a fresh query once the Live deploy is `8b9ba23`.

## Fix

- Restored `dashboard.html` from `ea4a862^` (approved shell).
- Re-applied commerce public-number search (`#commerceSearch` / `#commerceSearchBtn`).
- Cache-bust query `?v=portal-shell-restore1` on local css/js tags so returning sessions fetch assets tied to this HTML.

**Published:** branch `main` + `mira/elegance-e1-taxonomy-foundation` @ **`8b9ba23`**  
**Render:** `mira-partners-portal` deploy **`dep-dbs4oku7bikc73ejk62g`** → **Live** @ `8b9ba23`

## Production verification

- Live HTML includes `portal-shell.js`, `e2b-product-editor.css`, drafts/bulk, `commerceSearch`.
- Playwright on `https://mira-partners-portal.onrender.com/dashboard.html?ui-fixture=labeled`:
  - `hasShell`, `hasE2bCss`, rail, media heading present
  - legacy «إضافة محتوى» **not** visible (`addContentVisible: false`)
  - screenshots: `01-prod-products-shell.png`, `02-prod-product-editor-media.png`
- Logged-in Mira developer session: owner should hard-refresh once; shells boot after `PartnersApi.dashboard()` as before.

## Prevent recurrence

- Do not rewrite `dashboard.html` wholesale when adding commerce UI — patch the commerce card only.
- Keep portal-shell / e2b script+CSS tags mandatory in any dashboard change review.
- Optional: structure test `portal-shell.structure.tests.mjs` already asserts shell expectations — run it in CI before static deploy.
