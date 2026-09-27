#!/usr/bin/env python3
"""Apply PH-2 RC3 site records (RC2 review + P2-RC3-01..07 + PH-1 consistency)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHASES = ROOT / "data" / "discover-phases.json"
PROJECT = ROOT / "data" / "project.json"
VISUAL = ROOT / "data" / "discover-visual.json"

RC2_REVIEW = (
    "راجَع المراجع RC2 ولم يعتمد إغلاق المرحلة الثانية. ثبتت إصلاحات بدء تحميل الكتالوج، "
    "ومنع الرجوع للأمثلة عند فشل الخلاصة، وإلغاء نجاح الموعد الوهمي، وتحسن اللقطات. "
    "بقيت مشكلات في ربط المفضلة ووحدة السعر ومقارنة المؤشر وحالة البحث ومسارات التفاصيل "
    "واختبارات التكامل واتساق سجل الموقع."
)

APPROVED = (
    "المرحلة الأولى معتمدة ضمن نطاق واجهة العرض والأدلة المقبولة في RC4. "
    "المرحلة الثانية غير معتمدة بعد مراجعة RC1 وRC2. تسليم RC3 بانتظار المراجعة ولم يُعتمد في هذه الجولة. "
    "المراحل الثالثة والرابعة والخامسة لم تُعتمد. عدد المراحل المعتمدة: 1 من 5. "
    "هذا العدّ ليس نسبة إنجاز مقدّرة للمشروع."
)

PH1_NOTES = (
    "معتمدة ضمن نطاق RC4. اختبار الجوال وتشغيل الفيديو الفعلي مؤجل إلى المرحلة الخامسة. "
    "تسليمات RC1–RC3 البصرية تبقى سجلًا تاريخيًا."
)
PH1_BLOCKERS = (
    "لا اعتماد إطلاق. البحث والفلاتر والمتجر والموعد والموقع في المرحلة الثانية. "
    "تشغيل video_player على الجوال في المرحلة الخامسة."
)

RC3_CORRECTIONS = [
    {
        "id": "P2-RC3-01",
        "titleAr": "ربط المفضلة بالحساب والمسار الفعلي",
        "relatedTaskIds": ["P2-T1", "P2-T3"],
        "status": "بانتظار المراجعة",
        "problemAr": "المسار الطبيعي لم يمرّر مفضلة مرتبطة بالحساب؛ القلب لا يعكس الحالة المحفوظة.",
        "fixAr": "ApiDiscoverFavoriteClient على المسار الافتراضي مع Firebase authStateChanges وGET/POST /marketplace/favorites. refresh عند الدخول وتبديل الحساب. قفل أثناء الحفظ ورسائل فشل صادقة.",
        "filesAr": [
            "lib/features/marketplace/data/discover_favorite_client.dart",
            "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
            "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
            "mira-api/src/marketplace/marketplace.controller.ts",
            "mira-api/src/marketplace/marketplace.service.ts",
        ],
        "resultAr": "القلب يعكس saved بعد refresh. حساب مسجل يمر عبر العميل الشبكي لا ذاكرة العرض فقط.",
        "evidenceAr": "discover_phase2_widget_test.dart (قلب ممتلئ). discover_feed_controller_test.dart (عزل حساب). evidence/tests/rc3_flutter.txt",
        "remainingAr": "تكامل Postgres حي يتطلب DATABASE_URL محليًا. إثبات Firebase على جهاز في المرحلة الخامسة.",
    },
    {
        "id": "P2-RC3-02",
        "titleAr": "وحدة السعر (هللات → ريالات)",
        "relatedTaskIds": ["P2-T2", "P2-T3"],
        "status": "بانتظار المراجعة",
        "problemAr": "priceHalalas تُعرض كريالات خام مع «ر.س».",
        "fixAr": "CatalogPrice في Flutter وformatCatalogPrice في Nest. 8900→89 ر.س و8999→89.99 ر.س.",
        "filesAr": [
            "lib/features/marketplace/data/catalog_price.dart",
            "mira-api/src/marketplace/catalog-price.ts",
            "lib/features/marketplace/presentation/presentation/discover_presentation_catalog.dart",
            "lib/features/marketplace/presentation/screens/product_detail_screen.dart",
            "lib/features/marketplace/presentation/screens/service_detail_screen.dart",
        ],
        "resultAr": "الواجهة لا تعرض 8900 كريالًا.",
        "evidenceAr": "catalog_price_test.dart وcatalog-price.schema-tests.ts وودجت RC3 (لا 8900، يظهر 89).",
        "remainingAr": "لا شيء في المسار المحلي/المحاكى. اتساق priceLabel على الإنتاج يبقى للمراجعة.",
    },
    {
        "id": "P2-RC3-03",
        "titleAr": "مقارنة المؤشر الموحدة",
        "relatedTaskIds": ["P2-T1"],
        "status": "بانتظار المراجعة",
        "problemAr": "localeCompare للترتيب و > للاستمرار أسقطت عناصر (a/A/b و a-b/a_b/ab).",
        "fixAr": "compareCatalogKeys واحدة في catalog-page.ts وmarketplace.service. Dart يستخدم compareTo على المفتاح المركب.",
        "filesAr": [
            "mira-api/src/marketplace/catalog-page.ts",
            "mira-api/src/marketplace/marketplace.service.ts",
            "lib/features/marketplace/data/discover_catalog_query.dart",
        ],
        "resultAr": "a/A/b و a-b/a_b/ab يمران بصفحات كاملة دون فقد.",
        "evidenceAr": "catalog-page.schema-tests.ts وdiscover_catalog_query_test.dart (paging key order).",
        "remainingAr": "لا اختبار Prisma حي للصفحات.",
    },
    {
        "id": "P2-RC3-04",
        "titleAr": "البحث ودورة حياة الطلبات",
        "relatedTaskIds": ["P2-T1"],
        "status": "بانتظار المرajعة",
        "problemAr": "إخفاء TextField أثناء التحميل وnotify بعد dispose.",
        "fixAr": "_disposed في DiscoverFeedController. حقل البحث يبقى ظاهرًا. «كل الأنواع» لا يمسح المدينة.",
        "filesAr": [
            "lib/features/marketplace/presentation/discover_feed_controller.dart",
            "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
            "lib/features/marketplace/presentation/presentation/discover_visual_chrome.dart",
        ],
        "resultAr": "ودجت: بحث أثناء التحميل، dispose بلا notify.",
        "evidenceAr": "discover_phase2_widget_test.dart وdiscover_feed_controller_test.dart. evidence/tests/rc3_flutter.txt",
        "remainingAr": "اختبار pop أثناء الطلب على Navigator كامل مؤجل؛ dispose مغطى في المتحكم.",
    },
    {
        "id": "P2-RC3-05",
        "titleAr": "مداخل التفاصيل الموحدة",
        "relatedTaskIds": ["P2-T2", "P2-T3"],
        "status": "بانتظار المراجعة",
        "problemAr": "المتجر والمسارات المسماة فتحت ProductDetailScreen بكائن قديم.",
        "fixAr": "CatalogRecordScope.page من الخلاصة والمتجر والمطابقة والمسارات المسماة.",
        "filesAr": [
            "lib/features/marketplace/data/catalog_record_scope.dart",
            "lib/features/marketplace/presentation/screens/catalog_record_page.dart",
            "lib/core/navigation/marketplace_routes.dart",
            "lib/features/marketplace/presentation/screens/partner_detail_screen.dart",
        ],
        "resultAr": "إعادة جلب بالمعرّف من كل مدخل مرتبط.",
        "evidenceAr": "discover_activation_test.dart وdiscover_phase2_widget_test.dart (details-missing).",
        "remainingAr": "فتح الرابط على جهاز حقيقي غير مثبت.",
    },
    {
        "id": "P2-RC3-06",
        "titleAr": "اختبار التكامل للمفضلة",
        "relatedTaskIds": ["P2-T3"],
        "status": "بانتظار المراجعة",
        "problemAr": "اختبارات الذاكرة لا تثبت Prisma/HTTP.",
        "fixAr": "marketplace-favorites.integration-tests.ts على MarketplaceService مع skip بدون DATABASE_URL محلي.",
        "filesAr": [
            "mira-api/src/marketplace/marketplace-favorites.integration-tests.ts",
            "mira-api/src/marketplace/marketplace.service.ts",
            "mira-api/src/marketplace/marketplace.controller.ts",
        ],
        "resultAr": "schema tests ناجحة؛ integration SKIP موثق.",
        "evidenceAr": "evidence/tests/rc3_api.txt",
        "remainingAr": "تشغيل التكامل يحتاج migrate + Postgres محلي. الترحيل غير مطبّق على الإنتاج.",
    },
    {
        "id": "P2-RC3-07",
        "titleAr": "اتساق بطاقة PH-1",
        "relatedTaskIds": ["P1-T1"],
        "status": "بانتظار المراجعة",
        "problemAr": "notesAr وblockersAr في PH-1 ناقضان اعتماد RC4.",
        "fixAr": "تصحيح حقول PH-1 وapprovedSummaryAr وproject.json دون تغيير نتائج التسليمات التاريخية.",
        "filesAr": [
            "docs/mira-commerce-reference/data/discover-phases.json",
            "docs/mira-commerce-reference/data/project.json",
        ],
        "resultAr": "الحالة الحالية تذكر اعتماد RC4 وتأجيل الجوال.",
        "evidenceAr": "python3 scripts/validate_package.py بعد generate_data_js.",
        "remainingAr": "لا شيء داخل PH-1 بعد التصحيح.",
    },
]

# fix typo in status
for c in RC3_CORRECTIONS:
    c["status"] = c["status"].replace("المرajعة", "المراجعة")


def main() -> None:
    data = json.loads(PHASES.read_text(encoding="utf-8"))
    data["approvedSummaryAr"] = APPROVED

    ph1 = next(p for p in data["phases"] if p["id"] == "PH-1")
    ph1["notesAr"] = PH1_NOTES
    ph1["blockersAr"] = PH1_BLOCKERS
    ph1["reviewPackageLabel"] = "سجل RC4 البصري (معتمد ضمن النطاق)"
    ph1["verificationReportLabel"] = "بيان RC4؛ التحقق المستقل بجانب الحزمة على سطح المكتب"

    ph2 = next(p for p in data["phases"] if p["id"] == "PH-2")
    ph2["status"] = "بانتظار المراجعة"
    ph2["actualAr"] = (
        "RC3 يربط المفضلة بمسار API والحساب، ويحوّل الهللات إلى ريالات في الخلاصة والتفاصيل، "
        "ويوحّد compareCatalogKeys، ويبقي حقل البحث أثناء التحميل، ويفتح التفاصيل عبر CatalogRecordScope "
        "من كل المداخل المرتبطة. طلب الموعد يبقى غير متاح. المرحلة ليست معتمدة."
    )
    ph2["notesAr"] = (
        "مراجعة RC2: "
        + RC2_REVIEW
        + " الفحص المستقل: ZIP 6926e128…، 242/204 ملفًا، 66 اختبار Flutter مسجل، لم يُعِد المراجع تشغيل Flutter."
    )
    for d in ph2["deliveries"]:
        if d["id"] == "DEL-PH2-RC2":
            d["deliveryStatus"] = "تمت مراجعته"
            d["sha256"] = "6926e128bd135b01e308c8d52c25dbbe826810249860d4b6bbdd1080d557ca9b"
            d["reviewResultAr"] = RC2_REVIEW
    ph2["deliveries"].append(
        {
            "id": "DEL-PH2-RC3",
            "name": "MIRA_DISCOVER_PHASE2_RC3.zip",
            "createdAt": "2026-09-26T06:45:00+03:00",
            "deliveryStatus": "بانتظار المراجعة",
            "logHref": "deliveries/PH2-RC3.txt",
            "logLabel": "سجل تصحيح المرحلة الثانية RC3",
            "zipHref": "../../MIRA_DISCOVER_PHASE2_RC3.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE2_RC3.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE2_RC3.zip.sha256.txt",
            "sha256Label": "بصمة RC3 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE2_RC3_VERIFICATION.txt",
            "verificationLabel": "تحقق RC3 المستقل",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "بانتظار المراجعة. لم يُعتمد إغلاق المرحلة الثانية في هذه الجولة.",
            "approvalAr": "غير معتمدة",
        }
    )
    existing = {c["id"] for c in ph2.get("corrections", [])}
    for item in RC3_CORRECTIONS:
        if item["id"] not in existing:
            ph2.setdefault("corrections", []).append(item)

    PHASES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    proj = json.loads(PROJECT.read_text(encoding="utf-8"))
    proj["updatedAt"] = "2026-09-26T06:45:00+03:00"
    for i, b in enumerate(proj.get("blockers", [])):
        if "PH-2" in b or "RC2" in b:
            proj["blockers"][i] = (
                "PH-1 معتمدة ضمن نطاق RC4. PH-2 غير معتمدة؛ RC2 رُاجع وRC3 بانتظار المراجعة. "
                "اختبار الجوال في المرحلة الخامسة."
            )
    PROJECT.write_text(json.dumps(proj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if VISUAL.exists():
        vis = json.loads(VISUAL.read_text(encoding="utf-8"))
        if isinstance(vis.get("phase1ApprovalAr"), str) and "غير معتمد" in vis["phase1ApprovalAr"]:
            vis["phase1ApprovalAr"] = (
                "المرحلة الأولى معتمدة ضمن نطاق RC4؛ الجوال والفيديو الفعلي في المرحلة الخامسة."
            )
        VISUAL.write_text(json.dumps(vis, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("applied PH-2 RC3 site records")


if __name__ == "__main__":
    main()
