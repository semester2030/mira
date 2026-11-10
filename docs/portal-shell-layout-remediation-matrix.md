# بوابة ميرا — غلاف العرض (تحقق + إغلاق فجوات)

تاريخ: 2026-11-10 · commit السابق `c7d75ae` · متابعة الفجوات على نفس الفرع

## تحقق الحزمة السابقة

| المصدر | النتيجة |
|---|---|
| ZIP `mira-portal-shell-layout-20261110T200202Z-c7d75ae.zip` | موجود تحت `Desktop/مراجع تطبيق ميرا/`؛ SHA256 `d17a0297…` |
| مطابقة ZIP ↔ المستودع عند `c7d75ae` | متطابق لـ`portal-shell.js` / `dashboard.html` |
| النسخة المنشورة | نفس بصمة الملفات على `mira-partners-portal` |
| قبول الحزمة السابقة | بنية وتنقل فقط على fixture مبسّط — **ليس** إثبات محرر حقيقي/حفظ/معاينة مجاورة كافية |

## فجوات أُغلقت في هذه المتابعة

| البند | الإصلاح | الاختبار | الدليل | الحالة |
|---|---|---|---|---|
| بطاقة المنزل/الإضافة تتراكم فوق القائمة | إخفاء `#portalHomeCard` و`#portalAddCard` دائمًا مع الغلاف | `list-no-home` / `list-one-section` على 1366/1440/390 | `audit-out/portal-shell-layout-v2/*-01-products-list.png` | PASS |
| زر «عرض القائمة» القديم | إخفاء `#e2bShowList` عبر JS+CSS داخل `#portalShell` | `list-no-show-list-btn` | نفس لقطات القائمة | PASS |
| قائمة/محرر/مسودات متداخلة | غلاف + أوضاع حصرية (محفوظ من c7d75ae) + إعادة إثبات | `never-both-*` / `*-alone` | `results.json` 98 فحص | PASS |
| تبويب واحد + معاينة مجاورة | تبويبات دائمة + قياس هندسي للحقول/الوسائط | `single-tab-*` / `preview-beside-fields` | `*-02-edit-basics.png` + نتائج الهندسة | PASS |
| المسودات التقنية/الفراغ | بطاقات عربية + بذرة fixture + تكثيف CSS | `drafts-human-card` / `drafts-no-tech` | `*-04-drafts.png` | PASS |
| رحلة قائمة→إضافة→تبويب→حفظ→مغادرة→فتح | قبول متصفح فعلي + فيديو | الرحلة كاملة | `d1366-journey.webm` + `*-05-reopen-edit.png` | PASS |
| تاريخ الرابط والرجوع | `hash` / `goBack` | `hash-orders` / `history-back` | `results.json` | PASS |

## حدود مثبتة (ليست نجاحًا مُعلنًا زائفًا)

| البند | المانع | الدليل |
|---|---|---|
| حفظ خادمي حقيقي + وسائط في هذه الرحلة | وضع `ui-fixture=labeled` يمنع الشبكة عمدًا؛ الحفظ مُحاكى محليًا (`mira:draft-saved`) | رسالة التصنيفات «محاكاة» في لقطات التحرير |
| دوائر التصنيف الحية | نفس المانع أعلاه | خطأ تحميل التصنيفات في اللقطات |

تشغيل القبول:

```bash
# من مجلد الشركاء مع خادم ثابت على :4173 وplaywright في mira-api
cd partners-portal/web && python3 -m http.server 4173 --bind 127.0.0.1
NODE_PATH=../../mira-api/node_modules PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright \
  node js/portal-shell.browser-acceptance.mjs
```
