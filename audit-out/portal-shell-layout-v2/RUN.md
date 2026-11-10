# تشغيل قبول غلاف البوابة

1. من `partners-portal/web`:
   `python3 -m http.server 4173 --bind 127.0.0.1`
2. تثبيت متصفحات Playwright مرة واحدة من `mira-api`:
   `npx playwright install chromium`
3. تشغيل:
   `NODE_PATH=../../mira-api/node_modules node js/portal-shell.browser-acceptance.mjs`
4. النتائج في `audit-out/portal-shell-layout-v2/` (صور + `d1366-journey.webm` + `results.json`).

ملاحظة: `ui-fixture=labeled` يمنع طلبات الشبكة؛ الحفظ الخادمي الحي خارج نطاق هذا القبول.
