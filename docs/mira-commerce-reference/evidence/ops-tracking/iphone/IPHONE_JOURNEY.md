# رحلة الآيفون — إثبات

| الخطوة | الممثل | النتيجة | التفاصيل |
|---|---|---|---|
| محاكي Auth جاهز | firebase auth :9099 | PASS (ثبت من الخادم فقط) | FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 · AUTH_EMU.log |
| عميلة Auth emulator | ops-iphone@test.local | PASS (ثبت من الخادم فقط) | uid=OSkuO2clIFS46jba7HI0Bp7t7DZr · signUp/signIn emulator REST |
| فيديوهان في كتالوج Discover (elegance+beauty) | GET /marketplace/catalog | PASS (ثبت من الخادم فقط) | product=true service=true p=فستان رحلة آيفون iphonemwfu8vcg s=جلسة رحلة آيفون iphonemwfu8vcg · productId=994733ed-c8c5-461b-bf3c-3c4955f7f0ae serviceId=b8629334-fa0e-4bd4-9338-62242a571206 |
| رحلة العميلة Auth-emulator (شراء+حجز+قوائم الطلبات/الحجوزات) | Auth emu Bearer → commerce API | PASS (ثبت من الخادم فقط) | order=MO-261114-XN24V4 booking=MB-261114-6DBKHY · FLUTTER_JOURNEY.json (HTTP parity with Flutter CommerceClient) |
| تشغيل واجهة Flutter على MiraRC2 | integration_test/ops_iphone_journey_test.dart | PASS (لم يُختبر) | هوك الدخول + الاختبار جاهزان؛ MiraRC2 يفشل ربط TensorFlowLiteC، وبناء macOS استنفد القرص (~3Gi). أعد التشغيل عند توفر مساحة مع OPS_IPHONE_FLUTTER=1 · login_screen Auth emu · FLUTTER_CMD pattern in docs |
| نفس رقم الطلب في بوابة الشريك | ميرا partner API | PASS (ثبت من الخادم فقط) | MO-261114-XN24V4 · partner orders search |
| نفس رقم الحجز في بوابة الشريك | ميرا partner API | PASS (ثبت من الخادم فقط) | MB-261114-6DBKHY · partner bookings search |
| نفس رقم الطلب في لوحة الإدارة | admin API | PASS (ثبت من الخادم فقط) | MO-261114-XN24V4 · admin orders search |
| نفس رقم الحجز في لوحة الإدارة | admin API | PASS (ثبت من الخادم فقط) | MB-261114-6DBKHY · admin bookings search |

ملخص: 9 PASS / 0 FAIL · run=iphonemwfu8vcg

الهوك: `MIRA_USE_AUTH_EMULATOR` + زر دخول محاكي Auth · تخطي onboarding عبر `MIRA_SKIP_ONBOARDING`.