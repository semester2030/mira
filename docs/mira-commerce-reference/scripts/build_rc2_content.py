#!/usr/bin/env python3
"""Narrative and planning JSON for RC2. Product code is not modified."""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
NOW = "2026-09-23T03:43:29+03:00"
ACCESS = "2026-09-23"


def dump(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def P(text):
    return {"type": "p", "text": text}


def H(text):
    return {"type": "h3", "text": text}


def L(items):
    return {"type": "list", "items": items}


def C(text):
    return {"type": "callout", "text": text}


def PR(text):
    return {"type": "proposal", "text": text}


def rev(i, title, source, desc, reqs, sev, unit, files, prev, action, new, verify, limits, status, parent=None, evidence_type="source"):
    return {
        "id": i,
        "parentId": parent,
        "titleAr": title,
        "source": source,
        "descriptionAr": desc,
        "reqIds": reqs,
        "severity": sev,
        "impactAr": desc,
        "unit": unit,
        "files": files,
        "previousEvidenceAr": prev,
        "actionAr": action,
        "newEvidenceIds": new,
        "verificationAr": verify,
        "remainingLimitsAr": limits,
        "status": status,
        "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
        "updatedAt": NOW,
        "evidenceType": evidence_type,
    }


def main():
    findings = [
        rev("REV-0001", "أدلة الشركاء والإدارة لا تطابق حكم التفعيل", "مراجعة الحزمة السابقة",
            "بوابة الشركاء وُصفت مفعلة ودليلها ملف مواصفات، ولوحة الإدارة بلا دليل.",
            ["REQ-0006", "REQ-0016"], "high", "partners-admin",
            ["partners-portal/SPEC.md", "admin-portal/web/js/api.js"],
            "EVD-0007 فقط لـ CAP-0007، وCAP-0008 بلا evidenceIds",
            "قراءة المتحكم والحارس وعميل الويب، وتخفيض التفعيل إلى UNKNOWN",
            ["EVD-0011", "EVD-0012", "EVD-0014", "EVD-0015"],
            "مقارنة الملفات بالمقتطفات وSHA-256",
            "لا تشغيل إنتاجي. البندان الفرعيان اكتملت دراستهما بانتظار المراجعة.", "معالجة بانتظار المراجعة", evidence_type="source"),
        rev("REV-0001a", "SPEC ليس دليل تنفيذ الشركاء", "مراجعة الحزمة السابقة",
            "EVD-0007 مواصفات. التنفيذ في المتحكم والعميل.",
            ["REQ-0006"], "high", "partners", ["partners-portal/SPEC.md", "mira-api/src/partners-portal/partners-portal.controller.ts"],
            "EVD-0007", "أُبقي EVD-0007 كوثيقة وأُضيفت أدلة التنفيذ",
            ["EVD-0007", "EVD-0011", "EVD-0016"], "مراجعة نوع الدليل document مقابل fact",
            "التفعيل الإنتاجي UNKNOWN", "معالجة بانتظار المراجعة", "REV-0001"),
        rev("REV-0001b", "لوحة الإدارة بلا دليل مرتبط", "مراجعة الحزمة السابقة",
            "CAP-0008 كانت بلا evidenceIds.",
            ["REQ-0016"], "high", "admin", ["mira-api/src/admin/admin.controller.ts", "admin-portal/web/js/api.js"],
            "مصفوفة فارغة", "رُبطت EVD-0014 وEVD-0015 وEVD-0025",
            ["EVD-0014", "EVD-0015", "EVD-0025"], "وجود الملفات والمقتطفات",
            "لا يثبت ضبط المفتاح في الإنتاج", "معالجة بانتظار المراجعة", "REV-0001"),
        rev("REV-0002", "أحكام الوجود أوسع من الأدلة", "مراجعة الحزمة السابقة",
            "قدرات بلا أدلة، وملخص بحث، ومقتطف مخطط يُستخدم كنفي شامل.",
            ["REQ-0002", "REQ-0011"], "high", "study", ["data/capabilities.json"],
            "CAP-0008 و0010 و0011 و0013 و0014 بلا أدلة أو بملخص",
            "تضييق نطاق الغياب وإرفاق أوامر الخروج",
            ["EVD-0018", "EVD-0019", "EVD-0023"],             "مراجعة سجل الأمر وexit code",
            "البحث لا يغطي أسماءً لم تُذكر ولا مستودعات خارج ميرا", "معالجة بانتظار المراجعة"),
        rev("REV-0002a", "قدرات بلا أدلة مرتبطة", "مراجعة الحزمة السابقة",
            "CAP-0008 وCAP-0010 وCAP-0011 وCAP-0013 وCAP-0014 كانت بلا أدلة.",
            ["REQ-0013"], "high", "capabilities", ["data/capabilities.json"],
            "evidenceIds فارغة", "رُبط كل حكم بدليل أو صُنّف البحث بنطاقه",
            ["EVD-0014", "EVD-0017", "EVD-0020", "EVD-0023"], "كل قدرة حقيقة لها دليل",
            "SOURCE_ONLY", "معالجة بانتظار المراجعة", "REV-0002"),
        rev("REV-0002b", "سجل Order/Cart كان ملخصًا", "مراجعة الحزمة السابقة",
            "CMD-0001 ليس مخرج أمر.",
            ["REQ-0011"], "high", "evidence", ["evidence/commands/CMD-0001-search-order-cart.txt"],
            "EVD-0010 ملخص", "أُضيف CMD-RC2-0001 مع exit_code=1",
            ["EVD-0018", "EVD-0010"], "قراءة ملف الأمر",
            "exit=1 يعني لا تطابق للنمط لا غيابًا كونيًا", "معالجة بانتظار المراجعة", "REV-0002", "search"),
        rev("REV-0002c", "مقتطف المخطط لا ينفي المشروع", "مراجعة الحزمة السابقة",
            "EVD-0005 نطاقه أسطر المخطط المعروضة.",
            ["REQ-0002"], "medium", "schema", ["mira-api/prisma/schema.prisma"],
            "EVD-0005", "أُضيف بحث النماذج EVD-0019 ونص doesNotProve",
            ["EVD-0005", "EVD-0019"], "مقارنة حدود الدليل",
            "جداول بأسماء أخرى خارج النمط لن تُكتشف", "معالجة بانتظار المراجعة", "REV-0002", "search"),
        rev("REV-0003", "تقرير الإيقاف يخلط المنفذ والموقوف والناقص", "مراجعة الحزمة السابقة",
            "عبارة الانطلاق قريبًا ليست سببًا تشغيليًا، والشراء الداخلي لم يكن خدمة متوقفة.",
            ["REQ-0019"], "high", "paused", ["data/paused-services.json"],
            "PAUSE-0001 إلى 0003", "فُصلت طبقات الإخفاء والبوابة وAPI واكتمال المنطق",
            ["EVD-0001", "EVD-0003", "EVD-0004", "EVD-0018"],             "جدول الأحكام المتغيرة",
            "وصول API الإنتاج بقي UNKNOWN", "معالجة بانتظار المراجعة"),
        rev("REV-0003a", "طبقات Discover مختلطة", "مراجعة الحزمة السابقة",
            "حُكم بوصول API دون دليل تشغيل.",
            ["REQ-0006"], "high", "marketplace", ["lib/core/config/mira_features.dart", "lib/main.dart"],
            "EVD-0001 وEVD-0002", "uiHidden موثق والباقي UNKNOWN",
            ["EVD-0001", "EVD-0002", "EVD-0006"], "لا طلب شبكة إنتاجي في هذه المرحلة",
            "لم يُفحص البناء المنشور", "معالجة بانتظار المراجعة", "REV-0003"),
        rev("REV-0003b", "عبارة الانطلاق قريبًا ليست سبب إيقاف", "مراجعة الحزمة السابقة",
            "النص واجهة. السبب التاريخي غير موثق.",
            [], "medium", "marketplace", ["lib/main.dart"],
            "حقل documentedReason السابق", "صُحح reasonClass",
            ["EVD-0002"], "قراءة النص في المقتطف",
            "لا وثيقة تشغيل إضافية داخل المستودع", "معالجة بانتظار المراجعة", "REV-0003"),
        rev("REV-0003c", "الشراء الداخلي ليس خدمة متوقفة", "مراجعة الحزمة السابقة",
            "التصميم رابط خارجي ولم يُبنَ طلب داخلي ثم يُوقف.",
            ["REQ-0019"], "high", "orders", ["product_detail_screen.dart", "SPEC.md"],
            "PAUSE-0003", "التصنيف NEVER_BUILT",
            ["EVD-0004", "EVD-0007", "EVD-0018"], "مقارنة التصنيف بالأدلة",
            "قرار DEC-0001 ما زال مفتوحًا", "معالجة بانتظار المراجعة", "REV-0003"),
        rev("REV-0004", "القبول والمراحل والجهد غير محددة", "مراجعة الحزمة السابقة",
            "معيار قبول واحد لكل المتطلبات، ومراحل بلا خروج، ومتطلبات خارج الخطة.",
            ["REQ-0003", "REQ-0006", "REQ-0009", "REQ-0015", "REQ-0016", "REQ-0017", "REQ-0018", "REQ-0020"],
            "high", "roadmap", ["data/requirements.json", "data/roadmap.json"],
            "acceptanceAr الموحد", "معايير لكل متطلب وخطة تغطي الكل",
            [],             "أداة التحقق ترفض المعيار العام",
            "التقديرات نطاقات بافتراضات لا عروض أسعار", "معالجة بانتظار المراجعة"),
        rev("REV-0004a", "معيار القبول العام", "مراجعة الحزمة السابقة",
            "النص كان: يُثبت لاحقًا ببوابة قبول.",
            ["REQ-0001"], "high", "requirements", ["data/requirements.json"],
            "حقل acceptanceAr", "استُبدل بمعطى وإجراء ومتوقع وفشل واختبار ودليل",
            [], "validate_study يرفض العبارة العامة",
            "المعايير مقترحة للدراسة وليست اختبارات منفذة على المنتج", "معالجة بانتظار المراجعة", "REV-0004"),
        rev("REV-0004b", "شروط خروج المراحل", "مراجعة الحزمة السابقة",
            "GATE-01 إلى GATE-05 بلا خروج محدد.",
            [], "high", "roadmap", ["data/roadmap.json"],
            "exitCriteria على GATE-00 فقط", "لكل مرحلة دخول وخروج وجهد ومخاطر وتراجع",
            [], "قراءة roadmap.json",
            "الجهد تقدير دراسة", "معالجة بانتظار المراجعة", "REV-0004"),
        rev("REV-0004c", "متطلبات خارج المراحل المستقبلية", "مراجعة الحزمة السابقة",
            "REQ-0003 و0006 و0009 و0015 و0016 و0017 و0018 و0020 لم تكن في GATE-01..05.",
            ["REQ-0003", "REQ-0006", "REQ-0009", "REQ-0015", "REQ-0016", "REQ-0017", "REQ-0018", "REQ-0020"],
            "high", "roadmap", ["data/roadmap.json", "data/scope-decisions.json"],
            "GATE-00 كان يجمع كل المتطلبات", "وُزعت على البوابات وREQ-0020 قرار نطاق",
            [], "مصفوفة التغطية",
            "لم يبدأ التنفيذ", "معالجة بانتظار المراجعة", "REV-0004"),
        rev("REV-0005", "الفلاتر والوسائط والتنظيم مختصرة", "مراجعة الحزمة السابقة",
            "بلا عقود أو فهرسة أو تكلفة أو مصادر رسمية.",
            ["REQ-0013", "REQ-0004"], "high", "product-study", ["data/categories.json", "data/contracts.json"],
            "قوائم أسماء فلاتر", "عقود مقترحة موسومة غير منفذة وبحث مصادر",
            [],             "المصادر مؤرخة بتاريخ الاطلاع",
            "الأسعار غير متحققة والدراسة ليست اعتمادًا قانونيًا", "معالجة بانتظار المراجعة"),
        rev("REV-0005a", "عقود وفلاتر قابلة للمراجعة", "مراجعة الحزمة السابقة",
            "المثال المطلوب: فستان أزرق مقاس M متوفر يطابق متغيرًا واحدًا.",
            ["REQ-0013", "REQ-0014"], "high", "filters", ["data/contracts.json", "data/categories.json"],
            "أسماء فلاتر فقط", "عقود وحالات AND ومثال العدّ",
            [], "العرض في القسم 8 ووسم مقترح غير منفذ",
            "غير مبني في المنتج", "معالجة بانتظار المراجعة", "REV-0005", "proposal"),
        rev("REV-0005b", "دورة الوسائط والتكلفة", "مراجعة الحزمة السابقة",
            "لا دورة حياة ولا معادلة تكلفة.",
            ["REQ-0004", "REQ-0005"], "medium", "media", ["data/media-lifecycle.json", "data/costs.json"],
            "قسم مختصر", "دورة كاملة ومعادلات بلا أسعار مخترعة",
            ["EVD-0024"], "لا مشغل قائم في النطاق قبل اقتراح مزود",
            "أسعار المزود غير متحقق", "معالجة بانتظار المراجعة", "REV-0005"),
        rev("REV-0005c", "البحث التنظيمي الرسمي", "مراجعة الحزمة السابقة",
            "لم يُنجز في النسخة السابقة.",
            ["REQ-0017"], "high", "regulatory", ["data/regulatory.json"],
            "عبارة تحتاج مراجعة", "مصادر رسمية بتاريخ اطلاع وأثر تصميمي وأسئلة مختص",
            [], "روابط المصادر في القسم 12",
            "ليس رأيًا قانونيًا ملزمًا", "معالجة بانتظار المراجعة", "REV-0005", "regulatory"),
        rev("REV-0006", "أداة التحقق تقبل دراسة فاسدة", "مراجعة الحزمة السابقة",
            "نجحت رغم انحراف JSON واعتماد مرحلة ناقصة وحقول دليل فارغة.",
            [], "high", "tooling", ["scripts/validate_study.py"],
            "PASS بعدد ثابت", "فحوص بنيوية واختبارات سلبية على نسخة مؤقتة",
            [], "سجل الاختبارات في الموقع بعد التشغيل",
            "التحقق لا يغني عن قراءة موضوعية", "قيد المعالجة", evidence_type="test"),
        rev("REV-0007", "مصدر الحقيقة والعرض والاختبار التفاعلي", "مراجعة الحزمة السابقة",
            "نصوص الدراسة داخل app.js وأنماط مضمّنة وبلا لقطات.",
            [], "high", "site", ["js/app.js", "css/components.css"],
            "لا مجلد لقطات في الحزمة السابقة", "نقل المحتوى إلى JSON وفصل CSS",
            [], "اختبار متصفح لاحقًا",
            "لقطات المتصفح تُستكمل في هذه الجولة أو تبقى القيد ظاهرًا", "قيد المعالجة"),
        rev("REV-0007a", "النص الموضوعي داخل app.js", "مراجعة الحزمة السابقة",
            "sectionBody كان يحمل نتائج التدقيق.",
            [], "high", "site", ["js/app.js", "data/section-content.json"],
            "سويتش النصوص", "العرض يقرأ JSON والتوكنات {{ID}}",
            [], "مقارنة المولد بالملف",
            "نصوص أزرار الواجهة تبقى في العرض", "معالجة بانتظار المراجعة", "REV-0007"),
        rev("REV-0007b", "أنماط مضمّنة في القالب", "مراجعة الحزمة السابقة",
            "style على بطاقات المقاييس.",
            [], "low", "site", ["css/layout.css"],
            "ثلاث خصائص style", "صنف metric-compact",
            [], "بحث style= في app.js بعد التعديل",
            "لا يشمل أنماط المتصفح الافتراضية", "معالجة بانتظار المراجعة", "REV-0007"),
        rev("REV-0007c", "لقطات واختبار تفاعل المتصفح", "مراجعة الحزمة السابقة",
            "node --check وHTTP 200 لا يثبتان التفاعل.",
            [], "high", "tests", ["evidence/screenshots", "evidence/tests"],
            "لا لقطات", "اختبار عرض كمبيوتر وجوال وتابلت على النسخة المستخرجة إن أمكن",
            [], "سجل الاختبار يذكر ما نُفذ وحدوده",
            "إن تعذر العرض يبقى هذا البند قيد المعالجة", "قيد المعالجة", "REV-0007", "browser"),
    ]
    dump("review-findings.json", findings)

    coverage = []
    items = [
        ("SCOPE-ORIG-00", "تدقيق مبني على الأدلة بلا إعادة بناء", "s3", "capabilities.json", ["EVD-0011"], "partial", "التشغيل الإنتاجي غير مفحوص", "صلاحية الدراسة تمنع التنفيذ الحي", "يمنع إغلاق GATE-00"),
        ("SCOPE-ORIG-01", "اسم الموقع المتاجر الإلكترونية في ميرا", "s0", "project.json", [], "complete", "", "", "لا يمنع المراجعة"),
        ("SCOPE-ORIG-02", "أقسام 00 إلى 19 ومعرفات ثابتة", "s21", "project.json", [], "complete", "", "", "لا يمنع المراجعة"),
        ("SCOPE-ORIG-03", "عدم تعديل منتج ميرا", "s2", "evidence/git/STATUS.txt", ["EVD-0022"], "complete", "شجرة العمل كانت متسخة قبل الدراسة", "لم تُنسب إلى RC2 ولم تُمسح", "لا يمنع المراجعة"),
        ("SCOPE-ORIG-04", "رؤية 50 منتجًا ومحتوى مرتبط بلا نسخ إعلان", "s1", "contracts.json", [], "partial", "العقود مقترحة غير منفذة", "هذه دراسة", "يمنع بدء البناء قبل القرار"),
        ("SCOPE-RC2-00", "عدم إغلاق GATE-00", "s0", "project.json", [], "complete", "", "", "الحالة بانتظار إعادة المراجعة"),
        ("SCOPE-RC2-01", "كل نتيجة داخل الموقع", "s20", "section-content.json", [], "partial", "يكتمل بحزمة المتصفح", "اللقطات بند REV-0007c", "يبقي الملاحظة مفتوحة إن غابت اللقطات"),
        ("SCOPE-RC2-04", "سجل REV-0001 إلى REV-0007", "s20", "review-findings.json", [], "complete", "بعض البنود الفرعية قيد المعالجة", "لا إخفاء للنقص", "الملاحظة المفتوحة تمنع ادعاء الاكتمال"),
        ("SCOPE-RC2-05", "تدقيق تنفيذ الشركاء والإدارة", "s6", "partner-traces.json", ["EVD-0011", "EVD-0013", "EVD-0026"], "partial", "عزل الكتابة مثبت في المصدر واختبار mock فقط", "لا قاعدة حية", "SOURCE_ONLY"),
        ("SCOPE-RC2-06", "تصحيح الوجود والغياب والتوقف", "s4", "judgment-corrections.json", ["EVD-0018"], "complete", "API الإنتاج UNKNOWN", "لم يُنفذ طلب شبكة", "UNKNOWN لا يُغلق كحقيقة"),
        ("SCOPE-RC2-07", "عقود الفلاتر والمثال المرجعي", "s8", "contracts.json", [], "complete", "غير منفذ في المنتج", "مقترح دراسة", "لا يُحتسب ميزة مبنية"),
        ("SCOPE-RC2-08", "وسائط وتكلفة وتنظيم", "s9", "regulatory.json", ["EVD-0024"], "partial", "الأسعار غير متحققة", "لا سعر رسمي مجلوب لهذه الدورة", "لا اعتماد تكلفة"),
        ("SCOPE-RC2-09", "قبول ومراحل", "s15", "roadmap.json", [], "complete", "الجهد نطاق تقديري", "افتراضات مكتوبة في البوابة", "لا يمنع المراجعة"),
        ("SCOPE-RC2-10", "JSON مصدر الحقيقة", "s19", "section-content.json", [], "complete", "", "", "يُراجع مع REV-0007a"),
        ("SCOPE-RC2-11", "تحقق سلبي وإيجابي", "s19", "evidence/tests", [], "partial", "تُشغَّل بعد بناء الأداة", "البند يُحدَّث بنتيجة الأمر", "فشل الأداة يبقي REV-0006 مفتوحة"),
        ("SCOPE-RC2-12", "اختبار متصفح", "s21", "evidence/screenshots", [], "partial", "يُحدَّث بعد التنفيذ", "البيئة قد تمنع العرض", "لا يُسمى نجاحًا تفاعليًا قبل اللقطات"),
        ("SCOPE-RC2-13", "مصفوفة التغطية", "s21", "scope-coverage.json", [], "complete", "", "", "المراجع ينتقل من البند إلى الدليل"),
        ("SCOPE-RC2-14", "حزمة RC2 وSHA", "s18", "changelog.json", [], "partial", "تُختم بعد الاختبار", "النسخ يتم في نهاية الجولة", "الحزمة السابقة لا تُستبدل بصمت"),
    ]
    for i, title, sec, files, ev, st, gap, why, effect in items:
        coverage.append({
            "id": i,
            "titleAr": title,
            "sectionId": sec,
            "dataFiles": [files] if isinstance(files, str) else files,
            "evidenceIds": ev,
            "status": st,
            "remainingAr": gap,
            "whyAr": why,
            "approvalEffectAr": effect,
        })
    dump("scope-coverage.json", coverage)

    contracts = {
        "unimplemented": True,
        "labelAr": "مقترح غير منفذ",
        "entities": [
            {
                "name": "Product",
                "existsAr": "جدول Product: اسم وسعر وهلالة ورابط خارجي ووسوم",
                "extendAr": "الإبقاء على المعرف وإضافة حالة النشر دون جدول موازٍ",
                "fields": [
                    {"name": "id", "type": "string", "required": True, "source": "الخادم"},
                    {"name": "partnerId", "type": "string", "required": True, "source": "من الرمز لا من العميل"},
                    {"name": "status", "type": "enum draft|active|paused|archived", "required": True, "source": "الشريك والإدارة"},
                ],
            },
            {
                "name": "ProductVariant",
                "existsAr": "غير موجود في المخطط المبحوث",
                "extendAr": "متغير جديد يرتبط بمنتج واحد",
                "fields": [
                    {"name": "id", "type": "string", "required": True, "source": "الخادم"},
                    {"name": "productId", "type": "string", "required": True, "source": "المسار"},
                    {"name": "color", "type": "enum", "required": True, "source": "قاموس يديره المتجر"},
                    {"name": "size", "type": "enum", "required": True, "source": "قاموس المقاسات"},
                    {"name": "stockQty", "type": "int>=0", "required": True, "source": "الشريك"},
                    {"name": "priceHalalas", "type": "int>=0", "required": True, "source": "الشريك"},
                    {"name": "active", "type": "bool", "required": True, "source": "الشريك"},
                ],
            },
            {
                "name": "ServiceOffering",
                "existsAr": "جدول Service بلا فرع",
                "extendAr": "ربط branchId عند تعدد الفروع",
                "fields": [
                    {"name": "facilityId", "type": "string", "required": True, "source": "شريك من نوع عيادة أو صالون"},
                    {"name": "branchId", "type": "string", "required": True, "source": "سجل الفرع"},
                    {"name": "bookingMode", "type": "enum inquiry|appointment|external", "required": True, "source": "قرار المتجر"},
                ],
            },
            {
                "name": "MediaAsset",
                "existsAr": "لا نموذج في البحث EVD-0019",
                "extendAr": "أصل يرتبط بمنتج أو متغير أو خدمة دون نسخ السعر",
                "fields": [
                    {"name": "ownerType", "type": "enum product|variant|service", "required": True, "source": "عند الرفع"},
                    {"name": "ownerId", "type": "string", "required": True, "source": "الرابط"},
                    {"name": "state", "type": "enum uploaded|processing|in_review|published|failed|removed", "required": True, "source": "دورة المعالجة"},
                ],
            },
            {
                "name": "AdLink",
                "existsAr": "لا نموذج مشاهير",
                "extendAr": "رابط إعلان يقرأ السعر والمخزون من المتغير",
                "fields": [
                    {"name": "publisherId", "type": "string", "required": True, "source": "حساب الناشر"},
                    {"name": "advertiserId", "type": "string", "required": True, "source": "المعلن"},
                    {"name": "sellerPartnerId", "type": "string", "required": True, "source": "الشريك المالك"},
                    {"name": "variantId", "type": "string", "required": True, "source": "المنتج الأصلي"},
                    {"name": "storeApproval", "type": "enum pending|approved|rejected|expired", "required": True, "source": "المتجر"},
                ],
            },
        ],
        "example": {
            "titleAr": "فستان أزرق مقاس M متوفر",
            "variants": [
                {"id": "V1", "color": "blue", "size": "M", "stockQty": 5, "match": True},
                {"id": "V2", "color": "blue", "size": "S", "stockQty": 0, "match": False},
                {"id": "V3", "color": "red", "size": "M", "stockQty": 3, "match": False},
            ],
            "ruleAr": "AND على متغير واحد: اللون والمقاس والتوفر من الصف نفسه.",
            "productCount": 1,
            "clipCountAr": "مقطعان منشوران مرتبطان بالمنتج أو بـ V1 يُحسبان محتوىً مرئيًا. مقطع مرتبط بـ V3 فقط لا يظهر. عدد المنتجات 1 وعدد المقاطع قد يكون 2.",
        },
    }
    dump("contracts.json", contracts)

    media = {
        "unimplemented": True,
        "inspectedExistingAr": "لا video_player ولا VideoPlayer في lib وmira-api/src حسب EVD-0024. لا يُقترح مزود كبديل عن مشغل قائم لأنه غير موجود في هذا النطاق.",
        "steps": ["رفع", "تحقق من النوع والحجم", "معالجة", "مراجعة", "نشر", "تشغيل", "إيقاف أو حذف"],
        "playbackAr": [
            "تشغيل متكيف إن وُجد أكثر من تمثيل بعد المعالجة",
            "حد لذاكرة الجهاز وإلغاء التحميل المسبق عند انخفاض الذاكرة",
            "مقطع مسموع واحد",
            "حفظ نسبة العرض دون قص جوهري",
            "حفظ موضع المشاهدة لكل أصل",
            "فشل الشبكة يعيد المحاولة دون نشر مكرر",
        ],
        "vendorAr": "لا اختيار مزود في RC2. أي سعر لاحق يُؤرخ بمصدره أو يُوسم غير متحقق.",
    }
    dump("media-lifecycle.json", media)

    costs = {
        "priceStatus": "غير متحقق",
        "accessDate": ACCESS,
        "assumptions": {
            "stores": 20,
            "productsPerStore": 50,
            "imagesPerProduct": 4,
            "avgImageMb": 1.5,
            "videosPerProduct": 1,
            "videoSeconds": 30,
            "mbPerVideoMinute": "غير متحقق",
            "watchMinutesPerMonth": 10000,
        },
        "equationsAr": [
            "عدد المنتجات = المتاجر × منتجات المتجر",
            "تخزين الصور بالميغابايت = عدد المنتجات × صور المنتج × متوسط حجم الصورة",
            "تخزين الفيديو لا يُحسب برقم حتى يُثبت mb لكل دقيقة من مصدر السعر",
            "تكلفة المعالجة والبث = غير متحقق لهذه الدورة",
        ],
        "scenariosAr": [
            "سيناريو الدراسة: 20 متجرًا و50 منتجًا. تخزين الصور الافتراضي 20×50×4×1.5 = 6000 ميغابايت. هذا حجم افتراضي لا فاتورة.",
            "دقائق المشاهدة 10000 رقم افتراضي للسيناريو وليس قياس إنتاج.",
        ],
    }
    dump("costs.json", costs)

    regulatory = {
        "legalApproval": False,
        "accessDate": ACCESS,
        "sources": [
            {
                "id": "REG-0001",
                "topicAr": "متاجر الملابس والمنتجات غير الطبية",
                "sourceAr": "نظام التجارة الإلكترونية — هيئة الخبراء / وزارة التجارة",
                "url": "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/360de590-0286-4fa5-a243-aa9100c31979/1",
                "alsoUrl": "https://mc.gov.sa/ar/ECC/pages/default.aspx",
                "appliesAr": "التعاملات الإلكترونية لبيع المنتجات والإعلان عنها داخل النطاق الذي يحدده النظام.",
                "designImpactAr": "تعريف البائع وبيانات العرض ومسار الشراء يجب أن يبقى قابلًا للتمييز. هذه الدراسة لا تستخرج التزامًا تنفيذيًا مادةً مادة.",
                "specialistQuestionsAr": ["هل منصة الوساطة تأخذ وصف موفر خدمة أم معلن؟", "ما بيانات المتجر الواجب إظهارها في بطاقة المنتج؟"],
            },
            {
                "id": "REG-0002",
                "topicAr": "إعلانات المشاهير على الشبكات",
                "sourceAr": "ترخيص موثوق — الهيئة العامة لتنظيم الإعلام",
                "url": "https://mawthooq.gmedia.gov.sa/",
                "alsoUrl": "https://my.gov.sa/ar/services/21449",
                "appliesAr": "تقديم الأفراد محتوى إعلانيًا عبر منصات التواصل. لا يُنقل تلقائيًا إلى كل مقطع داخل تطبيق ميرا.",
                "designImpactAr": "فصل المعلن والناشر ووسم المحتوى الإعلاني قبل النشر. الترخيص نفسه سؤال لمختص لا حقل نفترضه كافيًا.",
                "specialistQuestionsAr": ["هل مقطع داخل التطبيق يُعد منصة تواصل بالمعنى التنظيمي؟", "ما إثبات الترخيص الذي نطلبه من الناشر؟"],
            },
            {
                "id": "REG-0003",
                "topicAr": "المنتجات التجميلية",
                "sourceAr": "إدراج منتجات التجميل — هيئة الغذاء والدواء",
                "url": "https://www.sfda.gov.sa/ar/eservices/88819",
                "alsoUrl": "https://www.sfda.gov.sa/ar/taxonomy/term/47",
                "appliesAr": "إدراج مستحضر تجميلي قبل تداوله. الإعلان عن ادعاء علاجي خارج نطاق هذه الصفحة حتى يراجعه مختص.",
                "designImpactAr": "عدم تحويل وسوم البشرة التسويقية إلى ادعاء طبي. ربط المنتج بسجل إدراج إن قرر المختص ذلك.",
                "specialistQuestionsAr": ["أي ادعاءات تجميل ممنوعة في بطاقة المنتج؟", "هل يكفي رقم الإدراج في البيانات؟"],
            },
            {
                "id": "REG-0004",
                "topicAr": "الخدمات الطبية والإعلان عنها",
                "sourceAr": "ضوابط المحتوى الإعلاني للمنشآت الصحية — وزارة الصحة",
                "url": "https://www.moh.gov.sa/eServices/Licences/Documents/10.pdf",
                "alsoUrl": "https://www.moh.gov.sa/eservices/licences/pages/private-health-institutions-law-and-regulations.aspx",
                "appliesAr": "المحتوى الإعلاني للخدمات الصحية المرخصة، بما فيه وضوح أنه إعلان وبيانات المنشأة والتحذيرات.",
                "designImpactAr": "عيادة ميرا لا تُعرض كصالون. مسار الحجز الطبي منفصل عن شراء الملابس.",
                "specialistQuestionsAr": ["هل الخصم على خدمة طبية يحتاج موافقة ترخيص قبل عرضه؟", "ما الحقول الإلزامية في بطاقة العيادة؟"],
            },
            {
                "id": "REG-0005",
                "topicAr": "صالونات التزيين",
                "sourceAr": "اشتراطات التزيين النسائي — وزارة البلديات والإسكان",
                "url": "https://momah.gov.sa/ar/node/14893",
                "alsoUrl": "https://momah.gov.sa/sites/default/files/2024-12/alqwa%60d%20altnfy.pdf",
                "appliesAr": "ترخيص نشاط التزيين ومنع خدمات منزلية أو منتجات دوائية داخل مركز غير مرخص لذلك.",
                "designImpactAr": "نوع الشريك salon لا يرث حقول العيادة. الخدمة خارج المنشأة ليست افتراضًا.",
                "specialistQuestionsAr": ["ما رقم الترخيص البلدي الذي يُخزن؟", "أين حد الخدمة الطبية داخل الصالون؟"],
            },
            {
                "id": "REG-0006",
                "topicAr": "بيانات التحليل الشخصي",
                "sourceAr": "نظام حماية البيانات الشخصية — سدايا",
                "url": "https://sdaia.gov.sa/ar/Research/Pages/DataProtection.aspx",
                "alsoUrl": "https://sdaia.gov.sa/ar/Research/Documents/ExecutiveRegulations.pdf",
                "appliesAr": "معالجة بيانات شخصية. نتائج البشرة قد تكون حساسة حسب توصيف المختص لا حسب تسمية التسويق.",
                "designImpactAr": "REQ-0017 يفصل الإعلان عن نتيجة التحليل. لا استخدام للنتيجة كجمهور إعلاني قبل رأي مختص.",
                "specialistQuestionsAr": ["هل نتيجة البشرة بيانات حساسة في هذا المنتج؟", "ما أساس معالجة المطابقة؟"],
            },
        ],
    }
    dump("regulatory.json", regulatory)

    traces = [
        {"id": "TR-01", "titleAr": "طلب الانضمام", "chain": ["apply.html", "PartnersApi.apply", "POST /partners-portal/apply", "PartnersPortalController.apply", "PartnersPortalService.apply", "PartnerApplication", "status token"], "verified": "SOURCE_ONLY", "evidenceIds": ["EVD-0011", "EVD-0016"]},
        {"id": "TR-02", "titleAr": "متابعة الحالة", "chain": ["status.html", "GET apply/status/:token", "getApplicationStatus"], "verified": "SOURCE_ONLY", "evidenceIds": ["EVD-0011"]},
        {"id": "TR-03", "titleAr": "الدخول والخروج", "chain": ["login.html", "POST /partners-portal/login", "email+accessToken", "PartnerUser", "localStorage", "clearSession"], "verified": "SOURCE_ONLY", "noteAr": "لا كلمة مرور منفصلة في هذا المسار. partnerId من السجل.", "evidenceIds": ["EVD-0021", "EVD-0016"]},
        {"id": "TR-04", "titleAr": "عزل المنتجات", "chain": ["Bearer", "PartnerTokenGuard", "partnerId من السجل", "assertProductOwner where id+partnerId", "رفض إن لم يُوجد"], "verified": "SOURCE_PLUS_UNIT_MOCK", "noteAr": "الاختبار EVD-0026 على mock. لا يثبت قاعدة حية. القراءة العامة عبر marketplace ليست لوحة الشريك.", "evidenceIds": ["EVD-0012", "EVD-0013", "EVD-0026"]},
        {"id": "TR-05", "titleAr": "الإدارة مقابل الشريك", "chain": ["الشريك: رمز شريك واحد", "الإدارة: X-Admin-Key على كل مسارات /admin", "اعتماد ورفض وإيقاف status"], "verified": "SOURCE_ONLY", "noteAr": "لا أدوار موظفين. البحث عن Employee وBranch بلا تطابق EVD-0019.", "evidenceIds": ["EVD-0014", "EVD-0025", "EVD-0019"]},
        {"id": "TR-06", "titleAr": "سعر ووسائط وتوفر", "chain": ["UpsertProductDto priceHalalas+externalUrl+active", "لا حقل مخزون", "لا رفع وسيط"], "verified": "SOURCE_ONLY", "evidenceIds": ["EVD-0017"]},
        {"id": "TR-07", "titleAr": "حجوزات", "chain": ["bookingEnabled اختياري في عقد الخدمة", "لا model Booking في البحث", "زر التطبيق stub"], "verified": "SOURCE_ONLY", "evidenceIds": ["EVD-0017", "EVD-0003", "EVD-0018"]},
        {"id": "TR-08", "titleAr": "تحليلات", "chain": ["POST /track بلا حارس", "partnerId من الجسم", "لوحة الشريك تعد أحداث 30 يومًا"], "verified": "SOURCE_ONLY", "noteAr": "هذه فجوة مسجلة لا تُصلح في هذه المرحلة.", "evidenceIds": ["EVD-0013"]},
        {"id": "TR-09", "titleAr": "إيقاف إداري", "chain": ["PATCH /admin/partners/:id/status", "active|suspended", "الحارس يرفض شريكًا غير active"], "verified": "SOURCE_ONLY", "evidenceIds": ["EVD-0014", "EVD-0012"]},
    ]
    dump("partner-traces.json", traces)

    answers = [
        {"q": "ماذا كان ناقصًا في النسخة السابقة؟", "a": "أدلة تنفيذ الشركاء والإدارة، وسجل بحث قابل للمراجعة، وفصل طبقات الإيقاف، ومعايير قبول، وخطة تغطي المتطلبات، وعقود فلاتر، ومصادر تنظيمية، ومدقق يرفض البيانات الفاسدة، وعرض موضوعي خارج app.js."},
        {"q": "ما الذي تحققنا منه الآن؟", "a": "مسارات المصدر من الصفحة إلى القاعدة لعزل الكتابة، وفرق مفتاح الإدارة عن رمز الشريك، وغياب نماذج الطلب والمتغير والمشاهير داخل نطاق الأوامر المرفقة. التشغيل الإنتاجي لم يُفحص."},
        {"q": "ما الأحكام التي صححناها؟", "a": "انظر جدول الأحكام التي تغيرت بعد المراجعة في القسم 4. التفعيل لم يعد ENABLED مع SOURCE_ONLY. الشراء الداخلي لم يعد خدمة متوقفة."},
        {"q": "ما الذي نملكه ويمكن إعادة استخدامه؟", "a": "جداول Partner وProduct وService، وحارس الرمز، وعزل assertProductOwner، واعتماد الطلبات، وعميل البوابة ولوحة الإدارة، والرابط الخارجي للشراء."},
        {"q": "ما الذي يحتاج تطويرًا؟", "a": "المتغيرات، الفروع، دورة الوسائط، الفلاتر على متغير واحد، إعلان بلا نسخ سعر، سد تتبع partnerId القادم من العميل، ومسارات الطلب والحجز إن قُرر ذلك."},
        {"q": "ما القرارات المطلوبة؟", "a": "DEC-0001 مكان الدفع، DEC-0002 البث الحي، DEC-0003 اعتماد المتجر، DEC-0004 منع نسخ الإعلان، DEC-0005 اعتماد الدراسة. لا قرار يُغلق هنا."},
        {"q": "ما مراحل التنفيذ وشروط قبولها؟", "a": "GATE-01 إلى GATE-05 في القسم 15. GATE-00 دراسة فقط وما زال قيد المعالجة. REQ-0020 قرار نطاق مرتبط بـ DEC-0002."},
        {"q": "ما الذي ما زال غير معروف ولماذا؟", "a": "قيمة الأعلام في البناء المنشور، وصول API رغم إخفاء الواجهة، ضبط مفتاح الإدارة، سلوك قاعدة الإنتاج، وأسعار مزود الوسائط. السبب: صلاحية هذه المرحلة تمنع التشغيل الحي ولم تُجلب تسعيرة موثوقة."},
    ]
    dump("site-answers.json", answers)

    sections = {
        "s0": [C("RC2 — استكمال الدراسة بعد المراجعة. الحالة: بانتظار إعادة المراجعة. GATE-00 غير مغلق."), H("إجابات المراجعة"), L([a["q"] + " " + a["a"] for a in answers])],
        "s1": [P("الرؤية الأصلية ثابتة: متجر بنحو 50 منتجًا، لكل منتج عرض مرئي مستقل، وإعلان المشهور يشير إلى المنتج دون نسخ السعر أو المخزون."), P("البث الحي ليس جزءًا من الرؤية المنفذة. هو {{DEC-0002}}."), PR("العقود في القسم 8 مقترحة وغير منفذة.")],
        "s2": [P("خط الأساس السابق والحالي: {{EVD-0022}}. commit المفحوص 15fe65c40d3dedb9afdd95619f2945bd84cb616a. وقت الفحص 2026-09-23T03:43:29+03:00."), P("شجرة العمل متسخة بملفات خارج هذه الدراسة. لم تُمسح ولم تُنسب إلى RC2. الفرق عن الأساس السابق: نفس commit، مع حزمة دراسة RC2 غير مدمجة في المنتج."), L(["المستودع: /Users/fayez/Desktop/mira", "الفرع: mira/p5-strict-frontend-recovery-2026-09-14", "ما لم يُفحص: بناء المتجر المنشور وقيمة dart-define على الجهاز"])],
        "s3": [P("القدرات التالية من البيانات. التفعيل ENABLED غير مستخدم مع SOURCE_ONLY في هذه النسخة."), C("الغياب ABSENT_AFTER_SEARCH يعني نطاق البحث في الدليل، لا نفيًا لكل منظومة خارج المستودع.")],
        "s4": [P("كل خدمة مفصولة إلى إخفاء واجهة، ومنع تنقل، وبوابة خادم، ووصول API، واكتمال منطق، واعتماد خارجي."), C("إن كان الحقل UNKNOWN فلا يُستنتج منه إيقاف ولا تشغيل."), H("الأحكام التي تغيرت بعد المراجعة")],
        "s5": [P("الشراء الحالي يفتح رابطًا خارجيًا {{EVD-0004}}. الحجز زر غير مكتمل {{EVD-0003}}. الاستفسار والاتصال ليسا مسارين منفصلين في المصدر المفحوص."), PR("الفصل المطلوب في {{REQ-0019}} غير منفذ.")],
        "s6": [P("التتبع أدناه من المصدر. يمكن إعادة استخدام العزل في الكتابة. التتبع الذي يأخذ partnerId من العميل يحتاج توسيع حماية لاحقًا ولا يُصلح هنا."), C("لم يُثبت تشغيل إنتاجي. الوسم SOURCE_ONLY مقصود."), H("ما لم يُتحقق منه"), L(["عزل القراءة على قاعدة حية", "جلسات إنتاج", "وجود فروع أو موظفين خارج أسماء البحث", "نشر partners.mira.app وadmin.mira.app في هذه الجولة"])],
        "s7": [P("لا نموذج ناشر أو معلن في النطاق {{EVD-0023}}. الموافقة والربط مقترحان في عقد AdLink."), PR("الإعلان يقرأ السعر من المتغير. انتهاء الربط يخفي الإعلان ولا يحذف المنتج. الطلب القديم يحتفظ بلقطته حسب {{REQ-0011}} غير المنفذ.")],
        "s8": [PR("التصنيفات التالية مقترحة للدراسة. القيم تُدار من قاموس المتجر لا من نص حر عندما تكون تعدادًا."), P("القاعدة: خصائص الفلتر على متغير واحد تُجمع بـ AND. القيم داخل الخاصية الواحدة متعددة الاختيار تُجمع بـ OR. عدد المنتجات المطابقة ليس عدد المقاطع."), H("مثال قابل للتحقق")],
        "s9": [P("قبل أي مزود جديد: لا مشغل فيديو في lib وmira-api/src حسب {{EVD-0024}}."), P("الدورة المقترحة غير منفذة: رفع ثم تحقق ثم معالجة ثم مراجعة ثم نشر ثم تشغيل ثم إيقاف أو حذف."), C("الأسعار: غير متحقق. المعادلات في بيانات التكلفة ظاهرة في هذا القسم.")],
        "s10": [P("الطلب والحجز والاستفسار والاتصال مسارات مختلفة في المتطلب، وليست كذلك في التنفيذ المفحوص."), P("بعد تغير الكتالوج، الطلب القديم — إن وُجد لاحقًا — يحتفظ بلقطة المتغير. لا جدول طلب اليوم داخل نطاق {{EVD-0018}}.")],
        "s11": [P("التحليلات الحالية أحداث شريك لثلاثين يومًا. {{EVD-0013}} يوضح أن trackEvent يقبل partnerId من العميل بلا حارس."), C("هذا عيب منتج مُسجّل. لا يُصلح في GATE-00."), L(["ما يمكن إعادة استخدامه: عدّ الأحداث للشريك المالك بعد تصحيح المصدر", "ما يحتاج تطويرًا: رفض المعرف القادم من الجسم وربطه بالرمز"])],
        "s12": [P("المصادر بتاريخ اطلاع 2026-09-23. ليست اعتمادًا قانونيًا. أثرها على التصميم وأسئلة المختص في الجدول."), C("عبارة تحتاج مراجعة لا تُستخدم هنا بديلًا عن إيراد المصدر.")],
        "s13": [P("الموجود القابل لإعادة الاستخدام: كتالوج الشريك، الحارس، اعتماد الطلبات، لوحة المفتاح، الرابط الخارجي."), P("التوسعة: متغير، وسيط، فرع، إعلان، فلاتر خادمية. التكامل مع مزود وسائط مؤجل لأن السعر غير متحقق.")],
        "s14": [P("لكل متطلب معطى وإجراء ونتيجة وفشل وطريقة اختبار ودليل. المعيار العام السابق أُزيل."), P("وجود صف في الجدول لا يعني أن المنتج حقق المعيار. الحالة proposed.")],
        "s15": [P("GATE-00 دراسة فقط وقيد المعالجة. بوابات 01 إلى 05 تغطي البيانات والخادم وويب الشركاء والتطبيق والإدارة والتحقق، لا واجهة فيديو وحدها."), P("{{REQ-0020}} في قرارات النطاق مرتبط بـ {{DEC-0002}} وليس مرحلة بناء.")],
        "s16": [P("لا قرار يُعلَّم معتمدًا من هذه الأداة. {{DEC-0005}} يبقى بانتظار المالك.")],
        "s17": [P("كل دليل يذكر ما يثبته وما لا يثبته. روابط المقتطفات نسبية."), C("ملخص CMD-0001 أُبقي كدليل على ضعف النسخة السابقة. السجل الجديد {{EVD-0018}}.")],
        "s18": [P("الإصدار السابق 1.0.0-GATE00-study-draft. الإصدار الحالي RC2 — استكمال الدراسة بعد المراجعة."), P("الملاحظات السابقة لم تُحذف. حالتها السابقة ظاهرة في سجل REV.")],
        "s19": [P("حدّث JSON ثم شغّل generate_data_js.py ثم validate_study.py. لا تكتب نتائج التدقيق داخل app.js."), L(["اختبار سلبي على نسخة مؤقتة فقط", "لا تعديل لملفات الأدلة الأصلية أثناء التجربة", "node --check صحة صياغة فقط", "HTTP 200 استجابة فقط"])],
        "s20": [P("الملاحظة تبقى ظاهرة بعد معالجتها مع الحالة السابقة والإجراء والدليل والقيود."), C("الحالة معالجة بانتظار المراجعة ليست إغلاقًا. قيد المعالجة يعني أن جزءًا ما زال ناقصًا.")],
        "s21": [P("انتقل من بند التكليف إلى القسم ثم الدليل. اكتمال العنوان لا يعني اكتمال المحتوى. الحالة partial تبقى ظاهرة.")],
    }
    dump("section-content.json", sections)

    cats = [
        ("CAT-FACE", "الوجه", ["النوع", "نوع البشرة المعلن", "الحجم", "السعر"], "OR داخل النوع، AND مع الحجم والسعر", "مل", "لا ادعاء طبي من الوسوم"),
        ("CAT-BODY", "الجسم", ["المنطقة", "القوام", "الحجم", "السعر"], "AND بين المنطقة والحجم", "مل", "المنطقة تعداد"),
        ("CAT-HAIR", "الشعر", ["نوع الشعر المعلن", "الهدف", "الحجم"], "AND", "مل", "النوع تسويقي لا تشخيص"),
        ("CAT-APPAREL", "الملابس", ["نوع القطعة", "اللون", "المقاس", "التوفر"], "AND على متغير واحد للون والمقاس والتوفر", "مقاس حرفي", "مثال الفستان هنا"),
        ("CAT-ACCESSORY", "الإكسسوارات", ["النوع", "اللون", "المادة"], "AND", "بدون وحدة مقاس ملابس", "المادة تعداد"),
        ("CAT-SALON", "المشاغل", ["الخدمة", "المدينة", "مدة بالدقائق"], "AND", "دقيقة", "ليست خدمة طبية"),
        ("CAT-CLINIC", "العيادات", ["التخصص", "المدينة", "نوع الزيارة"], "AND", "دقيقة", "حقول إعلان صحي منفصلة"),
    ]
    categories = []
    for i, name, quick, logic, unit, note in cats:
        categories.append({
            "id": i,
            "nameAr": name,
            "filters": quick,
            "subcategoriesAr": ["يُقترح تعداد فرعي يديره المتجر ضمن الفئة"],
            "attributesOnCreateAr": quick,
            "quickFilters": quick[:3],
            "advancedFilters": quick,
            "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
            "unitsAr": unit,
            "logicAr": logic,
            "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
            "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
            "paginationAr": "حد صفحة ثابت مع عدد كلي.",
            "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
            "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
            "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
            "note": note,
            "unimplemented": True,
        })
    dump("categories.json", categories)

    project = load("project.json")
    project["studyVersion"] = "RC2 — استكمال الدراسة بعد المراجعة"
    project["studyStatus"] = "بانتظار إعادة المراجعة"
    project["updatedAt"] = NOW
    project["previousStudyVersion"] = "1.0.0-GATE00-study-draft"
    project["previousPackage"] = "MIRA_ECOMMERCE_MASTER_STUDY_REVIEW_20260923_032329.zip"
    project["ownerDecisionStatus"] = "بانتظار إعادة المراجعة — DEC-0005 غير معتمد"
    project["baseline"]["inspectedAt"] = NOW
    project["baseline"]["previousCommitSha"] = "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    project["baseline"]["commitSha"] = "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    project["baseline"]["deltaFromPreviousAr"] = "نفس commit. الفرق هو تصحيح الدراسة لا تغيير منتج. الشجرة المتسخة موثقة في EVD-0022."
    project["blockers"] = [
        "GATE-00 بانتظار إعادة المراجعة",
        "لا دليل تشغيل إنتاجي",
        "لا متغيرات ولا طلب داخل النطاق المبحوث",
        "تتبع الأحداث يقبل partnerId من العميل في المصدر",
        "أسعار الوسائط غير متحققة",
    ]
    evd_n = len(load("evidence-index.json"))
    project["counts"] = {
        "requirements": 20,
        "gaps": len(load("gaps.json")),
        "evidence": evd_n,
        "capabilities": 14,
        "decisions": len(load("decisions.json")),
        "paused": 3,
        "gates": 6,
        "reviewFindings": len(load("review-findings.json")),
        "scopeItems": len(load("scope-coverage.json")),
    }
    dump("project.json", project)

    ch = load("changelog.json")
    ch.append({
        "version": "RC2 — استكمال الدراسة بعد المراجعة",
        "date": NOW,
        "changesAr": [
            "تصحيح أحكام التفعيل والغياب والإيقاف",
            "أدلة تنفيذ الشركاء والإدارة",
            "سجل REV ومعايير قبول وخطة بوابات",
            "عقود مقترحة ومصادر تنظيمية بتاريخ اطلاع",
            "نقل النص الموضوعي إلى JSON",
        ],
        "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
        "previousVersion": "1.0.0-GATE00-study-draft",
    })
    dump("changelog.json", ch)
    print("content written", evd_n)


if __name__ == "__main__":
    main()
