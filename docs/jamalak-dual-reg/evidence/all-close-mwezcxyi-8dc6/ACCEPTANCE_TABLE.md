# ACCEPTANCE_TABLE

Verdict: **NOT_VERIFIED** (Flutter connected player journeys blocked).

| المسار | الدائرة | الطلب | النتائج | فيديو ftyp | الحالة |
|---|---|---|---|---|---|
| الأطفال ← الكل | all | `/marketplace/catalog?lane=children&category=children&partnerId=b707c547-ebce-4c0` | 2 ids | True | PASS HTTP |
| الأطفال ← أحذية | children.shoes | `/marketplace/catalog?lane=children&category=children&subcategory=children.shoes&` | 1 ids | True | PASS HTTP |
| مكياج + placeMode=home | all | `/marketplace/catalog?lane=beauty&category=makeup&placeMode=home&partnerId=94127c` | 1 ids | True | PASS HTTP |
| الشعر | all | `/marketplace/catalog?lane=beauty&category=hair&partnerId=94127c69-98cd-496d-8478` | 2 ids | True | PASS HTTP |
| صبغة | beauty.hair.color | `/marketplace/catalog?lane=beauty&category=hair&subcategory=beauty.hair.color&par` | 1 ids | True | PASS HTTP |
| استشوار | beauty.hair.blowdry | `/marketplace/catalog?lane=beauty&category=hair&subcategory=beauty.hair.blowdry&p` | 1 ids | True | PASS HTTP |
| المجوهرات | all | `/marketplace/catalog?lane=jewelry&partnerId=b707c547-ebce-4c08-b72f-5b4bff6311a6` | 1 ids | True | PASS HTTP |
| الهدايا | all | `/marketplace/catalog?lane=gifts&partnerId=b707c547-ebce-4c08-b72f-5b4bff6311a6&v` | 1 ids | True | PASS HTTP |
| أناقتك | all | `/marketplace/catalog?lane=elegance&partnerId=b707c547-ebce-4c08-b72f-5b4bff6311a` | 2 ids | True | PASS HTTP |
| مواليد فارغ | children.newborn | `subcategory=children.newborn` | 0 ids |  | PASS HTTP |

## Flutter connected journeys
| المسار | الحالة | المانع |
|---|---|---|
| مكياج ← أطفال ← أحذية ← الكل | NOT_VERIFIED | iOS TFLite linker / disk; macOS rebuild incomplete |
| مكياج+في موقعك ← الكل | NOT_VERIFIED | same |
| شعر ← صبغة ← استشوار | NOT_VERIFIED | same |
| فارغ/رجوع/صفحة2 | NOT_VERIFIED | same |
