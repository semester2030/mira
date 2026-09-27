#!/usr/bin/env python3
"""Record the PH4 RC4 review status without approving the phase."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STATUS = "PH4 RC4 منفّذ — بانتظار المراجعة المستقلة"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def save(name, data):
    (DATA / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


phases = load("discover-phases.json")
phase = next(item for item in phases["phases"] if item["id"] == "PH-4")
phase["status"] = STATUS
phase["actualAr"] = "PH4 RC4 منفّذ — بانتظار المراجعة المستقلة. قواعد العد بانتظار اعتماد المالك، والعد غير مفعّل. PH3-STORAGE-LIVE مفتوح. اختبار الجوال مؤجل للمرحلة الخامسة."
phase["notesAr"] = "RC3 تمت مراجعته ويحتاج تصحيحًا، واختلاف بصمته مسجّل تاريخيًا. RC4 ينفذ التصحيحات المستقلة ولا يعتمد المرحلة ولا قواعد العد."
phase["reviewPackage"] = "deliveries/PH4-RC4.txt"
phase["verificationReport"] = "deliveries/PH4-RC4.txt"
phase["reviewResultAr"] = "PH4 RC4 منفّذ — بانتظار المراجعة المستقلة. لم تُعتمد المرحلة الرابعة من داخل التنفيذ."
phases["approvedSummaryAr"] = phases["approvedSummaryAr"].replace(
    "المرحلة الرابعة: PH4 RC3 منفّذ — بانتظار المراجعة المستقلة.",
    "المرحلة الرابعة: PH4 RC4 منفّذ — بانتظار المراجعة المستقلة.",
)

for task in phase["tasks"]:
    if task["id"] == "P4-T1":
        task["status"] = "بانتظار اعتماد المالك"
        task["resultAr"] = "بطاقة القرار جاهزة في RC4 وتعرض التوصية والبديل والأمثلة. طلب تنفيذ RC4 ليس اعتمادًا. 50٪ والثانية و24 ساعة ما زالت غير معتمدة. العد غير مفعّل."
        task["remainingAr"] = "اعتماد المالك الصريح للتوصية أو للبديل. لا يُفعّل العد قبل ذلك."
    if task["id"] == "P4-T2":
        task["status"] = "بانتظار اعتماد P4-T1 — العد غير مفعّل"
        task["remainingAr"] = "بعد اعتماد P4-T1: عدد حقيقي، وصفر مختلف عن تعذر الجلب، ومنع احتساب التحميل المسبق والتكرار، وربط الحدث بالهدف الصحيح. لا يُنفذ ذلك داخل RC4."

rc3 = next(item for item in phase["deliveries"] if item["id"] == "DEL-PH4-RC3")
rc3["deliveryStatus"] = "تمت مراجعته — يحتاج تصحيحًا"
rc3["reviewResultAr"] = "المراجعة المستقلة وجدت ملاحظات RC4. البصمة الفعلية للملف المرسل b32e13984f79710051ad156b3f898f91486f02e14e4fa1c7039697670e03689b، وملف البصمة المرفق احتوى b25852b5bb87e1204dddda8ab8583a0dc974a83a41e876db9e8fe95a2a908f57. الاختلاف مثبت ولم تُستبدل البصمة."

phase["deliveries"].append({
    "id": "DEL-PH4-RC4",
    "name": "MIRA_DISCOVER_PH4_RC4.zip",
    "createdAt": "2026-09-27T05:20:00+03:00",
    "deliveryStatus": STATUS,
    "logHref": "deliveries/PH4-RC4.txt",
    "logLabel": "سجل PH4 RC4",
    "zipHref": "../../MIRA_DISCOVER_PH4_RC4.zip",
    "zipLabel": "حزمة PH4 RC4",
    "sha256Href": "../../MIRA_DISCOVER_PH4_RC4.zip.sha256",
    "sha256Label": "بصمة الحزمة خارجها",
    "verificationHref": "../../MIRA_DISCOVER_PH4_RC4_VERIFICATION.txt",
    "verificationLabel": "تحقق الحزمة",
    "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
    "reviewResultAr": "تصحيح ملاحظات RC3 بانتظار المراجعة المستقلة. العد غير مفعّل. المعتمد بالكامل مرحلتان من خمس.",
    "approvalAr": "غير معتمدة",
})

phase["corrections"].extend([
    {
        "id": "P4-RC4-01",
        "titleAr": "روابط الوسائط وطلب الإزالة قبل الاعتماد",
        "relatedTaskIds": ["P4-T3"],
        "status": "منفذ — بانتظار المراجعة المستقلة",
        "problemAr": "الروابط النسبية تصل إلى العرض بلا تحويل إلى أصل واجهة API، وpendingRemoval يخفي الوسيط في الإعلان قبل اعتماد الإزالة.",
        "impactAr": "الصورة والفيديو لا يُحمّلان من العقد الحالي، والعرض العام يتغير قبل قرار الإدارة.",
        "fixAr": "حل الروابط عبر resolveCatalogMediaUrl في عميل البيانات. اختيار الوسائط المنشورة يستخدم publishedCatalogMediaWhere نفسه في الكتالوج والإعلان، بلا شرط pendingRemoval.",
        "filesAr": [
            "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
            "mira-api/src/marketplace/catalog-published-media.ts",
            "mira-api/src/marketplace/catalog-ad.service.ts",
            "mira-api/src/marketplace/marketplace.service.ts",
        ],
        "acceptanceAr": "رابط نسبي يصبح عنوان API كامل بلا تكرار /api/v1. الصورة تُفك بايتاتها. طلب الإزالة ثم الرفض يبقي الوسيط، والاعتماد يزيله من الإعلان والأصل معًا للمنتج والخدمة.",
        "resultAr": "اختبار Flutter فك صورة بعرض 1 وحل الروابط. اختبار HTTP المحلي يقارن وسائط الإعلان والأصل في الطلب والرفض والاعتماد.",
        "evidenceLinks": [
            {"href": "evidence/ph4-rc4/flutter-ad-rc4.log", "label": "سجل Flutter"},
            {"href": "evidence/ph4-rc4/ph4-rc4-integration.log", "label": "سجل HTTP"},
        ],
        "remainingAr": "مراجعة مستقلة. لا صور معاينة توليدية.",
    },
    {
        "id": "P4-RC4-02",
        "titleAr": "بحث الإعلانات والصفحات وحفظ الشريحة",
        "relatedTaskIds": ["P4-T3"],
        "status": "منفذ — بانتظار المراجعة المستقلة",
        "problemAr": "كل الإعلانات تُعرض دون البحث والفلاتر، وloadMore ينشئ حالة بلا إعلانات.",
        "impactAr": "إعلان غير مطابق يظهر مع نتيجة فارغة، وتختفي الإعلانات عند الصفحة التالية.",
        "fixAr": "التصفية عبر DiscoverCatalogQueryEngine على بيانات الأصل. الصفحات التالية تبقي الإعلانات. الاستجابة المتأخرة تُهمل بعد تغيير الجيل. هوية الشريحة هي معرّف الإعلان.",
        "filesAr": [
            "lib/features/marketplace/presentation/discover_feed_controller.dart",
            "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
            "lib/features/marketplace/presentation/presentation/presentation_models.dart",
        ],
        "acceptanceAr": "بحث فارغ ومطابق، وفلاتر المنتج والعيادة والمشغل والتصنيف والمدينة، وصفحتان، وإعلانان لأصل واحد، واستجابة متأخرة، وفشل التحميل ثم إعادته، دون تبديل الشريحة الحالية.",
        "resultAr": "اختبارات Flutter في discover_ad_rc4_test.dart غطت هذه الحالات وخرجت بنجاح.",
        "evidenceLinks": [{"href": "evidence/ph4-rc4/flutter-ad-rc4.log", "label": "سجل Flutter"}],
        "remainingAr": "لا سياسة تجارية جديدة لترتيب الإعلانات.",
    },
    {
        "id": "P4-RC4-03",
        "titleAr": "نوع الجهة وبيانات الخدمة من المصدر",
        "relatedTaskIds": ["P4-T3"],
        "status": "منفذ — بانتظار المراجعة المستقلة",
        "problemAr": "إعلان الخدمة كان يُثبّت النوع clinic ويملأ المدة والقيم الناقصة افتراضيًا.",
        "impactAr": "إعلان المشغل يظهر بواجهة العيادة وتصنيفاتها.",
        "fixAr": "العقد العام يرسل نوع الجهة والمدينة والتصنيف والمدة من الصف. المحلل يرفض الخدمة إذا غاب النوع الحقيقي أو المدينة أو المدة. bookingEnabled لا يعني طلب موعد تشغيلي.",
        "filesAr": [
            "lib/features/marketplace/data/discover_published_ad.dart",
            "mira-api/src/marketplace/catalog-ad.service.ts",
        ],
        "acceptanceAr": "إعلان منتج وعيادة ومشغل يثبت النوع والتصنيف والمعرّف والسعر. المدة الصفرية لا تُخترع.",
        "resultAr": "اختبار Flutter يفصل المكياج عن الليزر. اختبار HTTP يقرأ نوع العيادة والمشغل والمدة 45 والسعر من الصف.",
        "evidenceLinks": [
            {"href": "evidence/ph4-rc4/flutter-ad-rc4.log", "label": "سجل Flutter"},
            {"href": "evidence/ph4-rc4/ph4-rc4-integration.log", "label": "سجل HTTP"},
        ],
        "remainingAr": "مراجعة مستقلة. الحجز التشغيلي خارج النطاق.",
    },
    {
        "id": "P4-RC4-04",
        "titleAr": "فتح الرابط ثم تسجيل المحاولة",
        "relatedTaskIds": ["P4-T3"],
        "status": "منفذ — بانتظار المراجعة المستقلة",
        "problemAr": "link_open كان يُسجّل قبل الفتح، ومعرّف الحدث يُعاد لكل نقرات الإعلان طوال الشاشة.",
        "impactAr": "فشل الفتح يترك حدث نجاح، وإعادة المحاولة لا تُفصل عن النقرة التالية.",
        "fixAr": "التحقق من الأهلية ثم الفتح. النجاح فقط إذا أعادت الأداة true ولم ترمِ. فشل التسجيل يحفظ معرّف تلك المحاولة لإعادة الإرسال دون فتح ثانٍ. النقرة التالية تأخذ معرّفًا جديدًا. علم الانشغال يمنع التداخل.",
        "filesAr": ["lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"],
        "acceptanceAr": "false والاستثناء لا يسجلان نجاحًا. إعادة الإرسال بعد فشل التسجيل فتح واحد وأثر واحد. نقرتان مستقلتان بمعرّفين. لا تسجيل عند التحميل أو تبديل الوسيط أو التفاصيل.",
        "resultAr": "اختبار الواجهة نفّذ رجوع false ورمي الاستثناء وفشل التسجيل وإعادة الإرسال ونقرتين مستقلتين. ادعاء RC3 بتغطية هذه المسارات صُحح هنا.",
        "evidenceLinks": [{"href": "evidence/ph4-rc4/flutter-ad-rc4.log", "label": "سجل Flutter"}],
        "remainingAr": "رفض الخادم للرابط غير الصالح والمسحوب يبقى من RC3. فتح الرابط ليس شراءً.",
    },
    {
        "id": "P4-RC4-05",
        "titleAr": "رحلة البوابتين من الحزمة المفكوكة",
        "relatedTaskIds": ["P4-T3"],
        "status": "منفذ — بانتظار المراجعة المستقلة",
        "problemAr": "لقطات 480 و1280 كانت لقائمة فارغة، ونموذج 390 لا يظهر حقوله، والسكربت يثبت مسار المشروع الأصلي.",
        "impactAr": "تشغيل السكربت من حزمة مفكوكة قد يختبر الشجرة الأصلية، والأدلة لا تثبت البطاقات المحمّلة.",
        "fixAr": "جذر المشروع يُستخرج من موقع السكربت أو وسيطة --root، ومجلد الأدلة من --out. اللقطات العريضة تُؤخذ والإعلان قيد المراجعة. النقر يمر بحدث فأرة على مستطيل الزر.",
        "filesAr": [
            "docs/mira-commerce-reference/evidence/ph4-rc3/portal-journey.mjs",
            "mira-api/scripts/ph4-rc3-portal-journey.sh",
        ],
        "acceptanceAr": "رحلة من نسخة مفكوكة تسجل جذر المصدر، وتعرض الحقول والمعاينة والرفض و409، وتقيس viewport وdevicePixelRatio وscrollWidth وclientWidth وحدود الأزرار.",
        "resultAr": "الرحلة المحلية من الواجهة إلى API على PostgreSQL محلي. ليست اتصال Firebase حيًا ولا تحققًا من التخزين الدائم ولا تشغيل جوال.",
        "evidenceLinks": [
            {"href": "evidence/ph4-rc4/portal-metrics.json", "label": "مقاييس الرحلة"},
            {"href": "evidence/ph4-rc4/partner-ads-form-390.png", "label": "حقول النموذج"},
            {"href": "evidence/ph4-rc4/admin-ads-480.png", "label": "إدارة 480"},
            {"href": "evidence/ph4-rc4/admin-ads-1280.png", "label": "إدارة 1280"},
        ],
        "remainingAr": "إعادة التشغيل من الحزمة المفكوكة جزء من إغلاق التسليم. ليس اختبار جهاز.",
    },
])

policy = phases["viewCountPolicy"]
policy["noticeAr"] = policy["noticeAr"] + " تنفيذ RC4 لا يعتمد 50٪ ولا ثانية ولا 24 ساعة."
save("discover-phases.json", phases)

project = load("project.json")
project["updatedAt"] = "2026-09-27T05:20:00+03:00"
save("project.json", project)

visual = load("discover-visual.json")
visual["phaseApprovalAr"] = "المعتمد بالكامل مرحلتان من خمس. المرحلة الثالثة مقبولة برمجيًا ضمن النطاق المراجع وبانتظار إغلاق التخزين الدائم. PH4 RC4 منفّذ — بانتظار المراجعة المستقلة. قواعد العد بانتظار اعتماد المالك والعد غير مفعّل. PH3-STORAGE-LIVE مفتوح."
save("discover-visual.json", visual)
print("site json updated")
