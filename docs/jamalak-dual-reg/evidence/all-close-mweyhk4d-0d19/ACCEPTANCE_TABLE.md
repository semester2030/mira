# Discover «الكل» closure table

| runId | all-close-mweyhk4d-0d19 |
| gitHead | 0fd97c7 |

| المسار | الدائرة | الفلاتر | الطلب | النتائج | المشغّل | الحالة |
|---|---|---|---|---|---|---|
| children ← الكل (lane membership) | all | {} | `lane=children&partnerId=a6017040-a1a4-450f-ba44-4376d4ea5c7b` | 3670653a-19c1-4778-9cde-e929288d8380, 9b91e5bc-622b-4a32-b369-f1a5d036535b | 3670653a-19c1-4778-9cde-e929288d8380 | PASS |
| jewelry ← الكل (lane membership) | all | {} | `lane=jewelry&partnerId=a6017040-a1a4-450f-ba44-4376d4ea5c7b` | 2adf4817-2ea4-4005-a8ce-95977b0c9842 | 2adf4817-2ea4-4005-a8ce-95977b0c9842 | PASS |
| gifts ← الكل (lane membership) | all | {} | `lane=gifts&partnerId=a6017040-a1a4-450f-ba44-4376d4ea5c7b` | e23dae1b-18ee-4c3d-8ba7-0094b5548f6d | e23dae1b-18ee-4c3d-8ba7-0094b5548f6d | PASS |
| elegance ← الكل (lane membership) | all | {} | `lane=elegance&partnerId=a6017040-a1a4-450f-ba44-4376d4ea5c7b` | ∅ | ∅ | PASS |
| الأطفال ← الكل | all | {} | `lane=children&category=children&partnerId=a6017040-a1a4-450f-ba44-4376d4ea5c7b` | 3670653a-19c1-4778-9cde-e929288d8380, 9b91e5bc-622b-4a32-b369-f1a5d036535b | 3670653a-19c1-4778-9cde-e929288d8380 | PASS |
| الأطفال ← أحذية أطفال | children.shoes | {} | `lane=children&category=children&subcategory=children.shoes` | 3670653a-19c1-4778-9cde-e929288d8380 | 3670653a-19c1-4778-9cde-e929288d8380 | PASS |
| الشعر ← الكل | all | {} | `lane=beauty&category=hair&partnerId=d8c089a6-b7fe-4e75-8116-cefe4a3a7870` | 245d3912-af04-4178-9aec-4ef3da6ad706, e8bde7f5-4215-4bdf-a734-bbd081b8d1fc | 245d3912-af04-4178-9aec-4ef3da6ad706 | PASS |
| الشعر ← صبغة | beauty.hair.color | {} | `lane=beauty&category=hair&subcategory=beauty.hair.color&partnerId=d8c089a6-b7fe-4e75-8116-cefe4a3a7870` | 245d3912-af04-4178-9aec-4ef3da6ad706 | 245d3912-af04-4178-9aec-4ef3da6ad706 | PASS |
| الشعر ← استشوار | beauty.hair.blowdry | {} | `lane=beauty&category=hair&subcategory=beauty.hair.blowdry&partnerId=d8c089a6-b7fe-4e75-8116-cefe4a3a7870` | e8bde7f5-4215-4bdf-a734-bbd081b8d1fc | e8bde7f5-4215-4bdf-a734-bbd081b8d1fc | PASS |
| خدمات المكياج + في موقعك | all | {"placeMode":"home"} | `lane=beauty&category=makeup&placeMode=home` | ∅ | ∅ | PASS |
| قسم فارغ (children.__empty_test__) | children.__empty_test__ | {} | `lane=children&category=children&subcategory=children.__empty_test__` | ∅ | ∅ | PASS |
