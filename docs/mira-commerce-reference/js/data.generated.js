/* Generated from data/*.json — do not edit by hand */
window.MIRA_STUDY = {
  "project": {
    "studyId": "MIRA-ECOM-GATE00",
    "studyVersion": "RC4 بصري — تصحيح المعاينة والأدلة والتكوين",
    "studyStatus": "بانتظار إعادة المراجعة",
    "gate": "GATE-00",
    "titleAr": "المتاجر الإلكترونية في ميرا",
    "updatedAt": "2026-09-27T05:20:00+03:00",
    "timezone": "Asia/Riyadh",
    "ownerDecisionStatus": "بانتظار إعادة المراجعة — DEC-0005 غير معتمد",
    "baseline": {
      "repoPath": "/Users/fayez/Desktop/mira",
      "branch": "mira/p5-strict-frontend-recovery-2026-09-14",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "workingTreeNote": "تغييرات غير ملتزمة في iOS/skin — خارج نطاق هذه الدراسة",
      "appVersionInPubspec": "1.0.0+2026092302",
      "sourceVsBuildVsDeviceVsProd": {
        "sourceExamined": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
        "buildExamined": "غير مربوط بهذه الدراسة",
        "deviceExamined": "غير مثبت لهذه الدراسة",
        "productionExamined": "SOURCE_ONLY"
      },
      "inspectedAt": "2026-09-23T03:43:29+03:00",
      "previousCommitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "deltaFromPreviousAr": "نفس commit. الفرق هو تصحيح الدراسة لا تغيير منتج. الشجرة المتسخة موثقة في EVD-0022."
    },
    "blockers": [
      "GATE-00 بانتظار إعادة المراجعة",
      "لا دليل تشغيل إنتاجي",
      "لا متغيرات ولا طلب داخل النطاق المبحوث",
      "تتبع الأحداث يقبل partnerId من العميل في المصدر",
      "أسعار الوسائط غير متحققة",
      "المعتمد بالكامل 2 من 5. PH-3 مقبولة برمجيًا وPH3-STORAGE-LIVE مفتوح. PH-4 قيد التنفيذ وقواعد العد غير معتمدة. DEC-0007 غير محسوم. لا تكامل زد."
    ],
    "decisionsNeeded": [
      "DEC-0001",
      "DEC-0002",
      "DEC-0003",
      "DEC-0004",
      "DEC-0005",
      "DEC-0007"
    ],
    "brandTokens": {
      "primary": "#E86FA9",
      "primaryLight": "#FADAE9",
      "primaryDark": "#C95889",
      "secondary": "#C19EE0",
      "background": "#FFF7FA",
      "text": "#4A3A3A",
      "gold": "#D4AF37",
      "source": "lib/shared/theme/colors.dart"
    },
    "counts": {
      "requirements": 27,
      "gaps": 20,
      "evidence": 47,
      "capabilities": 15,
      "decisions": 7,
      "paused": 3,
      "gates": 10,
      "reviewFindings": 39,
      "scopeItems": 37
    },
    "previousStudyVersion": "RC1 — مراحل اكتشفي وشاشة العرض",
    "previousPackage": "MIRA_ECOMMERCE_MASTER_STUDY_REVIEW_20260923_032329.zip",
    "placesHandoff": {
      "package": "DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_RC2_20260924_0125.zip",
      "sha256": "60a8d854eb609e1eef11513a1406fd1e262ac809922e889f2e7beecf76ec48e1"
    },
    "releaseDelivery": {
      "rc4ReleaseId": "MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324"
    }
  },
  "repositories": [
    {
      "id": "REPO-0001",
      "path": "/Users/fayez/Desktop/mira",
      "roleAr": "مستودع موحّد Flutter + API + بوابات",
      "branch": "mira/p5-strict-frontend-recovery-2026-09-14",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "workingTree": "dirty (غير متعلق بالدراسة)",
      "inspectedAt": "2026-09-23T03:20:00+03:00",
      "dependencyFiles": [
        "pubspec.yaml",
        "mira-api/package.json",
        "mira-api/prisma/schema.prisma",
        "render.yaml"
      ],
      "envVarNamesOnly": [
        "DATABASE_URL",
        "MIRA_API_BASE_URL",
        "MIRA_MARKETPLACE_ENABLED",
        "PARTNER_AUTO_APPROVE",
        "AUTH_SKIP",
        "ADMIN_API_KEY"
      ],
      "runHints": [
        "flutter run",
        "cd mira-api && npm run start:dev"
      ],
      "subprojects": [
        {
          "id": "SP-FLUTTER",
          "path": "lib/",
          "role": "تطبيق العميل"
        },
        {
          "id": "SP-API",
          "path": "mira-api/",
          "role": "NestJS"
        },
        {
          "id": "SP-PARTNERS",
          "path": "partners-portal/",
          "role": "ويب الشركاء"
        },
        {
          "id": "SP-ADMIN",
          "path": "admin-portal/",
          "role": "لوحة الإدارة"
        },
        {
          "id": "SP-WEB",
          "path": "website/",
          "role": "تسويق"
        }
      ]
    },
    {
      "id": "REPO-0002",
      "path": "غير متاح للفحص",
      "roleAr": "مستودع تجارة منفصل",
      "note": "غير موجود ضمن نطاق Desktop المفحوص"
    }
  ],
  "capabilities": [
    {
      "id": "CAP-0001",
      "nameAr": "كتالوج الشركاء",
      "area": "marketplace",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0005",
        "EVD-0006"
      ],
      "judgmentNoteAr": "الكود موجود. تفعيل الإنتاج غير مثبت لأن التحقق SOURCE_ONLY."
    },
    {
      "id": "CAP-0002",
      "nameAr": "مطابقة البشرة",
      "area": "marketplace",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0006"
      ],
      "judgmentNoteAr": "مسار مطابقة في المتحكم العام. لا دليل تشغيل."
    },
    {
      "id": "CAP-0003",
      "nameAr": "واجهة Discover",
      "area": "flutter",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0001",
        "EVD-0002"
      ],
      "judgmentNoteAr": "العلم الافتراضي false يخفي الواجهة في المصدر. وصول API الإنتاج UNKNOWN."
    },
    {
      "id": "CAP-0004",
      "nameAr": "شراء عبر رابط خارجي",
      "area": "flutter",
      "existence": "PARTIAL",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0004",
        "EVD-0007"
      ],
      "judgmentNoteAr": "الشراء في الشاشة رابط خارجي. SPEC وثيقة لا تثبت التفعيل."
    },
    {
      "id": "CAP-0005",
      "nameAr": "حجز خدمة",
      "area": "booking",
      "existence": "PARTIAL",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0003"
      ],
      "judgmentNoteAr": "الزر stub في المصدر. ليست خدمة مكتملة متوقفة."
    },
    {
      "id": "CAP-0006",
      "nameAr": "سلة/طلب منتجات",
      "area": "orders",
      "existence": "ABSENT_AFTER_SEARCH",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0018",
        "EVD-0010"
      ],
      "judgmentNoteAr": "الغياب محصور بنطاق البحث في EVD-0018. الملخص القديم EVD-0010 غير كافٍ وحده."
    },
    {
      "id": "CAP-0007",
      "nameAr": "بوابة الشركاء",
      "area": "partners-portal",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0011",
        "EVD-0012",
        "EVD-0013",
        "EVD-0016",
        "EVD-0021",
        "EVD-0007"
      ],
      "judgmentNoteAr": "التنفيذ موجود في المصدر. EVD-0007 مواصفات فقط. التفعيل الإنتاجي غير مثبت."
    },
    {
      "id": "CAP-0008",
      "nameAr": "لوحة الإدارة",
      "area": "admin",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0014",
        "EVD-0015",
        "EVD-0025"
      ],
      "judgmentNoteAr": "أُضيف دليل المتحكم والعميل. لا يُصنف مفعّلًا في الإنتاج من الشيفرة."
    },
    {
      "id": "CAP-0009",
      "nameAr": "كتالوج محلي احتياطي",
      "area": "marketplace",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0008"
      ],
      "judgmentNoteAr": "بذرة محلية في المصدر عند غياب الشبكة. ليست كتالوج إنتاج."
    },
    {
      "id": "CAP-0010",
      "nameAr": "فيديو منتج متتابع",
      "area": "media",
      "existence": "ABSENT_AFTER_SEARCH",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0023",
        "EVD-0024"
      ],
      "judgmentNoteAr": "لا تطابق لأنماط الفيديو المتتابع داخل النطاق. ليس حكمًا على كل مستودع خارج الفحص."
    },
    {
      "id": "CAP-0011",
      "nameAr": "مشاهير/إعلانات منتج",
      "area": "creators",
      "existence": "ABSENT_AFTER_SEARCH",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0023",
        "EVD-0019"
      ],
      "judgmentNoteAr": "لا نموذج مشاهير في النطاق المبحوث."
    },
    {
      "id": "CAP-0012",
      "nameAr": "متغيرات منتج",
      "area": "catalog",
      "existence": "ABSENT_AFTER_SEARCH",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0017",
        "EVD-0019",
        "EVD-0005"
      ],
      "judgmentNoteAr": "العقد والمخطط المبحوثان بلا متغير. المقتطف وحده لا ينفي المشروع كله؛ البحث الأوسع في EVD-0019."
    },
    {
      "id": "CAP-0013",
      "nameAr": "فلاتر متخصصة",
      "area": "filters",
      "existence": "PARTIAL",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0017",
        "EVD-0006"
      ],
      "judgmentNoteAr": "concernTags وskinTypes موجودان. فلاتر المقاس واللون غير موجودة في العقد."
    },
    {
      "id": "CAP-0014",
      "nameAr": "اشتراكات رصيد (منفصل)",
      "area": "subscriptions",
      "existence": "EXISTING",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0020"
      ],
      "judgmentNoteAr": "مسار اشتراك رصيد منفصل عن المتجر. العلم الافتراضي false في المصدر. ليس دليل إيقاف إنتاجي مستقل."
    },
    {
      "id": "CAP-0015",
      "nameAr": "حزمة مصدر الأماكن للمراجعة",
      "area": "places-handoff",
      "existence": "PARTIAL",
      "activation": "UNKNOWN",
      "verification": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0028"
      ],
      "judgmentNoteAr": "الحزمة مصدر مراجعة وليست تطبيقًا مدمجًا في ميرا ولا بناءً مستقلًا."
    }
  ],
  "pausedServices": [
    {
      "id": "PAUSE-0001",
      "nameAr": "Discover في التطبيق",
      "previousClassificationAr": "خدمة متوقفة موثقة بسبب عبارة الانطلاق قريبًا، وAPI يمكن الوصول إليه",
      "correctedClassificationAr": "إخفاء واجهة في المصدر عبر علم بناء. سبب الإيقاف التاريخي غير موثق تشغيليًا.",
      "classification": "UI_FLAG_DEFAULT_OFF",
      "uiHidden": "true-in-source",
      "navigationBlocked": "true-in-client-routes",
      "serverFeatureGate": "UNKNOWN",
      "apiReachableDespiteUiHide": "UNKNOWN",
      "logicCompleteness": "PARTIAL",
      "externalDependencyMissing": "UNKNOWN",
      "documentedReason": "التعليق «الانطلاق قريبًا» نص واجهة. الآلية التقنية في المصدر هي MIRA_MARKETPLACE_ENABLED الافتراضي false. لا وثيقة تشغيل تشرح سبب الإيقاف. توجيه المالك اللاحق: الإبقاء للإعداد لتجربة العرض المرئي، مع التصريح الآن بنسخة اختبار منفصلة.",
      "reasonClass": "سبب تاريخي غير موثق؛ الآلية في المصدر موثقة",
      "evidenceIds": [
        "EVD-0001",
        "EVD-0002",
        "EVD-0006"
      ],
      "reactivationNeeds": [
        "قرار مالك",
        "معرفة قيمة العلم في البناء المنشور",
        "مراجعة الكتالوج قبل الإظهار"
      ],
      "reactivationRisks": [
        "إظهار بذرة محلية كأنها متجر حي"
      ],
      "ownerDirectiveAr": "توجيه المالك: أُبقيت مغلقة لتطويرها إلى تجربة العرض المرئي. هذا التوجيه منفصل عن استنتاج الكود بأن العلم الافتراضي false.",
      "testActivationAr": "صُرّح بتفعيل نسخة اختبار بالعلم دون تغيير الافتراضي."
    },
    {
      "id": "PAUSE-0002",
      "nameAr": "الحجز الإلكتروني",
      "previousClassificationAr": "خدمة متوقفة",
      "correctedClassificationAr": "مسار غير مكتمل في التصميم الحالي، وليس خدمة أُوقفت بعد اكتمالها.",
      "classification": "NEVER_COMPLETED_STUB",
      "uiHidden": "button-disabled-or-snackbar",
      "navigationBlocked": "UNKNOWN",
      "serverFeatureGate": "no-booking-model-in-searched-schema",
      "apiReachableDespiteUiHide": "UNKNOWN",
      "logicCompleteness": "STUB",
      "externalDependencyMissing": "UNKNOWN",
      "documentedReason": "الزر في الشاشة لا ينشئ حجزًا. لا يوجد model Booking في البحث EVD-0018. لا سبب تشغيلي تاريخي منفصل.",
      "reasonClass": "غير منفذ حتى الاكتمال",
      "evidenceIds": [
        "EVD-0003",
        "EVD-0018",
        "EVD-0017"
      ],
      "reactivationNeeds": [
        "عقد حجز",
        "مواعيد",
        "لا يكفي إعادة تشغيل خادم"
      ],
      "reactivationRisks": [
        "اعتبار الزر الحالي حجزًا حقيقيًا"
      ]
    },
    {
      "id": "PAUSE-0003",
      "nameAr": "شراء داخل ميرا",
      "previousClassificationAr": "خدمة متوقفة لأن SPEC يقول الدفع عند الشريك",
      "correctedClassificationAr": "غير منفذ في التصميم الحالي. ليس خدمة تحتاج إعادة تشغيل.",
      "classification": "NEVER_BUILT",
      "uiHidden": "buy-opens-external-url",
      "navigationBlocked": "not-applicable",
      "serverFeatureGate": "no-order-model-in-searched-scope",
      "apiReachableDespiteUiHide": "UNKNOWN",
      "logicCompleteness": "NOT_IMPLEMENTED",
      "externalDependencyMissing": "UNKNOWN",
      "documentedReason": "الشاشة تفتح externalUrl. المواصفات تقول الدفع عند الشريك. لا سجل تشغيلي يقول إن شراءً داخليًا كان يعمل ثم أُوقف.",
      "reasonClass": "تصميم خارجي وليس إيقافًا",
      "evidenceIds": [
        "EVD-0004",
        "EVD-0007",
        "EVD-0018"
      ],
      "reactivationNeeds": [
        "DEC-0001 قبل أي بناء"
      ],
      "reactivationRisks": [
        "بناء سلة فوق مسار رابط خارجي دون قرار"
      ]
    }
  ],
  "requirements": [
    {
      "id": "REQ-0001",
      "nameAr": "منتج أساسي بهوية ثابتة",
      "area": "catalog",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0001",
      "gapId": "GAP-0001",
      "acceptanceAr": "المعطى: منتج شريك موجود بهوية ثابتة. الإجراء: إنشاء منتج ثانٍ ثم تعديل سعر الأول. المتوقع: يبقى معرف المنتج الأول وتاريخه، ويتغير السعر المسجل دون إنشاء منتج جديد.",
      "acceptance": {
        "given": "منتج شريك موجود بهوية ثابتة",
        "action": "إنشاء منتج ثانٍ ثم تعديل سعر الأول",
        "expected": "يبقى معرف المنتج الأول وتاريخه، ويتغير السعر المسجل دون إنشاء منتج جديد",
        "failures": [
          "رفض اسم فارغ",
          "رفض سعر سالب"
        ],
        "testMethod": "اختبار خدمة على قاعدة اختبار",
        "evidenceRequired": "سجل المنتج قبل وبعد مع المعرف"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0002",
      "nameAr": "متغيرات مقاس/لون/مخزون",
      "area": "catalog",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0012",
      "gapId": "GAP-0002",
      "acceptanceAr": "المعطى: منتج له متغيران لون×مقاس. الإجراء: طلب المتغير الأزرق M المتوفر. المتوقع: يُختار متغير واحد تتطابق خصائصه كلها.",
      "acceptance": {
        "given": "منتج له متغيران لون×مقاس",
        "action": "طلب المتغير الأزرق M المتوفر",
        "expected": "يُختار متغير واحد تتطابق خصائصه كلها",
        "failures": [
          "متغير بلا مخزون لا يُباع",
          "دمج لون من متغير ومقاس من آخر"
        ],
        "testMethod": "اختبار استعلام المتغير",
        "evidenceRequired": "صف المتغير المطابق فقط"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0003",
      "nameAr": "خدمة + مقدم + فرع",
      "area": "catalog",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0001",
      "gapId": "GAP-0003",
      "acceptanceAr": "المعطى: طلب انضمام عيادة. الإجراء: اعتماد الإدارة ثم إضافة خدمة وفرع. المتوقع: الخدمة ترتبط بالمنشأة والفرع لا بمنتج عام.",
      "acceptance": {
        "given": "طلب انضمام عيادة",
        "action": "اعتماد الإدارة ثم إضافة خدمة وفرع",
        "expected": "الخدمة ترتبط بالمنشأة والفرع لا بمنتج عام",
        "failures": [
          "عيادة بلا ترخيص موثق تبقى قيد المراجعة"
        ],
        "testMethod": "اختبار الاعتماد ومسار الفرع",
        "evidenceRequired": "سجل الفرع والخدمة"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0004",
      "nameAr": "محتوى مرئي للمنتج",
      "area": "media",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0010",
      "gapId": "GAP-0004",
      "acceptanceAr": "المعطى: ملف فيديو ضمن الحدود. الإجراء: رفعه وربطه بمنتج. المتوقع: لا يُعرض قبل المراجعة، ويشير إلى المنتج الأصلي.",
      "acceptance": {
        "given": "ملف فيديو ضمن الحدود",
        "action": "رفعه وربطه بمنتج",
        "expected": "لا يُعرض قبل المراجعة، ويشير إلى المنتج الأصلي",
        "failures": [
          "رفض نوع غير مسموح",
          "فشل المعالجة يبقي الحالة فشل"
        ],
        "testMethod": "اختبار دورة الوسائط",
        "evidenceRequired": "حالات الوسيط"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0005",
      "nameAr": "تصفح فيديو متتابع",
      "area": "media",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0010",
      "gapId": "GAP-0005",
      "acceptanceAr": "المعطى: ثلاثة مقاطع منشورة. الإجراء: تمرير عمودي مع صوت. المتوقع: مقطع واحد مسموع، واستئناف الموضع عند العودة.",
      "acceptance": {
        "given": "ثلاثة مقاطع منشورة",
        "action": "تمرير عمودي مع صوت",
        "expected": "مقطع واحد مسموع، واستئناف الموضع عند العودة",
        "failures": [
          "تداخل صوت مقطعين",
          "اقتصاص خارج الإطار"
        ],
        "testMethod": "اختبار واجهة على جهاز",
        "evidenceRequired": "تسجيل شاشة ولقطات"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0006",
      "nameAr": "عرض متجر رسمي",
      "area": "partners",
      "priority": "should",
      "status": "proposed",
      "existingCapabilityId": "CAP-0007",
      "gapId": null,
      "acceptanceAr": "المعطى: شريك معتمد. الإجراء: فتح صفحته العامة من التطبيق. المتوقع: تظهر منتجاته النشطة فقط ورابط متجره.",
      "acceptance": {
        "given": "شريك معتمد",
        "action": "فتح صفحته العامة من التطبيق",
        "expected": "تظهر منتجاته النشطة فقط ورابط متجره",
        "failures": [
          "منتجات شريك آخر لا تُخلط"
        ],
        "testMethod": "اختبار عرض المتجر",
        "evidenceRequired": "قائمة المنتجات المعروضة"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0007",
      "nameAr": "إعلانات مشاهير بلا نسخ مخزون",
      "area": "creators",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0011",
      "gapId": "GAP-0006",
      "acceptanceAr": "المعطى: إعلان مشهور مربوط بمنتج. الإجراء: تغيير سعر المنتج ومخزونه. المتوقع: الإعلان يقرأ السعر والمخزون من المنتج ولا يخزن نسخة.",
      "acceptance": {
        "given": "إعلان مشهور مربوط بمنتج",
        "action": "تغيير سعر المنتج ومخزونه",
        "expected": "الإعلان يقرأ السعر والمخزون من المنتج ولا يخزن نسخة",
        "failures": [
          "رفض نشر إعلان بلا منتج"
        ],
        "testMethod": "اختبار عدم النسخ",
        "evidenceRequired": "مقارنة حقول الإعلان والمنتج"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0008",
      "nameAr": "فصل الناشر/البائع/المحتوى/الطلب",
      "area": "creators",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0011",
      "gapId": "GAP-0007",
      "acceptanceAr": "المعطى: أطراف الناشر والمعلن والبائع مختلفة. الإجراء: فتح الإعلان ثم الشراء. المتوقع: الطلب يُنسب للبائع والمحتوى للناشر.",
      "acceptance": {
        "given": "أطراف الناشر والمعلن والبائع مختلفة",
        "action": "فتح الإعلان ثم الشراء",
        "expected": "الطلب يُنسب للبائع والمحتوى للناشر",
        "failures": [
          "خلط هوية المعلن مع البائع"
        ],
        "testMethod": "اختبار الإسناد",
        "evidenceRequired": "سجل الأطراف"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0009",
      "nameAr": "حالات نشر المحتوى",
      "area": "media",
      "priority": "should",
      "status": "proposed",
      "existingCapabilityId": "CAP-0010",
      "gapId": "GAP-0008",
      "acceptanceAr": "المعطى: وسيط قيد المراجعة. الإجراء: محاولة تشغيله في التصفح. المتوقع: لا يظهر في الخلاصة العامة.",
      "acceptance": {
        "given": "وسيط قيد المراجعة",
        "action": "محاولة تشغيله في التصفح",
        "expected": "لا يظهر في الخلاصة العامة",
        "failures": [
          "نشر بلا مراجعة"
        ],
        "testMethod": "اختبار حالات النشر",
        "evidenceRequired": "حالة الوسيط قبل وبعد"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0010",
      "nameAr": "موافقة المتجر على الإعلان",
      "area": "creators",
      "priority": "should",
      "status": "proposed",
      "existingCapabilityId": "CAP-0011",
      "gapId": "GAP-0009",
      "acceptanceAr": "المعطى: إعلان بانتظار موافقة المتجر. الإجراء: المتجر يرفض الربط. المتوقع: يختفي من العرض ويبقى المنتج.",
      "acceptance": {
        "given": "إعلان بانتظار موافقة المتجر",
        "action": "المتجر يرفض الربط",
        "expected": "يختفي من العرض ويبقى المنتج",
        "failures": [
          "ربط بلا موافقة"
        ],
        "testMethod": "اختبار حالة الربط",
        "evidenceRequired": "سجل الموافقة"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0011",
      "nameAr": "حفظ مرجع المنتج عند الطلب",
      "area": "orders",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0006",
      "gapId": "GAP-0010",
      "acceptanceAr": "المعطى: طلب على متغير محدد. الإجراء: تغيير سعر المتغير لاحقًا. المتوقع: الطلب يحتفظ بسعر ونسخة المتغير وقت الإنشاء.",
      "acceptance": {
        "given": "طلب على متغير محدد",
        "action": "تغيير سعر المتغير لاحقًا",
        "expected": "الطلب يحتفظ بسعر ونسخة المتغير وقت الإنشاء",
        "failures": [
          "الطلب يتبع السعر الجديد صامتًا"
        ],
        "testMethod": "اختبار لقطة الطلب",
        "evidenceRequired": "لقطة السعر"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0012",
      "nameAr": "رحلة مشاهدة→طلب",
      "area": "journey",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0004",
      "gapId": "GAP-0011",
      "acceptanceAr": "المعطى: مستخدم على مقطع منتج. الإجراء: يختار شراء أو حجز أو استفسار. المتوقع: كل مسار يفتح وجهته دون تحويل الكل إلى الشراء.",
      "acceptance": {
        "given": "مستخدم على مقطع منتج",
        "action": "يختار شراء أو حجز أو استفسار",
        "expected": "كل مسار يفتح وجهته دون تحويل الكل إلى الشراء",
        "failures": [
          "زر واحد لكل المسارات"
        ],
        "testMethod": "اختبار الرحلة",
        "evidenceRequired": "سجل المسار المختار"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0013",
      "nameAr": "فلاتر AND على متغير واحد",
      "area": "filters",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0013",
      "gapId": "GAP-0012",
      "acceptanceAr": "المعطى: فستان أزرق M متوفر وفستان أزرق S غير متوفر. الإجراء: فلتر لون أزرق AND مقاس M AND متوفر. المتوقع: منتج واحد ومتغير واحد.",
      "acceptance": {
        "given": "فستان أزرق M متوفر وفستان أزرق S غير متوفر",
        "action": "فلتر لون أزرق AND مقاس M AND متوفر",
        "expected": "منتج واحد ومتغير واحد",
        "failures": [
          "مطابقة اللون من متغير والمقاس من آخر"
        ],
        "testMethod": "اختبار المثال المرجعي",
        "evidenceRequired": "هوية المتغير المطابق"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0014",
      "nameAr": "فلترة خادمية مع ترقيم",
      "area": "filters",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0013",
      "gapId": "GAP-0013",
      "acceptanceAr": "المعطى: كتالوج أكبر من صفحة. الإجراء: فلتر مع ترتيب وترقيم. المتوقع: العدد الكلي صحيح والصفحة لا تكرر صفًا.",
      "acceptance": {
        "given": "كتالوج أكبر من صفحة",
        "action": "فلتر مع ترتيب وترقيم",
        "expected": "العدد الكلي صحيح والصفحة لا تكرر صفًا",
        "failures": [
          "فلترة على العميل بعد جلب الكل"
        ],
        "testMethod": "اختبار الاستعلام",
        "evidenceRequired": "العد ورقم الصفحة"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0015",
      "nameAr": "أحداث تحليلات",
      "area": "analytics",
      "priority": "should",
      "status": "proposed",
      "existingCapabilityId": "CAP-0007",
      "gapId": "GAP-0014",
      "acceptanceAr": "المعطى: حدث نقرة على منتج. الإجراء: تسجيله ثم عرضه للشريك المالك. المتوقع: الحدث مرتبط بالشريك والهدف.",
      "acceptance": {
        "given": "حدث نقرة على منتج",
        "action": "تسجيله ثم عرضه للشريك المالك",
        "expected": "الحدث مرتبط بالشريك والهدف",
        "failures": [
          "شريك يسجل حدثًا لشريك آخر من جسم الطلب"
        ],
        "testMethod": "اختبار التتبع بعد سد الثغرة",
        "evidenceRequired": "سجل الحدث والمالك"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0016",
      "nameAr": "عزل بيانات المتاجر",
      "area": "security",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0007",
      "gapId": null,
      "acceptanceAr": "المعطى: رمزان لشريكين. الإجراء: الشريك أ يحاول تعديل منتج ب. المتوقع: الرفض دون تسريب وجود المنتج.",
      "acceptance": {
        "given": "رمزان لشريكين",
        "action": "الشريك أ يحاول تعديل منتج ب",
        "expected": "الرفض دون تسريب وجود المنتج",
        "failures": [
          "قبول partnerId من الجسم في الكتابة"
        ],
        "testMethod": "اختبار العزل على قاعدة اختبار",
        "evidenceRequired": "استدعاء assert والنتيجة"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0017",
      "nameAr": "فصل البشرة عن الإعلان المدفوع",
      "area": "privacy",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": null,
      "gapId": "GAP-0015",
      "acceptanceAr": "المعطى: نتيجة تحليل بشرة وإعلان مدفوع. الإجراء: عرض التوصية. المتوقع: الإعلان موسوم مدفوعًا ولا يُقدَّم كنتيجة تحليل.",
      "acceptance": {
        "given": "نتيجة تحليل بشرة وإعلان مدفوع",
        "action": "عرض التوصية",
        "expected": "الإعلان موسوم مدفوعًا ولا يُقدَّم كنتيجة تحليل",
        "failures": [
          "خلط الإعلان مع درجة البشرة"
        ],
        "testMethod": "اختبار العرض",
        "evidenceRequired": "لقطة التمييز"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0018",
      "nameAr": "إعادة استخدام الكتالوج الحالي",
      "area": "reuse",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0001",
      "gapId": null,
      "acceptanceAr": "المعطى: جداول Partner وProduct الحالية. الإجراء: إضافة متغير دون جدول منتج موازٍ. المتوقع: المنتجات القديمة تبقى قابلة للقراءة.",
      "acceptance": {
        "given": "جداول Partner وProduct الحالية",
        "action": "إضافة متغير دون جدول منتج موازٍ",
        "expected": "المنتجات القديمة تبقى قابلة للقراءة",
        "failures": [
          "نسخ الكتالوج إلى مخطط جديد"
        ],
        "testMethod": "مراجعة الترحيل",
        "evidenceRequired": "خطة الترحيل والاختبار"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0019",
      "nameAr": "تمييز شراء/حجز/استفسار/اتصال",
      "area": "journey",
      "priority": "must",
      "status": "proposed",
      "existingCapabilityId": "CAP-0005",
      "gapId": "GAP-0016",
      "acceptanceAr": "المعطى: منتج وخدمة. الإجراء: إظهار الأفعال المتاحة. المتوقع: الشراء والحجز والاستفسار والاتصال أزرار مختلفة حسب النوع.",
      "acceptance": {
        "given": "منتج وخدمة",
        "action": "إظهار الأفعال المتاحة",
        "expected": "الشراء والحجز والاستفسار والاتصال أزرار مختلفة حسب النوع",
        "failures": [
          "حجز على منتج مادي بلا خدمة"
        ],
        "testMethod": "اختبار الأفعال",
        "evidenceRequired": "مصفوفة الأزرار"
      },
      "planPlacement": "future-gate"
    },
    {
      "id": "REQ-0020",
      "nameAr": "قرار البث الحي",
      "area": "media",
      "priority": "decision",
      "status": "proposed",
      "existingCapabilityId": "CAP-0010",
      "gapId": "GAP-0017",
      "acceptanceAr": "المعطى: قرار نطاق البث الحي ما زال مفتوحًا. الإجراء: مراجع الدراسة. المتوقع: لا تُبنى شاشة بث ولا تُغلق الدراسة بانتظارها.",
      "acceptance": {
        "given": "قرار نطاق البث الحي ما زال مفتوحًا",
        "action": "مراجع الدراسة",
        "expected": "لا تُبنى شاشة بث ولا تُغلق الدراسة بانتظارها",
        "failures": [
          "اعتبار البث متطلب إطلاق"
        ],
        "testMethod": "مراجعة DEC-0002",
        "evidenceRequired": "نص القرار وحالته"
      },
      "planPlacement": "scope-decision"
    },
    {
      "id": "REQ-0021",
      "nameAr": "عداد مشاهدات صادق على العرض المنشور",
      "area": "analytics",
      "gapId": "GAP-0018",
      "acceptanceAr": "المعطى: عرض منشور بفيديو أو صور. الإجراء: تحميل البيانات ثم السحب بين صور العرض نفسه دون بقاء مؤهل. المتوقع: لا يزيد العدد بالتحميل المسبق ولا بالسحب الأفقي، ولا يظهر صفر عند فشل الجلب.",
      "acceptance": {
        "given": "عرض منشور بفيديو أو صور",
        "action": "تحميل البيانات ثم السحب بين صور العرض نفسه دون بقاء مؤهل",
        "expected": "لا يزيد العدد بالتحميل المسبق ولا بالسحب الأفقي، ولا يظهر صفر عند فشل الجلب",
        "failures": [
          "احتساب التحميل مشاهدة",
          "إظهار صفر عند التعذر",
          "استبدال العدد برقم تسويقي"
        ],
        "testMethod": "اختبار عقد الأحداث لاحقًا؛ هذه الجولة توثيق فقط",
        "evidenceRequired": "سجل حدث مؤهل وسجل فشل جلب"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "متطلب معتمد"
    },
    {
      "id": "REQ-0022",
      "nameAr": "استيراد كتالوج خارجي دون نشر تلقائي",
      "area": "integration",
      "gapId": "GAP-0019",
      "acceptanceAr": "المعطى: تاجر لديه منتجات في متجر خارجي مربوط بصلاحيات مثبتة. الإجراء: استيراد البيانات والوسائط إلى مسودات. المتوقع: تبقى المسودات غير منشورة حتى الاعتماد، ويحتفظ كل منتج بهوية مصدره.",
      "acceptance": {
        "given": "تاجر لديه منتجات في متجر خارجي مربوط بصلاحيات مثبتة",
        "action": "استيراد البيانات والوسائط إلى مسودات",
        "expected": "تبقى المسودات غير منشورة حتى الاعتماد، ويحتفظ كل منتج بهوية مصدره",
        "failures": [
          "نشر تلقائي عند الاستيراد",
          "طلب فيديو لكل منتج قبل أي استفادة"
        ],
        "testMethod": "عقد ربط موثق؛ المنصة غير معتمدة الآن",
        "evidenceRequired": "سجل مسودة وحالة نشر"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "متطلب معتمد"
    },
    {
      "id": "REQ-0023",
      "nameAr": "إحصاءات إعلان المشهور مستقلة",
      "area": "ads",
      "gapId": "GAP-0018",
      "acceptanceAr": "المعطى: إعلان مشهور مرتبط بعرض تاجر أصلي. الإجراء: تسجيل مشاهدة للإعلان وأخرى للأصل. المتوقع: العددان منفصلان مع رابط بين الكيانين، والسعر يبقى من المصدر الأصلي.",
      "acceptance": {
        "given": "إعلان مشهور مرتبط بعرض تاجر أصلي",
        "action": "تسجيل مشاهدة للإعلان وأخرى للأصل",
        "expected": "العددان منفصلان مع رابط بين الكيانين، والسعر يبقى من المصدر الأصلي",
        "failures": [
          "نسخ السعر إلى الإعلان كمصدر مستقل",
          "دمج العددين في رقم واحد"
        ],
        "testMethod": "اختبار لاحق بعد وجود الكيانين",
        "evidenceRequired": "سجل عرض أصلي وسجل إعلان"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "متطلب معتمد"
    },
    {
      "id": "REQ-0024",
      "nameAr": "عرض كامل لكل منتج أو خدمة",
      "area": "experience",
      "gapId": "GAP-0020",
      "acceptanceAr": "المعطى: منتج أو خدمة له وسائط. الإجراء: فتح العرض في الاكتشاف أو داخل متجر. المتوقع: شاشة كاملة، وداخل المتجر تظهر عروضه المطابقة للفلاتر فقط.",
      "acceptance": {
        "given": "منتج أو خدمة له وسائط",
        "action": "فتح العرض في الاكتشاف أو داخل متجر",
        "expected": "شاشة كاملة، وداخل المتجر تظهر عروضه المطابقة للفلاتر فقط",
        "failures": [
          "قص المنتج بطريقة مضللة",
          "خلط عروض متجر آخر"
        ],
        "testMethod": "اختبار واجهة لاحق ببيانات اختبار",
        "evidenceRequired": "لقطات RTL وSafeArea"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "متطلب معتمد"
    },
    {
      "id": "REQ-0025",
      "nameAr": "فصل السحب العمودي عن الأفقي",
      "area": "experience",
      "gapId": "GAP-0020",
      "acceptanceAr": "المعطى: عرض فيه أكثر من وسيط. الإجراء: سحب أفقي ثم عمودي. المتوقع: الأفقي يبدل وسيط العرض نفسه والعمودي ينتقل للعرض التالي دون فقدان سياق التفاصيل.",
      "acceptance": {
        "given": "عرض فيه أكثر من وسيط",
        "action": "سحب أفقي ثم عمودي",
        "expected": "الأفقي يبدل وسيط العرض نفسه والعمودي ينتقل للعرض التالي دون فقدان سياق التفاصيل",
        "failures": [
          "احتساب كل صورة مشاهدة جديدة",
          "فقدان موضع التصفح عند الرجوع"
        ],
        "testMethod": "اختبار إيماءات لاحق",
        "evidenceRequired": "سجل إيماءة ومشهد قبل وبعد"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "متطلب معتمد"
    },
    {
      "id": "REQ-0026",
      "nameAr": "معيار وسائط بلا اختراع بصري",
      "area": "media",
      "gapId": "GAP-0020",
      "acceptanceAr": "المعطى: صورة مربعة أو أفقية منخفضة أو عالية الجودة. الإجراء: عرضها في الإطار العمودي. المتوقع: يظهر المنتج دون تشويه، وتُعلَّم الجودة الضعيفة للمراجعة، ولا يُولَّد لون غير موجود.",
      "acceptance": {
        "given": "صورة مربعة أو أفقية منخفضة أو عالية الجودة",
        "action": "عرضها في الإطار العمودي",
        "expected": "يظهر المنتج دون تشويه، وتُعلَّم الجودة الضعيفة للمراجعة، ولا يُولَّد لون غير موجود",
        "failures": [
          "BoxFit الذي يقص المنتج كمعيار ميرا",
          "نشر المحتوى المستورد تلقائيًا"
        ],
        "testMethod": "مراجعة بصرية لاحقة على أكثر من مقاس",
        "evidenceRequired": "عينات قبل وبعد دون قص مضلل"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "متطلب معتمد"
    },
    {
      "id": "REQ-0027",
      "nameAr": "مسار التاجر بلا متجر خارجي",
      "area": "commerce",
      "gapId": "GAP-0019",
      "acceptanceAr": "المعطى: تاجر لا يملك متجرًا خارجيًا. الإجراء: محاولة افتراض شراء داخلي. المتوقع: يبقى المسار قرارًا مفتوحًا ولا يُعرض كقدرة جاهزة.",
      "acceptance": {
        "given": "تاجر لا يملك متجرًا خارجيًا",
        "action": "محاولة افتراض شراء داخلي",
        "expected": "يبقى المسار قرارًا مفتوحًا ولا يُعرض كقدرة جاهزة",
        "failures": [
          "إظهار زر شراء داخلي مؤكد",
          "اعتبار DEC-0001 مغلقًا"
        ],
        "testMethod": "قرار مالك لا تنفيذ",
        "evidenceRequired": "سجل DEC-0007"
      },
      "planPlacement": "future-gate",
      "existingCapabilityId": "CAP-0015",
      "priority": "must",
      "status": "يحتاج قرارًا"
    }
  ],
  "gaps": [
    {
      "id": "GAP-0001",
      "titleAr": "منتج بلا وسائط غنية",
      "severity": "high",
      "reqIds": [
        "REQ-0001"
      ],
      "impactAr": "عرض ضعيف",
      "reuseAr": "Product موجود",
      "proposalAr": "توسيع العقد",
      "evidenceIds": [
        "EVD-0005"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0002",
      "titleAr": "لا Variant",
      "severity": "critical",
      "reqIds": [
        "REQ-0002",
        "REQ-0013"
      ],
      "impactAr": "فلاتر مضللة",
      "reuseAr": "—",
      "proposalAr": "ProductVariant",
      "evidenceIds": [
        "EVD-0019",
        "EVD-0017",
        "EVD-0005"
      ],
      "verification": "SOURCE_ONLY",
      "limitationAr": "الغياب داخل نطاق البحث لا خارج المستودع."
    },
    {
      "id": "GAP-0003",
      "titleAr": "فروع/مواعيد ناقصة",
      "severity": "high",
      "reqIds": [
        "REQ-0003"
      ],
      "impactAr": "لا حجز",
      "reuseAr": "Service",
      "proposalAr": "Branch+Schedule",
      "evidenceIds": [
        "EVD-0003"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0004",
      "titleAr": "لا خط فيديو منتج",
      "severity": "critical",
      "reqIds": [
        "REQ-0004"
      ],
      "impactAr": "لا محتوى مرئي",
      "reuseAr": "—",
      "proposalAr": "MediaAsset",
      "evidenceIds": [
        "EVD-0024",
        "EVD-0019"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0005",
      "titleAr": "لا مشغل متتابع",
      "severity": "high",
      "reqIds": [
        "REQ-0005"
      ],
      "impactAr": "لا Feed",
      "reuseAr": "—",
      "proposalAr": "Vertical feed",
      "evidenceIds": [
        "EVD-0024",
        "EVD-0023"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0006",
      "titleAr": "لا كيان إعلان",
      "severity": "critical",
      "reqIds": [
        "REQ-0007"
      ],
      "impactAr": "لا مشاهير",
      "reuseAr": "—",
      "proposalAr": "Promotion→productId",
      "evidenceIds": [
        "EVD-0023",
        "EVD-0019"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0007",
      "titleAr": "لا فصل أدوار",
      "severity": "high",
      "reqIds": [
        "REQ-0008"
      ],
      "impactAr": "تضارب أسعار",
      "reuseAr": "Partner",
      "proposalAr": "أدوار صريحة",
      "evidenceIds": [
        "EVD-0023"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0008",
      "titleAr": "حالات محتوى ناقصة",
      "severity": "medium",
      "reqIds": [
        "REQ-0009"
      ],
      "impactAr": "مراجعة ضعيفة",
      "reuseAr": "Partner.status",
      "proposalAr": "Media states",
      "evidenceIds": [
        "EVD-0024"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0009",
      "titleAr": "لا موافقة ربط",
      "severity": "medium",
      "reqIds": [
        "REQ-0010"
      ],
      "impactAr": "امتثال",
      "reuseAr": "—",
      "proposalAr": "Approval flow",
      "evidenceIds": [
        "EVD-0023"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0010",
      "titleAr": "لا طلب داخلي",
      "severity": "critical",
      "reqIds": [
        "REQ-0011"
      ],
      "impactAr": "لا إثبات شراء",
      "reuseAr": "externalUrl",
      "proposalAr": "حسب DEC-0001",
      "evidenceIds": [
        "EVD-0010"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0011",
      "titleAr": "رحلة متوقفة",
      "severity": "high",
      "reqIds": [
        "REQ-0012"
      ],
      "impactAr": "لا تجربة",
      "reuseAr": "Discover screens",
      "proposalAr": "تفعيل مرحلي",
      "evidenceIds": [
        "EVD-0001"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0012",
      "titleAr": "فلاتر بلا متغير متسق",
      "severity": "critical",
      "reqIds": [
        "REQ-0013"
      ],
      "impactAr": "نتائج خاطئة",
      "reuseAr": "concernTags",
      "proposalAr": "فهرسة variants",
      "evidenceIds": [
        "EVD-0017"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0013",
      "titleAr": "فلترة خادمية غير مثبتة للخصائص المتقدمة",
      "severity": "medium",
      "reqIds": [
        "REQ-0014"
      ],
      "impactAr": "تصفية صفحة",
      "reuseAr": "listPartners",
      "proposalAr": "API filters",
      "evidenceIds": [
        "EVD-0006"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0014",
      "titleAr": "أحداث محدودة",
      "severity": "medium",
      "reqIds": [
        "REQ-0015"
      ],
      "impactAr": "إسناد ضعيف",
      "reuseAr": "PartnerEvent",
      "proposalAr": "توسيع الأحداث",
      "evidenceIds": [
        "EVD-0013"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0015",
      "titleAr": "سياسة إعلان×بشرة",
      "severity": "high",
      "reqIds": [
        "REQ-0017"
      ],
      "impactAr": "خصوصية",
      "reuseAr": "مطابقة غير مدفوعة",
      "proposalAr": "حظر استهداف",
      "evidenceIds": [],
      "verification": "UNVERIFIED",
      "limitationAr": "لا بحث يثبت غياب فصل الإعلان عن تحليل البشرة؛ المتطلب مقترح لأن المسار غير موصوف في الأدلة المرفقة."
    },
    {
      "id": "GAP-0016",
      "titleAr": "خلط أنواع التحويل",
      "severity": "medium",
      "reqIds": [
        "REQ-0019"
      ],
      "impactAr": "توقعات خاطئة",
      "reuseAr": "نصوص قريبًا",
      "proposalAr": "مفردات صارمة",
      "evidenceIds": [
        "EVD-0003"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0017",
      "titleAr": "بث حي غير محسوم",
      "severity": "low",
      "reqIds": [
        "REQ-0020"
      ],
      "impactAr": "نطاق",
      "reuseAr": "—",
      "proposalAr": "خارج المرحلة الأولى",
      "evidenceIds": [
        "EVD-0023"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0018",
      "titleAr": "لا قياس مشاهدات معتمد في تجربة ميرا",
      "severity": "high",
      "reqIds": [
        "REQ-0021",
        "REQ-0023"
      ],
      "impactAr": "لا عدد صادق على العرض",
      "reuseAr": "لا يُفترض وجوده في الأماكن",
      "proposalAr": "مواصفة ثم تنفيذ لاحق بعد المراجعة",
      "evidenceIds": [
        "EVD-0029"
      ],
      "verification": "SOURCE_ONLY"
    },
    {
      "id": "GAP-0019",
      "titleAr": "ربط المتجر الخارجي غير متحقق على منصة محددة",
      "severity": "high",
      "reqIds": [
        "REQ-0022"
      ],
      "impactAr": "لا ادعاء دعم زد أو غيرها",
      "reuseAr": "رابط الشراء الخارجي الحالي إن وُجد لا يكفي للمزامنة",
      "proposalAr": "عقد ربط بعد وثائق أو اختبار",
      "evidenceIds": [
        "EVD-0029"
      ],
      "verification": "UNVERIFIED"
    },
    {
      "id": "GAP-0020",
      "titleAr": "العرض العمودي متعدد الوسائط يحتاج تكييفًا",
      "severity": "medium",
      "reqIds": [
        "REQ-0024",
        "REQ-0025",
        "REQ-0026"
      ],
      "impactAr": "نسخ الأماكن كما هي يقص المنتج أو يحصر العرض في الفيديو",
      "reuseAr": "PageView ومعرض التفاصيل مرجع سلوك",
      "proposalAr": "معيار عرض ميرا",
      "evidenceIds": [
        "EVD-0028"
      ],
      "verification": "SOURCE_ONLY"
    }
  ],
  "decisions": [
    {
      "id": "DEC-0001",
      "titleAr": "الدفع عند الشريك أم داخل ميرا؟",
      "status": "يحتاج قرارًا",
      "owner": "مالك المشروع",
      "options": [
        "externalUrl الحالي",
        "طلب داخلي"
      ],
      "evidenceIds": [
        "EVD-0007"
      ]
    },
    {
      "id": "DEC-0002",
      "titleAr": "بث حي في المرحلة الأولى؟",
      "status": "يحتاج قرارًا",
      "owner": "مالك المشروع",
      "options": [
        "مسجّل فقط",
        "بث لاحقًا",
        "بث مبكر"
      ],
      "evidenceIds": []
    },
    {
      "id": "DEC-0003",
      "titleAr": "موافقة المتجر على إعلان المشهور؟",
      "status": "مقترح",
      "owner": "مالك المشروع",
      "options": [
        "إلزامي",
        "اختياري",
        "حسب الفئة"
      ],
      "evidenceIds": []
    },
    {
      "id": "DEC-0004",
      "titleAr": "تكرار إعلانات نفس المنتج",
      "status": "مقترح",
      "owner": "مالك المشروع",
      "options": [
        "واحد لكل جلسة",
        "تجميع",
        "تكرار مع شارة"
      ],
      "evidenceIds": []
    },
    {
      "id": "DEC-0005",
      "titleAr": "اعتماد هذه الدراسة",
      "status": "بانتظار إعادة المراجعة",
      "owner": "مالك المشروع",
      "options": [
        "اعتماد",
        "تعديل",
        "رفض"
      ],
      "evidenceIds": []
    },
    {
      "id": "DEC-0006",
      "titleAr": "تكييف مكونات الأماكن داخل ميرا دون نقل المشروع",
      "status": "متطلب معتمد",
      "owner": "مالك المشروع",
      "options": [
        "نقل المشروع كاملًا",
        "تكييف المكونات المناسبة",
        "إعادة البناء من الصفر"
      ],
      "evidenceIds": [
        "EVD-0028"
      ],
      "noteAr": "متطلب معتمد للدراسة. ليس تنفيذًا وليس إغلاقًا لـ DEC-0005."
    },
    {
      "id": "DEC-0007",
      "titleAr": "مسار التاجر الذي لا يملك متجرًا خارجيًا",
      "status": "يحتاج قرارًا",
      "owner": "مالك المشروع",
      "options": [
        "يبقى بلا شراء داخلي حتى قرار الدفع",
        "مسار لاحق بعد DEC-0001"
      ],
      "evidenceIds": [
        "EVD-0029"
      ]
    }
  ],
  "roadmap": [
    {
      "id": "GATE-00",
      "titleAr": "التدقيق والدراسة والموقع",
      "status": "in_progress",
      "goalAr": "دراسة مرجعية قابلة للمراجعة بلا تنفيذ منتج",
      "scopeAr": "المصدر والموقع والحزمة فقط",
      "reqIds": [],
      "decisionIds": [
        "DEC-0005"
      ],
      "dependsOn": [],
      "likelyUnits": [
        "docs/mira-commerce-reference"
      ],
      "reuseAr": "لا إعادة استخدام وظيفي في هذه المرحلة",
      "risksAr": [
        "إغلاق البوابة قبل كفاية الأدلة"
      ],
      "effortAr": "مكتمل كمسودة RC2؛ المراجعة البشرية خارج التقدير",
      "effortAssumptionsAr": "لا يشمل تنفيذ المتجر",
      "entryCriteriaAr": [
        "تكليف دراسة بلا تعديل منتج"
      ],
      "exitCriteriaAr": [
        "الموقع يعرض النتائج والأدلة والملاحظات داخل أقسامه",
        "الحزمة وSHA-256 متاحان للمراجع",
        "لم يُغلق GATE-00 ولم يُعتمد القرار DEC-0005 من هذه الدراسة",
        "لم يُعدَّل سلوك تطبيق أو خادم التجارة"
      ],
      "proofPackAr": [
        "الموقع",
        "ZIP",
        "سجل الاختبارات",
        "سجل الملاحظات"
      ],
      "rollbackAr": "حذف حزمة الدراسة لا يرجع منتجًا لأن المنتج لم يُمس"
    },
    {
      "id": "GATE-01",
      "titleAr": "هوية الكتالوج والعزل وإعادة الاستخدام",
      "status": "planned",
      "goalAr": "منتج وخدمة وفرع ومتغير فوق الجداول الحالية مع عزل الشريك",
      "scopeAr": "الخادم وويب الشركاء والبيانات ولوحة الإدارة. ليس واجهة الفيديو.",
      "reqIds": [
        "REQ-0001",
        "REQ-0002",
        "REQ-0003",
        "REQ-0006",
        "REQ-0016",
        "REQ-0018"
      ],
      "decisionIds": [
        "DEC-0003"
      ],
      "dependsOn": [
        "GATE-00"
      ],
      "likelyUnits": [
        "mira-api/prisma/schema.prisma",
        "mira-api/src/partners-portal",
        "partners-portal/web",
        "mira-api/src/admin"
      ],
      "reuseAr": "Partner وProduct وService وPartnerTokenGuard وassertProductOwner",
      "risksAr": [
        "ترحيل منتجات بلا متغيرات",
        "إبقاء trackEvent يقبل معرف العميل"
      ],
      "effortAr": "4 إلى 8 أسابيع",
      "effortAssumptionsAr": "مهندسان يعرفان Prisma الحالي، بلا قرار دفع داخلي، وبلا بيانات إنتاج تُنسخ",
      "entryCriteriaAr": [
        "إعادة مراجعة GATE-00 أو إعفاء مكتوب من المالك",
        "DEC-0003 محدد"
      ],
      "exitCriteriaAr": [
        "متغير واحد يطابق لونًا ومقاسًا وتوفرًا معًا",
        "شريك لا يعدّل منتج شريك آخر على قاعدة اختبار",
        "المنتجات الحالية ما زالت تُقرأ",
        "حزمة اختبار العزل مرفقة"
      ],
      "proofPackAr": [
        "اختبارات الخدمة",
        "مخطط بعد الترحيل",
        "لقطات نموذج الشريك"
      ],
      "rollbackAr": "علم ترحيل معطل واستعادة نسخة قاعدة الاختبار. لا إسقاط جداول الإنتاج ضمن هذه البوابة."
    },
    {
      "id": "GATE-02",
      "titleAr": "دورة الوسائط والتصفح المرئي",
      "status": "planned",
      "goalAr": "رفع ومعالجة ومراجعة وتشغيل مقطع مرتبط بالمنتج الأصلي",
      "scopeAr": "تطبيق ميرا والخادم والتخزين. يشمل الفشل وإعادة المحاولة وليس شاشة تشغيل فقط.",
      "reqIds": [
        "REQ-0004",
        "REQ-0005",
        "REQ-0009",
        "REQ-0012"
      ],
      "decisionIds": [],
      "dependsOn": [
        "GATE-01"
      ],
      "likelyUnits": [
        "lib/features/marketplace",
        "mira-api/src",
        "موفر تخزين لم يُختار"
      ],
      "reuseAr": "لا مشغل فيديو قائم داخل lib حسب EVD-0024. يُعاد استخدام هوية المنتج من GATE-01.",
      "risksAr": [
        "تقدير تكلفة غير متحقق",
        "ذاكرة الجهاز عند التحميل المسبق"
      ],
      "effortAr": "6 إلى 10 أسابيع",
      "effortAssumptionsAr": "موفر تخزين متفق عليه، فيديو قصير حتى 60 ثانية، بلا بث حي",
      "entryCriteriaAr": [
        "GATE-01 خرج بأدلة",
        "حد حجم الوسائط مقرر"
      ],
      "exitCriteriaAr": [
        "المقطع غير المنشور لا يظهر في الخلاصة",
        "صوت مقطع واحد فقط",
        "الموضع يُستأنف",
        "فشل الرفع قابل لإعادة المحاولة دون تكرار النشر"
      ],
      "proofPackAr": [
        "اختبار الدورة",
        "لقطات هاتف وجهاز لوحي",
        "سجل فشل المعالجة"
      ],
      "rollbackAr": "إيقاف النشر بعلم وإبقاء الملفات غير المنشورة غير مرئية"
    },
    {
      "id": "GATE-03",
      "titleAr": "الفلاتر والفهرسة",
      "status": "planned",
      "goalAr": "فلاتر سريعة ومتقدمة على خصائص المتغير مع عدّ صحيح",
      "scopeAr": "الخادم والفهرس والتطبيق. ليس ترشيح قائمة محلية بعد جلب الكل.",
      "reqIds": [
        "REQ-0013",
        "REQ-0014"
      ],
      "decisionIds": [],
      "dependsOn": [
        "GATE-01"
      ],
      "likelyUnits": [
        "mira-api/src/marketplace",
        "lib/features/marketplace"
      ],
      "reuseAr": "concernTags وskinTypes كسمات قائمة لا كبديل عن لون الملابس",
      "risksAr": [
        "عدّ المنتجات بدل عدّ المقاطع",
        "حالة الفلتر تضيع عند الرجوع"
      ],
      "effortAr": "3 إلى 5 أسابيع",
      "effortAssumptionsAr": "الفهرس على قاعدة الاختبار، كتالوج حتى 50 منتجًا لكل متجر في سيناريو القبول",
      "entryCriteriaAr": [
        "متغيرات GATE-01 قابلة للاستعلام"
      ],
      "exitCriteriaAr": [
        "مثال الفستان الأزرق M المتوفر يطابق متغيرًا واحدًا",
        "عدد المنتجات المطابقة مستقل عن عدد المقاطع",
        "الصفحة الثانية لا تكرر الصف الأول",
        "العودة من التفاصيل تُبقي الفلتر"
      ],
      "proofPackAr": [
        "استعلام موثّق",
        "لقطة العدد",
        "حالة فارغة"
      ],
      "rollbackAr": "إخفاء الفلاتر المتقدمة والإبقاء على قائمة غير مفلترة"
    },
    {
      "id": "GATE-04",
      "titleAr": "المشاهير والإسناد والموافقة",
      "status": "planned",
      "goalAr": "إعلان يشير إلى المنتج بلا نسخ سعر أو مخزون",
      "scopeAr": "العقود والمراجعة الإدارية والعرض والخصوصية. ليس حملة إعلانية جاهزة.",
      "reqIds": [
        "REQ-0007",
        "REQ-0008",
        "REQ-0010",
        "REQ-0017"
      ],
      "decisionIds": [
        "DEC-0004"
      ],
      "dependsOn": [
        "GATE-01",
        "DEC-0004"
      ],
      "likelyUnits": [
        "mira-api/src",
        "admin-portal/web",
        "lib/features/marketplace"
      ],
      "reuseAr": "اعتماد الشريك الحالي كنمط مراجعة، لا نموذج مشهور قائم",
      "risksAr": [
        "اقتباس تنظيمي ليس اعتمادًا قانونيًا",
        "خلط الإعلان مع تحليل البشرة"
      ],
      "effortAr": "4 إلى 7 أسابيع",
      "effortAssumptionsAr": "قرار DEC-0004 ثابت، وبلا بث حي",
      "entryCriteriaAr": [
        "GATE-01",
        "إجابة DEC-0004"
      ],
      "exitCriteriaAr": [
        "تغيير سعر المنتج يظهر في الإعلان دون حقل سعر منسوخ",
        "رفض المتجر يزيل الإعلان ويبقي المنتج",
        "الإعلان موسوم مدفوعًا",
        "أطراف الناشر والمعلن والبائع مفصولة في السجل"
      ],
      "proofPackAr": [
        "عقد الإعلان",
        "اختبار الموافقة",
        "لقطة الوسم"
      ],
      "rollbackAr": "حالة الربط suspended تخفي الإعلان فقط"
    },
    {
      "id": "GATE-05",
      "titleAr": "مسارات الطلب والحجز والاستفسار والتحليلات",
      "status": "planned",
      "goalAr": "تمييز الأفعال وحفظ لقطة المتغير عند الطلب إن اختير الدفع داخل ميرا",
      "scopeAr": "الخادم والتطبيق والإدارة والتحقق. الشراء الداخلي مشروط بـ DEC-0001.",
      "reqIds": [
        "REQ-0011",
        "REQ-0015",
        "REQ-0019"
      ],
      "decisionIds": [
        "DEC-0001"
      ],
      "dependsOn": [
        "GATE-01",
        "DEC-0001"
      ],
      "likelyUnits": [
        "mira-api/src",
        "lib/features/marketplace",
        "admin-portal/web"
      ],
      "reuseAr": "externalUrl للشراء الخارجي، وأحداث PartnerEvent بعد تصحيح مصدر partnerId",
      "risksAr": [
        "بناء طلب داخلي قبل قرار مكان الدفع",
        "التتبع الحالي يقبل معرف العميل"
      ],
      "effortAr": "5 إلى 9 أسابيع إذا اختير دفع داخلي؛ 2 إلى 4 إذا بقي الشراء خارجيًا والحجز هو المسار الجديد",
      "effortAssumptionsAr": "لا تشغيل دفع إنتاجي داخل البوابة. بيئة اختبار فقط.",
      "entryCriteriaAr": [
        "قرار DEC-0001 مكتوب",
        "GATE-01 مكتمل"
      ],
      "exitCriteriaAr": [
        "أزرار الشراء والحجز والاستفسار والاتصال منفصلة",
        "إن وُجد طلب فهو يحتفظ بلقطة السعر",
        "حدث التحليلات لا يُقبل بمعرف شريك من الجسم دون تفويض",
        "لا رسالة أو حجز حقيقي على إنتاج"
      ],
      "proofPackAr": [
        "مصفوفة المسارات",
        "اختبار اللقطة",
        "اختبار رفض التتبع المتجاوز"
      ],
      "rollbackAr": "الإبقاء على الرابط الخارجي وإخفاء أزرار المسار الجديد"
    },
    {
      "id": "GATE-06",
      "titleAr": "المرحلة الأولى — استكمال حزمة مصدر الأماكن",
      "status": "in_progress",
      "goalAr": "إغلاق فجوات المصدر والتوثيق والتحقق المستقل بحزمة RC2",
      "scopeAr": "يدخل: الاعتماديات الناقصة والتوثيق والمدقق. يخرج: تنفيذ ميرا وتعديل دار كار.",
      "reqIds": [],
      "decisionIds": [
        "DEC-0006"
      ],
      "dependsOn": [
        "GATE-00"
      ],
      "likelyUnits": [
        "حزمة DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_RC2"
      ],
      "reuseAr": "لا دمج",
      "risksAr": [
        "اعتبار البصمة إثباتًا لاكتمال كل ملفات المشروع الأصلي"
      ],
      "effortAr": "جولة توثيق",
      "effortAssumptionsAr": "بلا تنفيذ منتج",
      "entryCriteriaAr": [
        "وجود حزمة RC1 وملاحظات المراجعة"
      ],
      "exitCriteriaAr": [
        "الملفات الناقصة مرفقة أو موثقة كمانع",
        "الفحوص السلبية ترفض الحزم التالفة",
        "الحزمة السابقة لم تُستبدل"
      ],
      "proofPackAr": [
        "ZIP RC2",
        "negative_validation_rc2",
        "freshness"
      ],
      "rollbackAr": "الإبقاء على حزمة RC1 كما هي"
    },
    {
      "id": "GATE-07",
      "titleAr": "المرحلة الثانية — دراسة التكييف في موقع ميرا",
      "status": "in_progress",
      "goalAr": "تسجيل القرارات والمتطلبات وخطة الملفات داخل الموقع المرجعي",
      "scopeAr": "يدخل: بيانات الدراسة والأقسام. يخرج: تعديل تطبيق ميرا.",
      "reqIds": [],
      "decisionIds": [
        "DEC-0006",
        "DEC-0007"
      ],
      "dependsOn": [
        "GATE-06"
      ],
      "likelyUnits": [
        "docs/mira-commerce-reference"
      ],
      "reuseAr": "الموقع الحالي نفسه",
      "risksAr": [
        "تعليم المعالجة كاعتماد نهائي"
      ],
      "effortAr": "جولة توثيق",
      "effortAssumptionsAr": "لا تنفيذ قبل مراجعة هذه المرحلة",
      "entryCriteriaAr": [
        "حزمة RC2 معروفة بالاسم والبصمة"
      ],
      "exitCriteriaAr": [
        "كل متطلب جديد له حالة",
        "المرجع البصري الناقص مصرح به",
        "الخطة لا تأذن ببدء التنفيذ الآن"
      ],
      "proofPackAr": [
        "أقسام 22-35",
        "validate_study"
      ],
      "rollbackAr": "بيانات JSON السابقة تبقى في السجل"
    },
    {
      "id": "GATE-08",
      "titleAr": "المرحلة الثالثة — تجربة العرض داخل ميرا",
      "status": "planned",
      "goalAr": "شاشة كاملة ووسائط وتصنيفات وبحث وفلاتر وتفاصيل بهوية ميرا",
      "scopeAr": "يدخل لاحقًا: الواجهة ببيانات اختبار. يخرج الآن: أي تنفيذ.",
      "reqIds": [
        "REQ-0024",
        "REQ-0025",
        "REQ-0026"
      ],
      "decisionIds": [
        "DEC-0006"
      ],
      "dependsOn": [
        "GATE-07"
      ],
      "likelyUnits": [
        "lib/features واجهة ميرا المقترحة لاحقًا"
      ],
      "reuseAr": "نمط PageView بعد التكييف لا النسخ",
      "risksAr": [
        "قص المنتج",
        "كسر RTL أو SafeArea"
      ],
      "effortAr": "غير مقدّر للتنفيذ",
      "effortAssumptionsAr": "لا يبدأ قبل مراجعة GATE-07 وحزمة إثبات خاصة",
      "entryCriteriaAr": [
        "مراجعة المرحلة الثانية",
        "بيانات اختبار واضحة"
      ],
      "exitCriteriaAr": [
        "RTL وSafeArea",
        "سلامة الإيماءات",
        "ظهور المنتج وتوقف الصوت وحالات الفراغ والخطأ والإتاحة"
      ],
      "proofPackAr": [
        "ZIP لاحق",
        "لقطات جهاز"
      ],
      "rollbackAr": "علم واجهة يمكن إطفاؤه"
    },
    {
      "id": "GATE-09",
      "titleAr": "المرحلة الرابعة — لوحة التاجر والمشاهدات والربط",
      "status": "planned",
      "goalAr": "إدارة المحتوى والربط الخارجي والإحصاءات الصادقة",
      "scopeAr": "يدخل لاحقًا: اللوحة والإحصاءات. يخرج الآن: إنشاء endpoint أو قاعدة مشاهدات.",
      "reqIds": [
        "REQ-0021",
        "REQ-0022",
        "REQ-0023"
      ],
      "decisionIds": [
        "DEC-0001",
        "DEC-0007"
      ],
      "dependsOn": [
        "GATE-08"
      ],
      "likelyUnits": [
        "لوحة التاجر",
        "عقد المشاهدات"
      ],
      "reuseAr": "بوابة المزود كنمط بعد إعادة تقييم الصلاحيات",
      "risksAr": [
        "تكرار الأحداث",
        "صفر كاذب",
        "مزامنة سعر خاطئة"
      ],
      "effortAr": "غير مقدّر للتنفيذ",
      "effortAssumptionsAr": "قدرات المنصة الخارجية غير معتمدة",
      "entryCriteriaAr": [
        "مراجعة المرحلة الثالثة",
        "قرار دفع ما زال مفتوحًا ولا يُغلق ضمنيًا"
      ],
      "exitCriteriaAr": [
        "عزل المتاجر",
        "عدم تكرار الأحداث",
        "صدق الأعداد وحالات الطلب",
        "معالجة فشل المزامنة"
      ],
      "proofPackAr": [
        "ZIP لاحق",
        "اختبارات عقد"
      ],
      "rollbackAr": "إيقاف النشر دون حذف المصدر الخارجي"
    }
  ],
  "evidence": [
    {
      "id": "EVD-0001",
      "claim": "MIRA_MARKETPLACE_ENABLED default false",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/core/config/mira_features.dart",
      "symbol": "",
      "lines": "41-47",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "779d099d02ebe82171122ee8313ae69479c8b22d8da64b9716bb5fd892c3729f",
      "excerptFile": "evidence/source/EVD-0001.txt",
      "proves": "MIRA_MARKETPLACE_ENABLED default false",
      "doesNotProve": "لا يثبت سلوك الإنتاج المنشور دون ربط النسخة المنشورة بهذا الـ commit",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0002",
      "claim": "Route gates redirect when marketplace disabled",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/main.dart",
      "symbol": "",
      "lines": "355-385",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "ab3be120a7558dbb7822f5d0e67be9a9a12646a06fe91046353fb0b53185dd9c",
      "excerptFile": "evidence/source/EVD-0002.txt",
      "proves": "Route gates redirect when marketplace disabled",
      "doesNotProve": "لا يثبت سلوك الإنتاج المنشور دون ربط النسخة المنشورة بهذا الـ commit",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0003",
      "claim": "Booking button stubbed",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/features/marketplace/presentation/screens/service_detail_screen.dart",
      "symbol": "",
      "lines": "71-97",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "c6fb3485eb7cc65958b4af7a8acfea357b7073bb2a56502ed1f2e9e9cd417d9b",
      "excerptFile": "evidence/source/EVD-0003.txt",
      "proves": "Booking button stubbed",
      "doesNotProve": "لا يثبت سلوك الإنتاج المنشور دون ربط النسخة المنشورة بهذا الـ commit",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0004",
      "claim": "Product buy = external launchUrl",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/features/marketplace/presentation/screens/product_detail_screen.dart",
      "symbol": "",
      "lines": "1-45",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "192ea1ef27e3377dd6a78154262a5e716ba6ae8fc10269a7fc83a9e56e80dc02",
      "excerptFile": "evidence/source/EVD-0004.txt",
      "proves": "Product buy = external launchUrl",
      "doesNotProve": "لا يثبت سلوك الإنتاج المنشور دون ربط النسخة المنشورة بهذا الـ commit",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0005",
      "claim": "Partner/Product/Service; no Order/Cart",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/prisma/schema.prisma",
      "symbol": "",
      "lines": "117-180",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "01dd03c140e35698ab4b795404201f3e1ba7d23fd828de1b2ee1b5cb447a65d2",
      "excerptFile": "evidence/source/EVD-0005.txt",
      "proves": "Partner/Product/Service; no Order/Cart",
      "doesNotProve": "مقتطف المخطط يثبت شكل الجداول المعروضة فيه فقط. لا ينفي جداول خارج النطاق أو في خدمة أخرى.",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0006",
      "claim": "Public marketplace APIs",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/marketplace/marketplace.controller.ts",
      "symbol": "",
      "lines": "1-40",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "13833f34b202b1098b46d6666688a8f4e58a99369f2f2e60826f6b6005decac4",
      "excerptFile": "evidence/source/EVD-0006.txt",
      "proves": "Public marketplace APIs",
      "doesNotProve": "لا يثبت سلوك الإنتاج المنشور دون ربط النسخة المنشورة بهذا الـ commit",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0007",
      "claim": "Pay at partner; no Mira cart",
      "claimType": "document",
      "repo": "mira",
      "path": "partners-portal/SPEC.md",
      "symbol": "",
      "lines": "1-80",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "82cad22cbe38f082adb0edb20f3f4afae4bf2a19d01ba22c7bc468391ad42afb",
      "excerptFile": "evidence/source/EVD-0007.txt",
      "proves": "Pay at partner; no Mira cart",
      "doesNotProve": "ملف مواصفات. لا يثبت أن بوابة الشركاء مفعلة في الإنتاج، ولا يغني عن قراءة المتحكم والحارس.",
      "runtime": "SOURCE_ONLY",
      "limitations": "SPEC فقط. راجع EVD-0011 وما بعده للتنفيذ."
    },
    {
      "id": "EVD-0008",
      "claim": "Local offline seed catalog",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/features/marketplace/data/marketplace_local_catalog.dart",
      "symbol": "",
      "lines": "90-120",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "13ec504cf64b923268d264724366e5b1c651368bf0e61c822fa40e76be8c67c7",
      "excerptFile": "evidence/source/EVD-0008.txt",
      "proves": "Local offline seed catalog",
      "doesNotProve": "لا يثبت سلوك الإنتاج المنشور دون ربط النسخة المنشورة بهذا الـ commit",
      "runtime": "SOURCE_ONLY",
      "limitations": "فحص مصدر فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0010",
      "claim": "لا نماذج Order/Cart للمنتجات",
      "claimType": "search-summary",
      "repo": "mira",
      "path": "mira-api/prisma/schema.prisma",
      "symbol": "search",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "01dd03c140e35698ab4b795404201f3e1ba7d23fd828de1b2ee1b5cb447a65d2",
      "excerptFile": "evidence/commands/CMD-0001-search-order-cart.txt",
      "proves": "Absence after search",
      "doesNotProve": "الملف السابق ملخص مكتوب وليس سجل أمر. لا ينفي وجود الطلب خارج المسارات المفحوصة. السجل القابل للمراجعة هو EVD-0018.",
      "runtime": "SOURCE_ONLY",
      "limitations": "ملخص غير كافٍ. أُبقي كدليل على قصور النسخة السابقة."
    },
    {
      "id": "EVD-0011",
      "claim": "متحكم بوابة الشركاء ينفذ التقديم والدخول وCRUD والاعتماد",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/partners-portal/partners-portal.controller.ts",
      "symbol": "",
      "lines": "38-130",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "915b7b3406f94e56dbb75dfb5da0cc14ddc7ab2de189dc7d385655d45b8af7c2",
      "excerptFile": "evidence/source/EVD-0011.txt",
      "proves": "وجود مسارات في المصدر",
      "doesNotProve": "لا يثبت نشرًا أو تفعيلًا في الإنتاج",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0012",
      "claim": "partnerId يُؤخذ من الرمز المخزن وليس من جسم طلب الكتالوج",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/partners-portal/guards/partner-token.guard.ts",
      "symbol": "",
      "lines": "14-38",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "9df2c6069dd225a6318f9ddf202537e02d5fdfe35b3e16028ac9573ce6217974",
      "excerptFile": "evidence/source/EVD-0012.txt",
      "proves": "مصدر partnerId في الطلبات المحمية",
      "doesNotProve": "لا يثبت أن كل المسارات محمية؛ track بلا حارس",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0013",
      "claim": "تعديل وحذف المنتج والخدمة يشترطان partnerId المالك؛ التتبع يقبل معرف العميل",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/partners-portal/partners-portal.service.ts",
      "symbol": "",
      "lines": "282-412",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "dd4aaa49c38647860fe75b147a8a20de11d518f725222050674608fcfb7d6ccf",
      "excerptFile": "evidence/source/EVD-0013.txt",
      "proves": "عزل الكتابة على الكتالوج في المصدر، وثغرة كتابة أحداث التتبع",
      "doesNotProve": "لا يثبت عزلًا على قاعدة إنتاج حية",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0014",
      "claim": "متحكم الإدارة يسرد الشركاء ويعتمد الطلبات ويوقف الشريك",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/admin/admin.controller.ts",
      "symbol": "",
      "lines": "24-109",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "2af5bfd10d29da42966f8cad996c4009ff9ab88f362755dc8a51ee2d9303f9a3",
      "excerptFile": "evidence/source/EVD-0014.txt",
      "proves": "وجود مسارات إدارة في المصدر خلف AdminApiKeyGuard",
      "doesNotProve": "لا يثبت أن المفتاح مضبوط في الإنتاج أو أن الواجهة منشورة",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0015",
      "claim": "واجهة الإدارة الثابتة تستدعي /admin بمفتاح محلي",
      "claimType": "fact",
      "repo": "mira",
      "path": "admin-portal/web/js/api.js",
      "symbol": "",
      "lines": "1-79",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "06b8ff8af6d4b96987245826121a69e4d57bc682e4451331dc206f04073be247",
      "excerptFile": "evidence/source/EVD-0015.txt",
      "proves": "عميل لوحة الإدارة موجود في المستودع",
      "doesNotProve": "العنوان الافتراضي localhost. لا يثبت نشر admin.mira.app",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0016",
      "claim": "واجهة الشركاء تستدعي مسارات partners-portal",
      "claimType": "fact",
      "repo": "mira",
      "path": "partners-portal/web/js/api.js",
      "symbol": "",
      "lines": "1-79",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "93548cfbd8122f7c19ca15f8f8a1598554f011cd3ad6f949e0b787271cfa1cdc",
      "excerptFile": "evidence/source/EVD-0016.txt",
      "proves": "عميل البوابة يطابق مسارات الخادم",
      "doesNotProve": "لا يثبت جلسة إنتاج أو عزلًا من جهة المتصفح وحده",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0017",
      "claim": "عقد إنشاء المنتج بلا مقاس أو لون أو مخزون أو وسيط",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/partners-portal/dto/catalog.dto.ts",
      "symbol": "",
      "lines": "13-90",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "13e94f39889a337fa0f194b9b17fef0a18a12a842415596be7d9f1a330fa2cee",
      "excerptFile": "evidence/source/EVD-0017.txt",
      "proves": "شكل الإدخال الحالي للشريك",
      "doesNotProve": "لا ينفي حقولًا في عميل آخر لم يُفحص",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY داخل هذا الملف",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0018",
      "claim": "بحث Order/Cart/Booking داخل المسارات المحددة لم يُرجع تطابقًا",
      "claimType": "search",
      "repo": "mira",
      "path": "evidence/commands/CMD-RC2-0001-order-cart.txt",
      "symbol": "",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "a8fee5c4f001fbd5f43a3a10ebaa3c39279b65ed36ce576ee207806822ac16f9",
      "excerptFile": "evidence/commands/CMD-RC2-0001-order-cart.txt",
      "proves": "لا تطابق للنماذج المذكورة داخل النطاق وexit=1",
      "doesNotProve": "لا ينفي منظومة تجارة خارج المستودع أو بأسماء مختلفة",
      "runtime": "SOURCE_ONLY",
      "limitations": "نطاق الأمر مذكور في الملف"
    },
    {
      "id": "EVD-0019",
      "claim": "لا نماذج Branch/Employee/ProductVariant/MediaAsset/Creator في schema",
      "claimType": "search",
      "repo": "mira",
      "path": "evidence/commands/CMD-RC2-0002-models.txt",
      "symbol": "",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "c600449a88756efac5bf65727f9d79a84b65a97943d81bb489f7b6b75c1a29d1",
      "excerptFile": "evidence/commands/CMD-RC2-0002-models.txt",
      "proves": "لا تطابق لتلك النماذج في mira-api/prisma وexit=1",
      "doesNotProve": "لا ينفي الجداول إن وُجدت خارج هذا الملف",
      "runtime": "SOURCE_ONLY",
      "limitations": "بحث أسماء محددة"
    },
    {
      "id": "EVD-0020",
      "claim": "علم الاشتراك وعلم السوق يُقرآن من dart-define وافتراضهما false",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/core/config/mira_features.dart",
      "symbol": "",
      "lines": "14-46",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "779d099d02ebe82171122ee8313ae69479c8b22d8da64b9716bb5fd892c3729f",
      "excerptFile": "evidence/source/EVD-0020.txt",
      "proves": "الإخفاء في بناء التطبيق يعتمد على العلم",
      "doesNotProve": "لا يثبت قيمة العلم في بناء المتجر المنشور",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0021",
      "claim": "الدخول يربط الجلسة بسجل PartnerUser",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/partners-portal/partners-portal.service.ts",
      "symbol": "",
      "lines": "102-125",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "dd4aaa49c38647860fe75b147a8a20de11d518f725222050674608fcfb7d6ccf",
      "excerptFile": "evidence/source/EVD-0021.txt",
      "proves": "مصدر هوية الشريك بعد الدخول",
      "doesNotProve": "الرمز نفسه سر الدخول؛ لا كلمة مرور منفصلة في هذا المسار",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0022",
      "claim": "خط أساس RC2 يطابق commit الدراسة السابقة وشجرة العمل متسخة خارج الدراسة",
      "claimType": "search",
      "repo": "mira",
      "path": "evidence/git/HEAD.txt",
      "symbol": "",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "9e7092b8d5b8f24b9512e884b8282fa00f4a4710a98a8afd2311b3fbb7c457c4",
      "excerptFile": "evidence/git/STATUS.txt",
      "proves": "HEAD والفرع وحالة الشجرة وقت الفحص",
      "doesNotProve": "لا يصف محتوى كل ملف متسخ",
      "runtime": "SOURCE_ONLY",
      "limitations": "لم يُعاد ضبط المستودع"
    },
    {
      "id": "EVD-0023",
      "claim": "لا رموز فيديو منتج أو مشاهير أو متغير في النطاق المبحوث",
      "claimType": "search",
      "repo": "mira",
      "path": "evidence/commands/CMD-RC2-0003-video-creator.txt",
      "symbol": "",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "d954c4c3832175df7408f0fa1e447e3e840a3edb41ec36331daabdbfc3add438",
      "excerptFile": "evidence/commands/CMD-RC2-0003-video-creator.txt",
      "proves": "exit=1 للأنماط المذكورة",
      "doesNotProve": "غياب الكلمة ليس غياب كل وسيط في العالم",
      "runtime": "SOURCE_ONLY",
      "limitations": "نطاق محدد في رأس الملف"
    },
    {
      "id": "EVD-0024",
      "claim": "لا VideoPlayer أو video_player في lib وmira-api/src",
      "claimType": "search",
      "repo": "mira",
      "path": "evidence/commands/CMD-RC2-0004-video-player.txt",
      "symbol": "",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "85acfd2e79dd47df07d214334642196301332f72d792b52068cdfd8898755409",
      "excerptFile": "evidence/commands/CMD-RC2-0004-video-player.txt",
      "proves": "exit=1 داخل المسارين",
      "doesNotProve": "لا يشمل تطبيقات ويب ثابتة أو أصولًا ثنائية",
      "runtime": "SOURCE_ONLY",
      "limitations": "نمط بحث محدد"
    },
    {
      "id": "EVD-0025",
      "claim": "الإدارة تُفوَّض بمفتاح API مشترك",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/common/guards/admin-api-key.guard.ts",
      "symbol": "",
      "lines": "10-26",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "4d644f569c187ab61dc8f954934ed55b8078b1356630ded248fd83aab718d4bb",
      "excerptFile": "evidence/source/EVD-0025.txt",
      "proves": "فرق الصلاحية عن شريك واحد",
      "doesNotProve": "لا يثبت تدوير المفتاح أو تخزينه",
      "runtime": "SOURCE_ONLY",
      "limitations": "SOURCE_ONLY",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0026",
      "claim": "اختبار وحدة لعزل تحديث المنتج بين شريكين",
      "claimType": "fact",
      "repo": "mira",
      "path": "mira-api/src/partners-portal/partners-portal.service.spec.ts",
      "symbol": "",
      "lines": "105-121",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "6087e75e8c3817dd934c10c36456a23f7fdcb08b0fbfe5e18c1742e1838b957a",
      "excerptFile": "evidence/source/EVD-0026.txt",
      "proves": "العزل مقصود في الاختبار وعلى mock",
      "doesNotProve": "ليس اختبار قاعدة بيانات حية ولا إنتاجًا",
      "runtime": "SOURCE_ONLY",
      "limitations": "UNIT_MOCK",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0027",
      "claim": "ثماني تجارب سلبية على نسخة مؤقتة أعطت FAIL وخروجًا غير صفري، والنسخة السليمة PASS",
      "claimType": "search",
      "repo": "mira",
      "path": "evidence/tests/negative_validation.txt",
      "symbol": "",
      "lines": "n/a",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "fileSha256": "eaf5ec93b83339a925bf7ccd1817f6628d2cf48956808281063d2d328f272d4a",
      "excerptFile": "evidence/tests/negative_validation.txt",
      "proves": "المدقق يرفض الانحراف والتبعية الناقصة وحذف الدليل وتكرار المعرف والحقل الفارغ والحالة الممنوعة وقبولًا عامًا ومرجعًا من نوع خاطئ",
      "doesNotProve": "لا يثبت صحة المنتج ولا مراجعة موضوعية",
      "runtime": "TOOLING",
      "limitations": "التجارب على نسخة مؤقتة. الأدلة الأصلية لم تُحذف."
    },
    {
      "id": "EVD-0028",
      "claim": "Discovery feed uses DiscoveryApi not VenueApi",
      "claimType": "handoff",
      "repo": "mastermax-handoff",
      "path": "evidence/source/EVD-0028.txt",
      "symbol": "PlacesHttpDiscoveryRepository",
      "lines": "",
      "commitSha": "3ae70f296d7a42e096f55650ea45b9845616c474",
      "excerptFile": "evidence/source/EVD-0028.txt",
      "proves": "مسار الخلاصة في الحزمة موثق إلى DiscoveryApi وConsumerController",
      "doesNotProve": "لا يثبت تشغيل الإنتاج ولا أن كل ملفات المشروع الأصلي جُمعت",
      "runtime": "SOURCE_ONLY",
      "limitations": "البصمة تثبت اتساق الحزمة. اكتمال النطاق يعتمد على خريطة الاعتماديات."
    },
    {
      "id": "EVD-0029",
      "claim": "Views counter is a new MIRA requirement",
      "claimType": "handoff",
      "repo": "mira-study",
      "path": "evidence/source/EVD-0029.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "excerptFile": "evidence/source/EVD-0029.txt",
      "proves": "المشاهدات موثقة كمتطلب غير منفذ، والمرجع البصري غير مرفق",
      "doesNotProve": "لا يثبت غياب المشاهدات من كل ملف في دار كار خارج نطاق القراءة",
      "runtime": "SOURCE_ONLY",
      "limitations": "لا endpoint ولا قاعدة بيانات للمشاهدات في هذه الجولة"
    },
    {
      "id": "EVD-0030",
      "claim": "Discovery feed path inside unmodified RC2 0125 archive",
      "claimType": "handoff",
      "repo": "places-handoff-0125",
      "path": "evidence/source-corrections/discovery_path.txt",
      "symbol": "PlacesHttpDiscoveryRepository",
      "lines": "",
      "commitSha": "3ae70f296d7a42e096f55650ea45b9845616c474",
      "excerptFile": "evidence/source-corrections/discovery_path.txt",
      "proves": "الخلاصة في أرشيف 0125 تمر عبر DiscoveryApi وليس VenueApi",
      "doesNotProve": "لا يثبت تشغيل المنتج",
      "runtime": "SOURCE_ONLY",
      "limitations": "مقتطف توثيق. الأرشيف نفسه لم يُعدَّل."
    },
    {
      "id": "EVD-0031",
      "claim": "Redaction JSON disagrees with exclusions JSON in archive 0125",
      "claimType": "handoff",
      "repo": "places-handoff-0125",
      "path": "evidence/source-corrections/redaction_mismatch.txt",
      "symbol": "app_config.dart",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/source-corrections/redaction_mismatch.txt",
      "proves": "التعارض موثق دون كشف السر",
      "doesNotProve": "لا يستعيد المفتاح",
      "runtime": "SOURCE_ONLY",
      "limitations": "تصحيح لاحق داخل الموقع فقط"
    },
    {
      "id": "EVD-0032",
      "claim": "Historical nine-file hashes from archive 0059",
      "claimType": "handoff",
      "repo": "places-handoff-0059",
      "path": "evidence/historical/rc2-0059/README.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/historical/rc2-0059/README.txt",
      "proves": "النسخ التاريخية موجودة ومرتبطة بأرشيف 0059",
      "doesNotProve": "لا يثبت ثبات المستودع كاملًا",
      "runtime": "SOURCE_ONLY",
      "limitations": "تسعة ملفات فقط"
    },
    {
      "id": "EVD-0033",
      "claim": "RC3 browser capture metadata",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/rc3_browser.json",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/rc3_browser.json",
      "proves": "لقطات 390×844 و768×1024 و1280×900 مسجلة بأبعادها الفعلية",
      "doesNotProve": "لا يثبت جاهزية المنتج",
      "runtime": "SOURCE_ONLY",
      "limitations": "الأبعاد مقاسة من ملفات PNG لهذه اللقطات القديمة. المراجع الثلاث أصبحت available في evidence/visual/references، وهذا البند لا يصف حالة الملفات الحالية."
    },
    {
      "id": "EVD-0034",
      "claim": "Discover test activation status",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/discover_activation_status.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/discover_activation_status.txt",
      "proves": "نتائج اختبار العلم ومسبار خادم ميرا",
      "doesNotProve": "لا يثبت تجربة جهاز إذا لم يُسجَّل الجهاز في الملف نفسه",
      "runtime": "SOURCE_ONLY",
      "limitations": "بذرة الخادم ليست متاجرًا حقيقية"
    },
    {
      "id": "EVD-0035",
      "claim": "RC3 screenshots repeat every 445 and 527 pixels",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/rc3_screenshot_tiling.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/rc3_screenshot_tiling.txt",
      "proves": "تكرار البكسل في ملفات RC3 ومصدره أداة الالتقاط لا تكرار عقد DOM",
      "doesNotProve": "لا يثبت سلامة اللقطات البديلة قبل قياسها",
      "runtime": "SOURCE_ONLY",
      "limitations": "تُستكمل بلقطات جديدة بعد القياس"
    },
    {
      "id": "EVD-0036",
      "claim": "Phase 1 presentation widget tests",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/phase1_flutter_test.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/phase1_flutter_test.txt",
      "proves": "نجاح اختبارات اكتشفي وشاشة العرض على آلة الاختبار، مع رمز الخروج في الملف",
      "doesNotProve": "لا يثبت تشغيل video_player على جهاز أو محاكي",
      "runtime": "WIDGET_TEST",
      "limitations": "منفذ الفيديو في الاختبار بديل. العلم الافتراضي ما زال false في التشغيل بلا dart-define."
    },
    {
      "id": "EVD-0037",
      "claim": "Per-request provenance and explicit demo mark",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/phase1_flutter_test.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/phase1_flutter_test.txt",
      "proves": "اختبار التفصيلة المحلية بعد قائمة الخادم واختبار العلم الصريح",
      "doesNotProve": "لا يغيّر بذرة الخادم المنشورة",
      "runtime": "WIDGET_TEST",
      "limitations": "الخادم بلا demoContent يبقى unmarked"
    },
    {
      "id": "EVD-0038",
      "claim": "Reference site screenshots after the clip fix",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/phase1_screenshots.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/phase1_screenshots.txt",
      "proves": "أبعاد اللقطات وقياس الحافة بعد تعديل CSS",
      "doesNotProve": "لا يثبت شاشة العرض داخل التطبيق",
      "runtime": "SOURCE_ONLY",
      "limitations": "لقطات Chrome headless لصفحة الهبوط لا للتمرير إلى القسم"
    },
    {
      "id": "EVD-0039",
      "claim": "No Places files were copied for phase 1",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/phase1_places_independence.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/phase1_places_independence.txt",
      "proves": "لا استيراد تشغيلي من الأماكن أو دار كار داخل مجلد السوق",
      "doesNotProve": "لا يفحص مستودعات خارج ميرا",
      "runtime": "SOURCE_ONLY",
      "limitations": "الفحص نصي على مجلد marketplace وpubspec"
    },
    {
      "id": "EVD-0040",
      "claim": "RC2 widget tests for playback ownership and video failure",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/rc2_widget_test.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/rc2_widget_test.txt",
      "proves": "نجاح اختبارات الودجت لتصحيحات الإيقاف والفشل والترتيب المتأخر، مع وبدون علم الاختبار في اختبار التفعيل",
      "doesNotProve": "لا يثبت video_player على جهاز أو محاكي",
      "runtime": "WIDGET_TEST",
      "limitations": "المنفذ في اختبار العرض بديل ذو بوابات تأخير. العلم الافتراضي بقي false في الأمر الأول."
    },
    {
      "id": "EVD-0041",
      "claim": "RC2 real player attempt on simulator and iPhone",
      "claimType": "handoff",
      "repo": "reference-site",
      "path": "evidence/tests/rc2_device_run.txt",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/rc2_device_run.txt",
      "proves": "أن البناء على الجهاز بدأ وأن الاتصال انقطع قبل إثبات التشغيل، وأن بناء المحاكي فشل بالربط",
      "doesNotProve": "لا يثبت تشغيل الفيديو ولا السحب ولا الإيقاف على المشغّل الحقيقي",
      "runtime": "DEVICE",
      "limitations": "لا لقطات لشاشة العرض. التطبيق لم يبقَ في المقدمة."
    },
    {
      "id": "EVD-0042",
      "claim": "RC3 AssetVideoPort unit coverage",
      "claimType": "fact",
      "repo": "mira",
      "path": "test/features/marketplace/asset_video_port_test.dart",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/rc3_asset_video_port.txt",
      "proves": "سلامة منطق الإلغاء والتنظيف على AssetVideoPort وليس بديل DelayedVideoPort",
      "doesNotProve": "لا يثبت video_player على جهاز",
      "runtime": "UNIT",
      "limitations": "مشغّل ControllableVideoController حقن مصنع",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0043",
      "claim": "RC3 playback integration test corrections",
      "claimType": "fact",
      "repo": "mira",
      "path": "integration_test/discover_playback_rc2_test.dart",
      "symbol": "",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/tests/rc3_playback_integration_note.txt",
      "proves": "منطق الاختبار المصحح وRTL والتمييز بين محاكاة lifecycle والجهاز",
      "doesNotProve": "لا يثبت تشغيل clip حقيقي حتى ينجح rc3_device_run",
      "runtime": "INTEGRATION",
      "limitations": "يعتمد على VM Service على iPhone",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0044",
      "claim": "RC3 empty presentation exit",
      "claimType": "fact",
      "repo": "mira",
      "path": "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
      "symbol": "_exitPresentation",
      "lines": "",
      "commitSha": "",
      "excerptFile": "evidence/source/EVD-0044.txt",
      "proves": "زر إغلاق يعيد المستخدم من حالة لا توجد عروض",
      "doesNotProve": "لا يثبت مسار اكتشفي الكامل من التطبيق الحي",
      "runtime": "WIDGET",
      "limitations": "اختبار MaterialApp بمسارين فقط",
      "freshnessRole": "baseline",
      "currentClaimStatus": "not_reverified"
    },
    {
      "id": "EVD-0045",
      "claim": "RC5 new browse pages append after slides already shown",
      "claimType": "fact",
      "freshnessRole": "current",
      "currentClaimStatus": "verified_by_rc5_test",
      "repo": "mira",
      "path": "lib/features/marketplace/presentation/discover_browse_sequence.dart",
      "symbol": "DiscoverBrowseSequence.apply",
      "lines": "",
      "commitSha": "",
      "fileSha256": "6847b261e8dd6b3cf1a1fd1b09624963cfdb53a4a61441177b11310095926f6e",
      "excerptFile": "evidence/source/EVD-0045.txt",
      "proves": "الصفحات الجديدة تُلحَق بعد الشرائح المعروضة، واستبدال الاستعلام يبدأ تسلسلًا جديدًا",
      "doesNotProve": "لا يعيد إثبات أدلة baseline ولا سياسة ترتيب إعلانات تجارية",
      "runtime": "UNIT",
      "limitations": "يُفحص من discover_ad_rc5_test.dart على الشاشة الظاهرة"
    },
    {
      "id": "EVD-0046",
      "claim": "RC6 independent link opens use a UUID and resend keeps that id",
      "claimType": "fact",
      "freshnessRole": "current",
      "currentClaimStatus": "verified_by_rc6_test",
      "repo": "mira",
      "path": "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
      "symbol": "_openAdLink",
      "lines": "",
      "commitSha": "",
      "fileSha256": "16e86ba569200da3e0c6adbdde816886cd8fcdc00ac1eed57df6355ac0f4520a",
      "excerptFile": "evidence/source/EVD-0046.txt",
      "proves": "كل فتح مستقل يحصل على معرف جديد، وإعادة الإرسال تحتفظ بمعرف المحاولة نفسها",
      "doesNotProve": "لا يثبت شراءً ولا مشاهدة، ولا يثبت أن عداد RC5 كان فريدًا عبر المثيلات",
      "runtime": "UNIT",
      "limitations": "البصمة السابقة c1e0f8dc8f9ff0630cd5a4282ecf2cea9e38d82e653802b4aea48fab1201a812 كانت لعداد الشاشة في RC5 ولا تثبت التفرد. أُبقيت هنا ولم تُستبدل بصمة baseline."
    },
    {
      "id": "EVD-0047",
      "claim": "RC5 product ad parser keeps published descriptionAr",
      "claimType": "fact",
      "freshnessRole": "current",
      "currentClaimStatus": "verified_by_rc5_test",
      "repo": "mira",
      "path": "lib/features/marketplace/data/discover_published_ad.dart",
      "symbol": "DiscoverPublishedAd.tryParse",
      "lines": "",
      "commitSha": "",
      "fileSha256": "9724e6cfb185a93deb7946d7fb7960f38f036cc5e11f8f4a4ff46757de47938f",
      "excerptFile": "evidence/source/EVD-0047.txt",
      "proves": "وصف المنتج المنشور يصل إلى نموذج الإعلان الذي يستخدمه البحث",
      "doesNotProve": "لا يختلق وصفًا غائبًا ولا يستبدل وصف الأصل بالنص الإعلاني",
      "runtime": "UNIT",
      "limitations": "البيانات تمر عبر tryParse"
    },
    {
      "id": "EVD-0048",
      "claim": "RC7 link retries cancel the active transport and cap finished statuses",
      "claimType": "fact",
      "freshnessRole": "current",
      "currentClaimStatus": "verified_by_rc7_test",
      "repo": "mira",
      "path": "lib/features/marketplace/presentation/ad_link_open_outbox.dart",
      "symbol": "AdLinkOpenOutbox",
      "lines": "",
      "commitSha": "",
      "fileSha256": "4cba7dad93bdbfc35a27320c87b09a20605fad506b6f4039af56d38c026dea5b",
      "excerptFile": "evidence/source/EVD-0048.txt",
      "proves": "المحاولة التالية للحدث نفسه تبدأ بعد إلغاء النقل السابق، وسجل الحالات النهائية له سعة وعمر",
      "doesNotProve": "لا يثبت تسليمًا بعد إغلاق التطبيق ولا أن إلغاء العميل ألغى معالجة الخادم ولا أن المشاهدات مفعّلة",
      "runtime": "UNIT",
      "limitations": "البصمة السابقة 76230d79ad84c120784e91689af0512e485dc771710172c60cef0bc0f0e07fe7 كانت لقائمة RC6 قبل الإلغاء والحد. أُبقيت هنا. السعة 32 والحفظ 10 دقائق. abandoned ليس نجاحًا."
    }
  ],
  "changelog": [
    {
      "version": "1.0.0-GATE00-study-draft",
      "date": "2026-09-23T03:20:00+03:00",
      "changesAr": [
        "إنشاء GATE-00",
        "جرد القدرات",
        "موقع مرجعي"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    },
    {
      "version": "RC2 — استكمال الدراسة بعد المراجعة",
      "date": "2026-09-23T03:43:29+03:00",
      "changesAr": [
        "تصحيح أحكام التفعيل والغياب والإيقاف",
        "أدلة تنفيذ الشركاء والإدارة",
        "سجل REV ومعايير قبول وخطة بوابات",
        "عقود مقترحة ومصادر تنظيمية بتاريخ اطلاع",
        "نقل النص الموضوعي إلى JSON"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a",
      "previousVersion": "1.0.0-GATE00-study-draft"
    },
    {
      "version": "RC2 — خطة الأماكن بعد مراجعة التسليم",
      "date": "2026-09-24T01:10:00+03:00",
      "changesAr": [
        "إضافة حزمة مصدر RC2 بالاسم والبصمة دون استبدال حزمة 0030",
        "تصحيح مسار الاكتشاف وتسجيل المشاهدات والربط الخارجي كمتطلبات غير منفذة",
        "أقسام 22 إلى 35 وخطة GATE-06 إلى GATE-09 دون إعادة ترقيم GATE-00 إلى GATE-05",
        "المرجع البصري ما زال مطلوبًا ولم يُولَّد بديل"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    },
    {
      "version": "RC3 — تصحيح الموقع بعد المراجعة",
      "date": "2026-09-24T02:20:00+03:00",
      "changesAr": [
        "فصل فحص الحزمة عن فحص حداثة الأدلة",
        "تصحيح سجل التوثيق لخلاصة الأماكن والتنقيح دون تعديل أرشيف 0125",
        "نسخ أدلة البصمة التاريخية من أرشيف 0059",
        "تسجيل NEEDS_ASSET للتصورات الثلاثة"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    },
    {
      "version": "RC1 — تفعيل اختبار اكتشفي وخطة الدمج",
      "date": "2026-09-24T03:10:00+03:00",
      "changesAr": [
        "تسجيل توجيه المالك للإغلاق من أجل تجربة العرض، والتصريح بنسخة الاختبار",
        "خطة دمج تمنع تكرار وظائف ميرا واستقلالها عن الأماكن",
        "تشخيص تكرار لقطات RC3"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    },
    {
      "version": "RC1 — مراحل اكتشفي وشاشة العرض",
      "date": "2026-09-24T05:10:00+03:00",
      "changesAr": [
        "تسجيل المراحل الخمس في الموقع دون تنفيذ المراحل 2 إلى 5",
        "إغلاق مصدر البيانات والعلامة التجريبية وقص الجوال بانتظار المراجعة",
        "شاشة العرض المرئي داخل اكتشفي مع إبقاء المرحلة قيد التنفيذ لنقص إثبات الفيديو على جهاز"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    },
    {
      "version": "RC2 — تصحيحات المرحلة الأولى لاكتشفي",
      "date": "2026-09-24T06:11:28+03:00",
      "changesAr": [
        "تسجيل نتيجة مراجعة RC1 دون اعتماد المرحلة الأولى",
        "ملاحظات P1-RC2-01 إلى P1-RC2-05 على بطاقة المرحلة الأولى فقط",
        "روابط تسليم RC1 وRC2 دون إدراج بصمة الحزمة الجديدة داخلها"
      ],
      "baselineCommit": "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
    }
  ],
  "categories": [
    {
      "id": "CAT-FACE",
      "nameAr": "الوجه",
      "filters": [
        "النوع",
        "نوع البشرة المعلن",
        "الحجم",
        "السعر"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "النوع",
        "نوع البشرة المعلن",
        "الحجم",
        "السعر"
      ],
      "quickFilters": [
        "النوع",
        "نوع البشرة المعلن",
        "الحجم"
      ],
      "advancedFilters": [
        "النوع",
        "نوع البشرة المعلن",
        "الحجم",
        "السعر"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "مل",
      "logicAr": "OR داخل النوع، AND مع الحجم والسعر",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "لا ادعاء طبي من الوسوم",
      "unimplemented": true
    },
    {
      "id": "CAT-BODY",
      "nameAr": "الجسم",
      "filters": [
        "المنطقة",
        "القوام",
        "الحجم",
        "السعر"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "المنطقة",
        "القوام",
        "الحجم",
        "السعر"
      ],
      "quickFilters": [
        "المنطقة",
        "القوام",
        "الحجم"
      ],
      "advancedFilters": [
        "المنطقة",
        "القوام",
        "الحجم",
        "السعر"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "مل",
      "logicAr": "AND بين المنطقة والحجم",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "المنطقة تعداد",
      "unimplemented": true
    },
    {
      "id": "CAT-HAIR",
      "nameAr": "الشعر",
      "filters": [
        "نوع الشعر المعلن",
        "الهدف",
        "الحجم"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "نوع الشعر المعلن",
        "الهدف",
        "الحجم"
      ],
      "quickFilters": [
        "نوع الشعر المعلن",
        "الهدف",
        "الحجم"
      ],
      "advancedFilters": [
        "نوع الشعر المعلن",
        "الهدف",
        "الحجم"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "مل",
      "logicAr": "AND",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "النوع تسويقي لا تشخيص",
      "unimplemented": true
    },
    {
      "id": "CAT-APPAREL",
      "nameAr": "الملابس",
      "filters": [
        "نوع القطعة",
        "اللون",
        "المقاس",
        "التوفر"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "نوع القطعة",
        "اللون",
        "المقاس",
        "التوفر"
      ],
      "quickFilters": [
        "نوع القطعة",
        "اللون",
        "المقاس"
      ],
      "advancedFilters": [
        "نوع القطعة",
        "اللون",
        "المقاس",
        "التوفر"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "مقاس حرفي",
      "logicAr": "AND على متغير واحد للون والمقاس والتوفر",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "مثال الفستان هنا",
      "unimplemented": true
    },
    {
      "id": "CAT-ACCESSORY",
      "nameAr": "الإكسسوارات",
      "filters": [
        "النوع",
        "اللون",
        "المادة"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "النوع",
        "اللون",
        "المادة"
      ],
      "quickFilters": [
        "النوع",
        "اللون",
        "المادة"
      ],
      "advancedFilters": [
        "النوع",
        "اللون",
        "المادة"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "بدون وحدة مقاس ملابس",
      "logicAr": "AND",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "المادة تعداد",
      "unimplemented": true
    },
    {
      "id": "CAT-SALON",
      "nameAr": "المشاغل",
      "filters": [
        "الخدمة",
        "المدينة",
        "مدة بالدقائق"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "الخدمة",
        "المدينة",
        "مدة بالدقائق"
      ],
      "quickFilters": [
        "الخدمة",
        "المدينة",
        "مدة بالدقائق"
      ],
      "advancedFilters": [
        "الخدمة",
        "المدينة",
        "مدة بالدقائق"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "دقيقة",
      "logicAr": "AND",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "ليست خدمة طبية",
      "unimplemented": true
    },
    {
      "id": "CAT-CLINIC",
      "nameAr": "العيادات",
      "filters": [
        "التخصص",
        "المدينة",
        "نوع الزيارة"
      ],
      "subcategoriesAr": [
        "يُقترح تعداد فرعي يديره المتجر ضمن الفئة"
      ],
      "attributesOnCreateAr": [
        "التخصص",
        "المدينة",
        "نوع الزيارة"
      ],
      "quickFilters": [
        "التخصص",
        "المدينة",
        "نوع الزيارة"
      ],
      "advancedFilters": [
        "التخصص",
        "المدينة",
        "نوع الزيارة"
      ],
      "allowedValuesSourceAr": "قاموس يديره الشريك وتراجعه الإدارة. القيم الناقصة تُرفض ولا تُخترع في الواجهة.",
      "unitsAr": "دقيقة",
      "logicAr": "AND",
      "indexAr": "فهرس مقترح على partnerId والحالة وخصائص المتغير المستخدمة في الفلتر. غير منفذ.",
      "sortAr": "السعر أو الأحدث. الترتيب على نتيجة الاستعلام لا على صفحة واحدة.",
      "paginationAr": "حد صفحة ثابت مع عدد كلي.",
      "countAr": "عدد المنتجات المطابقة منفصل عن عدد الأصول المنشورة المرتبطة.",
      "stateAr": "حفظ الاستعلام عند فتح التفاصيل والعودة.",
      "emptyAr": "حالة لا نتائج مع إبقاء الفلاتر ظاهرة.",
      "note": "حقول إعلان صحي منفصلة",
      "unimplemented": true
    }
  ],
  "reviewFindings": [
    {
      "id": "REV-0001",
      "parentId": null,
      "titleAr": "أدلة الشركاء والإدارة لا تطابق حكم التفعيل",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "بوابة الشركاء وُصفت مفعلة ودليلها ملف مواصفات، ولوحة الإدارة بلا دليل.",
      "reqIds": [
        "REQ-0006",
        "REQ-0016"
      ],
      "severity": "high",
      "impactAr": "بوابة الشركاء وُصفت مفعلة ودليلها ملف مواصفات، ولوحة الإدارة بلا دليل.",
      "unit": "partners-admin",
      "files": [
        "partners-portal/SPEC.md",
        "admin-portal/web/js/api.js"
      ],
      "previousEvidenceAr": "EVD-0007 فقط لـ CAP-0007، وCAP-0008 بلا evidenceIds",
      "actionAr": "قراءة المتحكم والحارس وعميل الويب، وتخفيض التفعيل إلى UNKNOWN",
      "newEvidenceIds": [
        "EVD-0011",
        "EVD-0012",
        "EVD-0014",
        "EVD-0015"
      ],
      "verificationAr": "مقارنة الملفات بالمقتطفات وSHA-256",
      "remainingLimitsAr": "لا تشغيل إنتاجي. البندان الفرعيان اكتملت دراستهما بانتظار المراجعة.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0001a",
      "parentId": "REV-0001",
      "titleAr": "SPEC ليس دليل تنفيذ الشركاء",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "EVD-0007 مواصفات. التنفيذ في المتحكم والعميل.",
      "reqIds": [
        "REQ-0006"
      ],
      "severity": "high",
      "impactAr": "EVD-0007 مواصفات. التنفيذ في المتحكم والعميل.",
      "unit": "partners",
      "files": [
        "partners-portal/SPEC.md",
        "mira-api/src/partners-portal/partners-portal.controller.ts"
      ],
      "previousEvidenceAr": "EVD-0007",
      "actionAr": "أُبقي EVD-0007 كوثيقة وأُضيفت أدلة التنفيذ",
      "newEvidenceIds": [
        "EVD-0007",
        "EVD-0011",
        "EVD-0016"
      ],
      "verificationAr": "مراجعة نوع الدليل document مقابل fact",
      "remainingLimitsAr": "التفعيل الإنتاجي UNKNOWN",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0001b",
      "parentId": "REV-0001",
      "titleAr": "لوحة الإدارة بلا دليل مرتبط",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "CAP-0008 كانت بلا evidenceIds.",
      "reqIds": [
        "REQ-0016"
      ],
      "severity": "high",
      "impactAr": "CAP-0008 كانت بلا evidenceIds.",
      "unit": "admin",
      "files": [
        "mira-api/src/admin/admin.controller.ts",
        "admin-portal/web/js/api.js"
      ],
      "previousEvidenceAr": "مصفوفة فارغة",
      "actionAr": "رُبطت EVD-0014 وEVD-0015 وEVD-0025",
      "newEvidenceIds": [
        "EVD-0014",
        "EVD-0015",
        "EVD-0025"
      ],
      "verificationAr": "وجود الملفات والمقتطفات",
      "remainingLimitsAr": "لا يثبت ضبط المفتاح في الإنتاج",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0002",
      "parentId": null,
      "titleAr": "أحكام الوجود أوسع من الأدلة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "قدرات بلا أدلة، وملخص بحث، ومقتطف مخطط يُستخدم كنفي شامل.",
      "reqIds": [
        "REQ-0002",
        "REQ-0011"
      ],
      "severity": "high",
      "impactAr": "قدرات بلا أدلة، وملخص بحث، ومقتطف مخطط يُستخدم كنفي شامل.",
      "unit": "study",
      "files": [
        "data/capabilities.json"
      ],
      "previousEvidenceAr": "CAP-0008 و0010 و0011 و0013 و0014 بلا أدلة أو بملخص",
      "actionAr": "تضييق نطاق الغياب وإرفاق أوامر الخروج",
      "newEvidenceIds": [
        "EVD-0018",
        "EVD-0019",
        "EVD-0023"
      ],
      "verificationAr": "مراجعة سجل الأمر وexit code",
      "remainingLimitsAr": "البحث لا يغطي أسماءً لم تُذكر ولا مستودعات خارج ميرا",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0002a",
      "parentId": "REV-0002",
      "titleAr": "قدرات بلا أدلة مرتبطة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "CAP-0008 وCAP-0010 وCAP-0011 وCAP-0013 وCAP-0014 كانت بلا أدلة.",
      "reqIds": [
        "REQ-0013"
      ],
      "severity": "high",
      "impactAr": "CAP-0008 وCAP-0010 وCAP-0011 وCAP-0013 وCAP-0014 كانت بلا أدلة.",
      "unit": "capabilities",
      "files": [
        "data/capabilities.json"
      ],
      "previousEvidenceAr": "evidenceIds فارغة",
      "actionAr": "رُبط كل حكم بدليل أو صُنّف البحث بنطاقه",
      "newEvidenceIds": [
        "EVD-0014",
        "EVD-0017",
        "EVD-0020",
        "EVD-0023"
      ],
      "verificationAr": "كل قدرة حقيقة لها دليل",
      "remainingLimitsAr": "SOURCE_ONLY",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0002b",
      "parentId": "REV-0002",
      "titleAr": "سجل Order/Cart كان ملخصًا",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "CMD-0001 ليس مخرج أمر.",
      "reqIds": [
        "REQ-0011"
      ],
      "severity": "high",
      "impactAr": "CMD-0001 ليس مخرج أمر.",
      "unit": "evidence",
      "files": [
        "evidence/commands/CMD-0001-search-order-cart.txt"
      ],
      "previousEvidenceAr": "EVD-0010 ملخص",
      "actionAr": "أُضيف CMD-RC2-0001 مع exit_code=1",
      "newEvidenceIds": [
        "EVD-0018",
        "EVD-0010"
      ],
      "verificationAr": "قراءة ملف الأمر",
      "remainingLimitsAr": "exit=1 يعني لا تطابق للنمط لا غيابًا كونيًا",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "search"
    },
    {
      "id": "REV-0002c",
      "parentId": "REV-0002",
      "titleAr": "مقتطف المخطط لا ينفي المشروع",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "EVD-0005 نطاقه أسطر المخطط المعروضة.",
      "reqIds": [
        "REQ-0002"
      ],
      "severity": "medium",
      "impactAr": "EVD-0005 نطاقه أسطر المخطط المعروضة.",
      "unit": "schema",
      "files": [
        "mira-api/prisma/schema.prisma"
      ],
      "previousEvidenceAr": "EVD-0005",
      "actionAr": "أُضيف بحث النماذج EVD-0019 ونص doesNotProve",
      "newEvidenceIds": [
        "EVD-0005",
        "EVD-0019"
      ],
      "verificationAr": "مقارنة حدود الدليل",
      "remainingLimitsAr": "جداول بأسماء أخرى خارج النمط لن تُكتشف",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "search"
    },
    {
      "id": "REV-0003",
      "parentId": null,
      "titleAr": "تقرير الإيقاف يخلط المنفذ والموقوف والناقص",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "عبارة الانطلاق قريبًا ليست سببًا تشغيليًا، والشراء الداخلي لم يكن خدمة متوقفة.",
      "reqIds": [
        "REQ-0019"
      ],
      "severity": "high",
      "impactAr": "عبارة الانطلاق قريبًا ليست سببًا تشغيليًا، والشراء الداخلي لم يكن خدمة متوقفة.",
      "unit": "paused",
      "files": [
        "data/paused-services.json"
      ],
      "previousEvidenceAr": "PAUSE-0001 إلى 0003",
      "actionAr": "فُصلت طبقات الإخفاء والبوابة وAPI واكتمال المنطق",
      "newEvidenceIds": [
        "EVD-0001",
        "EVD-0003",
        "EVD-0004",
        "EVD-0018"
      ],
      "verificationAr": "جدول الأحكام المتغيرة",
      "remainingLimitsAr": "وصول API الإنتاج بقي UNKNOWN",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0003a",
      "parentId": "REV-0003",
      "titleAr": "طبقات Discover مختلطة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "حُكم بوصول API دون دليل تشغيل.",
      "reqIds": [
        "REQ-0006"
      ],
      "severity": "high",
      "impactAr": "حُكم بوصول API دون دليل تشغيل.",
      "unit": "marketplace",
      "files": [
        "lib/core/config/mira_features.dart",
        "lib/main.dart"
      ],
      "previousEvidenceAr": "EVD-0001 وEVD-0002",
      "actionAr": "uiHidden موثق والباقي UNKNOWN",
      "newEvidenceIds": [
        "EVD-0001",
        "EVD-0002",
        "EVD-0006"
      ],
      "verificationAr": "لا طلب شبكة إنتاجي في هذه المرحلة",
      "remainingLimitsAr": "لم يُفحص البناء المنشور",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0003b",
      "parentId": "REV-0003",
      "titleAr": "عبارة الانطلاق قريبًا ليست سبب إيقاف",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "النص واجهة. السبب التاريخي غير موثق.",
      "reqIds": [],
      "severity": "medium",
      "impactAr": "النص واجهة. السبب التاريخي غير موثق.",
      "unit": "marketplace",
      "files": [
        "lib/main.dart"
      ],
      "previousEvidenceAr": "حقل documentedReason السابق",
      "actionAr": "صُحح reasonClass",
      "newEvidenceIds": [
        "EVD-0002"
      ],
      "verificationAr": "قراءة النص في المقتطف",
      "remainingLimitsAr": "لا وثيقة تشغيل إضافية داخل المستودع",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0003c",
      "parentId": "REV-0003",
      "titleAr": "الشراء الداخلي ليس خدمة متوقفة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "التصميم رابط خارجي ولم يُبنَ طلب داخلي ثم يُوقف.",
      "reqIds": [
        "REQ-0019"
      ],
      "severity": "high",
      "impactAr": "التصميم رابط خارجي ولم يُبنَ طلب داخلي ثم يُوقف.",
      "unit": "orders",
      "files": [
        "product_detail_screen.dart",
        "SPEC.md"
      ],
      "previousEvidenceAr": "PAUSE-0003",
      "actionAr": "التصنيف NEVER_BUILT",
      "newEvidenceIds": [
        "EVD-0004",
        "EVD-0007",
        "EVD-0018"
      ],
      "verificationAr": "مقارنة التصنيف بالأدلة",
      "remainingLimitsAr": "قرار DEC-0001 ما زال مفتوحًا",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0004",
      "parentId": null,
      "titleAr": "القبول والمراحل والجهد غير محددة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "معيار قبول واحد لكل المتطلبات، ومراحل بلا خروج، ومتطلبات خارج الخطة.",
      "reqIds": [
        "REQ-0003",
        "REQ-0006",
        "REQ-0009",
        "REQ-0015",
        "REQ-0016",
        "REQ-0017",
        "REQ-0018",
        "REQ-0020"
      ],
      "severity": "high",
      "impactAr": "معيار قبول واحد لكل المتطلبات، ومراحل بلا خروج، ومتطلبات خارج الخطة.",
      "unit": "roadmap",
      "files": [
        "data/requirements.json",
        "data/roadmap.json"
      ],
      "previousEvidenceAr": "acceptanceAr الموحد",
      "actionAr": "معايير لكل متطلب وخطة تغطي الكل",
      "newEvidenceIds": [],
      "verificationAr": "أداة التحقق ترفض المعيار العام",
      "remainingLimitsAr": "التقديرات نطاقات بافتراضات لا عروض أسعار",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0004a",
      "parentId": "REV-0004",
      "titleAr": "معيار القبول العام",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "النص كان: يُثبت لاحقًا ببوابة قبول.",
      "reqIds": [
        "REQ-0001"
      ],
      "severity": "high",
      "impactAr": "النص كان: يُثبت لاحقًا ببوابة قبول.",
      "unit": "requirements",
      "files": [
        "data/requirements.json"
      ],
      "previousEvidenceAr": "حقل acceptanceAr",
      "actionAr": "استُبدل بمعطى وإجراء ومتوقع وفشل واختبار ودليل",
      "newEvidenceIds": [],
      "verificationAr": "validate_study يرفض العبارة العامة",
      "remainingLimitsAr": "المعايير مقترحة للدراسة وليست اختبارات منفذة على المنتج",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0004b",
      "parentId": "REV-0004",
      "titleAr": "شروط خروج المراحل",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "GATE-01 إلى GATE-05 بلا خروج محدد.",
      "reqIds": [],
      "severity": "high",
      "impactAr": "GATE-01 إلى GATE-05 بلا خروج محدد.",
      "unit": "roadmap",
      "files": [
        "data/roadmap.json"
      ],
      "previousEvidenceAr": "exitCriteria على GATE-00 فقط",
      "actionAr": "لكل مرحلة دخول وخروج وجهد ومخاطر وتراجع",
      "newEvidenceIds": [],
      "verificationAr": "قراءة roadmap.json",
      "remainingLimitsAr": "الجهد تقدير دراسة",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0004c",
      "parentId": "REV-0004",
      "titleAr": "متطلبات خارج المراحل المستقبلية",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "REQ-0003 و0006 و0009 و0015 و0016 و0017 و0018 و0020 لم تكن في GATE-01..05.",
      "reqIds": [
        "REQ-0003",
        "REQ-0006",
        "REQ-0009",
        "REQ-0015",
        "REQ-0016",
        "REQ-0017",
        "REQ-0018",
        "REQ-0020"
      ],
      "severity": "high",
      "impactAr": "REQ-0003 و0006 و0009 و0015 و0016 و0017 و0018 و0020 لم تكن في GATE-01..05.",
      "unit": "roadmap",
      "files": [
        "data/roadmap.json",
        "data/scope-decisions.json"
      ],
      "previousEvidenceAr": "GATE-00 كان يجمع كل المتطلبات",
      "actionAr": "وُزعت على البوابات وREQ-0020 قرار نطاق",
      "newEvidenceIds": [],
      "verificationAr": "مصفوفة التغطية",
      "remainingLimitsAr": "لم يبدأ التنفيذ",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0005",
      "parentId": null,
      "titleAr": "الفلاتر والوسائط والتنظيم مختصرة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "بلا عقود أو فهرسة أو تكلفة أو مصادر رسمية.",
      "reqIds": [
        "REQ-0013",
        "REQ-0004"
      ],
      "severity": "high",
      "impactAr": "بلا عقود أو فهرسة أو تكلفة أو مصادر رسمية.",
      "unit": "product-study",
      "files": [
        "data/categories.json",
        "data/contracts.json"
      ],
      "previousEvidenceAr": "قوائم أسماء فلاتر",
      "actionAr": "عقود مقترحة موسومة غير منفذة وبحث مصادر",
      "newEvidenceIds": [],
      "verificationAr": "المصادر مؤرخة بتاريخ الاطلاع",
      "remainingLimitsAr": "الأسعار غير متحققة والدراسة ليست اعتمادًا قانونيًا",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0005a",
      "parentId": "REV-0005",
      "titleAr": "عقود وفلاتر قابلة للمراجعة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "المثال المطلوب: فستان أزرق مقاس M متوفر يطابق متغيرًا واحدًا.",
      "reqIds": [
        "REQ-0013",
        "REQ-0014"
      ],
      "severity": "high",
      "impactAr": "المثال المطلوب: فستان أزرق مقاس M متوفر يطابق متغيرًا واحدًا.",
      "unit": "filters",
      "files": [
        "data/contracts.json",
        "data/categories.json"
      ],
      "previousEvidenceAr": "أسماء فلاتر فقط",
      "actionAr": "عقود وحالات AND ومثال العدّ",
      "newEvidenceIds": [],
      "verificationAr": "العرض في القسم 8 ووسم مقترح غير منفذ",
      "remainingLimitsAr": "غير مبني في المنتج",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "proposal"
    },
    {
      "id": "REV-0005b",
      "parentId": "REV-0005",
      "titleAr": "دورة الوسائط والتكلفة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "لا دورة حياة ولا معادلة تكلفة.",
      "reqIds": [
        "REQ-0004",
        "REQ-0005"
      ],
      "severity": "medium",
      "impactAr": "لا دورة حياة ولا معادلة تكلفة.",
      "unit": "media",
      "files": [
        "data/media-lifecycle.json",
        "data/costs.json"
      ],
      "previousEvidenceAr": "قسم مختصر",
      "actionAr": "دورة كاملة ومعادلات بلا أسعار مخترعة",
      "newEvidenceIds": [
        "EVD-0024"
      ],
      "verificationAr": "لا مشغل قائم في النطاق قبل اقتراح مزود",
      "remainingLimitsAr": "أسعار المزود غير متحقق",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0005c",
      "parentId": "REV-0005",
      "titleAr": "البحث التنظيمي الرسمي",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "لم يُنجز في النسخة السابقة.",
      "reqIds": [
        "REQ-0017"
      ],
      "severity": "high",
      "impactAr": "لم يُنجز في النسخة السابقة.",
      "unit": "regulatory",
      "files": [
        "data/regulatory.json"
      ],
      "previousEvidenceAr": "عبارة تحتاج مراجعة",
      "actionAr": "مصادر رسمية بتاريخ اطلاع وأثر تصميمي وأسئلة مختص",
      "newEvidenceIds": [],
      "verificationAr": "روابط المصادر في القسم 12",
      "remainingLimitsAr": "ليس رأيًا قانونيًا ملزمًا",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "regulatory"
    },
    {
      "id": "REV-0006",
      "parentId": null,
      "titleAr": "أداة التحقق تقبل دراسة فاسدة",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "نجحت رغم انحراف JSON واعتماد مرحلة ناقصة وحقول دليل فارغة.",
      "reqIds": [],
      "severity": "high",
      "impactAr": "نجحت رغم انحراف JSON واعتماد مرحلة ناقصة وحقول دليل فارغة.",
      "unit": "tooling",
      "files": [
        "scripts/validate_study.py"
      ],
      "previousEvidenceAr": "PASS بعدد ثابت",
      "actionAr": "فحوص بنيوية واختبارات سلبية على نسخة مؤقتة",
      "newEvidenceIds": [
        "EVD-0027"
      ],
      "verificationAr": "ثماني حالات FAIL بخروج غير صفري ثم PASS على النسخة السليمة. السجل EVD-0027.",
      "remainingLimitsAr": "التحقق بنيوي. لا يغني عن قراءة الملاحظات.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "test"
    },
    {
      "id": "REV-0007",
      "parentId": null,
      "titleAr": "مصدر الحقيقة والعرض والاختبار التفاعلي",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "نصوص الدراسة داخل app.js وأنماط مضمّنة وبلا لقطات.",
      "reqIds": [],
      "severity": "high",
      "impactAr": "نصوص الدراسة داخل app.js وأنماط مضمّنة وبلا لقطات.",
      "unit": "site",
      "files": [
        "js/app.js",
        "css/components.css"
      ],
      "previousEvidenceAr": "لا مجلد لقطات في الحزمة السابقة",
      "actionAr": "نقل المحتوى إلى JSON وفصل CSS",
      "newEvidenceIds": [],
      "verificationAr": "اختبار متصفح لاحقًا",
      "remainingLimitsAr": "لقطات المتصفح تُستكمل في هذه الجولة أو تبقى القيد ظاهرًا",
      "status": "قيد المعالجة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0007a",
      "parentId": "REV-0007",
      "titleAr": "النص الموضوعي داخل app.js",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "sectionBody كان يحمل نتائج التدقيق.",
      "reqIds": [],
      "severity": "high",
      "impactAr": "sectionBody كان يحمل نتائج التدقيق.",
      "unit": "site",
      "files": [
        "js/app.js",
        "data/section-content.json"
      ],
      "previousEvidenceAr": "سويتش النصوص",
      "actionAr": "العرض يقرأ JSON والتوكنات {{ID}}",
      "newEvidenceIds": [],
      "verificationAr": "مقارنة المولد بالملف",
      "remainingLimitsAr": "نصوص أزرار الواجهة تبقى في العرض",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0007b",
      "parentId": "REV-0007",
      "titleAr": "أنماط مضمّنة في القالب",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "style على بطاقات المقاييس.",
      "reqIds": [],
      "severity": "low",
      "impactAr": "style على بطاقات المقاييس.",
      "unit": "site",
      "files": [
        "css/layout.css"
      ],
      "previousEvidenceAr": "ثلاث خصائص style",
      "actionAr": "صنف metric-compact",
      "newEvidenceIds": [],
      "verificationAr": "بحث style= في app.js بعد التعديل",
      "remainingLimitsAr": "لا يشمل أنماط المتصفح الافتراضية",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "source"
    },
    {
      "id": "REV-0007c",
      "parentId": "REV-0007",
      "titleAr": "لقطات واختبار تفاعل المتصفح",
      "source": "مراجعة الحزمة السابقة",
      "descriptionAr": "node --check وHTTP 200 لا يثبتان التفاعل.",
      "reqIds": [],
      "severity": "high",
      "impactAr": "node --check وHTTP 200 لا يثبتان التفاعل.",
      "unit": "tests",
      "files": [
        "evidence/screenshots",
        "evidence/tests"
      ],
      "previousEvidenceAr": "لا لقطات",
      "actionAr": "اختبار عرض كمبيوتر وجوال وتابلت على النسخة المستخرجة إن أمكن",
      "newEvidenceIds": [],
      "verificationAr": "المتصفح المدمج: 22 قسمًا، RTL، فتح #REV-0001، البحث أخفى 20 قسمًا ثم أظهرها، وفلتر الحالة أظهر REV-0007 وREV-0007c. لقطة Chrome 1280 ناجحة. لقطتا 768 و390 خرجتا فارغتين وليستا دليلًا.",
      "remainingLimitsAr": "لقطات التابلت والجوال من Chrome headless بيضاء. لا تُحتسب نجاح عرض. البند يبقى قيد المعالجة.",
      "status": "قيد المعالجة",
      "previousStatus": "مفتوحة في مراجعة الحزمة 20260923_032329",
      "updatedAt": "2026-09-23T03:43:29+03:00",
      "evidenceType": "browser"
    },
    {
      "id": "REV-0008",
      "parentId": null,
      "titleAr": "ملفات مصدر ناقصة في RC1",
      "source": "مراجعة حزمة الأماكن RC1",
      "descriptionAr": "خمسة مسارات لم تكن في الحزمة السابقة.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "medium",
      "impactAr": "خمسة مسارات لم تكن في الحزمة السابقة.",
      "unit": "places-handoff",
      "files": [
        "lib/src/features/auth/models/auth_credentials.dart",
        "lib/src/core/geo/geo.dart",
        "assets/fonts/Cairo-Variable.ttf"
      ],
      "previousEvidenceAr": "حزمة 20260924_0030",
      "actionAr": "أُرفقت مع إغلاق الاستيراد اللازم وصُنفت اعتماديات المضيف.",
      "newEvidenceIds": [
        "EVD-0028"
      ],
      "verificationAr": "فحص حزمة RC2 بعد فكها",
      "remainingLimitsAr": "لم يُنسخ تطبيق دار كار كاملًا. المراجعة البشرية لم تعتمد الحزمة.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة",
      "updatedAt": "2026-09-24T01:10:00+03:00",
      "evidenceType": "handoff"
    },
    {
      "id": "REV-0009",
      "parentId": null,
      "titleAr": "مدقق الحزمة كان يقبل تلفًا",
      "source": "مراجعة حزمة الأماكن RC1",
      "descriptionAr": "تغيير README أو إتلاف MANIFEST أو حذف سجل كان يمكن أن يمر.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "medium",
      "impactAr": "تغيير README أو إتلاف MANIFEST أو حذف سجل كان يمكن أن يمر.",
      "unit": "places-handoff",
      "files": [
        "scripts/validate_package.py"
      ],
      "previousEvidenceAr": "حزمة 20260924_0030",
      "actionAr": "أُعيدت الفحوص السلبية على نسخ مؤقتة ورُفضت.",
      "newEvidenceIds": [
        "EVD-0028"
      ],
      "verificationAr": "فحص حزمة RC2 بعد فكها",
      "remainingLimitsAr": "البصمة تثبت الاتساق لا اكتمال جمع كل ملفات الأصل.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة",
      "updatedAt": "2026-09-24T01:10:00+03:00",
      "evidenceType": "handoff"
    },
    {
      "id": "REV-0010",
      "parentId": null,
      "titleAr": "مسار الاكتشاف نُسب إلى VenueApi",
      "source": "مراجعة حزمة الأماكن RC1",
      "descriptionAr": "الخلاصة في الكود عبر DiscoveryApi.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "medium",
      "impactAr": "الخلاصة في الكود عبر DiscoveryApi.",
      "unit": "places-handoff",
      "files": [
        "lib/src/features/places/core/api/places_http_discovery_repository.dart"
      ],
      "previousEvidenceAr": "حزمة 20260924_0030",
      "actionAr": "صُحح المسار في وثائق RC2 والموقع.",
      "newEvidenceIds": [
        "EVD-0028"
      ],
      "verificationAr": "فحص حزمة RC2 بعد فكها",
      "remainingLimitsAr": "لا يثبت سلوك النسخة المنشورة.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة",
      "updatedAt": "2026-09-24T01:10:00+03:00",
      "evidenceType": "handoff"
    },
    {
      "id": "REV-0011",
      "parentId": null,
      "titleAr": "عدد أسطر git status ليس دليل عدم التعديل",
      "source": "مراجعة حزمة الأماكن RC1",
      "descriptionAr": "RC1 اعتمد ثبات 1151 سطرًا.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "medium",
      "impactAr": "RC1 اعتمد ثبات 1151 سطرًا.",
      "unit": "places-handoff",
      "files": [
        "evidence/baseline/source_file_hashes_before.txt"
      ],
      "previousEvidenceAr": "حزمة 20260924_0030",
      "actionAr": "RC2 يسجل بصمات الملفات قبل وبعد. لم يُدعَ إصلاح النقص بأثر رجعي.",
      "newEvidenceIds": [
        "EVD-0028"
      ],
      "verificationAr": "فحص حزمة RC2 بعد فكها",
      "remainingLimitsAr": "دليل RC1 يبقى محدودًا بتلك الطريقة.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة",
      "updatedAt": "2026-09-24T01:10:00+03:00",
      "evidenceType": "handoff"
    },
    {
      "id": "REV-0012",
      "parentId": null,
      "titleAr": "تعارض عبارة التنقيح",
      "source": "مراجعة حزمة الأماكن RC1",
      "descriptionAr": "ملف قال إن شيئًا لم يُنقح والفهرس فيه نسخة منقحة.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "medium",
      "impactAr": "ملف قال إن شيئًا لم يُنقح والفهرس فيه نسخة منقحة.",
      "unit": "places-handoff",
      "files": [
        "lib/src/core/config/app_config.dart"
      ],
      "previousEvidenceAr": "حزمة 20260924_0030",
      "actionAr": "وُحّد السجل على app_config.dart فقط. auth_credentials ليس سرًا.",
      "newEvidenceIds": [
        "EVD-0028"
      ],
      "verificationAr": "فحص حزمة RC2 بعد فكها",
      "remainingLimitsAr": "المفتاح الأصلي بقي في المستودع ولم يُمس.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة في مراجعة الحزمة",
      "updatedAt": "2026-09-24T01:10:00+03:00",
      "evidenceType": "handoff"
    },
    {
      "id": "REV-0013",
      "parentId": null,
      "titleAr": "المرجع البصري للتصورات غير مرفق",
      "source": "مراجعة حزمة الأماكن RC1",
      "descriptionAr": "ثلاثة تصورات أعجب بها المالك بلا ملفات صور في التسليم.",
      "reqIds": [
        "REQ-0026"
      ],
      "severity": "medium",
      "impactAr": "ثلاثة تصورات أعجب بها المالك بلا ملفات صور في التسليم.",
      "unit": "places-handoff",
      "files": [
        "data/places-adoption.json"
      ],
      "previousEvidenceAr": "حزمة 20260924_0030",
      "actionAr": "RC3 بحث في ملفات الدراسة وسطح المكتب. الصور الثلاثة غير موجودة. لم تُولَّد بدائل ولم يُستخدم رابط مكسور.",
      "newEvidenceIds": [
        "EVD-0029",
        "EVD-0033"
      ],
      "verificationAr": "فحص حزمة RC2 بعد فكها",
      "remainingLimitsAr": "المراجع الثلاث مرفقة في evidence/visual/references بحالة available. هذا لا يعتمد المرحلة الأولى.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "قيد المعالجة",
      "updatedAt": "2026-09-26T03:10:00+03:00",
      "evidenceType": "handoff"
    },
    {
      "id": "REV-0014",
      "parentId": null,
      "titleAr": "سجل MANIFEST لا يطابق محتويات الحزمة",
      "source": "مراجعة الموقع 0125",
      "descriptionAr": "17 بصمة مختلفة و7 ملفات غير مسجلة وبيانات تعريف قديمة.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "17 بصمة مختلفة و7 ملفات غير مسجلة وبيانات تعريف قديمة.",
      "unit": "reference-site",
      "files": [
        "MANIFEST.json",
        "scripts/write_manifest.py"
      ],
      "previousEvidenceAr": "حزمة الموقع 0125",
      "actionAr": "يُعاد إنشاء السجل من الشجرة النهائية ويستثني نفسه فقط.",
      "newEvidenceIds": [
        "EVD-0030"
      ],
      "verificationAr": "فحص الحزمة المستقل بعد فك ZIP",
      "remainingLimitsAr": "بانتظار مراجعة بشرية. ليس اعتماد دراسة.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مثبتة في المراجعة",
      "updatedAt": "2026-09-24T02:20:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0015",
      "parentId": null,
      "titleAr": "فاحص الدراسة يفشل خارج مستودع ميرا",
      "source": "مراجعة الموقع 0125",
      "descriptionAr": "18 دليلًا من نوع fact تُفحص على ملفات التطبيق.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "18 دليلًا من نوع fact تُفحص على ملفات التطبيق.",
      "unit": "reference-site",
      "files": [
        "scripts/validate_package.py",
        "scripts/verify_evidence_freshness.py"
      ],
      "previousEvidenceAr": "حزمة الموقع 0125",
      "actionAr": "فُصل فحص الحزمة عن فحص الحداثة. غياب المستودع يُظهر BLOCKED ولا يُفشل الحزمة.",
      "newEvidenceIds": [
        "EVD-0001"
      ],
      "verificationAr": "فحص الحزمة المستقل بعد فك ZIP",
      "remainingLimitsAr": "الحداثة تبقى فحصًا منفصلًا عند تمرير --repo.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مثبتة في المراجعة",
      "updatedAt": "2026-09-24T02:20:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0016",
      "parentId": null,
      "titleAr": "لقطة سطح المكتب ليست بعرض 1280",
      "source": "مراجعة الموقع 0125",
      "descriptionAr": "places-plan-desktop-1280.png أبعادها 277×445.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "places-plan-desktop-1280.png أبعادها 277×445.",
      "unit": "reference-site",
      "files": [
        "evidence/screenshots/places-plan-desktop-1280.png",
        "evidence/screenshots/rc3-mobile-390x844.png",
        "evidence/screenshots/rc3-tablet-768x1024.png",
        "evidence/screenshots/rc3-desktop-1280x900.png",
        "evidence/tests/rc3_browser.json"
      ],
      "previousEvidenceAr": "حزمة الموقع 0125",
      "actionAr": "التقطت لقطات جديدة بأبعاد 390×844 و768×1024 و1280×900. اللقطة القديمة 277×445 بقيت باسمها وليست إثبات العرض العريض.",
      "newEvidenceIds": [
        "EVD-0033"
      ],
      "verificationAr": "فحص الحزمة المستقل بعد فك ZIP",
      "remainingLimitsAr": "لقطات RC1 ليست تكرار 445/527. قص حافة الجوال ما زال ملاحظة في REV-0019.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مثبتة في المراجعة",
      "updatedAt": "2026-09-24T03:18:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0017",
      "parentId": null,
      "titleAr": "DEPENDENCY_MAP.json ما زال يمرر الخلاصة عبر VenueApi",
      "source": "مراجعة الموقع 0125",
      "descriptionAr": "سلسلة browse-media داخل أرشيف 0125.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "سلسلة browse-media داخل أرشيف 0125.",
      "unit": "reference-site",
      "files": [
        "DEPENDENCY_MAP.json"
      ],
      "previousEvidenceAr": "حزمة الموقع 0125",
      "actionAr": "التصحيح موثق في الموقع. أرشيف المصدر لم يُعد تغليفه. مسار التفاصيل بقي على VenueApi.",
      "newEvidenceIds": [
        "EVD-0030"
      ],
      "verificationAr": "فحص الحزمة المستقل بعد فك ZIP",
      "remainingLimitsAr": "الوثيقة الأصلية داخل ZIP بقيت خاطئة عمدًا لأن الأرشيف لا يُعدَّل.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مثبتة في المراجعة",
      "updatedAt": "2026-09-24T02:20:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0018",
      "parentId": null,
      "titleAr": "سجل الاستبعاد ينفي تنقيحًا يثبته redaction_rc2",
      "source": "مراجعة الموقع 0125",
      "descriptionAr": "EXCLUSIONS_AND_REDACTIONS.json مقابل redaction_rc2.json.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "EXCLUSIONS_AND_REDACTIONS.json مقابل redaction_rc2.json.",
      "unit": "reference-site",
      "files": [
        "EXCLUSIONS_AND_REDACTIONS.json"
      ],
      "previousEvidenceAr": "حزمة الموقع 0125",
      "actionAr": "وُثّق التعارض دون استعادة المفتاح ودون تعديل الأرشيف.",
      "newEvidenceIds": [
        "EVD-0031"
      ],
      "verificationAr": "فحص الحزمة المستقل بعد فك ZIP",
      "remainingLimitsAr": "التصحيح لاحق داخل الموقع.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مثبتة في المراجعة",
      "updatedAt": "2026-09-24T02:20:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0019",
      "parentId": "REV-0016",
      "titleAr": "لقطات RC3 تكرر المحتوى كل 445 و527 بكسل",
      "source": "مراجعة لقطات RC3",
      "descriptionAr": "الأبعاد صحيحة لكن الصفوف تتطابق كل 445 بكسل والأعمدة كل 527 في التابلت والكمبيوتر.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "اللقطات لا تثبت سلامة العرض.",
      "unit": "reference-site",
      "files": [
        "evidence/screenshots/rc3-mobile-390x844.png",
        "evidence/screenshots/rc3-tablet-768x1024.png",
        "evidence/screenshots/rc3-desktop-1280x900.png",
        "evidence/tests/rc3_screenshot_tiling.txt",
        "evidence/screenshots/rc1-mobile-390x844.png",
        "evidence/screenshots/rc1-tablet-768x1024.png",
        "evidence/screenshots/rc1-desktop-1280x900.png",
        "evidence/tests/rc1_browser.json"
      ],
      "previousEvidenceAr": "حزمة RC3 0215",
      "actionAr": "أُعيد الالتقاط بـ Chrome headless بدون تكرار مطابق. لقطة التمرير إلى s38 كانت فارغة ورُفضت.",
      "newEvidenceIds": [
        "EVD-0035"
      ],
      "verificationAr": "مقارنة البكسل على الإزاحة 445 و527 ثم فحص اللقطات الجديدة",
      "remainingLimitsAr": "التكرار المطابق زال. لقطة 390 ما زال فيها حبر عند الحافة اليمنى، فلا يُعلن اكتمال خلوها من القص.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مثبتة في المراجعة",
      "updatedAt": "2026-09-24T03:18:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0020",
      "parentId": null,
      "titleAr": "وصف مصدر التفاصيل يتغير بعد طلب قائمة آخر",
      "source": "مراجعة تفعيل اختبار اكتشفي",
      "descriptionAr": "حقل lastOrigin على المستودع كان يُستبدل عندما يقرأ مسار التفاصيل المحلية قائمة الشركاء.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "تفاصيل محلية قد تُعرض على أنها من الخادم.",
      "unit": "mira-app",
      "files": [
        "lib/features/marketplace/data/repositories/marketplace_repository_impl.dart",
        "lib/features/marketplace/presentation/widgets/marketplace_data_banner.dart"
      ],
      "previousEvidenceAr": "حزمة تفعيل الاختبار 0319",
      "actionAr": "أصبحت نتيجة كل طلب CatalogLoad تحمل النقل وعلامة المحتوى. مسار التفاصيل المحلية يقرأ الكتالوج مباشرة ولا يستدعي قائمة الشركاء.",
      "newEvidenceIds": [
        "EVD-0037"
      ],
      "verificationAr": "اختبار يثبت أن تفصيلة محلية تبقى محلية بعد نجاح قائمة من الخادم.",
      "remainingLimitsAr": "استجابات الخادم بلا الحقل demoContent تبقى unmarked، وهذا ليس حكمًا بأنها حقيقية.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة",
      "updatedAt": "2026-09-24T05:10:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0021",
      "parentId": null,
      "titleAr": "المحتوى التجريبي كان يُستنتج من أسماء الجهات",
      "source": "مراجعة تفعيل اختبار اكتشفي",
      "descriptionAr": "قائمة أسماء عربية كانت تقرر أن المجموعة تجريبية.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "high",
      "impactAr": "اسم جهة على الخادم قد يُصنف المحتوى تجريبيًا أو العكس.",
      "unit": "mira-app",
      "files": [
        "lib/features/marketplace/data/marketplace_local_catalog.dart",
        "lib/features/marketplace/domain/entities/partner_summary.dart"
      ],
      "previousEvidenceAr": "حزمة تفعيل الاختبار 0319",
      "actionAr": "الكتالوج المحلي يعلن ContentMark.explicitDemo. الخادم لا يُعلَّم تجريبيًا إلا إذا كان demoContent true. حُذف الاعتماد على الأسماء.",
      "newEvidenceIds": [
        "EVD-0037"
      ],
      "verificationAr": "اختبار يعيد اسم لوريال من الخادم بلا العلم فيبقى unmarked، وعلَم true يجعله explicitDemo.",
      "remainingLimitsAr": "بذرة الخادم الحالية بلا الحقل، لذلك تُعرض unmarked لا حقيقية ولا تجريبية.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة",
      "updatedAt": "2026-09-24T05:10:00+03:00",
      "evidenceType": "correction"
    },
    {
      "id": "REV-0022",
      "parentId": null,
      "titleAr": "قص محتوى الموقع على عرض الجوال",
      "source": "مراجعة لقطات الموقع",
      "descriptionAr": "الجداول وحاوية البحث كانت توسع عرض الصفحة، ولقطة 390 وصل حبرها إلى الحافة.",
      "reqIds": [
        "REQ-0024"
      ],
      "severity": "medium",
      "impactAr": "النص والأزرار قد تُقص على الجوال.",
      "unit": "reference-site",
      "files": [
        "css/layout.css",
        "css/components.css",
        "css/responsive.css"
      ],
      "previousEvidenceAr": "لقطات rc1 في حزمة 0319",
      "actionAr": "أُلغي min-width الثابت للبحث وللجداول، وبطاقات المراحل والروابط تلتف. اللقطات الجديدة تُقاس في دليل هذه الجولة.",
      "newEvidenceIds": [
        "EVD-0038"
      ],
      "verificationAr": "لقطات 390 و768 و1280 وقياس الحافة والتكرار.",
      "remainingLimitsAr": "لقطات 390 و768 و1280 صار scrollWidth فيها مساويًا لعرض النافذة، وحبر الحافة اليمنى واليسرى صفر. التكرار على 445 ليس 1.0. هذا لا يعتمد المرحلة.",
      "status": "معالجة بانتظار المراجعة",
      "previousStatus": "مفتوحة",
      "updatedAt": "2026-09-24T05:10:00+03:00",
      "evidenceType": "correction"
    }
  ],
  "scopeCoverage": [
    {
      "id": "SCOPE-ORIG-00",
      "titleAr": "تدقيق مبني على الأدلة بلا إعادة بناء",
      "sectionId": "s3",
      "dataFiles": [
        "capabilities.json"
      ],
      "evidenceIds": [
        "EVD-0011"
      ],
      "status": "partial",
      "remainingAr": "التشغيل الإنتاجي غير مفحوص",
      "whyAr": "صلاحية الدراسة تمنع التنفيذ الحي",
      "approvalEffectAr": "يمنع إغلاق GATE-00"
    },
    {
      "id": "SCOPE-ORIG-01",
      "titleAr": "اسم الموقع المتاجر الإلكترونية في ميرا",
      "sectionId": "s0",
      "dataFiles": [
        "project.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "",
      "whyAr": "",
      "approvalEffectAr": "لا يمنع المراجعة"
    },
    {
      "id": "SCOPE-ORIG-02",
      "titleAr": "أقسام 00 إلى 19 ومعرفات ثابتة",
      "sectionId": "s21",
      "dataFiles": [
        "project.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "",
      "whyAr": "",
      "approvalEffectAr": "لا يمنع المراجعة"
    },
    {
      "id": "SCOPE-ORIG-03",
      "titleAr": "عدم تعديل منتج ميرا",
      "sectionId": "s2",
      "dataFiles": [
        "evidence/git/STATUS.txt"
      ],
      "evidenceIds": [
        "EVD-0022"
      ],
      "status": "complete",
      "remainingAr": "شجرة العمل كانت متسخة قبل الدراسة",
      "whyAr": "لم تُنسب إلى RC2 ولم تُمسح",
      "approvalEffectAr": "لا يمنع المراجعة"
    },
    {
      "id": "SCOPE-ORIG-04",
      "titleAr": "رؤية 50 منتجًا ومحتوى مرتبط بلا نسخ إعلان",
      "sectionId": "s1",
      "dataFiles": [
        "contracts.json"
      ],
      "evidenceIds": [],
      "status": "partial",
      "remainingAr": "العقود مقترحة غير منفذة",
      "whyAr": "هذه دراسة",
      "approvalEffectAr": "يمنع بدء البناء قبل القرار"
    },
    {
      "id": "SCOPE-RC2-00",
      "titleAr": "عدم إغلاق GATE-00",
      "sectionId": "s0",
      "dataFiles": [
        "project.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "",
      "whyAr": "",
      "approvalEffectAr": "الحالة بانتظار إعادة المراجعة"
    },
    {
      "id": "SCOPE-RC2-01",
      "titleAr": "كل نتيجة داخل الموقع",
      "sectionId": "s20",
      "dataFiles": [
        "section-content.json"
      ],
      "evidenceIds": [],
      "status": "partial",
      "remainingAr": "يكتمل بحزمة المتصفح",
      "whyAr": "اللقطات بند REV-0007c",
      "approvalEffectAr": "يبقي الملاحظة مفتوحة إن غابت اللقطات"
    },
    {
      "id": "SCOPE-RC2-04",
      "titleAr": "سجل REV-0001 إلى REV-0007",
      "sectionId": "s20",
      "dataFiles": [
        "review-findings.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "بعض البنود الفرعية قيد المعالجة",
      "whyAr": "لا إخفاء للنقص",
      "approvalEffectAr": "الملاحظة المفتوحة تمنع ادعاء الاكتمال"
    },
    {
      "id": "SCOPE-RC2-05",
      "titleAr": "تدقيق تنفيذ الشركاء والإدارة",
      "sectionId": "s6",
      "dataFiles": [
        "partner-traces.json"
      ],
      "evidenceIds": [
        "EVD-0011",
        "EVD-0013",
        "EVD-0026"
      ],
      "status": "partial",
      "remainingAr": "عزل الكتابة مثبت في المصدر واختبار mock فقط",
      "whyAr": "لا قاعدة حية",
      "approvalEffectAr": "SOURCE_ONLY"
    },
    {
      "id": "SCOPE-RC2-06",
      "titleAr": "تصحيح الوجود والغياب والتوقف",
      "sectionId": "s4",
      "dataFiles": [
        "judgment-corrections.json"
      ],
      "evidenceIds": [
        "EVD-0018"
      ],
      "status": "complete",
      "remainingAr": "API الإنتاج UNKNOWN",
      "whyAr": "لم يُنفذ طلب شبكة",
      "approvalEffectAr": "UNKNOWN لا يُغلق كحقيقة"
    },
    {
      "id": "SCOPE-RC2-07",
      "titleAr": "عقود الفلاتر والمثال المرجعي",
      "sectionId": "s8",
      "dataFiles": [
        "contracts.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "غير منفذ في المنتج",
      "whyAr": "مقترح دراسة",
      "approvalEffectAr": "لا يُحتسب ميزة مبنية"
    },
    {
      "id": "SCOPE-RC2-08",
      "titleAr": "وسائط وتكلفة وتنظيم",
      "sectionId": "s9",
      "dataFiles": [
        "regulatory.json"
      ],
      "evidenceIds": [
        "EVD-0024"
      ],
      "status": "partial",
      "remainingAr": "الأسعار غير متحققة",
      "whyAr": "لا سعر رسمي مجلوب لهذه الدورة",
      "approvalEffectAr": "لا اعتماد تكلفة"
    },
    {
      "id": "SCOPE-RC2-09",
      "titleAr": "قبول ومراحل",
      "sectionId": "s15",
      "dataFiles": [
        "roadmap.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "الجهد نطاق تقديري",
      "whyAr": "افتراضات مكتوبة في البوابة",
      "approvalEffectAr": "لا يمنع المراجعة"
    },
    {
      "id": "SCOPE-RC2-10",
      "titleAr": "JSON مصدر الحقيقة",
      "sectionId": "s19",
      "dataFiles": [
        "section-content.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "",
      "whyAr": "",
      "approvalEffectAr": "يُراجع مع REV-0007a"
    },
    {
      "id": "SCOPE-RC2-11",
      "titleAr": "تحقق سلبي وإيجابي",
      "sectionId": "s19",
      "dataFiles": [
        "evidence/tests"
      ],
      "evidenceIds": [
        "EVD-0027"
      ],
      "status": "complete",
      "remainingAr": "التحقق بنيوي ولا يغني عن المراجعة الموضوعية",
      "whyAr": "التجارب السلبية مثبتة في السجل",
      "approvalEffectAr": "فشل الأداة يبقي REV-0006 مفتوحة"
    },
    {
      "id": "SCOPE-RC2-12",
      "titleAr": "اختبار متصفح",
      "sectionId": "s21",
      "dataFiles": [
        "evidence/screenshots"
      ],
      "evidenceIds": [],
      "status": "partial",
      "remainingAr": "لقطة سطح المكتب 1280 فقط. لقطات 768 و390 خرجت فارغة وحُذفت.",
      "whyAr": "Chrome headless لم يرسم التابلت والجوال. التفاعل ثبت في متصفح بعرض 293.",
      "approvalEffectAr": "لا يُسمى نجاحًا تفاعليًا قبل اللقطات"
    },
    {
      "id": "SCOPE-RC2-13",
      "titleAr": "مصفوفة التغطية",
      "sectionId": "s21",
      "dataFiles": [
        "scope-coverage.json"
      ],
      "evidenceIds": [],
      "status": "complete",
      "remainingAr": "",
      "whyAr": "",
      "approvalEffectAr": "المراجع ينتقل من البند إلى الدليل"
    },
    {
      "id": "SCOPE-RC2-14",
      "titleAr": "حزمة RC2 وSHA",
      "sectionId": "s18",
      "dataFiles": [
        "changelog.json"
      ],
      "evidenceIds": [],
      "status": "partial",
      "remainingAr": "تُختم بعد الاختبار",
      "whyAr": "النسخ يتم في نهاية الجولة",
      "approvalEffectAr": "الحزمة السابقة لا تُستبدل بصمت"
    },
    {
      "id": "SCOPE-PLC-01",
      "titleAr": "ملخص قرار الاستفادة",
      "sectionId": "s22",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-02",
      "titleAr": "ما وصل من الأماكن",
      "sectionId": "s23",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0028"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-03",
      "titleAr": "نتائج مراجعة الحزمة",
      "sectionId": "s24",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0028"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-04",
      "titleAr": "سجل معالجة الملاحظات",
      "sectionId": "s25",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-05",
      "titleAr": "مصفوفة إعادة الاستخدام",
      "sectionId": "s26",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-06",
      "titleAr": "تجربة المنتجات",
      "sectionId": "s27",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-07",
      "titleAr": "تجربة العيادات والمشاغل",
      "sectionId": "s28",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-08",
      "titleAr": "معيار الوسائط",
      "sectionId": "s29",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-09",
      "titleAr": "المشاهدات والإحصاءات",
      "sectionId": "s30",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-10",
      "titleAr": "ربط المتاجر وإعلانات المشاهير",
      "sectionId": "s31",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-11",
      "titleAr": "خطة التنفيذ المرحلية",
      "sectionId": "s32",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-12",
      "titleAr": "القرارات المفتوحة",
      "sectionId": "s33",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-13",
      "titleAr": "الأدلة والتنزيلات",
      "sectionId": "s34",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0028"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-PLC-14",
      "titleAr": "سجل تغييرات خطة الأماكن",
      "sectionId": "s35",
      "dataFiles": [
        "places-adoption.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "بانتظار مراجعة بشرية. ليس اعتمادًا نهائيًا.",
      "whyAr": "التوثيق أُضيف إلى الموقع الحالي دون تنفيذ المنتج.",
      "approvalEffectAr": "لا يغلق GATE-00 ولا يبدأ GATE-08 أو GATE-09"
    },
    {
      "id": "SCOPE-RC3-01",
      "titleAr": "فحص الحزمة مستقل عن المستودع",
      "sectionId": "s19",
      "dataFiles": [
        "project.json"
      ],
      "evidenceIds": [
        "EVD-0030"
      ],
      "status": "partial",
      "remainingAr": "الحداثة فحص منفصل",
      "whyAr": "FAIL 18 كانت بسبب ملفات المستودع",
      "approvalEffectAr": "لا يغلق GATE-00"
    },
    {
      "id": "SCOPE-RC3-02",
      "titleAr": "التصورات المرجعية",
      "sectionId": "s36",
      "dataFiles": [
        "visual-references.json"
      ],
      "evidenceIds": [
        "EVD-0029"
      ],
      "status": "partial",
      "remainingAr": "الملفات مرفقة وحالتها available. هذا لا يعتمد المرحلة.",
      "whyAr": "كانت NEEDS_ASSET قبل إرفاق المراجع في 2026-09-26",
      "approvalEffectAr": "لا يُدعى اكتمال الصور"
    },
    {
      "id": "SCOPE-RC3-03",
      "titleAr": "تصحيح توثيق المصدر دون تعديل أرشيفه",
      "sectionId": "s37",
      "dataFiles": [
        "source-handoff-corrections.json"
      ],
      "evidenceIds": [
        "EVD-0030",
        "EVD-0031",
        "EVD-0032"
      ],
      "status": "partial",
      "remainingAr": "الأرشيف الأصلي يبقى بنصه",
      "whyAr": "المراجعة منعت إعادة التغليف",
      "approvalEffectAr": "لا يغيّر SHA-256 لأرشيف 0125"
    },
    {
      "id": "SCOPE-RC1-01",
      "titleAr": "تفعيل اختبار اكتشفي وخطة الدمج",
      "sectionId": "s38",
      "dataFiles": [
        "discover-integration-plan.json"
      ],
      "evidenceIds": [
        "EVD-0034"
      ],
      "status": "partial",
      "remainingAr": "إثبات الجهاز ولقطات الموقع البديلة يُستكملان في التقرير",
      "whyAr": "التفعيل بالعلم وخطة منع التكرار أُضيفا دون دمج الأماكن",
      "approvalEffectAr": "لا يغلق GATE-00 ولا ينشر الميزة"
    },
    {
      "id": "SCOPE-PH1-01",
      "titleAr": "تسجيل مراحل اكتشفي وتنفيذ شاشة العرض",
      "sectionId": "s39",
      "dataFiles": [
        "discover-phases.json"
      ],
      "evidenceIds": [
        "EVD-0036",
        "EVD-0038",
        "EVD-0039"
      ],
      "status": "partial",
      "remainingAr": "المرحلة 1 قيد التنفيذ لنقص إثبات الفيديو على جهاز. المراحل 2 إلى 5 لم تبدأ.",
      "whyAr": "التسجيل شرط التسليم، والتنفيذ اقتصر على المرحلة الأولى دون اعتمادها",
      "approvalEffectAr": "لا يعتمد المرحلة 1 ولا يغلق GATE-00"
    }
  ],
  "judgmentCorrections": [
    {
      "id": "JDG-0001",
      "subject": "CAP-0007",
      "beforeAr": "موجودة ومفعلة ودليلها SPEC",
      "afterAr": "موجودة في المصدر، التفعيل الإنتاجي UNKNOWN، والأدلة تنفيذية",
      "reasonAr": "REV-0001: المواصفات ليست تنفيذًا",
      "evidenceIds": [
        "EVD-0007",
        "EVD-0011",
        "EVD-0012"
      ]
    },
    {
      "id": "JDG-0002",
      "subject": "CAP-0008",
      "beforeAr": "موجودة ومفعلة بلا دليل",
      "afterAr": "موجودة في المصدر، التفعيل UNKNOWN، مع أدلة المتحكم والعميل",
      "reasonAr": "REV-0001 وREV-0002",
      "evidenceIds": [
        "EVD-0014",
        "EVD-0015"
      ]
    },
    {
      "id": "JDG-0003",
      "subject": "CAP-0010 CAP-0011 CAP-0012 CAP-0014",
      "beforeAr": "غياب أو وجود بلا أدلة مرتبطة أو بمقتطف مخطط فقط",
      "afterAr": "غياب داخل نطاق بحث موثّق، أو وجود علم اشتراك في المصدر",
      "reasonAr": "REV-0002",
      "evidenceIds": [
        "EVD-0018",
        "EVD-0019",
        "EVD-0020",
        "EVD-0023"
      ]
    },
    {
      "id": "JDG-0004",
      "subject": "CAP-0001 CAP-0002 CAP-0003 CAP-0009",
      "beforeAr": "التفعيل ENABLED مع SOURCE_ONLY",
      "afterAr": "التفعيل UNKNOWN لأن الشيفرة لا تثبت الإنتاج",
      "reasonAr": "قاعدة RC2: لا ENABLED بلا دليل تشغيل",
      "evidenceIds": [
        "EVD-0001",
        "EVD-0006",
        "EVD-0008"
      ]
    },
    {
      "id": "JDG-0005",
      "subject": "PAUSE-0001",
      "beforeAr": "الإيقاف موثق بعبارة الانطلاق قريبًا وAPI قابل للوصول",
      "afterAr": "إخفاء واجهة موثق. وصول API وبوابة الخادم UNKNOWN. السبب التاريخي غير موثق.",
      "reasonAr": "REV-0003",
      "evidenceIds": [
        "EVD-0001",
        "EVD-0002",
        "EVD-0006"
      ]
    },
    {
      "id": "JDG-0006",
      "subject": "PAUSE-0002",
      "beforeAr": "حجز متوقف",
      "afterAr": "مسار غير مكتمل وليس خدمة تُستأنف",
      "reasonAr": "REV-0003",
      "evidenceIds": [
        "EVD-0003",
        "EVD-0018"
      ]
    },
    {
      "id": "JDG-0007",
      "subject": "PAUSE-0003",
      "beforeAr": "شراء داخلي متوقف",
      "afterAr": "غير منفذ حسب التصميم الحالي",
      "reasonAr": "REV-0003",
      "evidenceIds": [
        "EVD-0004",
        "EVD-0007",
        "EVD-0018"
      ]
    }
  ],
  "contracts": {
    "unimplemented": true,
    "labelAr": "مقترح غير منفذ",
    "entities": [
      {
        "name": "Product",
        "existsAr": "جدول Product: اسم وسعر وهلالة ورابط خارجي ووسوم",
        "extendAr": "الإبقاء على المعرف وإضافة حالة النشر دون جدول موازٍ",
        "fields": [
          {
            "name": "id",
            "type": "string",
            "required": true,
            "source": "الخادم"
          },
          {
            "name": "partnerId",
            "type": "string",
            "required": true,
            "source": "من الرمز لا من العميل"
          },
          {
            "name": "status",
            "type": "enum draft|active|paused|archived",
            "required": true,
            "source": "الشريك والإدارة"
          }
        ]
      },
      {
        "name": "ProductVariant",
        "existsAr": "غير موجود في المخطط المبحوث",
        "extendAr": "متغير جديد يرتبط بمنتج واحد",
        "fields": [
          {
            "name": "id",
            "type": "string",
            "required": true,
            "source": "الخادم"
          },
          {
            "name": "productId",
            "type": "string",
            "required": true,
            "source": "المسار"
          },
          {
            "name": "color",
            "type": "enum",
            "required": true,
            "source": "قاموس يديره المتجر"
          },
          {
            "name": "size",
            "type": "enum",
            "required": true,
            "source": "قاموس المقاسات"
          },
          {
            "name": "stockQty",
            "type": "int>=0",
            "required": true,
            "source": "الشريك"
          },
          {
            "name": "priceHalalas",
            "type": "int>=0",
            "required": true,
            "source": "الشريك"
          },
          {
            "name": "active",
            "type": "bool",
            "required": true,
            "source": "الشريك"
          }
        ]
      },
      {
        "name": "ServiceOffering",
        "existsAr": "جدول Service بلا فرع",
        "extendAr": "ربط branchId عند تعدد الفروع",
        "fields": [
          {
            "name": "facilityId",
            "type": "string",
            "required": true,
            "source": "شريك من نوع عيادة أو صالون"
          },
          {
            "name": "branchId",
            "type": "string",
            "required": true,
            "source": "سجل الفرع"
          },
          {
            "name": "bookingMode",
            "type": "enum inquiry|appointment|external",
            "required": true,
            "source": "قرار المتجر"
          }
        ]
      },
      {
        "name": "MediaAsset",
        "existsAr": "لا نموذج في البحث EVD-0019",
        "extendAr": "أصل يرتبط بمنتج أو متغير أو خدمة دون نسخ السعر",
        "fields": [
          {
            "name": "ownerType",
            "type": "enum product|variant|service",
            "required": true,
            "source": "عند الرفع"
          },
          {
            "name": "ownerId",
            "type": "string",
            "required": true,
            "source": "الرابط"
          },
          {
            "name": "state",
            "type": "enum uploaded|processing|in_review|published|failed|removed",
            "required": true,
            "source": "دورة المعالجة"
          }
        ]
      },
      {
        "name": "AdLink",
        "existsAr": "لا نموذج مشاهير",
        "extendAr": "رابط إعلان يقرأ السعر والمخزون من المتغير",
        "fields": [
          {
            "name": "publisherId",
            "type": "string",
            "required": true,
            "source": "حساب الناشر"
          },
          {
            "name": "advertiserId",
            "type": "string",
            "required": true,
            "source": "المعلن"
          },
          {
            "name": "sellerPartnerId",
            "type": "string",
            "required": true,
            "source": "الشريك المالك"
          },
          {
            "name": "variantId",
            "type": "string",
            "required": true,
            "source": "المنتج الأصلي"
          },
          {
            "name": "storeApproval",
            "type": "enum pending|approved|rejected|expired",
            "required": true,
            "source": "المتجر"
          }
        ]
      }
    ],
    "example": {
      "titleAr": "فستان أزرق مقاس M متوفر",
      "variants": [
        {
          "id": "V1",
          "color": "blue",
          "size": "M",
          "stockQty": 5,
          "match": true
        },
        {
          "id": "V2",
          "color": "blue",
          "size": "S",
          "stockQty": 0,
          "match": false
        },
        {
          "id": "V3",
          "color": "red",
          "size": "M",
          "stockQty": 3,
          "match": false
        }
      ],
      "ruleAr": "AND على متغير واحد: اللون والمقاس والتوفر من الصف نفسه.",
      "productCount": 1,
      "clipCountAr": "مقطعان منشوران مرتبطان بالمنتج أو بـ V1 يُحسبان محتوىً مرئيًا. مقطع مرتبط بـ V3 فقط لا يظهر. عدد المنتجات 1 وعدد المقاطع قد يكون 2."
    }
  },
  "regulatory": {
    "legalApproval": false,
    "accessDate": "2026-09-23",
    "sources": [
      {
        "id": "REG-0001",
        "topicAr": "متاجر الملابس والمنتجات غير الطبية",
        "sourceAr": "نظام التجارة الإلكترونية — هيئة الخبراء / وزارة التجارة",
        "url": "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/360de590-0286-4fa5-a243-aa9100c31979/1",
        "alsoUrl": "https://mc.gov.sa/ar/ECC/pages/default.aspx",
        "appliesAr": "التعاملات الإلكترونية لبيع المنتجات والإعلان عنها داخل النطاق الذي يحدده النظام.",
        "designImpactAr": "تعريف البائع وبيانات العرض ومسار الشراء يجب أن يبقى قابلًا للتمييز. هذه الدراسة لا تستخرج التزامًا تنفيذيًا مادةً مادة.",
        "specialistQuestionsAr": [
          "هل منصة الوساطة تأخذ وصف موفر خدمة أم معلن؟",
          "ما بيانات المتجر الواجب إظهارها في بطاقة المنتج؟"
        ]
      },
      {
        "id": "REG-0002",
        "topicAr": "إعلانات المشاهير على الشبكات",
        "sourceAr": "ترخيص موثوق — الهيئة العامة لتنظيم الإعلام",
        "url": "https://mawthooq.gmedia.gov.sa/",
        "alsoUrl": "https://my.gov.sa/ar/services/21449",
        "appliesAr": "تقديم الأفراد محتوى إعلانيًا عبر منصات التواصل. لا يُنقل تلقائيًا إلى كل مقطع داخل تطبيق ميرا.",
        "designImpactAr": "فصل المعلن والناشر ووسم المحتوى الإعلاني قبل النشر. الترخيص نفسه سؤال لمختص لا حقل نفترضه كافيًا.",
        "specialistQuestionsAr": [
          "هل مقطع داخل التطبيق يُعد منصة تواصل بالمعنى التنظيمي؟",
          "ما إثبات الترخيص الذي نطلبه من الناشر؟"
        ]
      },
      {
        "id": "REG-0003",
        "topicAr": "المنتجات التجميلية",
        "sourceAr": "إدراج منتجات التجميل — هيئة الغذاء والدواء",
        "url": "https://www.sfda.gov.sa/ar/eservices/88819",
        "alsoUrl": "https://www.sfda.gov.sa/ar/taxonomy/term/47",
        "appliesAr": "إدراج مستحضر تجميلي قبل تداوله. الإعلان عن ادعاء علاجي خارج نطاق هذه الصفحة حتى يراجعه مختص.",
        "designImpactAr": "عدم تحويل وسوم البشرة التسويقية إلى ادعاء طبي. ربط المنتج بسجل إدراج إن قرر المختص ذلك.",
        "specialistQuestionsAr": [
          "أي ادعاءات تجميل ممنوعة في بطاقة المنتج؟",
          "هل يكفي رقم الإدراج في البيانات؟"
        ]
      },
      {
        "id": "REG-0004",
        "topicAr": "الخدمات الطبية والإعلان عنها",
        "sourceAr": "ضوابط المحتوى الإعلاني للمنشآت الصحية — وزارة الصحة",
        "url": "https://www.moh.gov.sa/eServices/Licences/Documents/10.pdf",
        "alsoUrl": "https://www.moh.gov.sa/eservices/licences/pages/private-health-institutions-law-and-regulations.aspx",
        "appliesAr": "المحتوى الإعلاني للخدمات الصحية المرخصة، بما فيه وضوح أنه إعلان وبيانات المنشأة والتحذيرات.",
        "designImpactAr": "عيادة ميرا لا تُعرض كصالون. مسار الحجز الطبي منفصل عن شراء الملابس.",
        "specialistQuestionsAr": [
          "هل الخصم على خدمة طبية يحتاج موافقة ترخيص قبل عرضه؟",
          "ما الحقول الإلزامية في بطاقة العيادة؟"
        ]
      },
      {
        "id": "REG-0005",
        "topicAr": "صالونات التزيين",
        "sourceAr": "اشتراطات التزيين النسائي — وزارة البلديات والإسكان",
        "url": "https://momah.gov.sa/ar/node/14893",
        "alsoUrl": "https://momah.gov.sa/sites/default/files/2024-12/alqwa%60d%20altnfy.pdf",
        "appliesAr": "ترخيص نشاط التزيين ومنع خدمات منزلية أو منتجات دوائية داخل مركز غير مرخص لذلك.",
        "designImpactAr": "نوع الشريك salon لا يرث حقول العيادة. الخدمة خارج المنشأة ليست افتراضًا.",
        "specialistQuestionsAr": [
          "ما رقم الترخيص البلدي الذي يُخزن؟",
          "أين حد الخدمة الطبية داخل الصالون؟"
        ]
      },
      {
        "id": "REG-0006",
        "topicAr": "بيانات التحليل الشخصي",
        "sourceAr": "نظام حماية البيانات الشخصية — سدايا",
        "url": "https://sdaia.gov.sa/ar/Research/Pages/DataProtection.aspx",
        "alsoUrl": "https://sdaia.gov.sa/ar/Research/Documents/ExecutiveRegulations.pdf",
        "appliesAr": "معالجة بيانات شخصية. نتائج البشرة قد تكون حساسة حسب توصيف المختص لا حسب تسمية التسويق.",
        "designImpactAr": "REQ-0017 يفصل الإعلان عن نتيجة التحليل. لا استخدام للنتيجة كجمهور إعلاني قبل رأي مختص.",
        "specialistQuestionsAr": [
          "هل نتيجة البشرة بيانات حساسة في هذا المنتج؟",
          "ما أساس معالجة المطابقة؟"
        ]
      }
    ]
  },
  "costs": {
    "priceStatus": "غير متحقق",
    "accessDate": "2026-09-23",
    "assumptions": {
      "stores": 20,
      "productsPerStore": 50,
      "imagesPerProduct": 4,
      "avgImageMb": 1.5,
      "videosPerProduct": 1,
      "videoSeconds": 30,
      "mbPerVideoMinute": "غير متحقق",
      "watchMinutesPerMonth": 10000
    },
    "equationsAr": [
      "عدد المنتجات = المتاجر × منتجات المتجر",
      "تخزين الصور بالميغابايت = عدد المنتجات × صور المنتج × متوسط حجم الصورة",
      "تخزين الفيديو لا يُحسب برقم حتى يُثبت mb لكل دقيقة من مصدر السعر",
      "تكلفة المعالجة والبث = غير متحقق لهذه الدورة"
    ],
    "scenariosAr": [
      "سيناريو الدراسة: 20 متجرًا و50 منتجًا. تخزين الصور الافتراضي 20×50×4×1.5 = 6000 ميغابايت. هذا حجم افتراضي لا فاتورة.",
      "دقائق المشاهدة 10000 رقم افتراضي للسيناريو وليس قياس إنتاج."
    ]
  },
  "mediaLifecycle": {
    "unimplemented": true,
    "inspectedExistingAr": "لا video_player ولا VideoPlayer في lib وmira-api/src حسب EVD-0024. لا يُقترح مزود كبديل عن مشغل قائم لأنه غير موجود في هذا النطاق.",
    "steps": [
      "رفع",
      "تحقق من النوع والحجم",
      "معالجة",
      "مراجعة",
      "نشر",
      "تشغيل",
      "إيقاف أو حذف"
    ],
    "playbackAr": [
      "تشغيل متكيف إن وُجد أكثر من تمثيل بعد المعالجة",
      "حد لذاكرة الجهاز وإلغاء التحميل المسبق عند انخفاض الذاكرة",
      "مقطع مسموع واحد",
      "حفظ نسبة العرض دون قص جوهري",
      "حفظ موضع المشاهدة لكل أصل",
      "فشل الشبكة يعيد المحاولة دون نشر مكرر"
    ],
    "vendorAr": "لا اختيار مزود في RC2. أي سعر لاحق يُؤرخ بمصدره أو يُوسم غير متحقق."
  },
  "partnerTraces": [
    {
      "id": "TR-01",
      "titleAr": "طلب الانضمام",
      "chain": [
        "apply.html",
        "PartnersApi.apply",
        "POST /partners-portal/apply",
        "PartnersPortalController.apply",
        "PartnersPortalService.apply",
        "PartnerApplication",
        "status token"
      ],
      "verified": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0011",
        "EVD-0016"
      ]
    },
    {
      "id": "TR-02",
      "titleAr": "متابعة الحالة",
      "chain": [
        "status.html",
        "GET apply/status/:token",
        "getApplicationStatus"
      ],
      "verified": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0011"
      ]
    },
    {
      "id": "TR-03",
      "titleAr": "الدخول والخروج",
      "chain": [
        "login.html",
        "POST /partners-portal/login",
        "email+accessToken",
        "PartnerUser",
        "localStorage",
        "clearSession"
      ],
      "verified": "SOURCE_ONLY",
      "noteAr": "لا كلمة مرور منفصلة في هذا المسار. partnerId من السجل.",
      "evidenceIds": [
        "EVD-0021",
        "EVD-0016"
      ]
    },
    {
      "id": "TR-04",
      "titleAr": "عزل المنتجات",
      "chain": [
        "Bearer",
        "PartnerTokenGuard",
        "partnerId من السجل",
        "assertProductOwner where id+partnerId",
        "رفض إن لم يُوجد"
      ],
      "verified": "SOURCE_PLUS_UNIT_MOCK",
      "noteAr": "الاختبار EVD-0026 على mock. لا يثبت قاعدة حية. القراءة العامة عبر marketplace ليست لوحة الشريك.",
      "evidenceIds": [
        "EVD-0012",
        "EVD-0013",
        "EVD-0026"
      ]
    },
    {
      "id": "TR-05",
      "titleAr": "الإدارة مقابل الشريك",
      "chain": [
        "الشريك: رمز شريك واحد",
        "الإدارة: X-Admin-Key على كل مسارات /admin",
        "اعتماد ورفض وإيقاف status"
      ],
      "verified": "SOURCE_ONLY",
      "noteAr": "لا أدوار موظفين. البحث عن Employee وBranch بلا تطابق EVD-0019.",
      "evidenceIds": [
        "EVD-0014",
        "EVD-0025",
        "EVD-0019"
      ]
    },
    {
      "id": "TR-06",
      "titleAr": "سعر ووسائط وتوفر",
      "chain": [
        "UpsertProductDto priceHalalas+externalUrl+active",
        "لا حقل مخزون",
        "لا رفع وسيط"
      ],
      "verified": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0017"
      ]
    },
    {
      "id": "TR-07",
      "titleAr": "حجوزات",
      "chain": [
        "bookingEnabled اختياري في عقد الخدمة",
        "لا model Booking في البحث",
        "زر التطبيق stub"
      ],
      "verified": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0017",
        "EVD-0003",
        "EVD-0018"
      ]
    },
    {
      "id": "TR-08",
      "titleAr": "تحليلات",
      "chain": [
        "POST /track بلا حارس",
        "partnerId من الجسم",
        "لوحة الشريك تعد أحداث 30 يومًا"
      ],
      "verified": "SOURCE_ONLY",
      "noteAr": "هذه فجوة مسجلة لا تُصلح في هذه المرحلة.",
      "evidenceIds": [
        "EVD-0013"
      ]
    },
    {
      "id": "TR-09",
      "titleAr": "إيقاف إداري",
      "chain": [
        "PATCH /admin/partners/:id/status",
        "active|suspended",
        "الحارس يرفض شريكًا غير active"
      ],
      "verified": "SOURCE_ONLY",
      "evidenceIds": [
        "EVD-0014",
        "EVD-0012"
      ]
    }
  ],
  "sectionContent": {
    "s0": [
      {
        "type": "callout",
        "text": "RC3 — تصحيح الموقع بعد المراجعة. الحالة: بانتظار إعادة المراجعة. GATE-00 غير مغلق. أرشيف مصدر الأماكن 0125 لم يُعد تغليفه."
      },
      {
        "type": "h3",
        "text": "إجابات المراجعة"
      },
      {
        "type": "list",
        "items": [
          "ماذا كان ناقصًا في النسخة السابقة؟ أدلة تنفيذ الشركاء والإدارة، وسجل بحث قابل للمراجعة، وفصل طبقات الإيقاف، ومعايير قبول، وخطة تغطي المتطلبات، وعقود فلاتر، ومصادر تنظيمية، ومدقق يرفض البيانات الفاسدة، وعرض موضوعي خارج app.js.",
          "ما الذي تحققنا منه الآن؟ مسارات المصدر من الصفحة إلى القاعدة لعزل الكتابة، وفرق مفتاح الإدارة عن رمز الشريك، وغياب نماذج الطلب والمتغير والمشاهير داخل نطاق الأوامر المرفقة. التشغيل الإنتاجي لم يُفحص.",
          "ما الأحكام التي صححناها؟ انظر جدول الأحكام التي تغيرت بعد المراجعة في القسم 4. التفعيل لم يعد ENABLED مع SOURCE_ONLY. الشراء الداخلي لم يعد خدمة متوقفة.",
          "ما الذي نملكه ويمكن إعادة استخدامه؟ جداول Partner وProduct وService، وحارس الرمز، وعزل assertProductOwner، واعتماد الطلبات، وعميل البوابة ولوحة الإدارة، والرابط الخارجي للشراء.",
          "ما الذي يحتاج تطويرًا؟ المتغيرات، الفروع، دورة الوسائط، الفلاتر على متغير واحد، إعلان بلا نسخ سعر، سد تتبع partnerId القادم من العميل، ومسارات الطلب والحجز إن قُرر ذلك.",
          "ما القرارات المطلوبة؟ DEC-0001 مكان الدفع، DEC-0002 البث الحي، DEC-0003 اعتماد المتجر، DEC-0004 منع نسخ الإعلان، DEC-0005 اعتماد الدراسة. لا قرار يُغلق هنا.",
          "ما مراحل التنفيذ وشروط قبولها؟ GATE-01 إلى GATE-05 في القسم 15. GATE-00 دراسة فقط وما زال قيد المعالجة. REQ-0020 قرار نطاق مرتبط بـ DEC-0002.",
          "ما الذي ما زال غير معروف ولماذا؟ قيمة الأعلام في البناء المنشور، وصول API رغم إخفاء الواجهة، ضبط مفتاح الإدارة، سلوك قاعدة الإنتاج، وأسعار مزود الوسائط. السبب: صلاحية هذه المرحلة تمنع التشغيل الحي ولم تُجلب تسعيرة موثوقة."
        ]
      }
    ],
    "s1": [
      {
        "type": "p",
        "text": "الرؤية الأصلية ثابتة: متجر بنحو 50 منتجًا، لكل منتج عرض مرئي مستقل، وإعلان المشهور يشير إلى المنتج دون نسخ السعر أو المخزون."
      },
      {
        "type": "p",
        "text": "البث الحي ليس جزءًا من الرؤية المنفذة. هو {{DEC-0002}}."
      },
      {
        "type": "proposal",
        "text": "العقود في القسم 8 مقترحة وغير منفذة."
      }
    ],
    "s2": [
      {
        "type": "p",
        "text": "خط الأساس السابق والحالي: {{EVD-0022}}. commit المفحوص 15fe65c40d3dedb9afdd95619f2945bd84cb616a. وقت الفحص 2026-09-23T03:43:29+03:00."
      },
      {
        "type": "p",
        "text": "شجرة العمل متسخة بملفات خارج هذه الدراسة. لم تُمسح ولم تُنسب إلى RC2. الفرق عن الأساس السابق: نفس commit، مع حزمة دراسة RC2 غير مدمجة في المنتج."
      },
      {
        "type": "list",
        "items": [
          "المستودع: /Users/fayez/Desktop/mira",
          "الفرع: mira/p5-strict-frontend-recovery-2026-09-14",
          "ما لم يُفحص: بناء المتجر المنشور وقيمة dart-define على الجهاز"
        ]
      }
    ],
    "s3": [
      {
        "type": "p",
        "text": "القدرات التالية من البيانات. التفعيل ENABLED غير مستخدم مع SOURCE_ONLY في هذه النسخة."
      },
      {
        "type": "callout",
        "text": "الغياب ABSENT_AFTER_SEARCH يعني نطاق البحث في الدليل، لا نفيًا لكل منظومة خارج المستودع."
      }
    ],
    "s4": [
      {
        "type": "p",
        "text": "كل خدمة مفصولة إلى إخفاء واجهة، ومنع تنقل، وبوابة خادم، ووصول API، واكتمال منطق، واعتماد خارجي."
      },
      {
        "type": "callout",
        "text": "إن كان الحقل UNKNOWN فلا يُستنتج منه إيقاف ولا تشغيل."
      },
      {
        "type": "h3",
        "text": "الأحكام التي تغيرت بعد المراجعة"
      }
    ],
    "s5": [
      {
        "type": "p",
        "text": "الشراء الحالي يفتح رابطًا خارجيًا {{EVD-0004}}. الحجز زر غير مكتمل {{EVD-0003}}. الاستفسار والاتصال ليسا مسارين منفصلين في المصدر المفحوص."
      },
      {
        "type": "proposal",
        "text": "الفصل المطلوب في {{REQ-0019}} غير منفذ."
      }
    ],
    "s6": [
      {
        "type": "p",
        "text": "التتبع أدناه من المصدر. يمكن إعادة استخدام العزل في الكتابة. التتبع الذي يأخذ partnerId من العميل يحتاج توسيع حماية لاحقًا ولا يُصلح هنا."
      },
      {
        "type": "callout",
        "text": "لم يُثبت تشغيل إنتاجي. الوسم SOURCE_ONLY مقصود."
      },
      {
        "type": "h3",
        "text": "ما لم يُتحقق منه"
      },
      {
        "type": "list",
        "items": [
          "عزل القراءة على قاعدة حية",
          "جلسات إنتاج",
          "وجود فروع أو موظفين خارج أسماء البحث",
          "نشر partners.mira.app وadmin.mira.app في هذه الجولة"
        ]
      }
    ],
    "s7": [
      {
        "type": "p",
        "text": "لا نموذج ناشر أو معلن في النطاق {{EVD-0023}}. الموافقة والربط مقترحان في عقد AdLink."
      },
      {
        "type": "proposal",
        "text": "الإعلان يقرأ السعر من المتغير. انتهاء الربط يخفي الإعلان ولا يحذف المنتج. الطلب القديم يحتفظ بلقطته حسب {{REQ-0011}} غير المنفذ."
      }
    ],
    "s8": [
      {
        "type": "proposal",
        "text": "التصنيفات التالية مقترحة للدراسة. القيم تُدار من قاموس المتجر لا من نص حر عندما تكون تعدادًا."
      },
      {
        "type": "p",
        "text": "القاعدة: خصائص الفلتر على متغير واحد تُجمع بـ AND. القيم داخل الخاصية الواحدة متعددة الاختيار تُجمع بـ OR. عدد المنتجات المطابقة ليس عدد المقاطع."
      },
      {
        "type": "h3",
        "text": "مثال قابل للتحقق"
      }
    ],
    "s9": [
      {
        "type": "p",
        "text": "قبل أي مزود جديد: لا مشغل فيديو في lib وmira-api/src حسب {{EVD-0024}}."
      },
      {
        "type": "p",
        "text": "الدورة المقترحة غير منفذة: رفع ثم تحقق ثم معالجة ثم مراجعة ثم نشر ثم تشغيل ثم إيقاف أو حذف."
      },
      {
        "type": "callout",
        "text": "الأسعار: غير متحقق. المعادلات في بيانات التكلفة ظاهرة في هذا القسم."
      }
    ],
    "s10": [
      {
        "type": "p",
        "text": "الطلب والحجز والاستفسار والاتصال مسارات مختلفة في المتطلب، وليست كذلك في التنفيذ المفحوص."
      },
      {
        "type": "p",
        "text": "بعد تغير الكتالوج، الطلب القديم — إن وُجد لاحقًا — يحتفظ بلقطة المتغير. لا جدول طلب اليوم داخل نطاق {{EVD-0018}}."
      }
    ],
    "s11": [
      {
        "type": "p",
        "text": "التحليلات الحالية أحداث شريك لثلاثين يومًا. {{EVD-0013}} يوضح أن trackEvent يقبل partnerId من العميل بلا حارس."
      },
      {
        "type": "callout",
        "text": "هذا عيب منتج مُسجّل. لا يُصلح في GATE-00."
      },
      {
        "type": "list",
        "items": [
          "ما يمكن إعادة استخدامه: عدّ الأحداث للشريك المالك بعد تصحيح المصدر",
          "ما يحتاج تطويرًا: رفض المعرف القادم من الجسم وربطه بالرمز"
        ]
      }
    ],
    "s12": [
      {
        "type": "p",
        "text": "المصادر بتاريخ اطلاع 2026-09-23. ليست اعتمادًا قانونيًا. أثرها على التصميم وأسئلة المختص في الجدول."
      },
      {
        "type": "callout",
        "text": "عبارة تحتاج مراجعة لا تُستخدم هنا بديلًا عن إيراد المصدر."
      }
    ],
    "s13": [
      {
        "type": "p",
        "text": "الموجود القابل لإعادة الاستخدام: كتالوج الشريك، الحارس، اعتماد الطلبات، لوحة المفتاح، الرابط الخارجي."
      },
      {
        "type": "p",
        "text": "التوسعة: متغير، وسيط، فرع، إعلان، فلاتر خادمية. التكامل مع مزود وسائط مؤجل لأن السعر غير متحقق."
      }
    ],
    "s14": [
      {
        "type": "p",
        "text": "لكل متطلب معطى وإجراء ونتيجة وفشل وطريقة اختبار ودليل. المعيار العام السابق أُزيل."
      },
      {
        "type": "p",
        "text": "وجود صف في الجدول لا يعني أن المنتج حقق المعيار. الحالة proposed."
      }
    ],
    "s15": [
      {
        "type": "p",
        "text": "GATE-00 دراسة فقط وقيد المعالجة. بوابات 01 إلى 05 تغطي البيانات والخادم وويب الشركاء والتطبيق والإدارة والتحقق، لا واجهة فيديو وحدها."
      },
      {
        "type": "p",
        "text": "{{REQ-0020}} في قرارات النطاق مرتبط بـ {{DEC-0002}} وليس مرحلة بناء."
      }
    ],
    "s16": [
      {
        "type": "p",
        "text": "لا قرار يُعلَّم معتمدًا من هذه الأداة. {{DEC-0005}} يبقى بانتظار المالك."
      }
    ],
    "s17": [
      {
        "type": "p",
        "text": "كل دليل يذكر ما يثبته وما لا يثبته. روابط المقتطفات نسبية."
      },
      {
        "type": "callout",
        "text": "ملخص CMD-0001 أُبقي كدليل على ضعف النسخة السابقة. السجل الجديد {{EVD-0018}}."
      }
    ],
    "s18": [
      {
        "type": "p",
        "text": "الإصدار السابق 1.0.0-GATE00-study-draft. الإصدار الحالي RC2 — استكمال الدراسة بعد المراجعة."
      },
      {
        "type": "p",
        "text": "الملاحظات السابقة لم تُحذف. حالتها السابقة ظاهرة في سجل REV."
      }
    ],
    "s19": [
      {
        "type": "h3",
        "text": "فحص الحزمة المستقل"
      },
      {
        "type": "p",
        "text": "بعد فك ZIP خارج المشروع: python3 scripts/validate_package.py --root . لا يحتاج مستودع ميرا ولا دار كار. يغطي السجل والبيانات والمراجع والصور والمعرّفات وتطابق JSON مع JavaScript."
      },
      {
        "type": "h3",
        "text": "فحص حداثة الأدلة"
      },
      {
        "type": "p",
        "text": "python3 scripts/verify_evidence_freshness.py --repo /path/to/mira يقارن أدلة fact الثمانية عشر بملفات المستودع. بلا مسار مستودع تكون الحالة BLOCKED ولا تُسمى PASS ولا تُفشل فحص الحزمة."
      },
      {
        "type": "list",
        "items": [
          "EVD-0001 إلى EVD-0026 من نوع fact هي الفحوص التي كانت تفشل خارج المستودع",
          "لا يُحذف دليل لإسكات الفحص",
          "لا تُكتب كلمة PASS ثابتة داخل تقرير الحزمة"
        ]
      },
      {
        "type": "p",
        "text": "لقطات RC3 المقاسة: rc3-mobile-390x844.png وrc3-tablet-768x1024.png وrc3-desktop-1280x900.png. الملف places-plan-desktop-1280.png يبقى 277×445 وليس إثباتًا لعرض 1280."
      }
    ],
    "s20": [
      {
        "type": "p",
        "text": "الملاحظة تبقى ظاهرة بعد معالجتها مع الحالة السابقة والإجراء والدليل والقيود."
      },
      {
        "type": "callout",
        "text": "الحالة معالجة بانتظار المراجعة ليست إغلاقًا. قيد المعالجة يعني أن جزءًا ما زال ناقصًا."
      }
    ],
    "s21": [
      {
        "type": "p",
        "text": "انتقل من بند التكليف إلى القسم ثم الدليل. اكتمال العنوان لا يعني اكتمال المحتوى. الحالة partial تبقى ظاهرة."
      }
    ],
    "s22": [
      {
        "type": "callout",
        "text": "القرار الحالي متطلب معتمد للدراسة عبر {{DEC-0006}}: تكييف المكونات المناسبة داخل ميرا، لا نقل مشروع الأماكن، ولا إعادة بناء كل شيء، مع بقاء دار كار دون تعديل."
      },
      {
        "type": "p",
        "text": "منطق الغرف والليالي لا ينتقل إلى المنتجات أو المواعيد. الدفع الداخلي ما زال {{DEC-0001}}."
      }
    ],
    "s23": [
      {
        "type": "p",
        "text": "وصلت حزمة RC2 بـ 826 ملف مصدر. التفاصيل والبصمة في قسم التنزيلات. الحزمة ليست تطبيق Flutter قابلًا للبناء. اختبارات RC1 لا تثبت تشغيل المنتج."
      }
    ],
    "s24": [
      {
        "type": "p",
        "text": "مراجعة RC1: 697 ملفًا مسجلًا و723 تطابق بصمة، ونسخة 2.zip فيها تغليف macOS زائد. RC2 أعاد الحساب ولم ينسخ الأرقام كأنها نتيجة جديدة."
      }
    ],
    "s25": [
      {
        "type": "p",
        "text": "ملاحظات الحزمة: {{REV-0008}} إلى {{REV-0013}}. المعالجة بانتظار المراجعة ليست اعتمادًا نهائيًا. {{REV-0007}} ما زال مفتوحًا لأنه موضوع لقطات سابق."
      }
    ],
    "s26": [
      {
        "type": "p",
        "text": "المصفوفة أدناه من places-adoption.json. إعادة استخدام كتالوج ميرا عندما يغطي الاحتياج، وتكييف نمط الأماكن، وبناء المشاهدات من جديد."
      }
    ],
    "s27": [
      {
        "type": "p",
        "text": "{{REQ-0024}} و{{REQ-0025}}. إجراءات المنتج: التفاصيل والشراء والمتجر. الشراء المؤكد ليس نقرة رابط."
      }
    ],
    "s28": [
      {
        "type": "p",
        "text": "العيادة والمشغل يستخدمان أسلوب العرض نفسه. الخدمة: تفاصيل، طلب موعد وفق القدرة الفعلية، وموقع. الطلب ليس حجزًا مؤكدًا. شريط التصنيفات والهوية الوردية مشتركان مع تصور المنتجات."
      }
    ],
    "s29": [
      {
        "type": "proposal",
        "text": "{{REQ-0026}}. BoxFit.cover في الأماكن فجوة تكييف لا حكم عطل منشور. الصور المربعة والأفقية داخل إطار عمودي. المحتوى الضعيف يُعلَّم ولا يُنشر بالاستيراد."
      }
    ],
    "s30": [
      {
        "type": "callout",
        "text": "{{REQ-0021}} متطلب أساسي غير منفذ. لا endpoint ولا قاعدة في هذه الجولة. العتبة الزمنية مقترحة في PLC-0008 وليست معتمدة."
      }
    ],
    "s31": [
      {
        "type": "p",
        "text": "{{REQ-0022}} و{{REQ-0023}}. زد والمنصات الأخرى {{PLC-0010}}. التاجر بلا متجر خارجي {{DEC-0007}}."
      }
    ],
    "s32": [
      {
        "type": "p",
        "text": "المراحل الأربع مربوطة بـ {{GATE-06}} حتى {{GATE-09}} دون إلغاء {{GATE-00}} إلى {{GATE-05}}. وجود الخطة لا يأذن ببدء التنفيذ."
      }
    ],
    "s33": [
      {
        "type": "list",
        "items": [
          "{{DEC-0001}} الدفع",
          "{{DEC-0002}} البث",
          "{{DEC-0003}} موافقة المتجر على الإعلان",
          "{{DEC-0004}} منع نسخ الإعلان",
          "{{DEC-0005}} اعتماد الدراسة",
          "{{DEC-0007}} تاجر بلا متجر خارجي",
          "PLC-0008 عتبة المشاهدة",
          "PLC-0010 قدرات المنصات",
          "PLC-0016 المرجع البصري"
        ]
      }
    ],
    "s34": [
      {
        "type": "p",
        "text": "الدليل المحلي {{EVD-0028}} و{{EVD-0029}}. ملف الحزمة الكبيرة على سطح المكتب وغير منسوخ داخل الموقع. الاسم والبصمة في بطاقة التنزيل."
      }
    ],
    "s35": [
      {
        "type": "p",
        "text": "سجل التغييرات العام في القسم 18 يتضمن جولة خطة الأماكن. الملاحظات القديمة لم تُحذف."
      }
    ],
    "s36": [
      {
        "type": "callout",
        "text": "التصورات الثلاثة مرفقة في evidence/visual/references وحالتها available. سجل NEEDS_ASSET وصف مرحلة سابقة قبل إرفاق الملفات."
      },
      {
        "type": "p",
        "text": "أيقونة المشاهدات والعدد الحقيقي متطلب معتمد أُضيف بعد التصورات حتى لو لم تظهر في صورة لاحقة."
      }
    ],
    "s37": [
      {
        "type": "p",
        "text": "التصحيحات التالية تصف أرشيف {{EVD-0030}} كما هو. الوثيقة الأصلية داخل ZIP تبقى، والجدول تصحيح لاحق في هذا الموقع."
      },
      {
        "type": "p",
        "text": "أدلة قبل/بعد التاريخية في evidence/historical/rc2-0059 تغطي تسعة ملفات من أرشيف 0059 فقط."
      }
    ],
    "s38": [
      {
        "type": "p",
        "text": "نطوّر اكتشفي الموجودة في ميرا، لا متجرًا ثانيًا. توجيه المالك أبقى الإغلاق لتطوير تجربة العرض المرئي، وهذا منفصل عن استنتاج الكود السابق."
      },
      {
        "type": "p",
        "text": "نسخة الاختبار مسموحة الآن بالأمر flutter run --dart-define=MIRA_MARKETPLACE_ENABLED=true. الافتراضي يبقى false."
      },
      {
        "type": "p",
        "text": "تسجيل المراحل الخمس وحالة تنفيذ شاشة العرض موجود في قسم مراحل تطوير اكتشفي. أيقونة المشاهدات بلا عدد حقيقي، والفلاتر وربط المتجر وإعلان المشهور لم تبدأ."
      },
      {
        "type": "p",
        "text": "التصورات {{VIS-PRODUCTS}} و{{VIS-CLINICS}} و{{VIS-SALONS}} مرفقة الآن. الوصف السابق NEEDS_ASSET لم يعد الحالة الحالية."
      }
    ],
    "s39": [
      {
        "type": "p",
        "text": "هذه البطاقات هي سجل المراحل. حالتها تُقرأ من discover-phases.json ولا تُكرر في نص متعارض. اعتماد المرحلة لا يصدر من اكتمال التنفيذ."
      }
    ]
  },
  "siteAnswers": [
    {
      "q": "ماذا كان ناقصًا في النسخة السابقة؟",
      "a": "أدلة تنفيذ الشركاء والإدارة، وسجل بحث قابل للمراجعة، وفصل طبقات الإيقاف، ومعايير قبول، وخطة تغطي المتطلبات، وعقود فلاتر، ومصادر تنظيمية، ومدقق يرفض البيانات الفاسدة، وعرض موضوعي خارج app.js."
    },
    {
      "q": "ما الذي تحققنا منه الآن؟",
      "a": "مسارات المصدر من الصفحة إلى القاعدة لعزل الكتابة، وفرق مفتاح الإدارة عن رمز الشريك، وغياب نماذج الطلب والمتغير والمشاهير داخل نطاق الأوامر المرفقة. التشغيل الإنتاجي لم يُفحص."
    },
    {
      "q": "ما الأحكام التي صححناها؟",
      "a": "انظر جدول الأحكام التي تغيرت بعد المراجعة في القسم 4. التفعيل لم يعد ENABLED مع SOURCE_ONLY. الشراء الداخلي لم يعد خدمة متوقفة."
    },
    {
      "q": "ما الذي نملكه ويمكن إعادة استخدامه؟",
      "a": "جداول Partner وProduct وService، وحارس الرمز، وعزل assertProductOwner، واعتماد الطلبات، وعميل البوابة ولوحة الإدارة، والرابط الخارجي للشراء."
    },
    {
      "q": "ما الذي يحتاج تطويرًا؟",
      "a": "المتغيرات، الفروع، دورة الوسائط، الفلاتر على متغير واحد، إعلان بلا نسخ سعر، سد تتبع partnerId القادم من العميل، ومسارات الطلب والحجز إن قُرر ذلك."
    },
    {
      "q": "ما القرارات المطلوبة؟",
      "a": "DEC-0001 مكان الدفع، DEC-0002 البث الحي، DEC-0003 اعتماد المتجر، DEC-0004 منع نسخ الإعلان، DEC-0005 اعتماد الدراسة. لا قرار يُغلق هنا."
    },
    {
      "q": "ما مراحل التنفيذ وشروط قبولها؟",
      "a": "GATE-01 إلى GATE-05 في القسم 15. GATE-00 دراسة فقط وما زال قيد المعالجة. REQ-0020 قرار نطاق مرتبط بـ DEC-0002."
    },
    {
      "q": "ما الذي ما زال غير معروف ولماذا؟",
      "a": "قيمة الأعلام في البناء المنشور، وصول API رغم إخفاء الواجهة، ضبط مفتاح الإدارة، سلوك قاعدة الإنتاج، وأسعار مزود الوسائط. السبب: صلاحية هذه المرحلة تمنع التشغيل الحي ولم تُجلب تسعيرة موثوقة."
    }
  ],
  "scopeDecisions": [
    {
      "reqId": "REQ-0020",
      "kind": "scope-decision",
      "decisionId": "DEC-0002",
      "reasonAr": "البث الحي قرار نطاق مستقل. لا يوزَّع كمرحلة تنفيذ ولا يُترك خارج الخطة."
    },
    {
      "reqId": "REQ-0027",
      "kind": "scope-decision",
      "decisionId": "DEC-0007",
      "reasonAr": "التاجر بلا متجر خارجي قرار مفتوح. لا يُفترض شراء داخلي ولا يوزَّع على مرحلة تنفيذ الآن."
    }
  ],
  "placesAdoption": {
    "package": {
      "name": "DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_RC2_20260924_0125.zip",
      "sha256": "60a8d854eb609e1eef11513a1406fd1e262ac809922e889f2e7beecf76ec48e1",
      "location": "سطح المكتب، بجانب ملف sha256 وملف التحقق. غير مضمّن داخل هذا الموقع.",
      "previousName": "DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_20260924_0030.zip",
      "previousSha256": "5d45520b94a3681b7b92af1bfca0617977de39be224b3c666a257bd236dcc99a",
      "previousLocation": "مراجع تطبيق ميرا على سطح المكتب. لم تُستبدل.",
      "sourceFiles": 826,
      "counts": {
        "places-core": 336,
        "flutter-places": 199,
        "host-integration": 126,
        "provider-web": 94,
        "flutter-shared": 47,
        "asset": 21,
        "host-manifest": 3
      },
      "rc1RegisteredSourceFiles": 697,
      "rc1ManifestMatches": 723,
      "note": "أرقام RC1 سجل مراجعة فقط. أعداد RC2 أُعيد حسابها من الفهرس."
    },
    "items": [
      {
        "id": "PLC-0001",
        "section": "decision",
        "domain": "نطاق",
        "status": "متطلب معتمد",
        "title": "لا ننقل مشروع الأماكن كاملًا إلى ميرا",
        "detail": "نختار المكونات المناسبة ونكيفها داخل ملفات ميرا. الموجود في ميرا يُعاد استخدامه إذا غطى الاحتياج. دار كار يبقى مستقلًا ودون تعديل. هذا متطلب دراسة وليس تنفيذًا تم."
      },
      {
        "id": "PLC-0002",
        "section": "decision",
        "domain": "نطاق",
        "status": "متطلب معتمد",
        "title": "منطق الغرف والليالي لا ينتقل تلقائيًا",
        "detail": "حجوزات الفنادق في الأماكن لا تصبح منتجات ميرا ولا مواعيد الخدمات تلقائيًا."
      },
      {
        "id": "PLC-0003",
        "section": "experience",
        "domain": "منتجات",
        "status": "متطلب معتمد",
        "title": "عرض مستقل بشاشة كاملة لكل منتج أو خدمة",
        "detail": "السحب العمودي ينتقل بين العروض. السحب الأفقي يتنقل بين وسائط العرض نفسه. فتح التفاصيل يحافظ على سياق التصفح."
      },
      {
        "id": "PLC-0004",
        "section": "experience",
        "domain": "منتجات",
        "status": "متطلب معتمد",
        "title": "أسلوب العرض نفسه للاكتشاف ولصفحة المتجر",
        "detail": "داخل متجر محدد تقتصر النتائج على عروضه المطابقة للفلاتر. البحث والفلاتر والتصنيفات تتكيف مع المجال."
      },
      {
        "id": "PLC-0005",
        "section": "media",
        "domain": "وسائط",
        "status": "متطلب معتمد",
        "title": "لا فيديو إلزامي لكل منتج",
        "detail": "الصور المربعة والأفقية تُعرض داخل معالجة عمودية تحافظ على ظهور المنتج دون قص مضلل. المحتوى منخفض الجودة يُعلَّم للمراجعة. الاستيراد لا ينشر تلقائيًا. القوالب لا تخترع ألوانًا أو مزايا."
      },
      {
        "id": "PLC-0006",
        "section": "actions",
        "domain": "منتجات",
        "status": "متطلب معتمد",
        "title": "إجراءات المنتج: التفاصيل والشراء والمتجر",
        "detail": "الخدمة: التفاصيل، وطلب موعد أو حجز وفق القدرة الفعلية، والموقع. زر الموعد لا يوحي بتأكيد لم يحدث. الحفظ والمشاركة والتواصل تُحدد حالتها من الكود: في مجموعة أزرار الأماكن المقروءة لم يُثبت زر حفظ أو مشاركة عام."
      },
      {
        "id": "PLC-0007",
        "section": "views",
        "domain": "مشاهدات",
        "status": "متطلب معتمد",
        "title": "أيقونة عين وعدد واضح على كل عرض منشور",
        "detail": "يشمل الفيديو وعروض الصور والمحتوى. التحميل أو التحميل المسبق لا يُحسب مشاهدة. التنقل بين صور العرض نفسه لا ينشئ مشاهدة جديدة تلقائيًا. إذا تعذر جلب العدد لا يُعرض صفر كأنه حقيقة. الأرقام التسويقية المصطنعة ممنوعة."
      },
      {
        "id": "PLC-0008",
        "section": "views",
        "domain": "مشاهدات",
        "status": "مقترح",
        "title": "عتبة الظهور والمدة ما زالتا قيمتين مقترحتين",
        "detail": "مقترح للمراجعة وليس معتمدًا: ظهور 50٪ من مساحة المحتوى لمدة 1 ثانية للفيديو أو الصورة الثابتة. المشاهدة الفريدة مقترحها: أول مشاهدة مؤهلة للعرض لكل فاعل خلال 24 ساعة. إعادة المشاهدة حدث منفصل لا يزيد العدد العام إلا بقاعدة تُعتمد لاحقًا. هذه الأرقام ليست قرارًا معتمدًا."
      },
      {
        "id": "PLC-0009",
        "section": "stores",
        "domain": "ربط خارجي",
        "status": "متطلب معتمد",
        "title": "ربط متجر التاجر الخارجي وعرض منتجاته بأسلوب ميرا",
        "detail": "مثال الدراسة تاجر لديه 200 منتج. التدفق: ربط بالصلاحيات المتاحة، استيراد البيانات والوسائط والخيارات، مراجعة الجودة، مسودات، وسائط خاصة بميرا، معاينة واعتماد ونشر، ثم مزامنة السعر والمخزون والحالة وفق ما يثبته الربط. لا يُطلب 200 فيديو للبدء."
      },
      {
        "id": "PLC-0010",
        "section": "stores",
        "domain": "ربط خارجي",
        "status": "غير متحقق",
        "title": "قدرات زد والمنصات الأخرى غير موثقة هنا",
        "detail": "المصادقة، الحدود، الترقيم، Webhooks، تغيّر السعر، نفاد المخزون، الحذف، إلغاء الربط، نقل المقاس واللون والكمية، وجهة الدفع، وتأكيد البيع تحتاج وثائق رسمية حديثة أو اختبارًا موثقًا. لا يُدّعى دعم أي قدرة الآن."
      },
      {
        "id": "PLC-0011",
        "section": "stores",
        "domain": "دفع",
        "status": "يحتاج قرارًا",
        "title": "الدفع الداخلي والمحفظة والتسويات ليست معتمدة للتنفيذ",
        "detail": "تبقى ضمن DEC-0001. النقر على الشراء أو الإحالة هو ما يمكن تأكيده إذا لم يوجد ربط يثبت الطلب الخارجي. الضغط على الرابط ليس شراءً مؤكدًا."
      },
      {
        "id": "PLC-0012",
        "section": "stores",
        "domain": "مشاهير",
        "status": "متطلب معتمد",
        "title": "إعلان المشهور يرتبط بالعرض الأصلي ولا ينسخ السعر",
        "detail": "يدعم المتاجر والعيادات والمشاغل. يوثق الناشر والمعلن والجهة المقدمة للخدمة أو البائع. مشاهدات الإعلان مستقلة عن مشاهدات العرض الأصلي مع رابط بينهما."
      },
      {
        "id": "PLC-0013",
        "section": "stores",
        "domain": "ربط خارجي",
        "status": "يحتاج قرارًا",
        "title": "التاجر بلا متجر خارجي",
        "detail": "مساره يحتاج تحديدًا. لا تُفترض جاهزية شراء داخلي له."
      },
      {
        "id": "PLC-0014",
        "section": "gaps",
        "domain": "تكييف",
        "status": "موجود في المصدر",
        "title": "تصفح الأماكن الحالي مبني حول الفيديو",
        "detail": "معرض الصور الأفقي في مسار التفاصيل. دمج عدة وسائط داخل العرض العمودي نفسه يحتاج تكييفًا. BoxFit.cover في شاشة الاكتشاف قد يقص محتوى المنتج؛ معيار العرض يخص ميرا. هذه فجوة تكييف وليست حكمًا بأن تطبيق دار كار المنشور معطوب."
      },
      {
        "id": "PLC-0015",
        "section": "gaps",
        "domain": "تكييف",
        "status": "موجود في المصدر",
        "title": "نموذج المكان والوحدة لا يساوي المنتج أو الخدمة",
        "detail": "فلاتر الفنادق لا تنتقل إلى المنتجات. بوابة المزود مرشحة بعد إعادة تقييم المجال والصلاحيات. SafeArea والتقييم الصفري والنصوص التقنية تُراجع عند التكييف."
      },
      {
        "id": "PLC-0016",
        "section": "visual",
        "domain": "تصميم",
        "status": "يحتاج قرارًا",
        "title": "إرفاق المرجع البصري مطلوب",
        "detail": "RC3 بحث ولم يجد صور المنتجات والعيادات والمشاغل. الحالة NEEDS_ASSET. لم تُولَّد بدائل. الأسماء والأسعار في أي تصور لاحق أمثلة."
      }
    ],
    "matrix": [
      {
        "component": "الخلاصة العمودية",
        "source": "places discovery PageView",
        "deps": "video_player",
        "miraUse": "نمط انتقال بين العروض",
        "action": "تكييف",
        "evidence": "PLC-0003",
        "status": "موجود في المصدر"
      },
      {
        "component": "بيانات الاكتشاف",
        "source": "PlacesHttpDiscoveryRepository → DiscoveryApi → /v1/feed أو /v1/discovery/search → ConsumerController → FilterEngineService",
        "deps": "places-core",
        "miraUse": "مرجع عقد الخلاصة لا نسخة الخادم",
        "action": "تكييف",
        "evidence": "EVD-0028",
        "status": "موجود في المصدر"
      },
      {
        "component": "تفاصيل المكان",
        "source": "VenueApi",
        "deps": "وحدة المكان",
        "miraUse": "لا يُستخدم كخلاصة اكتشاف",
        "action": "لا يُنقل كما هو",
        "evidence": "EVD-0028",
        "status": "موجود في المصدر"
      },
      {
        "component": "معرض الصور الأفقي",
        "source": "مسار تفاصيل المكان",
        "deps": "وسائط الوحدة",
        "miraUse": "وسائط داخل العرض نفسه",
        "action": "تكييف",
        "evidence": "PLC-0014",
        "status": "موجود في المصدر"
      },
      {
        "component": "فلاتر الفندق",
        "source": "فلاتر الأماكن",
        "deps": "وحدات وحجوزات",
        "miraUse": "لا تنتقل إلى المنتجات",
        "action": "بناء معايير مجال في ميرا",
        "evidence": "PLC-0015",
        "status": "متطلب معتمد"
      },
      {
        "component": "بوابة المزود",
        "source": "places-provider-web",
        "deps": "صلاحيات المزود",
        "miraUse": "نمط لوحة بعد إعادة تقييم",
        "action": "تكييف",
        "evidence": "PLC-0015",
        "status": "موجود في المصدر"
      },
      {
        "component": "كتالوج ميرا الحالي",
        "source": "Partner وProduct وService",
        "deps": "حارس الشريك",
        "miraUse": "أساس إعادة الاستخدام",
        "action": "إعادة استخدام",
        "evidence": "CAP-0001",
        "status": "موجود في المصدر"
      },
      {
        "component": "المشاهدات",
        "source": "غير مفترضة في كود الأماكن",
        "deps": "لا endpoint في هذه الجولة",
        "miraUse": "متطلب جديد",
        "action": "بناء جديد",
        "evidence": "PLC-0007",
        "status": "متطلب معتمد"
      },
      {
        "component": "الخط Cairo",
        "source": "assets/fonts/Cairo-Variable.ttf",
        "deps": "pubspec",
        "miraUse": "مرجع أصل فقط",
        "action": "لا نسخ أعمى",
        "evidence": "RC2",
        "status": "موجود في المصدر"
      },
      {
        "component": "خرائط ومفتاح Google",
        "source": "app_config منقح داخل الحزمة",
        "deps": "خدمة خارجية",
        "miraUse": "لا يُنقل المفتاح",
        "action": "مستبعد",
        "evidence": "EVD-0028",
        "status": "معالجة بانتظار المراجعة"
      }
    ],
    "viewsSpec": [
      {
        "topic": "الظهور مقابل المشاهدة المؤهلة",
        "text": "الظهور: العنصر دخل منطقة العرض. المشاهدة المؤهلة: تجاوز عتبة لم تُعتمد بعد. التحميل المسبق ليس مشاهدة.",
        "status": "مقترح"
      },
      {
        "topic": "الخلفية والمحتوى المحجوب والتبديل السريع",
        "text": "التطبيق في الخلفية أو المحتوى المغطى أو المرور الأسرع من العتبة لا يُسجل مشاهدة مؤهلة.",
        "status": "مقترح"
      },
      {
        "topic": "التفرد وإعادة الإرسال",
        "text": "مفتاح idempotency من الخادم. إعادة إرسال الحدث نفسه لا تزيد العدد. dedup على هوية العرض والفاعل والنافذة الزمنية بعد اعتمادها.",
        "status": "مقترح"
      },
      {
        "topic": "تحقق الخادم",
        "text": "الخادم يتحقق من هوية العرض وملكيته. العميل لا يرسل العدد النهائي.",
        "status": "متطلب معتمد"
      },
      {
        "topic": "المعدل والتلاعب",
        "text": "حدود معدل ورفض الأنماط غير البشرية. لا أرقام تسويقية بديلة.",
        "status": "متطلب معتمد"
      },
      {
        "topic": "التجميع والتأخر",
        "text": "العدد العام قد يتأخر. الواجهة تميز بين غير متاح وبين صفر حقيقي.",
        "status": "متطلب معتمد"
      },
      {
        "topic": "الخصوصية والاحتفاظ",
        "text": "لا تُعرض هوية المشاهد للتاجر. مدة الاحتفاظ بالحدث الخام تحتاج قرارًا. العدد المجمع يكفي للعرض العام.",
        "status": "يحتاج قرارًا"
      },
      {
        "topic": "دلالة العدد",
        "text": "العدد الظاهر للعامة وتقرير التاجر للعرض نفسه يعنيان المشاهدات المؤهلة ذاتها، مع تفصيل أوضح في لوحة التاجر.",
        "status": "متطلب معتمد"
      }
    ],
    "events": [
      {
        "event": "عرض المحتوى",
        "meaning": "ظهور في منطقة العرض",
        "status": "مقترح"
      },
      {
        "event": "مشاهدة مؤهلة",
        "meaning": "بعد العتبة المعتمدة لاحقًا",
        "status": "مقترح"
      },
      {
        "event": "فتح التفاصيل",
        "meaning": "انتقال مع حفظ سياق التصفح",
        "status": "متطلب معتمد"
      },
      {
        "event": "الحفظ",
        "meaning": "إن وُجد الفعل في المنتج",
        "status": "يحتاج قرارًا"
      },
      {
        "event": "المشاركة",
        "meaning": "إن وُجد الفعل في المنتج",
        "status": "يحتاج قرارًا"
      },
      {
        "event": "التواصل",
        "meaning": "بدء اتصال أو رسالة، ليس إتمام صفقة",
        "status": "مقترح"
      },
      {
        "event": "النقر على الشراء",
        "meaning": "نقرة أو إحالة فقط",
        "status": "متطلب معتمد"
      },
      {
        "event": "بدء طلب موعد",
        "meaning": "بدء مسار، وليس حجزًا مؤكدًا",
        "status": "متطلب معتمد"
      },
      {
        "event": "طلب مؤكد",
        "meaning": "يحتاج إثباتًا من نظام الطلب. غير متاح للرابط الخارجي وحده.",
        "status": "يحتاج قرارًا"
      }
    ],
    "stages": [
      {
        "id": "PLC-STAGE-01",
        "gate": "GATE-06",
        "title": "استكمال حزمة المصدر",
        "status": "معالجة بانتظار المراجعة",
        "goal": "اعتماديات ناقصة وتوثيق وتحقق مستقل وحزمة RC2",
        "inScope": "الملفات الناقصة والمدقق والفحوص السلبية",
        "outScope": "تنفيذ تجربة ميرا وتعديل دار كار",
        "acceptance": "لا نواقص صامتة داخل النطاق، والبصمات والفحوص السلبية صحيحة",
        "evidence": "حزمة RC2 وسجل الفحوص السلبية",
        "blocker": "المراجعة البشرية لم تُغلق"
      },
      {
        "id": "PLC-STAGE-02",
        "gate": "GATE-07",
        "title": "تحديث دراسة ميرا وعقود التكييف",
        "status": "معالجة بانتظار المراجعة",
        "goal": "جرد قرارات إعادة الاستخدام ونموذج العرض والمشاهدات والربط",
        "inScope": "هذا الموقع والبيانات",
        "outScope": "تنفيذ التطبيق قبل مراجعة المرحلة",
        "acceptance": "كل متطلب له حالة ودليل أو قرار، وخطة ملفات قابلة للمراجعة",
        "evidence": "أقسام الموقع 22 إلى 35",
        "blocker": "المرجع البصري غير مرفق، وقدرات المنصات غير متحققة"
      },
      {
        "id": "PLC-STAGE-03",
        "gate": "GATE-08",
        "title": "تجربة العرض داخل ميرا",
        "status": "مقترح",
        "goal": "شاشة كاملة ووسائط وتصنيفات وبحث وفلاتر وتفاصيل وهوية ميرا",
        "inScope": "واجهة تجريبية ببيانات اختبار",
        "outScope": "يبدأ فقط بعد مراجعة هذه المرحلة وحزمة إثبات خاصة بها",
        "acceptance": "RTL وSafeArea وسلامة الإيماءات وظهور المنتج وتوقف الصوت وإدارة الموارد وحالات الخطأ والفراغ والإتاحة",
        "evidence": "ZIP وأدلة جهاز لاحقًا",
        "blocker": "غير مأذون الآن"
      },
      {
        "id": "PLC-STAGE-04",
        "gate": "GATE-09",
        "title": "لوحة التاجر والبيانات والمشاهدات",
        "status": "مقترح",
        "goal": "إدارة المحتوى والربط والمراجعة والنشر والإحصاءات",
        "inScope": "لوحة وإحصاءات بعد اعتماد العقد",
        "outScope": "لا endpoint للمشاهدات في هذه الجولة",
        "acceptance": "عزل المتاجر وصحة الربط وعدم تكرار الأحداث وصدق الأعداد ومعالجة فشل المزامنة",
        "evidence": "ZIP لاحق",
        "blocker": "غير مأذون الآن"
      }
    ]
  },
  "visualReferences": {
    "viewsNoteAr": "أيقونة المشاهدات والعدد الحقيقي متطلب معتمد أُضيف بعد هذه التصورات. إن لم تكن الأيقونة ظاهرة في صورة لاحقة، فهذا لا يلغي المتطلب.",
    "searchNoteAr": "الصور الثلاث موجودة في evidence/visual/references وتحققت بصماتها في RC2 البصري. الحالة السابقة NEEDS_ASSET لم تعد تصف الوضع الحالي.",
    "items": [
      {
        "id": "VIS-PRODUCTS",
        "titleAr": "شاشة المنتجات",
        "descriptionAr": "مرجع تكوين شاشة المنتجات. الألوان والخطوط من ثيم ميرا لا من الصورة.",
        "status": "available",
        "path": "evidence/visual/references/3856406F-4363-4706-8F2C-D7E44477AFFA.jpeg",
        "sha256": "75c8ded57a6726e320cd3154ed49b923764e8e0c9eb0251b20bea18fc244f6d6",
        "disclaimerAr": "تصور مرجعي للتكوين. ليس دليل تشغيل ولا بيانات تجارية.",
        "searchNoteAr": "الملف مرفق. البصمة مطابقة."
      },
      {
        "id": "VIS-CLINICS",
        "titleAr": "شاشة العيادات",
        "descriptionAr": "مرجع تكوين شاشة العيادات. إجراء الموعد لا يؤكد حجزًا.",
        "status": "available",
        "path": "evidence/visual/references/C29F7690-9EB9-45CA-A167-D212A90D0A6C.jpeg",
        "sha256": "3f6c34fc86508b041351de2a5dd5d836556ea308862712d9bcbdd1551b45ed9c",
        "disclaimerAr": "الأسماء في الصورة ليست بيانات الكتالوج.",
        "searchNoteAr": "الملف مرفق. البصمة مطابقة."
      },
      {
        "id": "VIS-SALONS",
        "titleAr": "شاشة المشاغل",
        "descriptionAr": "مرجع تكوين شاشة المشاغل.",
        "status": "available",
        "path": "evidence/visual/references/617733F4-AC10-49C7-9768-0D8C3883850C.jpeg",
        "sha256": "a5ed531d24ec2f06e17e66e6ab333bd19b0c53ffbb04d036b365bccc3894e2c7",
        "disclaimerAr": "لا يُعد تشغيلًا للمنتج.",
        "searchNoteAr": "الملف مرفق. البصمة مطابقة."
      }
    ]
  },
  "sourceCorrections": {
    "originalArchive": {
      "name": "DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_RC2_20260924_0125.zip",
      "sha256": "60a8d854eb609e1eef11513a1406fd1e262ac809922e889f2e7beecf76ec48e1",
      "unchanged": true
    },
    "historicalArchive": {
      "name": "DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_RC2_20260924_0059.zip",
      "sha256": "fa752eea3627e88b62f369aa6af0e661891d84ad845fc4613cb6b3333617119d",
      "hashFiles": [
        "evidence/historical/rc2-0059/source_file_hashes_before.txt",
        "evidence/historical/rc2-0059/source_file_hashes_after.txt"
      ],
      "coverage": "تسعة ملفات فقط، وليست إثباتًا لثبات المستودع كاملًا"
    },
    "historicalNoteAr": "ملفات البصمة قبل/بعد نُسخت من أرشيف 0059 إلى أدلة هذا الموقع. أرشيف 0125 لم يُعد تغليفه.",
    "corrections": [
      {
        "id": "SRC-CORR-001",
        "topic": "مسار الخلاصة",
        "originalFile": "DEPENDENCY_MAP.json chain browse-media",
        "originalStatement": "السلسلة تمر من places_live_core.dart إلى venue_api.dart ثم وحدات catalog.",
        "correctedStatement": "الخلاصة: PlacesHttpDiscoveryRepository ثم DiscoveryApi ثم GET /v1/feed أو POST /v1/discovery/search ثم ConsumerController.feed ثم CatalogService.feed ثم FilterEngineService.feedAdapter.",
        "status": "تصحيح لاحق موثق؛ الأرشيف الأصلي بقي كما هو"
      },
      {
        "id": "SRC-CORR-002",
        "topic": "تفاصيل المكان",
        "originalFile": "DEPENDENCY_MAP.json chain details و venue_api.dart",
        "originalStatement": "VenueApi يخدم التفاصيل والمعرض.",
        "correctedStatement": "هذا المسار يبقى على VenueApi وGET /v1/venues/:id. التصحيح لا يُعمم على كل السلاسل.",
        "status": "مثبت ويبقى كما هو"
      },
      {
        "id": "SRC-CORR-003",
        "topic": "التنقيح",
        "originalFile": "EXCLUSIONS_AND_REDACTIONS.json",
        "originalStatement": "النص يقول إنه لم تُعد كتابة الملفات في هذه الجولة.",
        "correctedStatement": "evidence/redaction_rc2.json داخل الأرشيف نفسه يثبت تنقيح app_config.dart فقط، باستبدال مفتاح الخرائط بنص REDACTED_GOOGLE_MAPS_API_KEY.",
        "status": "تعارض موثق؛ الأرشيف لم يُعدَّل"
      }
    ]
  },
  "discoverPlan": {
    "titleAr": "تفعيل اختبار اكتشفي وخطة الدمج",
    "ownerDirectiveAr": "سبب الإبقاء على الإغلاق، بحسب توجيه مالك المشروع، هو تطوير اكتشفي إلى تجربة العرض المرئي. هذا توجيه منتج، وهو منفصل عن الاستنتاج السابق من الكود بأن العلم الافتراضي false ولا توجد وثيقة تشغيل تشرح الإيقاف.",
    "testAuthorizationAr": "صُرّح بتفعيل نسخة الاختبار الآن عبر --dart-define=MIRA_MARKETPLACE_ENABLED=true. القيمة الافتراضية في الكود تبقى false، ولم يُفعَّل العلم لبناء الإنتاج.",
    "run": {
      "name": "MIRA Discover Test",
      "command": "flutter run --dart-define=MIRA_MARKETPLACE_ENABLED=true",
      "script": "scripts/run_mira_discover_test.sh",
      "launchConfig": ".vscode/launch.json",
      "defaultRemainsFalse": true
    },
    "independenceAr": [
      "ميرا مستقلة عن دار كار والأماكن في الكود والخدمات والبيانات والنشر.",
      "أي دمج لاحق يأخذ نسخة مستقلة داخل مستودع ميرا. لا روابط ملفات ولا symlinks ولا Git submodules ولا حزمة داخلية مشتركة.",
      "اكتشفي لا تتصل بباك إند الأماكن ولا بقاعدة بياناتها ولا بمفاتيحها، ولا يحتاج تشغيلها بناء دار كار.",
      "هذه الجولة لا تدمج مكونات الأماكن."
    ],
    "dataSource": {
      "probedAt": "2026-09-24T03:07:00+03:00",
      "endpoint": "https://mira-api-n4p3.onrender.com/api/v1/marketplace/partners",
      "result": "HTTP 200 من خادم ميرا. الأسماء هي بذرة marketplace.seed وليست متاجر شركاء مُدخلة من البوابة.",
      "localFallback": "إذا تعذر طلب التفاصيل يُقرأ الكتالوج المحلي مباشرة. وصف النقل مرتبط بنتيجة ذلك الطلب، والعلامة التجريبية معلنة في الكتالوج لا مستنتجة من الأسماء."
    },
    "functions": [
      {
        "id": "ACT-0001",
        "nameAr": "فتح اكتشفي من الرئيسية",
        "state": "منفذة وكانت محجوبة",
        "detailAr": "البطاقة تفتح DiscoverHubScreen. مع العلم تُعرض الأقسام الثلاثة بدل شاشة الانطلاق قريبًا.",
        "tested": "اختبار ودجت مع العلم وبدونه"
      },
      {
        "id": "ACT-0002",
        "nameAr": "قوائم الماركات والعيادات والصالونات",
        "state": "منفذة وتحتاج أن يُفهم أن البيانات بذرة",
        "detailAr": "PartnerListScreen يستدعي خادم ميرا ثم يسقط إلى البذرة المحلية. الخادم أعاد البذرة نفسها.",
        "tested": "فحص HTTP للقوائم الثلاث، واختبار سقوط الخادم إلى البذرة المحلية"
      },
      {
        "id": "ACT-0003",
        "nameAr": "صفحة الجهة وتفاصيل المنتج",
        "state": "منفذة",
        "detailAr": "النقر يفتح صفحة الجهة. أيقونة الرابط الخارجي تبقى للماركات. تفاصيل المنتج تعرض السعر ورابط المتجر وتصرّح أن الفتح ليس شراءً مؤكدًا.",
        "tested": "اختبار ودجت لتفاصيل المنتج، واستجابة الخادم لمنتجات لوريال"
      },
      {
        "id": "ACT-0004",
        "nameAr": "تفاصيل الخدمة والحجز",
        "state": "جزئية",
        "detailAr": "التفاصيل والسعر والمدة موجودة. bookingEnabled قيمته false في البذرة. الزر يعرض «الحجز قريباً» ورسالة انتظار، وليس «تم الحجز».",
        "tested": "اختبار ودجت يمنع نص إتمام الحجز، واستجابة الخادم لخدمات عيادة نور"
      },
      {
        "id": "ACT-0005",
        "nameAr": "الصور",
        "state": "جزئية",
        "detailAr": "العرض الحالي رموز تعبيرية. لا صور منتجات في هذه البذرة.",
        "tested": "قراءة واجهة التفاصيل والكتالوج"
      },
      {
        "id": "ACT-0006",
        "nameAr": "الاتصال والموقع",
        "state": "غير منفذة",
        "detailAr": "لا مسار هاتف أو خريطة داخل شاشات اكتشفي الحالية.",
        "tested": "بحث في ملفات marketplace عن tel أو خريطة ولم يوجد"
      },
      {
        "id": "ACT-0007",
        "nameAr": "المطابقة حسب تحليل البشرة",
        "state": "منفذة وتحتاج تقرير بشرة",
        "detailAr": "MarketplaceMatchedSection على شاشة الروتين، وتستخدم الخادم ثم البذرة المحلية. لم تُختبر على الجهاز في هذه الجولة.",
        "tested": "قراءة الاستدعاء في skin_routine_screen.dart"
      },
      {
        "id": "ACT-0008",
        "nameAr": "المشاهدات",
        "state": "غير منفذة",
        "detailAr": "متطلب لاحق. لم يُضف رقم وهمي.",
        "tested": "لا عداد في شاشات اكتشفي الحالية"
      }
    ],
    "fileMap": [
      {
        "id": "MAP-0001",
        "functionAr": "علم الإغلاق والاختبار",
        "unit": "lib/core/config/mira_features.dart",
        "responsibilityAr": "القيمة الافتراضية false وخيار البناء true",
        "calledByAr": "المسارات والرئيسية وشاشة اكتشفي",
        "decision": "استخدام كما هي",
        "reasonAr": "الآلية موجودة. لا تُقلب القيمة الافتراضية من أجل الاختبار.",
        "affectedAr": ".vscode/launch.json وscripts/run_mira_discover_test.sh",
        "testAr": "discover_activation_test.dart يُشغَّل مرتين"
      },
      {
        "id": "MAP-0002",
        "functionAr": "مسارات اكتشفي",
        "unit": "lib/features/marketplace/presentation/marketplace_routes.dart",
        "responsibilityAr": "البوابة والقوائم والتفاصيل",
        "calledByAr": "lib/main.dart",
        "decision": "استخراج مكون",
        "reasonAr": "نفس السلوك السابق في ملف قابل للاختبار دون إعادة هيكلة التطبيق.",
        "affectedAr": "lib/main.dart",
        "testAr": "اختبار نوع الصفحة عند إغلاق العلم وفتحه"
      },
      {
        "id": "MAP-0003",
        "functionAr": "الكتالوج",
        "unit": "lib/features/marketplace/data/repositories/marketplace_repository_impl.dart",
        "responsibilityAr": "خادم ميرا ثم البذرة المحلية",
        "calledByAr": "قوائم الجهات وصفحة الجهة والمطابقة",
        "decision": "تطوير",
        "reasonAr": "إظهار مصدر البيانات حتى لا تُعرض البذرة كمتاجر حقيقية.",
        "affectedAr": "marketplace_data_banner.dart وpartner_list_screen.dart",
        "testAr": "سقوط Dio إلى البذرة المحلية"
      },
      {
        "id": "MAP-0004",
        "functionAr": "واجهة الخادم",
        "unit": "mira-api/src/marketplace/marketplace.controller.ts",
        "responsibilityAr": "قوائم الجهات والتفاصيل والمطابقة",
        "calledByAr": "MarketplaceApiDataSource",
        "decision": "استخدام كما هي",
        "reasonAr": "لا يُنشأ باك إند تجارة موازٍ.",
        "affectedAr": "لا تعديل على الخادم في هذه الجولة",
        "testAr": "فحص HTTP للقوائم والتفاصيل"
      },
      {
        "id": "MAP-0005",
        "functionAr": "تجربة العرض المرئي لاحقًا",
        "unit": "غير موجودة بعد داخل ميرا",
        "responsibilityAr": "عرض كامل وفيديو وفلاتر ومشاهدات",
        "calledByAr": "لا مستدعٍ حالي",
        "decision": "إضافة جديدة لاحقًا",
        "reasonAr": "لا تُنسخ بيانات السعر إلى سجل فيديو ثانٍ، ولا تُدمج الأماكن في هذه الجولة.",
        "affectedAr": "لا ملفات جديدة للعرض المرئي الآن",
        "testAr": "لا اختبار منتج للمشاهدات لأنها غير منفذة"
      }
    ]
  },
  "discoverPhases": {
    "titleAr": "مراحل تطوير اكتشفي",
    "ownerConfirmationAr": "أكّد المالك أنه اختبر أيقونات اكتشفي على الجهاز وأن النقر والتنقل يعملان. هذا تأكيد للنقر والتنقل فقط، ولا يثبت الحجز ولا المشاهدات ولا التكاملات ولا شاشة العرض الجديدة.",
    "progressBasisAr": "إذا ظهر عدّ للمهام فهو عدد المهام التي حالتها «بانتظار المراجعة» من مهام تلك المرحلة. هذا العدّ ليس نسبة إنجاز تقديرية ولا يعني اعتماد المرحلة.",
    "approvedSummaryAr": "المعتمد بالكامل مرحلتان من خمس. المرحلة الخامسة قيد التنفيذ لاختبار النسخة الحالية المنشورة وتشغيل التطبيق على الجوال، بقرار المالك في 2026-09-27. البنود الأربعة المؤجلة تبقى مفتوحة: اعتماد المشاهدات، والعد الحقيقي، وتخزين PH3-STORAGE-LIVE، وسلسلة التكامل المتوقفة عند MinIO. ليست مكتملة. تصحيحات RC7 البرمجية محفوظة.",
    "placesCopyAr": "لم تُنسخ ملفات من حزمة مصدر الأماكن في هذه الجولة. شاشة العرض بُنيت داخل ميرا بـ PageView وvideo_player. لا يوجد استيراد من دار كار أو الأماكن ولا رابط ملفات ولا submodule.",
    "phases": [
      {
        "id": "PH-1",
        "number": 1,
        "nameAr": "شاشة العرض الجديدة",
        "goalAr": "فيديو وصور بشاشة عرض كاملة داخل اكتشفي، مع السحب بين العروض ووسائط العرض الواحد، وموضع لأيقونة المشاهدات دون عدد.",
        "inScopeAr": [
          "مسار العرض المرئي من اكتشفي عند تفعيل علم الاختبار",
          "سحب عمودي بين العروض وأفقي بين وسائط العرض نفسه",
          "ربط العرض بمعرّفات المنتج أو الخدمة والجهة الموجودة",
          "عينات وسائط معزولة وموسومة، وحالة فشل مع إعادة محاولة",
          "تشغيل الفيديو الظاهر فقط عبر منفذ يمكن استبداله في الاختبار"
        ],
        "outOfScopeAr": [
          "احتساب المشاهدات",
          "البحث والفلاتر وصفحة المتجر",
          "بوابة إدارة الوسائط والاستيراد",
          "الدفع والحجز المؤكد والبث وزد"
        ],
        "tasks": [
          {
            "id": "P1-T1",
            "nameAr": "مسار العرض ونقطة الدخول من اكتشفي",
            "status": "بانتظار المراجعة"
          },
          {
            "id": "P1-T2",
            "nameAr": "السحب العمودي والأفقي وفتح التفاصيل بالمعرّف نفسه",
            "status": "بانتظار المراجعة"
          },
          {
            "id": "P1-T3",
            "nameAr": "ملاءمة الصور والعينات المعزولة وحالة الفشل",
            "status": "بانتظار المراجعة"
          },
          {
            "id": "P1-T4",
            "nameAr": "تشغيل video_player وإيقافه على جهاز أو محاكي",
            "status": "قيد التنفيذ"
          },
          {
            "id": "P1-T5",
            "nameAr": "أيقونة العين دون رقم يوحي بإحصاء",
            "status": "بانتظار المراجعة"
          }
        ],
        "expectedAr": "تجربة عرض قابلة للاختبار مرتبطة بالكيانات الحالية، مع سلامة الوسائط والتنقل وحالات التحميل والفشل وأدلة تنفيذ واختبار.",
        "actualAr": "أُغلق نطاق واجهة العرض والأدلة في RC4 وقُبل. سجل الاختبارات المرفق بتلك الحزمة يذكر 40 اختبارًا ناجحًا؛ هذه نتيجة التنفيذ وليست إعادة تشغيل من المراجع. تشغيل الجوال والفيديو الفعلي مؤجلان إلى المرحلة الخامسة.",
        "status": "معتمدة",
        "dependenciesAr": "علم MIRA_MARKETPLACE_ENABLED ومعرّفات الكتالوج الحالي. لا تعتمد على مخطط جديد.",
        "notesAr": "معتمدة ضمن نطاق RC4. اختبار الجوال وتشغيل الفيديو الفعلي مؤجل إلى المرحلة الخامسة. تسليمات RC1–RC3 البصرية تبقى سجلًا تاريخيًا.",
        "blockersAr": "لا اعتماد إطلاق. البحث والفلاتر والمتجر والموعد والموقع في المرحلة الثانية. تشغيل video_player على الجوال في المرحلة الخامسة.",
        "acceptanceAr": "مراجعة التصميم والكود الآن مسموحة. قبول التشغيل على الجهاز النهائي مؤجل إلى المرحلة الخامسة بقرار المالك. لا اعتماد إطلاق.",
        "evidenceIds": [
          "EVD-0036",
          "EVD-0039",
          "EVD-0040",
          "EVD-0041",
          "EVD-0042",
          "EVD-0043",
          "EVD-0044"
        ],
        "reviewPackage": "deliveries/VIS-RC4.txt",
        "verificationReport": "deliveries/VIS-RC4.txt",
        "reviewResultAr": "اعتماد إغلاق المرحلة الأولى ضمن نطاق واجهة العرض والأدلة الحالية، بناءً على مراجعة RC4. اختبار الجوال وتشغيل الفيديو الفعلي مؤجلان إلى المرحلة الخامسة، وهذا الاعتماد لا يعني جاهزية الإطلاق العام. التسليم المرتبط: MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC4. سجل الاختبارات المرفق يذكر 40 اختبارًا ناجحًا، ولم يُعَد تشغيله بواسطة المراجع. التسليمات الأقدم تبقى سجلًا تاريخيًا.",
        "reviewDate": "2026-09-26",
        "reviewPackageLabel": "سجل RC4 البصري (معتمد ضمن النطاق)",
        "verificationReportLabel": "بيان RC4؛ التحقق المستقل بجانب الحزمة على سطح المكتب",
        "approvalAr": "معتمدة",
        "corrections": [
          {
            "id": "P1-RC2-01",
            "titleAr": "إيقاف الفيديو عند فتح التفاصيل وتغطية الشاشة",
            "problemAr": "فتح التفاصيل كان ينتقل دون إيقاف الفيديو، ودورة حياة التطبيق لا تغطي مسارًا يغطي الشاشة داخل التطبيق.",
            "impactAr": "قد يستمر صوت الفيديو أو تشغيله خلف شاشة التفاصيل أو بعد الخروج.",
            "taskAr": "إيقاف المشغّل عند التغطية، واستئناف الوسيط النشط فقط عند الرجوع إذا كان التطبيق في المقدمة، ومنع استئناف بعد الإغلاق.",
            "relatedTaskIds": [
              "P1-T2",
              "P1-T4"
            ],
            "status": "قيد التنفيذ",
            "resultAr": "الآلية مضافة: RouteAware على miraRouteObserver، والإيقاف عند التغطية والخلفية، وrelease عند الإغلاق. اختبار الودجت أثبت نداء الإيقاف والاستئناف على البديل.",
            "evidenceAr": "اختبار ودجت ببديل: فتح تفاصيل المنتج يوقف التشغيل والرجوع يستأنف الفتحة النشطة. فتح تفاصيل الخدمة من فيديو يوقف المشغّل. مغادرة الشاشة أثناء التهيئة لا تبدأ التشغيل.",
            "remainingAr": "لم يُثبت توقف VideoPlayerController الحقيقي لأن اتصال الجهاز انقطع قبل إكمال السيناريو."
          },
          {
            "id": "P1-RC2-02",
            "titleAr": "فشل الفيديو وإعادة المحاولة",
            "problemAr": "تهيئة المشغّل وتشغيله لم يوصلا الخطأ إلى الواجهة، وقد تبقى حالة التجهيز دون مخرج. إعادة المحاولة السابقة كانت لفشل صورة مصطنع.",
            "impactAr": "انتظار غير منته، أو خطأ وسيط سابق يظهر فوق وسيط لاحق.",
            "taskAr": "حالات تحميل وجاهز وفشل، زر إعادة المحاولة يعيد تهيئة الوسيط نفسه بعد التنظيف، ونقل الفشل المصطنع إلى الاختبار.",
            "relatedTaskIds": [
              "P1-T3"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "AssetVideoPort يلتقط فشل التهيئة ومهلة 12 ثانية وخطأ المشغّل بعد الجاهزية. الواجهة تعرض «تعذر تشغيل الفيديو» و«إعادة المحاولة». الكتالوج لم يعد يفشل خدمة عند كل دخول.",
            "evidenceAr": "اختبار ودجت: فشل تهيئة ثم إعادة محاولة ناجحة ثم فشل متكرر. خطأ تشغيل بعد الجاهزية منفصل عن «تعذر تحميل الصورة». الانتقال أثناء الفشل لا يترك نص الفيديو على صورة. السجل: evidence/tests/rc2_widget_test.txt",
            "remainingAr": "لا شيء داخل مسار التصفح. فشل التهيئة الحقيقي لم يُحقن في مشغّل الجهاز."
          },
          {
            "id": "P1-RC2-03",
            "titleAr": "منع تداخل عمليات التشغيل",
            "problemAr": "عمليات الإرفاق والفصل والتهيئة غير المتزامنة لم تتحقق بعد الانتظار من أن الطلب ما زال صالحًا.",
            "impactAr": "طلب قديم قد يشغّل فيديو بعد تغيّر الاختيار، أو يوقف مشغّلًا أحدث.",
            "taskAr": "ربط الملكية بالعرض والوسيط، ورمز جيل يمنع تشغيل طلب قديم أو إيقاف مشغّل أحدث، دون تعريف العرض بمسار الملف وحده.",
            "relatedTaskIds": [
              "P1-T2",
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "PresentationSlot يضم معرّف العرض وفهرس الوسيط. رمز الجيل يُزاد عند تبديل الطلب وrelease. إيقاف قديم لا يتخلص من مشغّل أحدث. لا تحديث بعد التخلص.",
            "evidenceAr": "اختبارات ببديل ذي بوابات تأخير: انتقال سريع من فيديو إلى فيديو، ومن فيديو قيد التهيئة إلى صورة، والعودة، والملف نفسه في عرضين، ومغادرة الشاشة أثناء التهيئة، والخلفية أثناء التهيئة. السجل: evidence/tests/rc2_widget_test.txt",
            "remainingAr": "لا شيء في اختبارات الترتيب المتأخر. إثبات المشغّل الحقيقي في P1-RC2-04."
          },
          {
            "id": "P1-RC2-04",
            "titleAr": "التشغيل الفعلي وسلامة العرض",
            "problemAr": "اختبارات الودجت بالبديل لا تثبت video_player الحقيقي.",
            "impactAr": "قد تنجح الاختبارات بينما المشغّل الحقيقي لا يعمل أو لا يتوقف.",
            "taskAr": "تشغيل شاشة العرض بمشغّل حقيقي على جهاز أو محاكي مع العلم، وإثبات السحب والتفاصيل والإيقاف والتقاط صور وتسجيل.",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "قيد التنفيذ",
            "resultAr": "المحاكي iPhone 16 / iOS 26.5: فشل البناء لأن TensorFlowLiteC مبني للجهاز فقط. الجهاز fayez’s iPhone / iOS 26.6: نجح بناء Xcode واتصل flutter drive على المنفذ 8888 ثم قطع النظام الاتصال والاختبار لم يطبع حالة المشغّل. لا صور ولا تسجيل لشاشة العرض.",
            "evidenceAr": "evidence/tests/rc2_device_run.txt",
            "remainingAr": "تشغيل يبقى في مقدمة الجهاز حتى تكتمل تأكيدات المشغّل والسحب واللقطات."
          },
          {
            "id": "P1-RC2-05",
            "titleAr": "روابط الحزمة وتقرير التحقق",
            "problemAr": "حقلا حزمة المراجعة وتقرير التحقق تُركا فارغين في RC1 لأن المراجعة لم تكن قد صدرت.",
            "impactAr": "وجود الحزمة لا يظهر في البطاقة، ويُخلط بين رابط التسليم واعتماد المرحلة.",
            "taskAr": "تسجيل RC1 ثم RC2 بالاسم والتاريخ والحالة والروابط والبصمة المتاحة، مع فصل نتيجة المراجعة عن الاعتماد.",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "RC1 مسجّل باسمه وبصمته ونتيجة المراجعة في deliveries/RC1.txt دون نسخ ZIP. RC2 مسجّل في deliveries/RC2.txt دون بصمة نهائية. الاعتماد حقل مستقل ويبقى غير معتمدة.",
            "evidenceAr": "deliveries/RC1.txt وdeliveries/RC1-VERIFICATION.txt وdeliveries/RC2.txt. فحص الفك يُسجّل خارج الحزمة في VERIFICATION.txt.",
            "remainingAr": "لا شيء داخل البطاقة. تأكيد الفك خارج الحزمة."
          },
          {
            "id": "P1-RC3-01",
            "titleAr": "تصحيح اختبار التشغيل والرجوع والخلفية",
            "problemAr": "اختبار التكامل كان يحتفظ بمرجع VideoPlayer قبل التفاصيل بينما التنفيذ يتخلص من المشغّل عند التغطية.",
            "impactAr": "نجاح زائف أو فشل بعد الرجوع رغم سلوك المنتج الصحيح.",
            "taskAr": "إعادة جلب المشغّل النشط بعد الرجوع، تحقق تقدم محدود المدة، RTL فعلي، وتمييز محاكاة دورة الحياة.",
            "relatedTaskIds": [
              "P1-RC2-01",
              "P1-RC2-04",
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "حُدّث integration_test/discover_playback_rc2_test.dart: مرجع جديد بعد pop، تحقق position متعدد العينات، Directionality RTL، سينario covered-resume.",
            "evidenceAr": "evidence/tests/rc3_playback_integration_note.txt — اختبار الوحدة/التكامل في CI؛ تشغيل الجهاز في rc3_device_run.txt.",
            "remainingAr": "إثبات RC3_MARK على جهاز فعلي ما زال معلقًا على VM Service."
          },
          {
            "id": "P1-RC3-02",
            "titleAr": "اختبار منطق AssetVideoPort الفعلي",
            "problemAr": "DelayedVideoPort داخل الاختبارات لا يثبت خوارزمية الإلغاء في AssetVideoPort.",
            "impactAr": "فجوة بين نجاح واجهة الاختبار وسلامة المشغّل الحقيقي.",
            "taskAr": "اختبارات على AssetVideoPort مع حقن مصنع VideoPlayerController قابل للتحكم.",
            "relatedTaskIds": [
              "P1-RC2-02",
              "P1-RC2-03",
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "10 حالات على AssetVideoPort؛ تُصليح بعد play عند hasError؛ play/pause/dispose تُراقَب على الطبقة السفلى.",
            "evidenceAr": "test/features/marketplace/asset_video_port_test.dart و evidence/tests/rc3_asset_video_port.txt",
            "remainingAr": "لا شيء ضمن اختبارات الوحدة."
          },
          {
            "id": "P1-RC3-03",
            "titleAr": "خروج من شاشة العروض الفارغة",
            "problemAr": "فرع _slides.isEmpty كان يعرض نصًا فقط بلا مخرج.",
            "impactAr": "حبس المستخدم عند فتح عرض فارغ.",
            "taskAr": "زر إغلاق في المنطقة الآمنة مع pop أو pushReplacementNamed إلى اكتشفي.",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "زر إغلاق في الحالة الفارغة؛ اختبار يضغط الإغلاق ويتحقق من العودة.",
            "evidenceAr": "discover_presentation_test.dart — empty presentation has an exit",
            "remainingAr": "لا شيء."
          },
          {
            "id": "P1-RC3-04",
            "titleAr": "التشغيل الفعلي والأدلة المرئية",
            "problemAr": "RC2: محاكي TensorFlowLiteC؛ الجهاز قطع الاتصال قبل إثبات التشغيل.",
            "impactAr": "لا صور/تسجيل من التطبيق لشاشة العرض.",
            "taskAr": "flutter test على iPhone بعلم MIRA_MARKETPLACE_ENABLED=true مع أدلة لقطات/تسجيل.",
            "relatedTaskIds": [
              "P1-RC2-04",
              "P1-T4"
            ],
            "status": "قيد التنفيذ",
            "resultAr": "أُعيد flutter test على iPhone؛ البناء نجح؛ VM Service لم يُكتشف خلال 60s (جاري/معلق).",
            "evidenceAr": "evidence/tests/rc3_device_run.txt",
            "remainingAr": "لقطات شاشة التطبيق وتسجيل فيدio قصير من الجهاز؛ إبقاء التطبيق في المقدمة."
          },
          {
            "id": "P1-RC3-05",
            "titleAr": "روابط تنزيل ZIP وتقرير التحقق",
            "problemAr": "zipHref كان يشير إلى سجل RC2.txt بدل ملف ZIP.",
            "impactAr": "خلط بين السجل والحزمة والتحقق.",
            "taskAr": "فصل سجل التسليم وتنزيل ZIP والبصمة وتقرير التحقق؛ ترتيب فك بجوار ZIP.",
            "relatedTaskIds": [
              "P1-RC2-05",
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "توسيع app.js وحقول logHref/sha256Href؛ DEL-RC2/DEL-RC3 بمسارات ../../ للفك بجوار ZIP؛ نسخ محلي في deliveries/ للمستودع.",
            "evidenceAr": "deliveries/RC3.txt و evidence/tests/rc3_link_check.txt",
            "remainingAr": "تحقق نهائي بعد إغلاق ZIP على سطح المكتب."
          },
          {
            "id": "P1-RC4-01",
            "titleAr": "تصحيح اختبار الخلفية والتغطية",
            "problemAr": "انظر مراجعة RC3",
            "impactAr": "منع إغلاق PH-1",
            "taskAr": "تصحيح اختبار الخلفية والتغطية",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "فصل (أ)(ب)(ج)؛ إزالة play على مشغّل متخلّص؛ RC4_LIFECYCLE_SIMULATED",
            "evidenceAr": "integration_test/discover_playback_rc2_test.dart",
            "remainingAr": "إثبات على جهاز"
          },
          {
            "id": "P1-RC4-02",
            "titleAr": "إثبات تقدم الفيدio والوسيط",
            "problemAr": "انظر مراجعة RC3",
            "impactAr": "منع إغلاق PH-1",
            "taskAr": "إثبات تقدم الفيدio والوسيط",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "videoPositionShowsProgress؛ تحقق مفتاح الوسيط؛ لا isPlaying وحده",
            "evidenceAr": "presentation_video_progress.dart + playback_position_progress_test.dart",
            "remainingAr": "تكامل جهاز"
          },
          {
            "id": "P1-RC4-03",
            "titleAr": "اختبار detach متأخر فعليًا",
            "problemAr": "انظر مراجعة RC3",
            "impactAr": "منع إغلاق PH-1",
            "taskAr": "اختبار detach متأخر فعليًا",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "detach A مع pauseGate ثم attach B",
            "evidenceAr": "asset_video_port_test.dart",
            "remainingAr": "لا شيء"
          },
          {
            "id": "P1-RC4-04",
            "titleAr": "التشغيل الفعلي والأدلة",
            "problemAr": "انظر مراجعة RC3",
            "impactAr": "منع إغلاق PH-1",
            "taskAr": "التشغيل الفعلي والأدلة",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "قيد التنفيذ",
            "resultAr": "flutter drive --device-vmservice-port=8888",
            "evidenceAr": "evidence/tests/rc4_device_run.txt",
            "remainingAr": "لقطات/تسجيل تطبيق"
          },
          {
            "id": "P1-RC4-05",
            "titleAr": "روابط التسليم والتحقق",
            "problemAr": "انظر مراجعة RC3",
            "impactAr": "منع إغلاق PH-1",
            "taskAr": "روابط التسليم والتحقق",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "معرّف MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324؛ PACKAGE_MANIFEST",
            "evidenceAr": "evidence/tests/rc4_link_check.txt",
            "remainingAr": "فحص بعد ZIP"
          },
          {
            "id": "P1-VIS-01",
            "titleAr": "تثبيت المراجع وقياسات التصميم",
            "problemAr": "الانتقال من شاشة الاختبار الداكنة إلى التصميم المعتمد.",
            "impactAr": "لا يمكن اعتماد الشكل قبل الصور.",
            "taskAr": "تثبيت المراجع وقياسات التصميم",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "الصور الثلاث مفتوحة والبصمات مطابقة. القرار: التكوين من الصور والهوية من ثيم ميرا.",
            "evidenceAr": "evidence/visual/references و data/discover-visual.json",
            "remainingAr": "لا نسبة مطابقة. المرحلة غير معتمدة."
          },
          {
            "id": "P1-VIS-02",
            "titleAr": "تنفيذ شاشة المنتجات",
            "problemAr": "الانتقال من شاشة الاختبار الداكنة إلى التصميم المعتمد.",
            "impactAr": "لا يمكن اعتماد الشكل قبل الصور.",
            "taskAr": "تنفيذ شاشة المنتجات",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "تكوين المنتجات من المرجع مع ألوان الثيم وبيانات الكتالوج سيروم فيتامين C.",
            "evidenceAr": "evidence/visual/comparisons/product.png",
            "remainingAr": "لا صور تصنيفات، ولا سطر حجم، والوسائط عينة."
          },
          {
            "id": "P1-VIS-03",
            "titleAr": "تنفيذ شاشة العيادات",
            "problemAr": "الانتقال من شاشة الاختبار الداكنة إلى التصميم المعتمد.",
            "impactAr": "لا يمكن اعتماد الشكل قبل الصور.",
            "taskAr": "تنفيذ شاشة العيادات",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "صف العيادة من الكتالوج: استشارة جلدية، والتصنيف المحدد البشرة.",
            "evidenceAr": "evidence/visual/comparisons/clinic.png",
            "remainingAr": "أيقونات بدل صور التصنيفات. زر الصوت على الفيديو فقط."
          },
          {
            "id": "P1-VIS-04",
            "titleAr": "تنفيذ شاشة المشاغل",
            "problemAr": "الانتقال من شاشة الاختبار الداكنة إلى التصميم المعتمد.",
            "impactAr": "لا يمكن اعتماد الشكل قبل الصور.",
            "taskAr": "تنفيذ شاشة المشاغل",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "شريحة الكتالوج s-rose-facial بتكوين المشغل وانحناء 18 مقابل 28 للعيادة.",
            "evidenceAr": "evidence/visual/comparisons/salon.png",
            "remainingAr": "العنوان من الكتالوج لا من نص الصورة. أيقونات بدل صور التصنيفات."
          },
          {
            "id": "P1-VIS-05",
            "titleAr": "دمج الواجهات مع العرض الحالي",
            "problemAr": "الانتقال من شاشة الاختبار الداكنة إلى التصميم المعتمد.",
            "impactAr": "لا يمكن اعتماد الشكل قبل الصور.",
            "taskAr": "دمج الواجهات مع العرض الحالي",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "الكروم فوق PageView. كتم الصوت يضبط setVolume عند الفيديو.",
            "evidenceAr": "discover_presentation_test.dart و presentation_video_port.dart",
            "remainingAr": "إثبات الجهاز مؤجل إلى PH-5."
          },
          {
            "id": "P1-VIS-06",
            "titleAr": "المقارنة البصرية",
            "problemAr": "الانتقال من شاشة الاختبار الداكنة إلى التصميم المعتمد.",
            "impactAr": "لا يمكن اعتماد الشكل قبل الصور.",
            "taskAr": "المقارنة البصرية",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "مقارنات جنبًا إلى جنب للمنتجات والعيادات والمشاغل. لا نسبة.",
            "evidenceAr": "evidence/visual/comparisons",
            "remainingAr": "الفروق في discover-visual.json. المرحلة غير معتمدة."
          },
          {
            "id": "P1-VRC3-01",
            "titleAr": "توليد الصور الرئيسية والتصنيفات",
            "problemAr": "مراجعة RC2: دوائر أيقونات بدل صور التصنيفات، ووسائط هندسية في المعاينة.",
            "impactAr": "التجربة البصرية ناقصة.",
            "taskAr": "توليد الصور الرئيسية الثلاث وصور التصنيفات الخمس عشرة وتركيبها.",
            "relatedTaskIds": [
              "P1-VIS-02",
              "P1-VIS-03",
              "P1-VIS-04"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "18 أصلًا عبر Cursor GenerateImage. السجل evidence/visual/generated/assets.json. المعاينة لا تُنسب إلى تاجر.",
            "evidenceAr": "assets/marketplace/discover و evidence/visual/generated",
            "remainingAr": "دقة الأداة 720×1280 للصور الرئيسية و1024×1024 للتصنيفات حيث أخرجتها الأداة."
          },
          {
            "id": "P1-VRC3-02",
            "titleAr": "تصحيح مواضع الإجراءات ومؤشر الوسائط",
            "problemAr": "ترتيب Row في RTL عكس مواضع التفاصيل والمتجر عن المطلوب، ومؤشر الوسائط كان أسفل الشاشة.",
            "impactAr": "التكوين لا يطابق مواضع المرجع.",
            "taskAr": "التفاصيل يسار الشاشة، الإجراء الأوسط في الوسط، المتجر أو الموقع يمين الشاشة. المؤشر أعلى المنتج.",
            "relatedTaskIds": [
              "P1-VIS-02"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "صف الإجراءات باتجاه بصري ثابت. مؤشر الوسائط تحت البحث. التصنيف الحالي يبدأ من الكل ولا يُثبَّت الشعر لخدمة بشرة.",
            "evidenceAr": "evidence/visual/implementation و comparisons",
            "remainingAr": "لا نسبة مطابقة رقمية."
          },
          {
            "id": "P1-VRC3-03",
            "titleAr": "توحيد حالة الكتم ومنع تشغيل طلب قديم",
            "problemAr": "أيقونة الكتم لا تتبع المشغّل بعد الانتقال، وsetVolume قد يكتمل ثم يُستدعى play لطلب لم يعد صالحًا.",
            "impactAr": "صوت أو تشغيل بعد الخروج.",
            "taskAr": "مصدر كتم واحد، وإعادة التحقق بعد setVolume وقبل play.",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "isMuted على المنفذ. بعد setVolume يُعاد فحص الجيل والملكية قبل play. اختبارات التأخر والانتقال نجحت.",
            "evidenceAr": "asset_video_port_test.dart و discover_presentation_test.dart",
            "remainingAr": "إثبات الجهاز في PH-5."
          },
          {
            "id": "P1-VRC3-04",
            "titleAr": "شراء الرابط الخارجي ومعاينة بلا معاملة",
            "problemAr": "شراء المنتج الحقيقي لم يكن يفتح الرابط الموجود، والمعاينة يجب ألا تنفّذ معاملة.",
            "impactAr": "إجراء غير صادق.",
            "taskAr": "فتح الرابط الخارجي للمنتج ذي الرابط الصالح مع النص أن الفتح ليس شراءً مكتملًا. المعاينة ترفض المعاملة.",
            "relatedTaskIds": [
              "P1-T2"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "MiraUrlLauncher للمنتج الحقيقي. معاينة: هذه معاينة ولا تنفّذ شراءً.",
            "evidenceAr": "discover_presentation_test.dart",
            "remainingAr": "لا دفع داخلي. البحث والفلاتر والمتجر والموعد والموقع غير منفذة."
          },
          {
            "id": "P1-VRC4-01",
            "titleAr": "فصل المعاينة عن مسار اكتشفي",
            "problemAr": "DiscoverPresentationScreen كانت تستدعي previewSlides عند عدم تمرير بيانات.",
            "impactAr": "الدخول العادي يعرض صور المعاينة المولّدة بدل عروض الكتالوج.",
            "taskAr": "المعاينة تمرير صريح. المسار العادي يستخدم slides(). الشاشة نفسها للمسارين. المعاينة بلا معاملة وبلا نسبة إلى تاجر.",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "الافتراضي أصبح DiscoverPresentationCatalog.slides(). تحديث الشريحة عند تغيّر المدخل. اختبار المسار العادي يتوقع سيروم فيتامين C ولا يتوقع عرض معاينة. اختبار المعاينة الصريحة يتوقع سيروم عناية وصورة hero_product.jpg.",
            "evidenceAr": "discover_presentation_test.dart و evidence/tests/visual_rc4_widget_test.txt",
            "remainingAr": "ربط البحث والفلاتر والمتجر بالبيانات يبقى في المرحلة الثانية."
          },
          {
            "id": "P1-VRC4-02",
            "titleAr": "عزل لقطات النسب والفيديو",
            "problemAr": "video.png وratio-square.png وratio-landscape.png كانت متطابقة لأن حالة الشاشة تُضبط في initState.",
            "impactAr": "الأدلة لم تثبت عرض المربع والأفقي.",
            "taskAr": "عزل كل التقاط، وانتظار الصورة، والتحقق من مسار الأصل ومن اختلاف اللقطات.",
            "relatedTaskIds": [
              "P1-T3"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "لكل التقاط مفتاح شاشة جديد وتفريغ الشجرة قبل الضخ. الاختبار يفشل إذا غاب الأصل المطلوب أو تغيّر حجم التخطيط عن حجم الأصل. المربع 240×240 والأفقي 320×180 والرأسي 180×320. نصف الخلية الأخيرة في ملف العينة المربعة نفسه. طرف الصورة الرأسية يمر تحت صف التصنيفات في اللقطة الكاملة لأن الوسائط خلف الواجهة.",
            "evidenceAr": "evidence/visual/implementation/ratio-portrait.png و ratio-square.png و ratio-landscape.png و video.png",
            "remainingAr": "لا نسبة مطابقة رقمية مع المرجع."
          },
          {
            "id": "P1-VRC4-03",
            "titleAr": "حد دليل الفيديو",
            "problemAr": "اختبار الالتقاط يستخدم _QuietVideoPort ويعيد SizedBox.expand.",
            "impactAr": "لقطة الفيديو لا تثبت تشغيل video_player.",
            "taskAr": "وصف الدليل بحدوده: تكوين الواجهة وزر الصوت. الإبقاء على اختبارات الملكية والكتم والإيقاف.",
            "relatedTaskIds": [
              "P1-T4"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "اللقطة تثبت زر الصوت وكروم ميرا على خلفية الثيم. لا إطار من المشغّل. اختبارات AssetVideoPort للكتم والإيقاف بقيت. التشغيل على الجوال مؤجل إلى PH-5 ولم يُطلب في هذه الجولة.",
            "evidenceAr": "evidence/visual/implementation/video.png و asset_video_port_test.dart",
            "remainingAr": "التشغيل الفعلي على الجوال في المرحلة الخامسة."
          },
          {
            "id": "P1-VRC4-04",
            "titleAr": "شرائط الوسائط وصف التصنيفات",
            "problemAr": "مؤشر الوسائط كان نقاطًا في الوسط، ودوائر التصنيف 52 بكسلًا لا تستفيد من عرض الصف.",
            "impactAr": "التكوين أبعد عن المرجع.",
            "taskAr": "شرائط أفقية أعلى اليمين بعدد الوسائط ومؤشرها. صف تصنيفات أكبر ومتجاوب مع تمرير عند الضيق وترتيب RTL.",
            "relatedTaskIds": [
              "P1-VIS-02"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "الشرائط يمين الشريط تحت البحث، والنشط أعرض بلون primary. زر الصوت أنزل إلى top+148 حتى لا يغطيه. التصنيفات من 64 إلى 78 وتوزع عرض الصف، مع تمرير أفقي إذا لم تتسع. إطار الاختيار ليس فلترًا.",
            "evidenceAr": "evidence/visual/implementation/product.png و clinic.png و salon.png",
            "remainingAr": "وظائف التصفية في المرحلة الثانية."
          },
          {
            "id": "P1-VRC4-05",
            "titleAr": "استبدال صورة تصنيف الملابس",
            "problemAr": "الصورة السابقة لقطة قريبة لنسيج وردي لا تُظهر قطعة ملابس داخل الدائرة.",
            "impactAr": "التصنيف غير مقروء بالحجم المصغر.",
            "taskAr": "أصل مربع لفستان وردي واضح الشكل، بلا نص أو إطار، مع مصغّر 256 وتحديث السجل.",
            "relatedTaskIds": [
              "P1-VRC3-01"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "استُبدل product_clothes.jpg والمصغّر ونسخة المعرض. 1024×1024. البصمة 6a31846f21c0f52f69976ba6e88bfcc484472421fbe3650188e9f2cf3b680a5e. بقية الأصول المقبولة لم تُعد توليدها.",
            "evidenceAr": "evidence/visual/generated/assets.json و product_clothes.jpg",
            "remainingAr": "لا شيء داخل هذه الملاحظة غير مراجعة الصورة."
          },
          {
            "id": "P1-VRC4-06",
            "titleAr": "تسجيل مراجعة RC3 وتسليم RC4",
            "problemAr": "حقول المراجعة كانت تشير إلى RC1، وحزمة RC3 البصرية لم تكن في سجل التسليمات.",
            "impactAr": "السجل لا يطابق التسليم الحالي.",
            "taskAr": "تسجيل مراجعة RC3 والبصمة، والإبقاء على التسليمات السابقة، وتسجيل مهام RC4 دون اعتماد المرحلة.",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "resultAr": "DEL-VIS-RC3 بالاسم والبصمة المتحققة. DEL-VIS-RC4 بانتظار المراجعة. بصمة الحزمة الحالية تُحسب خارجها.",
            "evidenceAr": "deliveries/VIS-RC3.txt و deliveries/VIS-RC4.txt",
            "remainingAr": "اعتماد المرحلة الأولى معلّق حتى المراجعة. المراحل 2–5 لم تبدأ."
          }
        ],
        "deliveries": [
          {
            "id": "DEL-RC1",
            "name": "MIRA_DISCOVER_PHASE1_AND_PHASE_TRACKER_RC1_20260924_0507.zip",
            "createdAt": "2026-09-24T05:07:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "zipHref": "deliveries/RC1.txt",
            "zipLabel": "سجل حزمة RC1 والبصمة",
            "verificationHref": "deliveries/RC1-VERIFICATION.txt",
            "verificationLabel": "تقرير تحقق RC1",
            "sha256": "ad4399482c891b28850efa12dca36cebcc9944f0103c74a547d05994f06551b4",
            "reviewResultAr": "قبول تسجيل المراحل كأساس للمتابعة. المرحلة الأولى غير معتمدة."
          },
          {
            "id": "DEL-RC2",
            "name": "MIRA_DISCOVER_PHASE1_CORRECTIONS_RC2_20260924_0611.zip",
            "createdAt": "2026-09-24T06:11:28+03:00",
            "deliveryStatus": "تمت مراجعته",
            "zipHref": "../../MIRA_DISCOVER_PHASE1_CORRECTIONS_RC2_20260924_0611.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE1_CORRECTIONS_RC2_20260924_0611.zip",
            "verificationHref": "../../MIRA_DISCOVER_PHASE1_CORRECTIONS_RC2_20260924_0611__VERIFICATION.txt",
            "verificationLabel": "تقرير تحقق RC2",
            "sha256": "86fbabfc3e74a7701bd2974d29f310aad156b97e2aa329e5169a0e2084f6f6b8",
            "reviewResultAr": "بصمة ZIP صحيحة؛ 146 ملفًا متطابقًا؛ فاحص الموقع 121 ملفًا؛ PH-1 قيد التنفيذ؛ 18 اختبارًا ناجحًا و5 بعلم التفعيل؛ لا إثبات مشغّل حقيقي؛ المرحلة الأولى غير معتمدة.",
            "logHref": "deliveries/RC2.txt",
            "logLabel": "سجل تسليم RC2",
            "sha256Href": "../../MIRA_DISCOVER_PHASE1_CORRECTIONS_RC2_20260924_0611.zip.sha256.txt",
            "sha256Label": "بصمة RC2",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-RC3",
            "name": "MIRA_DISCOVER_PHASE1_CLOSURE_RC3_.zip",
            "createdAt": "2026-09-25T04:30:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "logHref": "deliveries/RC3.txt",
            "logLabel": "سجل تسليم RC3",
            "zipHref": "../../MIRA_DISCOVER_PHASE1_CLOSURE_RC3_.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE1_CLOSURE_RC3_.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE1_CLOSURE_RC3_.zip.sha256.txt",
            "sha256Label": "بصمة RC3 (خارج الحزمة)",
            "verificationHref": "../../MIRA_DISCOVER_PHASE1_CLOSURE_RC3_VERIFICATION.txt",
            "verificationLabel": "MIRA_DISCOVER_PHASE1_CLOSURE_RC3_VERIFICATION.txt",
            "sha256": "0cfead38b9094768d7c44aa3bab289b5dc686118980ef65b62e9e330850ab1e8",
            "reviewResultAr": "بصمة ZIP الأصلية مطابقة؛ نسخة macOS «2» ليست صاحبة البصمة؛ فحص 130 ملفًا؛ AssetVideoPort وخروج فارغ مقبولان؛ الفيديو الحقيقي غير مثبت؛ PH-1 غير معتمدة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-RC4",
            "name": "MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324.zip",
            "createdAt": "2026-09-25T23:24:00+03:00",
            "deliveryStatus": "مُسلَّم للمراجعة",
            "logHref": "deliveries/RC4.txt",
            "logLabel": "سجل تسليم RC4",
            "zipHref": "../../MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324.zip.sha256.txt",
            "sha256Label": "بصمة RC4",
            "verificationHref": "../../MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324_VERIFICATION.txt",
            "verificationLabel": "MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324_VERIFICATION.txt",
            "sha256": "",
            "reviewResultAr": "لم تصدر بعد",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-VIS-RC2",
            "name": "MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC2_20260926_0050.zip",
            "createdAt": "2026-09-26T00:50:00+03:00",
            "deliveryStatus": "مُسلَّم للمراجعة",
            "sha256": "b260f30bd404e4a9461da7beae1577334f1eff7fa3169527df12f18eef42cc0c",
            "reviewResultAr": "حزمة RC2 البصرية على سطح المكتب. البصمة خارج الحزمة. المرحلة لم تُعتمد.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-VIS-RC3",
            "name": "MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC3_.zip",
            "createdAt": "2026-09-26T03:10:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "logHref": "deliveries/VIS-RC3.txt",
            "logLabel": "سجل مراجعة RC3 البصري",
            "zipHref": "../../MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC3_.zip",
            "zipLabel": "MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC3_.zip",
            "sha256Href": "../../MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC3_.zip.sha256.txt",
            "sha256Label": "بصمة RC3 البصري",
            "verificationHref": "../../MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC3_VERIFICATION.txt",
            "verificationLabel": "تقرير تحقق RC3 البصري",
            "sha256": "048fe388c56cfdd22c371f997120f78a02d2803415fa93d003af1f202e96ab96",
            "reviewResultAr": "مقبول: الصور الثلاث والتصنيفات الخمسة عشر ومصغراتها، وألوان وخطوط ميرا، ومواضع الإجراءات، ومصدر الكتم والتحقق قبل play، وحالة المراجع وسجل RC2. متبقٍّ عولج في RC4: فصل المعاينة، أدلة النسب، حد دليل الفيديو، شرائط الوسائط وصف التصنيفات، وصورة الملابس. المرحلة غير معتمدة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-VIS-RC4",
            "name": "MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC4_.zip",
            "createdAt": "2026-09-26T03:40:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "logHref": "deliveries/VIS-RC4.txt",
            "logLabel": "سجل RC4 البصري",
            "zipHref": "../../MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC4_.zip",
            "zipLabel": "MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC4_.zip",
            "sha256Href": "../../MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC4_.zip.sha256.txt",
            "sha256Label": "بصمة RC4 البصري",
            "verificationHref": "../../MIRA_DISCOVER_APPROVED_VISUAL_IMPLEMENTATION_RC4_VERIFICATION.txt",
            "verificationLabel": "تقرير تحقق RC4 البصري",
            "sha256": "3528bdf9519f9c35db058cd2ccbd63b3e235b7c32bd4f78c9482cb5f077abba5",
            "reviewResultAr": "اعتماد إغلاق المرحلة الأولى ضمن نطاق واجهة العرض والأدلة الحالية، بناءً على مراجعة RC4. اختبار الجوال وتشغيل الفيديو الفعلي مؤجلان إلى المرحلة الخامسة، وهذا الاعتماد لا يعني جاهزية الإطلاق العام.",
            "approvalAr": "اعتماد نطاق واجهة العرض فقط"
          }
        ]
      },
      {
        "id": "PH-2",
        "number": 2,
        "nameAr": "تجربة المنتجات والخدمات",
        "goalAr": "بحث وتصنيفات وفلاتر وصفحة متجر الجهة وتفاصيل وإجراءات صادقة.",
        "inScopeAr": [
          "البحث والتصنيفات والفلاتر من البيانات",
          "صفحة متجر الجهة",
          "إجراءات المنتج والخدمة ضمن القدرة الفعلية"
        ],
        "outOfScopeAr": [
          "دفع داخلي",
          "حجز مؤكد",
          "احتساب مشاهدات"
        ],
        "tasks": [
          {
            "id": "P2-T1",
            "nameAr": "البحث والتصنيفات والفلاتر",
            "status": "معتمدة"
          },
          {
            "id": "P2-T2",
            "nameAr": "صفحة متجر الجهة",
            "status": "معتمدة"
          },
          {
            "id": "P2-T3",
            "nameAr": "إجراءات صادقة للشراء والتواصل والموقع والموعد",
            "status": "معتمدة"
          }
        ],
        "expectedAr": "ترابط الخلاصة والمتجر والتفاصيل بنفس المعرّفات، وفلاتر مبنية على البيانات، وإجراءات تصف نتيجتها الفعلية.",
        "actualAr": "اعتمد المراجع المرحلة الثانية ضمن نطاقها بعد إغلاق PH2 RC6. نتائج RC5 وRC6 محفوظة كتاريخ. عدد المراحل المعتمدة 2 من 5. هذا الاعتماد لا يشمل المرحلة الثالثة.",
        "status": "معتمدة",
        "dependenciesAr": "المرحلة الأولى معتمدة لنطاق واجهة العرض. لا دفع داخلي ولا مشاهدات ولا استيراد.",
        "notesAr": "مراجعة RC3: الحزمة سليمة، وثبتت إصلاحات جزئية، ولم يُعتمد إغلاق المرحلة الثانية بسبب مشكلات البحث أثناء السحب، والمفضلة، والسعر غير المتاح، وبيانات المتجر، وأدلة التكامل، واتساق سجل المرحلة. بصمة RC3: 2da3caa9ee26079113137a90448e5499e246a8749e749345692852c2dd20f725. مراجعة RC4: سلامة ZIP وسجلات الملفات وفحص الموقع ناجحة. المرحلة الثانية غير معتمدة. ثبت إصلاح تعارض مفاتيح البحث أثناء السحب، وقراءة السعر الغائب، وعرض بيانات المتجر الحديثة، وتحويل المفضلة إلى حفظ حالة صريحة. بقيت موانع في المصادقة، وتزامن المفضلة، وثبات البحث، واختبارات التكامل وحزمتها، وسكربت قاعدة الاختبار، واتساق الموقع. بصمة RC4: 65ca7a138c04b6d3e044fabe33b3ae3c3e66806de734d4a8f8e641ca5ec18f32.  مراجعة RC5: قُبلت خمسة بنود وبقي بند سكربت قاعدة الاختبار. بصمة RC5: 74ba49c4dcaa334f6c35ecf415a0e6353ca18dc4e752a985eb0e4a0de1e968d5. التصحيح الحالي PH2-RC6 مرتبط بـ P2-RC5-05 وبانتظار مراجعة إغلاق المرحلة الثانية.",
        "blockersAr": "لا مسار تشغيلي لطلب الموعد؛ bookingEnabled ليس طلبًا. الإنتاج لم يُختبر. اختبار الجوال والفيديو على الجهاز مؤجلان إلى المرحلة الخامسة.",
        "affectedFilesAr": [
          "lib/features/marketplace/data/discover_catalog_query.dart",
          "lib/features/marketplace/data/repositories/marketplace_repository_impl.dart",
          "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
          "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
          "lib/features/marketplace/presentation/presentation/discover_visual_chrome.dart",
          "mira-api/src/marketplace/marketplace.controller.ts",
          "mira-api/src/marketplace/marketplace.service.ts"
        ],
        "acceptanceAr": "ترابط الخلاصة والمتجر والتفاصيل بنفس المعرّفات، وفلاتر مبنية على البيانات، وإجراءات صادقة في وصف نتائجها.",
        "evidenceIds": [],
        "reviewPackage": "deliveries/PH2-RC6.txt",
        "verificationReport": "deliveries/PH2-RC6.txt",
        "reviewPackageLabel": "سجل تصحيح سكربت القاعدة PH2-RC6",
        "verificationReportLabel": "أدلة RC6 داخل الموقع",
        "reviewResultAr": "أُغلق PH2 RC6 واعتمدت المرحلة الثانية ضمن نطاقها المتفق عليه. بصمة الحزمة التي رُاجعت مع RC6: adcdf63b8917783df7d3168e3b982b0d380be3cda14d682108e69783a0de15ea.",
        "reviewDate": "2026-09-26",
        "approvalAr": "معتمدة ضمن النطاق المتفق عليه",
        "deliveries": [
          {
            "id": "DEL-PH2-RC1",
            "name": "MIRA_DISCOVER_PHASE2_RC1.zip",
            "createdAt": "2026-09-26T04:10:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "logHref": "deliveries/PH2-RC1.txt",
            "logLabel": "سجل المرحلة الثانية",
            "zipHref": "../../MIRA_DISCOVER_PHASE2_RC1.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE2_RC1.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE2_RC1.zip.sha256.txt",
            "sha256Label": "بصمة المرحلة الثانية خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE2_RC1_VERIFICATION.txt",
            "verificationLabel": "تقرير تحقق المرحلة الثانية",
            "sha256": "82ad3069b4a16de18f3b211ff107a5a2bdb6351dd58cd5f5d6fde84b2496c5a5",
            "reviewResultAr": "المرحلة الثانية غير معتمدة. الحزمة سليمة من ناحية البصمة وسجل الملفات، لكن التنفيذ جزئي وتوجد مشكلات في تحميل الخادم وفصل مصادر البيانات وترقيم الصفحات وطلب الموعد والتفاصيل والأدلة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH2-RC2",
            "name": "MIRA_DISCOVER_PHASE2_RC2.zip",
            "createdAt": "2026-09-26T04:40:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "logHref": "deliveries/PH2-RC2.txt",
            "logLabel": "سجل تصحيح المرحلة الثانية RC2",
            "zipHref": "../../MIRA_DISCOVER_PHASE2_RC2.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE2_RC2.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE2_RC2.zip.sha256.txt",
            "sha256Label": "بصمة RC2 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE2_RC2_VERIFICATION.txt",
            "verificationLabel": "تحقق RC2 المستقل",
            "sha256": "6926e128bd135b01e308c8d52c25dbbe826810249860d4b6bbdd1080d557ca9b",
            "reviewResultAr": "راجَع المراجع RC2 ولم يعتمد إغلاق المرحلة الثانية. ثبتت إصلاحات بدء تحميل الكتالوج، ومنع الرجوع للأمثلة عند فشل الخلاصة، وإلغاء نجاح الموعد الوهمي، وتحسن اللقطات. بقيت مشكلات في ربط المفضلة ووحدة السعر ومقارنة المؤشر وحالة البحث ومسارات التفاصيل واختبارات التكامل واتساق سجل الموقع.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH2-RC3",
            "name": "MIRA_DISCOVER_PHASE2_RC3.zip",
            "createdAt": "2026-09-26T06:45:00+03:00",
            "deliveryStatus": "تمت مراجعته",
            "logHref": "deliveries/PH2-RC3.txt",
            "logLabel": "سجل تصحيح المرحلة الثانية RC3",
            "zipHref": "../../MIRA_DISCOVER_PHASE2_RC3.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE2_RC3.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE2_RC3.zip.sha256.txt",
            "sha256Label": "بصمة RC3 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE2_RC3_VERIFICATION.txt",
            "verificationLabel": "تحقق RC3 المستقل",
            "sha256": "2da3caa9ee26079113137a90448e5499e246a8749e749345692852c2dd20f725",
            "reviewResultAr": "الحزمة سليمة، وثبتت إصلاحات جزئية، ولم يُعتمد إغلاق المرحلة الثانية بسبب مشكلات البحث أثناء السحب، والمفضلة، والسعر غير المتاح، وبيانات المتجر، وأدلة التكامل، واتساق سجل المرحلة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH2-RC4",
            "name": "MIRA_DISCOVER_PHASE2_RC4.zip",
            "createdAt": "2026-09-26T07:10:00+03:00",
            "deliveryStatus": "تمت مراجعته — غير معتمد",
            "logHref": "deliveries/PH2-RC4.txt",
            "logLabel": "سجل إغلاق المرحلة الثانية RC4",
            "zipHref": "../../MIRA_DISCOVER_PHASE2_RC4.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE2_RC4.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE2_RC4.zip.sha256.txt",
            "sha256Label": "بصمة RC4 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE2_RC4_VERIFICATION.txt",
            "verificationLabel": "تحقق RC4 المستقل",
            "sha256": "65ca7a138c04b6d3e044fabe33b3ae3c3e66806de734d4a8f8e641ca5ec18f32",
            "reviewResultAr": "مراجعة RC4: سلامة ZIP وسجلات الملفات وفحص الموقع ناجحة. المرحلة الثانية غير معتمدة. ثبت إصلاح تعارض مفاتيح البحث أثناء السحب، وقراءة السعر الغائب، وعرض بيانات المتجر الحديثة، وتحويل المفضلة إلى حفظ حالة صريحة. بقيت موانع في المصادقة، وتزامن المفضلة، وثبات البحث، واختبارات التكامل وحزمتها، وسكربت قاعدة الاختبار، واتساق الموقع.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH2-RC5",
            "name": "MIRA_DISCOVER_PHASE2_RC5.zip",
            "createdAt": "2026-09-26T07:40:00+03:00",
            "deliveryStatus": "تمت مراجعته — بقي بند السكربت",
            "logHref": "deliveries/PH2-RC5.txt",
            "logLabel": "سجل تصحيح المرحلة الثانية RC5",
            "zipHref": "../../MIRA_DISCOVER_PHASE2_RC5.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE2_RC5.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE2_RC5.zip.sha256.txt",
            "sha256Label": "بصمة RC5 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE2_RC5_VERIFICATION.txt",
            "verificationLabel": "تحقق RC5 المستقل",
            "sha256": "74ba49c4dcaa334f6c35ecf415a0e6353ca18dc4e752a985eb0e4a0de1e968d5",
            "reviewResultAr": "قُبلت خمسة بنود من ستة. بقي اتصال سكربت قاعدة الاختبار لأن أوامر الإدارة لا تستخدم المضيف والمنفذ المتحقَّق منهما. المرحلة الثانية غير معتمدة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH2-RC6",
            "name": "MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6.zip",
            "createdAt": "2026-09-26T08:10:00+03:00",
            "deliveryStatus": "تمت مراجعته — معتمد",
            "logHref": "deliveries/PH2-RC6.txt",
            "logLabel": "سجل PH2-RC6",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6.zip",
            "zipLabel": "الحزمة المشتركة",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6.zip.sha256.txt",
            "sha256Label": "بصمة الحزمة المشتركة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة المشتركة",
            "sha256": "adcdf63b8917783df7d3168e3b982b0d380be3cda14d682108e69783a0de15ea",
            "reviewResultAr": "أُغلق بند سكربت قاعدة الاختبار واعتمدت المرحلة الثانية ضمن نطاقها المتفق عليه.",
            "approvalAr": "معتمدة ضمن النطاق المتفق عليه"
          }
        ],
        "corrections": [
          {
            "id": "P2-RC2-01",
            "titleAr": "التحميل الأول من الخادم",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "DiscoverPresentationScreen.initState يستدعي المسار المحلي فقط، ولا يبدأ طلب الخادم عند الدخول حتى مع تفعيل USE_MIRA_API.",
            "impactAr": "الدخول الطبيعي قد يبقى على الأمثلة المحلية رغم تفعيل الواجهة الخلفية.",
            "taskAr": "بدء طلب الكتالوج عند تفعيل الخادم، والإبقاء على المسار المحلي الموسوم عند تعطيله.",
            "fixAr": "الدخول عند تفعيل البوابة يستدعي DiscoverFeedController.load دون زرع الأمثلة المحلية قبل الطلب. عند تعطيل الخادم يبقى المسار المحلي بوسم تجريبي صريح. حالات التحميل والنجاح والفراغ والفشل وإعادة المحاولة وتحميل المزيد منفصلة، ولا تُعرض «لا توجد نتائج» أثناء الانتظار. فشل تحميل المزيد يبقي النتائج ويعيد الصفحة نفسها. استبدال الاستعلام يصفّر الصفحة النشطة.",
            "filesAr": [
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "lib/features/marketplace/presentation/discover_feed_controller.dart",
              "lib/features/marketplace/data/discover_catalog_gateway.dart",
              "lib/features/marketplace/data/repositories/marketplace_repository_impl.dart"
            ],
            "resultAr": "طلب الكتالوج يبدأ مع الدخول عندما تكون البوابة شبكية. الفشل الأول ليس صفحة فارغة، وإعادة المحاولة تطلب من جديد.",
            "evidenceAr": "test/features/marketplace/discover_phase2_widget_test.dart. لقطات محاكاة ودجت: evidence/visual/phase2/catalog-loading.png وcatalog-error.png وserver-loaded.png. البوابة قابلة للاستبدال وليست قاعدة حية.",
            "remainingAr": "لم يُشغَّل المسار ضد قاعدة الإنتاج. اختبار الجوال مؤجل إلى المرحلة الخامسة."
          },
          {
            "id": "P2-RC2-02",
            "titleAr": "مصادر البيانات وحالات الطلبات",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "browseDiscover يرجع إلى أمثلة محلية عند فشل الخادم، و_loadMore يدمج النتيجة دون التحقق من المصدر. تحميل المزيد قد يبطل استجابة بحث جارٍ.",
            "impactAr": "قد تختلط أمثلة تجريبية بنتائج الخادم، أو تستبدل نتيجة قديمة بحثًا أحدث.",
            "taskAr": "ربط كل استجابة بالاستعلام والمصدر والصفحة، ومنع الخلط وإبطال السياق السابق.",
            "fixAr": "كل استجابة تُطبَّق فقط إذا طابق الجيل والاستعلام والنقل. صفحة الكتالوج المحلي لا تُدمج في نتائج الخادم، ومؤشر مصدر لا يُستخدم مع مصدر آخر. فشل الشبكة يبقي البيانات الصحيحة ويعرض الفشل. بحث أو فلتر جديد يبطل تحميل المزيد السابق، وتحميل المزيد لا يلغي الاستعلام الأحدث ولا يضيف إلى سياق تبدّل. طلب تحميل المزيد المتزامن للصفحة نفسها ممنوع. انتهاء النتائج مختلف عن فشل الطلب. التفاصيل والمتجر على المسار الشبكي لا يعيدان إحياء عنصر محذوف أو غير منشور من الأمثلة.",
            "filesAr": [
              "lib/features/marketplace/presentation/discover_feed_controller.dart",
              "lib/features/marketplace/data/repositories/marketplace_repository_impl.dart",
              "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
              "lib/features/marketplace/presentation/screens/catalog_record_page.dart"
            ],
            "resultAr": "اختبار المتحكم يثبت تجاهل الاستجابة المتأخرة وعدم دمج الصفحة المحلية. اختبار الواجهة يثبت أن عنوان الاستجابة الأقدم لا يظهر بعد اكتمالها إذا تغيّر البحث.",
            "evidenceAr": "test/features/marketplace/discover_feed_controller_test.dart وdiscover_phase2_widget_test.dart (الاستجابة الأقدم لا تستبدل العنوان المعروض).",
            "remainingAr": "listPartnersLoad لقائمة المحور الأقدم ما زال يرجع إلى الأمثلة المحلية عند انقطاع الشبكة. خلاصة اكتشفي والمتجر والتفاصيل لا تفعل ذلك."
          },
          {
            "id": "P2-RC2-03",
            "titleAr": "ترقيم الصفحات والمؤشر",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "المؤشر يبحث عن عنصر الصفحة السابقة داخل النتائج الحالية. إذا حُذف أو خرج من النشر، يرجع الخادم نهاية النتائج رغم وجود عناصر تالية.",
            "impactAr": "يضيع ما بعد العنصر المحذوف ويبدو الكتالوج منتهيًا.",
            "taskAr": "مؤشر ثابت لا يشترط بقاء سجل المؤشر، مع رفض المؤشر غير الصالح.",
            "fixAr": "المؤشر مفتاح product:id أو service:id. الصفحة التالية هي أول عنصر مفتاحه أكبر من المؤشر، فلا يشترط بقاء صف المؤشر. مؤشر لا يطابق النمط يُرفض ولا يُفسَّر نهاية صامتة. الحد عدد صحيح من 1 إلى 24. البحث والفلاتر على المجموعة المنشورة المطابقة ثم التقطيع. نشاط العنصر ونشاط الجهة باقيان على الخلاصة والمتجر والتفاصيل. لا كتالوج موازٍ.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-page.ts",
              "mira-api/src/marketplace/marketplace.service.ts",
              "lib/features/marketplace/data/discover_catalog_query.dart"
            ],
            "resultAr": "حذف product:b ثم طلب المؤشر product:b يعيد product:c ثم service:a. التصفح الطبيعي يغطي الصفوف دون تكرار. المؤشر missing-row مرفوض.",
            "evidenceAr": "mira-api/src/marketplace/catalog-page.schema-tests.ts عبر npx tsx، وtest/features/marketplace/discover_catalog_query_test.dart. بيانات معزولة في الذاكرة، بنفس أسلوب إعادة الإنتاج الذي أثبته المراجع، وليست قاعدة حية.",
            "remainingAr": "اختبار الصفحات على Postgres محلي معزول نُفّذ في RC5 ثم حُذفت القاعدة. الترحيل غير مطبَّق على الإنتاج."
          },
          {
            "id": "P2-RC2-04",
            "titleAr": "حقيقة طلب الموعد",
            "relatedTaskIds": [
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "زر الموعد يرسل booking_request إلى /partners-portal/track ثم يقول إن طلب الموعد سُجّل. هذا المسار ينشئ PartnerEvent فقط.",
            "impactAr": "يُعرض نجاح طلب تشغيلي بينما الناتج حدث إحصائي.",
            "taskAr": "عدم اعتبار حدث التتبع طلب موعد، وتوحيد العرض والتفاصيل مع القدرة الموجودة فعلًا.",
            "fixAr": "تسجيل PartnerEvent ليس طلب موعد. الزر في شاشة العرض وفي تفاصيل الخدمة يعرض عدم التوفر ولا يرسل حدث تتبع بدلًا عن الطلب. لا تُعرض رسالة نجاح. حُذفت وعود التفعيل اللاحق. لا منظومة حجز أو دفع جديدة.",
            "filesAr": [
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "lib/features/marketplace/presentation/screens/service_detail_screen.dart",
              "lib/core/constants/marketplace_copy.dart"
            ],
            "resultAr": "لا يوجد كيان طلب موعد يمكن للجهة متابعته. القدرة الموجودة علم bookingEnabled بلا طلب. الواجهة تقول: طلب الموعد غير متاح. لا يوجد مسار تشغيلي ينشئ طلبًا يمكن للجهة متابعته.",
            "evidenceAr": "discover_phase2_widget_test.dart: appointment says the operational request is unavailable. discover_activation_test.dart يتوقع النص نفسه ولا يتوقع «سيُفعّل» أو «تم الحجز».",
            "remainingAr": "الفجوة التشغيلية باقية عمدًا. هذا ليس إكمالًا لطلب الموعد ولا حجزًا مؤكدًا."
          },
          {
            "id": "P2-RC2-05",
            "titleAr": "التفاصيل والإجراءات",
            "relatedTaskIds": [
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "التفاصيل تعرض التطابق 0% دون تحليل، وقد تُحيي عنصرًا غير منشور من الأمثلة، وتعد بموعد تفعيل لاحق.",
            "impactAr": "بيانات مضللة عن المطابقة والسعر والتوفر والموعد.",
            "taskAr": "التحقق من الكيان الحالي، وتمييز الغياب عن الصفر، وتوحيد فتح الروابط.",
            "fixAr": "فتح التفاصيل يعيد جلب الكيان بالمعرّف والنقل. الحذف أو إيقاف النشر رسالة مستقلة عن انقطاع الشبكة مع إعادة محاولة للانقطاع فقط. التطابق يُعرض فقط عند matchKnown. السعر الغائب «السعر غير متوفر» والصفر المعروف يُعرض إن وُجد. الروابط عبر MiraUrlLauncher، والنقر ليس شراءً مكتملًا. الموقع اسم ومدينة مسجّلة وليس إحداثيات فرع. لا هاتف أو تقييم افتراضي. شارة المطابقة في بلاطة المتجر لا تظهر دون نتيجة مطابقة فعلية.",
            "filesAr": [
              "lib/features/marketplace/presentation/screens/catalog_record_page.dart",
              "lib/features/marketplace/presentation/screens/product_detail_screen.dart",
              "lib/features/marketplace/presentation/screens/service_detail_screen.dart",
              "lib/features/marketplace/presentation/screens/partner_detail_screen.dart",
              "lib/features/marketplace/presentation/widgets/matched_product_tile.dart"
            ],
            "resultAr": "عنصر غير منشور لا يُعاد من الأمثلة على المسار الشبكي. متجر الجهة في اللقطة لا يعرض 0%. العودة من التفاصيل تُبقي عنوان الخلاصة.",
            "evidenceAr": "evidence/visual/phase2/details-missing.png وstore-loreal.png. محاكاة ودجت ببوابة تُرجع غياب العنصر، والكتالوج المحلي الموسوم للمتجر.",
            "remainingAr": "لا إحداثيات فرع في البيانات. فتح الرابط على جهاز حقيقي غير مثبت هنا."
          },
          {
            "id": "P2-RC2-06",
            "titleAr": "استكمال التصنيفات والوسائط والمفضلة والتواصل",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "التصنيفات بلا حقل منظم، والوسائط بلا عقد قراءة، والمفضلة غير مربوطة بحساب، والتواصل بلا بيانات منشورة.",
            "impactAr": "فلاتر تفرغ لأن الكود يمنع التطابق، ولا تُعرض وسائط الشبكة ولا مفضلة الحساب.",
            "taskAr": "حقل تصنيف ومعرّفات، وعقد وسائط، ومفضلة معزولة بالحساب، وتواصل من البيانات المنشورة فقط.",
            "fixAr": "حقل category على المنتج والخدمة بمعرّفات مخزنة: منتجات face/body/hair/clothes، عيادات skin/hair/laser/teeth، مشاغل hair/makeup/nails/care. الفلتر يقارن المفتاح ولا يخمن من الاسم أو وسوم البشرة. مسح التصنيف لا يُسقط النوع أو المدينة. عقد catalog_media للقراءة مع الترتيب والنوع. catalog_favorites بمعزل عن المستخدم ورفض غير المنشور. contact_phone اختياري ومن القيمة المنشورة فقط. الترحيل إضافي بلا تحديث صفوف.",
            "filesAr": [
              "mira-api/prisma/schema.prisma",
              "mira-api/prisma/migrations/20260926040000_discover_catalog_rc2/migration.sql",
              "mira-api/src/marketplace/marketplace.service.ts",
              "mira-api/src/marketplace/marketplace.controller.ts",
              "mira-api/src/marketplace/catalog-favorites.ts",
              "lib/features/marketplace/data/discover_catalog_query.dart"
            ],
            "resultAr": "تصنيف بلا صفوف يظهر فراغًا صادقًا. مكياج يطابق التصنيف المخزن. منتج تجريبي بتصنيف clothes يطابق. المفضلة لا تُرى بين حسابين في الاختبار المعزول. لا تُنسب صور المعاينة المولدة إلى منتج.",
            "evidenceAr": "catalog-favorites.schema-tests.ts وdiscover_catalog_query_test.dart وdiscover_feed_controller_test.dart لعزل المفضلة. لقطات search-makeup.png وcatalog-feed.png محاكاة، وصور التصنيف هي المصغرات المعتمدة وليست صور تاجر.",
            "remainingAr": "الترحيل غير مطبَّق على الإنتاج ولا توجد تعبئة راجعة، فتبقى صفوف الإنتاج بلا تصنيف حتى تُدار في المرحلة الثالثة. لا وسائط في البذرة. تكامل Firebase للمفضلة غير منفَّذ هنا. الرفع والمراجعة والاستيراد مرحلة ثالثة. التاجر بلا متجر خارجي يبقى على رابط المنتج الخارجي دون سلة داخلية."
          },
          {
            "id": "P2-RC2-07",
            "titleAr": "الاختبارات والأدلة المرئية",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "اختبارات المسار الشبكي عُطّلت بعلم API، واللقطات لم تثبت تحميل الخطوط ولا حالات التحميل والخطأ.",
            "impactAr": "لا يثبت أثر الاستجابات المتأخرة على الشاشة، وقد تظهر اللقطات كنصوص تالفة.",
            "taskAr": "بدائل قابلة للتحكم للمسار الشبكي، ولقطات بالثيم وRTL بعد تحميل الخطوط.",
            "fixAr": "اختبارات المسار الشبكي تحقن بوابة قابلة للتحكم ولا تُمرَّر بعلم يعطّل API لإخفاء العيب. الاستجابة المتأخرة تُقاس بعنوان معروض لا بعدّاد الجيل وحده. اللقطات تحمّل Tajawal وPlayfair وMaterial Icons وتستخدم ثيم ميرا واتجاه RTL وتنتظر الصور المصغرة. كل سيناريو على سطح 390×844.",
            "filesAr": [
              "test/features/marketplace/discover_phase2_widget_test.dart",
              "test/features/marketplace/discover_fonts.dart",
              "test/features/marketplace/discover_feed_controller_test.dart",
              "test/features/marketplace/discover_catalog_query_test.dart"
            ],
            "resultAr": "نجحت اختبارات الخلاصة والمتحكم والاستعلام والتفعيل والالتقاط ومشغّل الأصل في آخر تشغيل مسجّل. لقطات التحميل والخطأ والفراغ والبحث والفلاتر والمتجر والتفاصيل مرفقة ومصدرها موضّح.",
            "evidenceAr": "evidence/tests/rc2_flutter.txt وevidence/tests/rc2_api.txt وevidence/visual/phase2/CAPTIONS.txt. لقطة فيديو صامتة ليست إثبات video_player.",
            "remainingAr": "تشغيل الفيديو على الجوال يبقى في المرحلة الخامسة. لا VM Service في هذه الجولة."
          },
          {
            "id": "P2-RC2-08",
            "titleAr": "اتساق سجل الموقع",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "discover-visual.json وproject.json ما زالا يصفان المرحلة الأولى بأنها غير معتمدة، بينما بطاقتها الحالية معتمدة.",
            "impactAr": "الحالة الحالية تتعارض مع سجل المرحلة الأولى.",
            "taskAr": "تحديث الحالة الحالية مع الإبقاء على نصوص التسليمات القديمة بوصفها تاريخًا.",
            "fixAr": "الحالة الحالية تفصل اعتماد المرحلة الأولى ضمن RC4 عن رفض RC1 وعن انتظار RC2. نصوص التسليمات القديمة بقيت تاريخًا. بطاقة كل مرحلة مستقلة. لم يُعتمد إغلاق المرحلة الثانية من داخل التنفيذ.",
            "filesAr": [
              "docs/mira-commerce-reference/data/discover-phases.json",
              "docs/mira-commerce-reference/data/discover-visual.json",
              "docs/mira-commerce-reference/data/project.json",
              "docs/mira-commerce-reference/js/data.generated.js"
            ],
            "resultAr": "عدد المراحل المعتمدة يبقى 1 من 5. المرحلة الثانية حالتها بانتظار المراجعة.",
            "evidenceAr": "python3 scripts/validate_package.py بعد توليد البيانات. سجل RC1 محفوظ في DEL-PH2-RC1.",
            "remainingAr": "اعتماد RC2 يبقى للمراجع بعد فحص الحزمة. البصمة تُحسب خارج الحزمة بعد إغلاقها."
          },
          {
            "id": "P2-RC3-01",
            "titleAr": "ربط المفضلة بالحساب والمسار الفعلي",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "المسار الطبيعي لم يمرّر مفضلة مرتبطة بالحساب؛ القلب لا يعكس الحالة المحفوظة.",
            "fixAr": "ApiDiscoverFavoriteClient على المسار الافتراضي مع Firebase authStateChanges وGET/POST /marketplace/favorites. refresh عند الدخول وتبديل الحساب. قفل أثناء الحفظ ورسائل فشل صادقة.",
            "filesAr": [
              "lib/features/marketplace/data/discover_favorite_client.dart",
              "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "mira-api/src/marketplace/marketplace.controller.ts",
              "mira-api/src/marketplace/marketplace.service.ts"
            ],
            "resultAr": "القلب يعكس saved بعد refresh. حساب مسجل يمر عبر العميل الشبكي لا ذاكرة العرض فقط.",
            "evidenceAr": "discover_phase2_widget_test.dart (قلب ممتلئ). discover_feed_controller_test.dart (عزل حساب). evidence/tests/rc3_flutter.txt",
            "remainingAr": "تكامل Postgres حي يتطلب DATABASE_URL محليًا. إثبات Firebase على جهاز في المرحلة الخامسة."
          },
          {
            "id": "P2-RC3-02",
            "titleAr": "وحدة السعر (هللات → ريالات)",
            "relatedTaskIds": [
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "priceHalalas تُعرض كريالات خام مع «ر.س».",
            "fixAr": "CatalogPrice في Flutter وformatCatalogPrice في Nest. 8900→89 ر.س و8999→89.99 ر.س.",
            "filesAr": [
              "lib/features/marketplace/data/catalog_price.dart",
              "mira-api/src/marketplace/catalog-price.ts",
              "lib/features/marketplace/presentation/presentation/discover_presentation_catalog.dart",
              "lib/features/marketplace/presentation/screens/product_detail_screen.dart",
              "lib/features/marketplace/presentation/screens/service_detail_screen.dart"
            ],
            "resultAr": "الواجهة لا تعرض 8900 كريالًا.",
            "evidenceAr": "catalog_price_test.dart وcatalog-price.schema-tests.ts وودجت RC3 (لا 8900، يظهر 89).",
            "remainingAr": "لا شيء في المسار المحلي/المحاكى. اتساق priceLabel على الإنتاج يبقى للمراجعة."
          },
          {
            "id": "P2-RC3-03",
            "titleAr": "مقارنة المؤشر الموحدة",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "localeCompare للترتيب و > للاستمرار أسقطت عناصر (a/A/b و a-b/a_b/ab).",
            "fixAr": "compareCatalogKeys واحدة في catalog-page.ts وmarketplace.service. Dart يستخدم compareTo على المفتاح المركب.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-page.ts",
              "mira-api/src/marketplace/marketplace.service.ts",
              "lib/features/marketplace/data/discover_catalog_query.dart"
            ],
            "resultAr": "a/A/b و a-b/a_b/ab يمران بصفحات كاملة دون فقد.",
            "evidenceAr": "catalog-page.schema-tests.ts وdiscover_catalog_query_test.dart (paging key order).",
            "remainingAr": "اختبار الصفحات على Postgres محلي معزول نُفّذ في RC5 ثم حُذفت القاعدة. الإنتاج غير مختبر."
          },
          {
            "id": "P2-RC3-04",
            "titleAr": "البحث ودورة حياة الطلبات",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "إخفاء TextField أثناء التحميل وnotify بعد dispose.",
            "fixAr": "_disposed في DiscoverFeedController. حقل البحث يبقى ظاهرًا. «كل الأنواع» لا يمسح المدينة.",
            "filesAr": [
              "lib/features/marketplace/presentation/discover_feed_controller.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "lib/features/marketplace/presentation/presentation/discover_visual_chrome.dart"
            ],
            "resultAr": "ودجت: بحث أثناء التحميل، dispose بلا notify.",
            "evidenceAr": "discover_phase2_widget_test.dart وdiscover_feed_controller_test.dart. evidence/tests/rc3_flutter.txt",
            "remainingAr": "اختبار pop أثناء الطلب على Navigator كامل مؤجل؛ dispose مغطى في المتحكم."
          },
          {
            "id": "P2-RC3-05",
            "titleAr": "مداخل التفاصيل الموحدة",
            "relatedTaskIds": [
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "المتجر والمسارات المسماة فتحت ProductDetailScreen بكائن قديم.",
            "fixAr": "CatalogRecordScope.page من الخلاصة والمتجر والمطابقة والمسارات المسماة.",
            "filesAr": [
              "lib/features/marketplace/data/catalog_record_scope.dart",
              "lib/features/marketplace/presentation/screens/catalog_record_page.dart",
              "lib/core/navigation/marketplace_routes.dart",
              "lib/features/marketplace/presentation/screens/partner_detail_screen.dart"
            ],
            "resultAr": "إعادة جلب بالمعرّف من كل مدخل مرتبط.",
            "evidenceAr": "discover_activation_test.dart وdiscover_phase2_widget_test.dart (details-missing).",
            "remainingAr": "فتح الرابط على جهاز حقيقي غير مثبت."
          },
          {
            "id": "P2-RC3-06",
            "titleAr": "اختبار التكامل للمفضلة",
            "relatedTaskIds": [
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "اختبارات الذاكرة لا تثبت Prisma/HTTP.",
            "fixAr": "marketplace-favorites.integration-tests.ts على MarketplaceService مع skip بدون DATABASE_URL محلي.",
            "filesAr": [
              "mira-api/src/marketplace/marketplace-favorites.integration-tests.ts",
              "mira-api/src/marketplace/marketplace.service.ts",
              "mira-api/src/marketplace/marketplace.controller.ts"
            ],
            "resultAr": "schema tests ناجحة؛ integration SKIP موثق.",
            "evidenceAr": "evidence/tests/rc3_api.txt",
            "remainingAr": "تشغيل التكامل يحتاج migrate + Postgres محلي. الترحيل غير مطبّق على الإنتاج."
          },
          {
            "id": "P2-RC3-07",
            "titleAr": "اتساق بطاقة PH-1",
            "relatedTaskIds": [
              "P1-T1"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "notesAr وblockersAr في PH-1 ناقضان اعتماد RC4.",
            "fixAr": "تصحيح حقول PH-1 وapprovedSummaryAr وproject.json دون تغيير نتائج التسليمات التاريخية.",
            "filesAr": [
              "docs/mira-commerce-reference/data/discover-phases.json",
              "docs/mira-commerce-reference/data/project.json"
            ],
            "resultAr": "الحالة الحالية تذكر اعتماد RC4 وتأجيل الجوال.",
            "evidenceAr": "python3 scripts/validate_package.py بعد generate_data_js.",
            "remainingAr": "لا شيء داخل PH-1 بعد التصحيح."
          },
          {
            "id": "P2-RC4-01",
            "titleAr": "البحث أثناء السحب",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "GlobalKey واحد على صفحات PageView المتزامنة.",
            "impactAr": "تعارض مفاتيح وقطع الكتابة.",
            "filesAr": [
              "discover_presentation_screen.dart"
            ],
            "fixAr": "حقل بحث واحد في الطبقة المشتركة.",
            "acceptanceAr": "حقل واحد أثناء السحب والنص يبقى.",
            "resultAr": "ودجت السحب يبقي TextField واحدًا.",
            "evidenceAr": "discover_phase2_widget_test.dart وevidence/tests/rc4_flutter.txt",
            "remainingAr": "لا شيء داخل مسار الخلاصة.",
            "taskAr": "حقل بحث واحد في الطبقة المشتركة."
          },
          {
            "id": "P2-RC4-02",
            "titleAr": "عزل المفضلة",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "نتيجة refresh أو الحفظ تصل بعد تبديل الحساب.",
            "impactAr": "تلوث مفضلة الحساب الجديد.",
            "filesAr": [
              "discover_favorite_client.dart"
            ],
            "fixAr": "جيل حساب وكتابة، وتجاهل العملية بعد dispose.",
            "acceptanceAr": "استجابة A لا تكتب على B.",
            "resultAr": "اختبارات العميل الحقيقي مع نقل بديل.",
            "evidenceAr": "discover_favorite_client_test.dart",
            "remainingAr": "إثبات Firebase على الجهاز في المرحلة الخامسة.",
            "taskAr": "جيل حساب وكتابة، وتجاهل العملية بعد dispose."
          },
          {
            "id": "P2-RC4-03",
            "titleAr": "إعادة محاولة المفضلة",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "toggle يقلب الحالة عند إعادة الإرسال.",
            "impactAr": "فقدان الحفظ بعد ضياع الاستجابة.",
            "filesAr": [
              "marketplace.service.ts"
            ],
            "fixAr": "setFavorite بحالة صريحة وupsert.",
            "acceptanceAr": "تكرار الحفظ يبقى محفوظًا.",
            "resultAr": "تكامل HTTP لطلبين متتاليين ومتزامنين.",
            "evidenceAr": "evidence/tests/rc4_api.txt",
            "remainingAr": "لا شيء في قاعدة الاختبار.",
            "taskAr": "setFavorite بحالة صريحة وupsert."
          },
          {
            "id": "P2-RC4-04",
            "titleAr": "سعر null",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "containsKey ثم تحويل num يفشل عند null.",
            "impactAr": "انهيار أو سعر مختلق.",
            "filesAr": [
              "catalog_price.dart"
            ],
            "fixAr": "الغائب وnull غير معروفين والصفر معلوم.",
            "acceptanceAr": "89 و0 وغير متاح.",
            "resultAr": "نص تفاصيل المنتج بعد قراءة JSON.",
            "evidenceAr": "catalog_price_test.dart",
            "remainingAr": "لا شيء في القراءة المحلية.",
            "taskAr": "الغائب وnull غير معروفين والصفر معلوم."
          },
          {
            "id": "P2-RC4-05",
            "titleAr": "بيانات المتجر",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "الشاشة تبقي الكائن الأولي بعد الجلب.",
            "impactAr": "هاتف أو رابط قديم.",
            "filesAr": [
              "partner_detail_screen.dart"
            ],
            "fixAr": "استخدام summary من الاستجابة وإعادة المحاولة.",
            "acceptanceAr": "الاسم من الاستجابة.",
            "resultAr": "partner_detail_freshness_test.dart",
            "evidenceAr": "partner_detail_freshness_test.dart",
            "remainingAr": "فتح الرابط على جهاز غير مثبت.",
            "taskAr": "استخدام summary من الاستجابة وإعادة المحاولة."
          },
          {
            "id": "P2-RC4-06",
            "titleAr": "تكامل محلي",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "SKIP السابق ليس إغلاقًا.",
            "impactAr": "لا دليل HTTP وقاعدة.",
            "filesAr": [
              "marketplace.http.integration-tests.ts"
            ],
            "fixAr": "Postgres محلي وترحيل وحارس fixture.",
            "acceptanceAr": "نجح ثم حُذفت قاعدة الاختبار.",
            "resultAr": "HTTP مع Controller وPrisma.",
            "evidenceAr": "evidence/tests/rc4_api.txt",
            "remainingAr": "الترحيل غير مطبّق على الإنتاج.",
            "taskAr": "Postgres محلي وترحيل وحارس fixture."
          },
          {
            "id": "P2-RC4-07",
            "titleAr": "اتساق السجل",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "المرجع بقي على تسليم أقدم.",
            "impactAr": "المراجع لا يرى RC4.",
            "filesAr": [
              "discover-phases.json"
            ],
            "fixAr": "RC3 تمت مراجعته وRC4 بانتظار المراجعة.",
            "acceptanceAr": "1 من 5 معتمدة.",
            "resultAr": "فحص الموقع بعد التوليد.",
            "evidenceAr": "validate_package.py",
            "remainingAr": "اعتماد المرحلة يبقى للمراجع.",
            "taskAr": "RC3 تمت مراجعته وRC4 بانتظار المراجعة."
          },
          {
            "id": "P2-RC5-01",
            "titleAr": "إزالة مسار المصادقة الاختباري من حارس التشغيل",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T3"
            ],
            "status": "مقبول في مراجعة RC5",
            "problemAr": "فرع MIRA_AUTH_FIXTURE داخل FirebaseAuthGuard كان يقبل رموزًا من إعدادات دون استدعاء Firebase، ولا يمنع تفعيله في الإنتاج.",
            "impactAr": "نجاح التكامل لم يكن استبدال مزود التحقق فقط، بل مسار قبول داخل حارس التشغيل.",
            "filesAr": [
              "mira-api/src/common/guards/firebase-auth.guard.ts",
              "mira-api/src/common/auth/firebase-id-token-verifier.ts",
              "mira-api/src/common/common.module.ts",
              "mira-api/src/marketplace/marketplace.http.integration-tests.ts"
            ],
            "fixAr": "أُزيل الفرع وخريطة الرموز. الحارس يستخرج Bearer ويستدعي مزود FirebaseIdTokenVerifier ويربط الهوية الناتجة. التشغيل الافتراضي يستخدم FirebaseAdminIdTokenVerifier. الاختبار يستبدل المزود فقط داخل وحدة الاختبار.",
            "acceptanceAr": "غياب الترويسة وBearer الفارغ وغير الصالح مرفوضة. رفض المزود يرفض الطلب. نجاحه يربط هويته. جسم الطلب لا يختار حسابًا آخر. إعدادات fixture القديمة لا تفتح مسار قبول. حسابان عبر HTTP معزولان.",
            "resultAr": "اختبار HTTP على الحارس الحقيقي مع بديل المزود نجح، بما فيه رفض legacy-token رغم ضبط MIRA_AUTH_FIXTURE. هذا لا يثبت اتصال Firebase الحي.",
            "evidenceAr": "evidence/tests/rc5_api.txt. السطر الأخير يصرّح أن المزود بديل اختبار.",
            "remainingAr": "الاتصال بخدمة Firebase الحية غير مثبت. AUTH_SKIP للتطوير المحلي لم يُستخدم دليلًا. الإنتاج غير مختبر. قبول البند لا يعتمد المرحلة الثانية.",
            "taskAr": "إزالة مسار المصادقة الاختباري من حارس التشغيل."
          },
          {
            "id": "P2-RC5-02",
            "titleAr": "إغلاق تزامن المفضلة وإعادة القراءة",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T3"
            ],
            "status": "مقبول في مراجعة RC5",
            "problemAr": "مسار خطأ refresh لم يطبق تسلسل الكتابة، فقراءة قديمة تفشل بـ401 كانت تستطيع مسح حفظ أحدث. الواجهة تعرض التعذر دون إعادة قراءة.",
            "impactAr": "حالة حفظ مؤكدة تضيع أو تظهر كخطأ لم يعد يمثل الحالة الحالية.",
            "filesAr": [
              "lib/features/marketplace/data/discover_favorite_client.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "fixAr": "نجاح القراءة وخطأها وfinally يلتزمون بجيل الحساب والمراجعة وتسلسل القراءة. قراءة تبدأ أثناء كتابة معلقة لا تكتب فوق نتيجة الحفظ. قراءة أقدم لا تكتب فوق قراءة أحدث. أضيف زر إعادة قراءة المفضلة.",
            "acceptanceAr": "ست حالات: 401 متأخر، خطأ شبكة متأخر، كتابة ثم قراءة بترتيب متعاكس، قراءتان، تبديل الحساب والخروج وdispose، وإعادة القراءة من الواجهة.",
            "resultAr": "اختبارات العميل الحقيقي مع نقل موقوت نجحت على الحالة النهائية ورسالة الخطأ. إعادة القراءة تزيل التعذر.",
            "evidenceAr": "test/features/marketplace/discover_favorite_client_test.dart وdiscover_phase2_widget_test.dart ضمن evidence/tests/rc5_flutter.txt.",
            "remainingAr": "لا إثبات على جهاز. الإنتاج غير مختبر. قبول البند لا يعتمد المرحلة الثانية.",
            "taskAr": "إغلاق تزامن المفضلة وإتاحة إعادة القراءة."
          },
          {
            "id": "P2-RC5-03",
            "titleAr": "تثبيت موضع البحث",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "مقبول في مراجعة RC5",
            "problemAr": "عند خلو العروض أثناء التحميل كان يظهر TextField آخر في منتصف الشاشة ثم يعود البحث إلى الأعلى.",
            "impactAr": "موضع البحث والتركيز لا يثبتان بين التحميل والنتائج.",
            "filesAr": [
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "fixAr": "حقل بحث واحد في موضع علوي ثابت لحالات التحميل والنتائج والفراغ والفشل. حالة المحتوى تبقى في مساحتها. لا مشاركة للمفتاح بين حقلين مركبين معًا.",
            "acceptanceAr": "قياس الموضع قبل الطلب وأثناءه وبعده مع سطح وInsets ثابتين، واستمرار التركيز والنص والمؤشر، والفراغ والفشل وإعادة المحاولة، والسحب في منتصف الحركة وبعدها، وغياب استثناءات Flutter.",
            "resultAr": "اختبار الموضع نجح. لقطات RC5 حديثة مرفقة.",
            "evidenceAr": "evidence/visual/phase2/rc5-search-loading.png وrc5-search-empty.png وrc5-search-failed.png وrc5-search-results.png. الوصف في CAPTIONS.txt بتاريخ 2026-09-26.",
            "remainingAr": "اللقطات من محاكاة ودجت بحجم ثابت، وليست إثبات جهاز. اختبار الجوال مؤجل إلى المرحلة الخامسة. قبول البند لا يعتمد المرحلة الثانية.",
            "taskAr": "تثبيت البحث أثناء التحميل والفراغ والفشل."
          },
          {
            "id": "P2-RC5-04",
            "titleAr": "استكمال التكامل وقابلية إعادة التحقق",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "مقبول في مراجعة RC5",
            "problemAr": "حزمة RC4 لم تكفِ لإعادة اختبار HTTP، وبقي استدعاء toggleFavorite، ولم يُثبت أول حفظ متزامن ولا ترقية صفوف المخطط السابق، ولم يُرفق دليل بناء.",
            "impactAr": "المراجع لا يستطيع إعادة التحقق، وأول إنشاء متزامن لم يكن مثبتًا.",
            "filesAr": [
              "mira-api/src/marketplace/marketplace.service.ts",
              "mira-api/src/marketplace/marketplace.http.integration-tests.ts",
              "mira-api/src/marketplace/marketplace-favorites.integration-tests.ts",
              "mira-api/package.json",
              "mira-api/package-lock.json"
            ],
            "fixAr": "كل الحفظ عبر setFavorite. أول حفظين متزامنين لعنصر غير محفوظ ينتجان سجلًا واحدًا. الترقية تُدرج صفوفًا قبل ترحيل الكتالوج ثم تطبقه وتتحقق من المعرّف والسعر والتصنيف غير المعروف. البناء nest build مسجّل.",
            "acceptanceAr": "حسابان، حفظ وإزالة، أول إنشاء متزامن، إزالة متزامنة، إعادة الطلب نفسه، عنصر غائب وغير منشور، صفحات الكتالوج، وترقية صفوف سابقة.",
            "resultAr": "nest build خرج 0. اختبار HTTP خرج 0 على قاعدة محلية ثم حُذفت. SKIP لا يُحتسب نجاحًا.",
            "evidenceAr": "evidence/tests/rc5_build.txt وrc5_api.txt. سطر legacy-product legacy-rc5-product|3210|NULL.",
            "remainingAr": "الإنتاج غير مختبر والترحيل غير مطبّق عليه. بديل Firebase لا يثبت الخدمة الحية. قبول البند لا يعتمد المرحلة الثانية.",
            "taskAr": "استكمال التكامل والبناء وقابلية إعادة التحقق."
          },
          {
            "id": "P2-RC5-05",
            "titleAr": "إصلاح سكربت قاعدة الاختبار",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "متبقٍ — يُغلق عبر PH2-RC6",
            "problemAr": "اسم الإنشاء والحذف كان يمكن أن يفترق عن DATABASE_URL، والتنظيف لا يعمل عند الفشل بسبب set -e.",
            "impactAr": "فشل الاختبار يترك قاعدة، أو قد يُحذف هدف غير مقصود.",
            "filesAr": [
              "mira-api/scripts/run-marketplace-rc5-integration.sh"
            ],
            "fixAr": "الاسم والمضيف والمنفذ والدور والاتصال تُشتق من إعداد واحد. الاسم المسموح mira_ph2_rc5_test أو لاحقة اختبار على المضيف المحلي فقط. قاعدة موجودة مسبقًا تُرفض ولا تُحذف. التنظيف على النجاح والفشل والمقاطعة مع الإبقاء على رمز الخروج. لا eval ولا طباعة أسرار.",
            "acceptanceAr": "تشغيل ناجح، فشل متعمد، تغيير اسم مسموح، ورفض اسم أو مضيف غير مسموح دون حذف قاعدة أخرى.",
            "resultAr": "الرفض خرج 2 دون حذف mira_db. الفشل المتعمد خرج 1 وحذف قاعدة الجولة فقط. النجاح خرج 0 وحذف قاعدة الجولة.",
            "evidenceAr": "evidence/tests/rc5_db_checks.txt وrc5_db_fail.txt وrc5_api.txt.",
            "remainingAr": "مراجعة RC5 أبقت هذا البند. التصحيح في P2-RC6-01 ولم يُعتمد الإغلاق بعد.",
            "taskAr": "إصلاح سكربت قاعدة الاختبار."
          },
          {
            "id": "P2-RC5-06",
            "titleAr": "تصحيح الحالة الحالية في الموقع",
            "relatedTaskIds": [
              "P2-T1",
              "P2-T2",
              "P2-T3"
            ],
            "status": "مقبول في مراجعة RC5",
            "problemAr": "الموقع كان يعرض RC4 بانتظار المراجعة، وتختلط نتيجة المراجعة بالنص الحالي، وتبقى عبارة نفي اختبار القاعدة بعد تنفيذ الاختبار المحلي.",
            "impactAr": "المراجع لا يميز التسليم الحالي من نتيجة RC4.",
            "filesAr": [
              "docs/mira-commerce-reference/data/discover-phases.json",
              "docs/mira-commerce-reference/data/project.json",
              "docs/mira-commerce-reference/data/discover-visual.json",
              "docs/mira-commerce-reference/evidence/visual/phase2/CAPTIONS.txt"
            ],
            "fixAr": "RC5 هو التسليم الحالي بانتظار المراجعة. نتيجة RC4 تحت تسليمه مع بصمتها. actualAr وblockersAr يميزان الاختبار المحلي من الإنتاج غير المختبر. المعتمد يبقى 1 من 5.",
            "acceptanceAr": "لا جملة لا شيء متبقٍ لبند اختباره لم ينجح. البصمات السابقة لم تُبدَّل نتائجها.",
            "resultAr": "السجل يصف RC5 بانتظار المراجعة وRC4 كمراجعة غير معتمدة. المعتمد 1 من 5.",
            "evidenceAr": "validate_package.py بعد توليد البيانات. لقطات RC5 مؤرخة في CAPTIONS.txt.",
            "remainingAr": "اعتماد المرحلة الثانية يبقى قرار المراجع. هذه الجولة لا تعتمد المرحلة. قبول البند لا يعتمد المرحلة الثانية.",
            "taskAr": "تصحيح الحالة الحالية والأدلة في الموقع."
          },
          {
            "id": "P2-RC6-01",
            "titleAr": "تمرير المضيف والمنفذ إلى أوامر قاعدة الاختبار",
            "relatedTaskIds": [
              "P2-T1"
            ],
            "status": "مغلق باعتماد المرحلة الثانية",
            "problemAr": "السكربت يتحقق من DB_HOST وDB_PORT ولا يمررهما إلى psql وcreatedb وdropdb، فتستطيع إعدادات libpq الموروثة تغيير الهدف.",
            "impactAr": "أوامر الإدارة قد تصيب خادمًا غير الخادم الذي يستخدمه Prisma.",
            "taskAr": "إغلاق البند المتبقي P2-RC5-05 دون إعادة فتح البنود المقبولة.",
            "fixAr": "كل أمر إدارة يستخدم -h و-p و-U بعد إلغاء PGHOST وPGPORT وPGSERVICE وبقية متغيرات الاتصال الموروثة. فشل الاتصال يوقف السكربت. فشل الحذف لا يطبع cleaned.",
            "filesAr": [
              "mira-api/scripts/run-marketplace-rc6-integration.sh",
              "mira-api/scripts/run-marketplace-rc5-integration.sh"
            ],
            "resultAr": "print-admin تجاهل المضيف والمنفذ المتعارضين. prove-port توقف عند المنفذ 1 برمز 3. فشل التنظيف خرج 1 دون cleaned. التكامل المحلي خرج 0 وحذف قاعدة الجولة فقط.",
            "evidenceAr": "evidence/tests/rc6_proofs.txt وevidence/tests/rc6_api.txt وdeliveries/PH2-RC6.txt.",
            "remainingAr": "لا متبقٍ داخل نطاق المرحلة الثانية لهذا البند. الإنتاج والجوال خارج النطاق."
          }
        ]
      },
      {
        "id": "PH-3",
        "number": 3,
        "nameAr": "إدارة المحتوى وربط المتاجر",
        "goalAr": "تمكين التاجر والمنشأة من إدارة محتوى منتجاتهما وخدماتهما في البوابة الحالية، والإدارة من قرار النشر، واكتشفي من عرض المنشور فقط.",
        "inScopeAr": [
          "وسائط المنتج والخدمة في البوابة الحالية",
          "دورة المسودة والمراجعة والنشر والسحب",
          "استيراد داخلي موسوم عند غياب تكامل معتمد",
          "توثيق ملكية الحقول وقرار التاجر بلا متجر"
        ],
        "outOfScopeAr": [
          "دفع ومحفظة وتسويات وشحن وبث",
          "اتصال زد قبل تحقق الوثائق وبيانات الوصول",
          "ترحيل الإنتاج ونشر عام",
          "تشغيل الجوال والفيديو على الجهاز"
        ],
        "tasks": [
          {
            "id": "P3-T1",
            "nameAr": "إدارة الوسائط في بوابة الشركاء",
            "status": "بانتظار المراجعة"
          },
          {
            "id": "P3-T2",
            "nameAr": "الربط والمراجعة والنشر",
            "status": "بانتظار المراجعة"
          },
          {
            "id": "P3-T3",
            "nameAr": "الاستيراد والمزامنة ضمن الحد المعتمد",
            "status": "بانتظار المراجعة"
          }
        ],
        "expectedAr": "رحلة محتوى مثبتة على البوابة والإدارة والكتالوج، واستيراد لا يكرر الصفوف، دون مصدر سعر ثانٍ.",
        "actualAr": "مراجع RC6 قبل التصحيحات البرمجية وأدلة التحقق المحلي. التخزين على مورد فعلي لم يُتحقق منه. المرحلة ليست معتمدة بالكامل.",
        "status": "مقبولة برمجيًا ضمن النطاق المراجع — بانتظار إغلاق التخزين الدائم",
        "dependenciesAr": "البوابة والكتالوج الحاليان. لا تكامل زد معتمد. قرار DEC-0007 ما زال مفتوحًا.",
        "notesAr": "اعتماد المرحلة الثانية لا يفتح من جديد بسبب إصلاحات وسائط المرحلة الثالثة. الاستيراد المحاكى ليس تكامل متجر.",
        "blockersAr": "مانع الإطلاق PH3-STORAGE-LIVE مفتوح. حالته تُقرأ من السجل الواحد.",
        "acceptanceAr": "رحلات الوسائط والمراجعة والنشر والسحب وعزل الجهات والاستيراد الموسوم مثبتة باختبار HTTP على قاعدة محلية، والمسودة لا تتسرب إلى الخلاصة.",
        "evidenceIds": [],
        "reviewPackage": "deliveries/PH3-RC6.txt",
        "verificationReport": "deliveries/PH3-RC6.txt",
        "reviewResultAr": "RC6 مقبول برمجيًا. التحقق المحلي من التوقيع مقبول. المورد الفعلي غير متحقق. ليس اعتمادًا كاملًا.",
        "reviewDate": "2026-09-27",
        "affectedFilesAr": [
          "mira-api/src/marketplace/catalog-content.service.ts",
          "mira-api/src/marketplace/catalog-media.storage.ts",
          "mira-api/src/partners-portal/partners-portal.service.ts",
          "mira-api/prisma/schema.prisma",
          "partners-portal/web/dashboard.html",
          "admin-portal/web/css/admin.css",
          "admin-portal/web/js/app.js"
        ],
        "reviewPackageLabel": "سجل المرحلة الثالثة PH3-RC4",
        "verificationReportLabel": "أدلة PH3-RC4 داخل الموقع",
        "approvalAr": "مقبولة برمجيًا — ليست اعتمادًا كاملًا",
        "deliveries": [
          {
            "id": "DEL-PH3-RC1",
            "name": "MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6.zip",
            "createdAt": "2026-09-26T08:10:00+03:00",
            "deliveryStatus": "تمت مراجعته — غير معتمد",
            "logHref": "deliveries/PH3-RC1.txt",
            "logLabel": "سجل PH3-RC1",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6.zip",
            "zipLabel": "الحزمة المشتركة",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6.zip.sha256.txt",
            "sha256Label": "بصمة الحزمة المشتركة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC1_WITH_PHASE2_RC6_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة المشتركة",
            "sha256": "adcdf63b8917783df7d3168e3b982b0d380be3cda14d682108e69783a0de15ea",
            "reviewResultAr": "لم تُعتمد المرحلة الثالثة. بقيت ملاحظات الحقن، وفصل المسودة، وقرارات النشر، وعقد الوسائط، والمعاينة، وتزامن الاستيراد، وإثبات التخزين، وقابلية تركيب الحزمة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH3-RC2",
            "name": "MIRA_DISCOVER_PHASE3_RC2.zip",
            "createdAt": "2026-09-26T23:40:00+03:00",
            "deliveryStatus": "تمت مراجعته — غير معتمد",
            "logHref": "deliveries/PH3-RC2.txt",
            "logLabel": "سجل PH3 RC2",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC2.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE3_RC2.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC2.zip.sha256.txt",
            "sha256Label": "بصمة RC2 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC2_VERIFICATION.txt",
            "verificationLabel": "تحقق RC2",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "المراجعة المستقلة لم تعتمد RC2 وطلبت تصحيح RC3. نصوص نتائج البنود الثمانية بقيت كما سُلّمت.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH3-RC3",
            "name": "MIRA_DISCOVER_PHASE3_RC3.zip",
            "createdAt": "2026-09-27T00:40:00+03:00",
            "deliveryStatus": "تمت مراجعته — غير معتمد",
            "logHref": "deliveries/PH3-RC3.txt",
            "logLabel": "سجل PH3 RC3",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC3.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE3_RC3.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC3.zip.sha256",
            "sha256Label": "بصمة RC3 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC3_VERIFICATION.txt",
            "verificationLabel": "تحقق RC3",
            "sha256": "fa92fa699f32e34759be3ab105cdd4fa00622aad5c16506f8f376f6939d68350",
            "reviewResultAr": "المراجعة المستقلة لم تعتمد RC3 وطلبت تصحيح RC4. نصوص نتائج بنود RC3 بقيت كما سُلّمت.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH3-RC4",
            "name": "MIRA_DISCOVER_PHASE3_RC4.zip",
            "createdAt": "2026-09-27T01:35:00+03:00",
            "deliveryStatus": "تمت مراجعته — غير معتمد",
            "logHref": "deliveries/PH3-RC4.txt",
            "logLabel": "سجل PH3 RC4",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC4.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE3_RC4.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC4.zip.sha256",
            "sha256Label": "بصمة RC4 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC4_VERIFICATION.txt",
            "verificationLabel": "تحقق RC4",
            "sha256": "d42df99bbe6f3819ade9efed70c8f8eff989fd00af22bdd18519d2885ef37a80",
            "reviewResultAr": "المراجع قبل P3-RC4-01 وP3-RC4-02 وP3-RC4-03 وP3-RC4-05. P3-RC4-04 بقي غير مغلق. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس. نصوص نتائج البنود بقيت كما سُلّمت.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH3-RC5",
            "name": "MIRA_DISCOVER_PHASE3_RC5.zip",
            "createdAt": "2026-09-27T02:00:00+03:00",
            "deliveryStatus": "تمت مراجعته — منع المحلي مقبول والتخزين الفعلي غير مثبت",
            "logHref": "deliveries/PH3-RC5.txt",
            "logLabel": "سجل PH3 RC5",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC5.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE3_RC5.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC5.zip.sha256",
            "sha256Label": "بصمة RC5 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC5_VERIFICATION.txt",
            "verificationLabel": "تحقق RC5",
            "sha256": "f30b475b54bfbddaa75f59e0c4f93b8a630bfad41a0c504377e51ca2f66042fe",
            "reviewResultAr": "المراجع قبل إصلاح منع التخزين المحلي في الإنتاج. بنود RC4 الأربعة 01 و02 و03 و05 تبقى مقبولة. محوّل S3 مرشح وتوافقه مع مزود فعلي غير مثبت. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH3-RC6",
            "name": "MIRA_DISCOVER_PHASE3_RC6.zip",
            "createdAt": "2026-09-27T02:25:00+03:00",
            "deliveryStatus": "تمت مراجعته — مقبول برمجيًا والتخزين الفعلي غير مغلق",
            "logHref": "deliveries/PH3-RC6.txt",
            "logLabel": "سجل PH3 RC6",
            "zipHref": "../../MIRA_DISCOVER_PHASE3_RC6.zip",
            "zipLabel": "MIRA_DISCOVER_PHASE3_RC6.zip",
            "sha256Href": "../../MIRA_DISCOVER_PHASE3_RC6.zip.sha256",
            "sha256Label": "بصمة RC6 خارج الحزمة",
            "verificationHref": "../../MIRA_DISCOVER_PHASE3_RC6_VERIFICATION.txt",
            "verificationLabel": "تحقق RC6",
            "sha256": "4e7751e7179b32f6d43bc88e8a6c341857694fec3d14c352b847789188372f63",
            "reviewResultAr": "المراجع قبل تصحيحات RC6 البرمجية وأدلة التحقق المحلي. بنود RC4 الأربعة المقبولة بقيت مقبولة. منع التخزين المحلي في RC5 بقي مقبولًا. التحقق من المورد الفعلي لم يُنفذ.",
            "approvalAr": "مقبولة برمجيًا — ليست اعتمادًا كاملًا"
          }
        ],
        "corrections": [
          {
            "id": "P3-RC2-01",
            "titleAr": "منع حقن HTML في البوابة والإدارة",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "اسم المنتج وملاحظات المراجعة تُدرج في innerHTML.",
            "impactAr": "يمكن أن يصبح اسم أو ملاحظة عنصر HTML أو معالج حدث.",
            "taskAr": "منع حقن HTML في البوابة والإدارة",
            "fixAr": "عرض نصوص الشريك عبر textContent أو عقد DOM، لا عبر حد الطول ولا CSP وحدها.",
            "filesAr": [
              "partners-portal/web/dashboard.html",
              "admin-portal/web/js/app.js"
            ],
            "acceptanceAr": "نص فيه وسوم واقتباس يظهر كنص في البوابة والإدارة دون عناصر إضافية.",
            "resultAr": "نصوص الكتالوج وملاحظات المراجعة وطلبات الانضمام تُعرض عبر textContent. في اللقطة المحلية ظهر الاسم «<img src=x onerror=alert(1)> مسودة \"اقتباس\"» كنص، وعدد عناصر img ذات src=x كان صفرًا في البوابة والإدارة.",
            "evidenceAr": "اختبار المتصفح على قاعدة mira_ph3_rc2_shot المحذوفة بعد اللقطة. evidence/visual/phase3/ph3-rc2-partner.png وph3-rc2-admin.png. لوحة الالتقاط 660×445، والبطاقة صُغّرت داخل جلسة الالتقاط فقط حتى تظهر الأزرار.",
            "remainingAr": "لا متبقٍ داخل هذا البند. المراجعة المستقلة لم تُعتمد بعد."
          },
          {
            "id": "P3-RC2-02",
            "titleAr": "فصل المسودة عن النسخة المنشورة",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "إرسال المراجعة ورفضها وطلب إزالة الوسيط يغيّران ما يراه العام.",
            "impactAr": "المنشور يختفي أو يتغير قبل الاعتماد.",
            "taskAr": "فصل المسودة عن النسخة المنشورة",
            "fixAr": "حالة المراجعة منفصلة عن إتاحة النسخة المنشورة. الترتيب والرئيسي والإزالة تبقى مسودة حتى الاعتماد.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-content.service.ts",
              "prisma/schema.prisma"
            ],
            "acceptanceAr": "منتج وخدمة: تعديل ثم إرسال ثم رفض ثم إعادة إرسال ثم اعتماد، والخلاصة والمتجر والتفاصيل تبقى على النسخة المنشورة حتى الاعتماد.",
            "resultAr": "contentStatus يبقى حالة النسخة المنشورة، وreviewStatus حالة المراجعة. اختبار HTTP على منتج وخدمة: التعديل والإرسال والرفض لا يغيّران الاسم العام، وطلب إزالة الوسيط المنشور يبقى متاحًا حتى الاعتماد، ثم ينتقل الاسم والترتيب والحذف مع بقاء المعرف نفسه.",
            "evidenceAr": "ph3 content http passed ضمن scripts/run-marketplace-rc6-integration.sh على قاعدة mira_ph2_rc6_test ثم حُذفت. الصف السابق بقي legacy-rc5-product|3210|NULL|published.",
            "remainingAr": "لا متبقٍ داخل هذا البند. السعر يبقى على الصف نفسه وليس مصدرًا موازيًا."
          },
          {
            "id": "P3-RC2-03",
            "titleAr": "ضبط قرارات المراجعة والنشر والسحب",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "القرار الغائب يُعامل اعتمادًا، ويمكن اعتماد بلا وسائط، وروابط الوسائط تبقى بعد السحب.",
            "impactAr": "نشر جزئي أو نجاح وهمي.",
            "taskAr": "ضبط قرارات المراجعة والنشر والسحب",
            "fixAr": "رفض القرار غير المعروف، وربط القرار بنسخة المعاينة، وإعادة فحص الوسائط، وسجل بمفتاح الإدارة لا باسم شخص.",
            "filesAr": [
              "catalog-content.service.ts",
              "catalog-media.controller.ts",
              "catalog-review.admin.controller.ts"
            ],
            "acceptanceAr": "قرار فارغ، قرار مجهول، اعتماد قبل الإرسال، بلا وسيط، تغيير أثناء المراجعة، تكرار القرار، والسحب.",
            "resultAr": "القرار الفارغ وغير المعروف يرجع 400 دون كتابة. الاعتماد قبل الإرسال أو بلا صورة يرجع 400. تغيير المسودة أثناء المراجعة يرجع 409. تكرار الاعتماد يرجع alreadyApplied. السحب يجعل رابط الوسيط العام 404. السجل يستخدم admin-key لا اسم مستخدم.",
            "evidenceAr": "نفس اختبار HTTP للمحتوى. فشل الكتابة داخل معاملة الاعتماد لا يحذف ملف المنشور؛ اختبار التخزين المحلي أكد بقاء الملف بعد رفض المسودة.",
            "remainingAr": "لا هوية مستخدم إداري فردية في المصادقة الحالية. المفتاح المشترك هو الفاعل المسجّل."
          },
          {
            "id": "P3-RC2-04",
            "titleAr": "عقد وسائط اكتشفي",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "الرابط النسبي يصل إلى الصورة والفيديو كأصل محلي.",
            "impactAr": "الوسيط لا يُعرض من API.",
            "taskAr": "عقد وسائط اكتشفي",
            "fixAr": "حل الرابط على أصل عنوان API قبل العرض، مع الترتيب والرئيسي وفشل التحميل دون صورة مولدة.",
            "filesAr": [
              "lib/features/marketplace/data"
            ],
            "acceptanceAr": "استجابة كتالوج فعلية تمر إلى طبقة البيانات والعارض.",
            "resultAr": "روابط /api/v1/marketplace/media تُحل على أصل عنوان API قبل الصورة والفيديو. اختبار Flutter مرّر شكل استجابة الكتالوج إلى MarketplaceApiDataSource ثم DiscoverPresentationScreen: الرابط مطلق، بلا تكرار /api/v1، والفيديو ليس أصلًا محليًا، والصورة NetworkImage.",
            "evidenceAr": "flutter test test/features/marketplace/catalog_media_url_test.dart نجح. فشل التحميل في الشاشة يعرض «تعذر تحميل الصورة» وإعادة المحاولة ولا يستبدل الوسيط بصورة مولدة. هذا الاختبار لم يفرض فشل شبكة حيًا.",
            "remainingAr": "تشغيل المشغل الحقيقي على الجوال يبقى في المرحلة الخامسة."
          },
          {
            "id": "P3-RC2-05",
            "titleAr": "معاينة وتحرير الواجهة",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "الإدارة تعرض JSON والبوابة لا تكمل رحلة التحرير.",
            "impactAr": "المراجع لا يرى المحتوى.",
            "taskAr": "معاينة وتحرير الواجهة",
            "fixAr": "معاينة مرئية وفرق المسودة وسبب الرفض وأزرار متاحة.",
            "filesAr": [
              "dashboard.html",
              "admin-portal/web/js/app.js"
            ],
            "acceptanceAr": "رحلة متصفح كاملة.",
            "resultAr": "بوابة الشريك تعرض الوسائط عند الفتح، والفرق بين المنشور والمسودة، والترتيب والرئيسي والإزالة. الإدارة تعرض معاينة صورة لا JSON، والاسم المنشور والتعديل المطلوب، وأزرار المعاينة والاعتماد والرفض.",
            "evidenceAr": "لقطتا ph3-rc2-partner.png وph3-rc2-admin.png من بوابة محلية وAPI محلي وقاعدة محذوفة. ليست لقطة طابور فارغ.",
            "remainingAr": "المراجعة المستقلة. مقاس أداة الالتقاط 660×445؛ الواجهة نفسها تستخدم تخطيط البوابة الحالي."
          },
          {
            "id": "P3-RC2-06",
            "titleAr": "سلامة الاستيراد وإعادة المحاولة",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "استيرادان متزامنان ينشئان منتجين.",
            "impactAr": "صف يتيم أو مكرر.",
            "taskAr": "سلامة الاستيراد وإعادة المحاولة",
            "fixAr": "قفل ومعاملة وربط فريد وإعادة محاولة الوسائط الناقصة. المحاكاة تبقى simulated.",
            "filesAr": [
              "catalog-content.service.ts"
            ],
            "acceptanceAr": "تزامن، فشل الربط، فشل وسيط، إعادة محاولة، 50 و200.",
            "resultAr": "استيرادان متزامنان للمعرف نفسه أنتجا ربطًا واحدًا. الفشل قبل الربط لم يترك منتجًا يتيمًا. إعادة المحاولة أضافت الوسيط الناقص فقط. دفعتا 50 و200، وتغير التوفر في الاتجاهين، والحذف، وفشل المزامنة دون تصفير السعر. الاستجابة mode=simulated وconnected=false.",
            "evidenceAr": "اختبار HTTP للمحتوى. المصدر موسوم simulated وليس تكامل متجر.",
            "remainingAr": "لا تكامل زد. PLC-0010 غير متحقق. DEC-0007 غير محسوم ولم تُنشأ محفظة أو طلبات."
          },
          {
            "id": "P3-RC2-07",
            "titleAr": "إثبات التخزين المحلي الفعلي",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "اختبار الذاكرة لا يثبت التخزين.",
            "impactAr": "لا دليل على بقاء الملف.",
            "taskAr": "إثبات التخزين المحلي الفعلي",
            "fixAr": "رفع HTTP عبر التخزين المحلي وقراءته من عملية ثانية، دون حذف المنشور عند رفض المسودة.",
            "filesAr": [
              "catalog-media.storage.ts"
            ],
            "acceptanceAr": "سجل يفصل الذاكرة عن التخزين المحلي عن الإنتاج غير المختبر.",
            "resultAr": "اختبار HTTP منفصل استخدم LocalCatalogMediaStorage في مجلد مؤقت. رُفعت صورة PNG وفيديو mp4 اختباري عبر مسار البوابة. الملف قُرئ بعد إغلاق العملية وفتح خدمة جديدة. الرفض لم يحذف ملف المنشور. السحب أخفى الرابط العام وأبقى الملف. الملف غير الصالح رُفض ولم يُحفظ.",
            "evidenceAr": "السجل يفصل: اختبار المحتوى يستخدم ذاكرة، واختبار catalog-storage.http.integration-tests.ts يستخدم التخزين المحلي، والإنتاج لم يُختبر. المسار المحلي MIRA_MEDIA_DIR أو mira-api/var/catalog-media وهو متجاهل ويفنى على Render.",
            "remainingAr": "لا تحقق من تخزين الإنتاج. المجلد المؤقت حُذف بعد الاختبار."
          },
          {
            "id": "P3-RC2-08",
            "titleAr": "الحزمة والأدلة والسجل",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "بانتظار المراجعة",
            "problemAr": "التركيب لا يوضح سلسلة الاعتماد، والسجل يدّعي سلوكًا لم يثبت.",
            "impactAr": "المراجع لا يعيد التحقق.",
            "taskAr": "الحزمة والأدلة والسجل",
            "fixAr": "خطوات تركيب على الأساس والبصمات السابقة، والمرحلة الثالثة بانتظار المراجعة.",
            "filesAr": [
              "deliveries وdiscover-phases.json"
            ],
            "acceptanceAr": "فحص حزمة مستقل.",
            "resultAr": "سجل الموقع يقول مرحلتان من خمس. PH3 RC1 تاريخ «تمت مراجعته — غير معتمد». هذا التسليم بانتظار المراجعة ولم تُعتمد المرحلة الثالثة من داخل التنفيذ. ادعاء RC1 بأن الرفض يبقي المنشور أو أن المعاينة مكتملة أُلغي؛ السلوك الجديد مثبت بالاختبار.",
            "evidenceAr": "deliveries/PH3-RC2.txt وPH3-RC2-RUN.txt. سلسلة التركيب: الأساس 15fe65c40d3dedb9afdd95619f2945bd84cb616a ثم RC5 74ba49c4dcaa334f6c35ecf415a0e6353ca18dc4e752a985eb0e4a0de1e968d5 ثم الحزمة adcdf63b8917783df7d3168e3b982b0d380be3cda14d682108e69783a0de15ea ثم ملفات RC2 في هذه الحزمة.",
            "remainingAr": "المراجعة المستقلة للحزمة. بصمة ZIP تُحسب خارج الحزمة بعد إغلاقها."
          },
          {
            "id": "P3-RC3-01",
            "titleAr": "اعتماد النسخة التي راجعتها الإدارة",
            "relatedTaskIds": [
              "P3-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "الاستيراد يغيّر اسم المسودة دون زيادة رقم المراجعة، وفحص النسخة يحدث قبل معاملة النشر.",
            "goalAr": "ربط الإرسال والمعاينة والقرار بنسخة محددة داخل معاملة محمية من التزامن للمنتجات والخدمات والوسائط.",
            "impactAr": "يمكن اعتماد رقم قديم ونشر اسم أو وسائط لم تُعاين.",
            "taskAr": "اعتماد النسخة التي راجعتها الإدارة",
            "fixAr": "قفل الصف وزيادة رقم المراجعة داخل معاملة التغيير، وقرار مشروط على النسخة نفسها. النسخة القديمة ترجع 409. تكرار القرار لا ينشر مسودة أحدث. فشل المعاملة يبقي المنشور السابق. تنظيف التخزين بعد الالتزام.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-content.service.ts",
              "mira-api/src/partners-portal/partners-portal.service.ts"
            ],
            "acceptanceAr": "409 بعد تغيير الاسم أو الوسائط، وتزامن التعديل والاعتماد، وتزامن القرار والسحب، وفشل داخل معاملة النشر، وتكرار القرار، على المنتجات والخدمات.",
            "resultAr": "قفل الصف وزيادة رقم المراجعة داخل معاملة التغيير. قرار مشروط يرجع 409 للنسخة القديمة. فشل الكتابة داخل المعاملة أبقى المراجعة والمنشور. تكرار الاعتماد لم يزد سجل الاعتماد ولم ينشر المسودة الأحدث. تزامن القفل ثم الاعتماد رجع 409 وأبقى الاسم المنشور. تزامن الاعتماد والسحب انتهى بسحب بلا ظهور عام. نُفذ على منتج وخدمة.",
            "evidenceAr": "evidence/ph3-rc3/rc3-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc3/rc3-integration.log",
                "label": "سجل اختبار HTTP"
              }
            ],
            "remainingAr": "المراجعة المستقلة. لا اعتماد للمرحلة."
          },
          {
            "id": "P3-RC3-02",
            "titleAr": "منع اعتماد نسخة تُجلب لحظة الضغط",
            "relatedTaskIds": [
              "P3-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "زر الاعتماد يجلب أحدث معاينة ثم يعتمدها، وقد تختلف عما شاهده المراجع.",
            "goalAr": "إرسال رقم النسخة التي اكتمل عرضها فقط، وإيقاف القرار عند 409 حتى معاينة جديدة وضغط مستقل.",
            "impactAr": "المراجع قد يعتمد محتوى لم يره.",
            "taskAr": "منع اعتماد نسخة تُجلب لحظة الضغط",
            "fixAr": "تخزين رقم النسخة بعد اكتمال العرض. الاعتماد والرفض يرسلان هذا الرقم ولا يستدعيان جلبًا جديدًا داخل الضغط. 409 يوقف القرار. الأزرار معطلة أثناء التحميل وإذا فشلت المعاينة.",
            "filesAr": [
              "admin-portal/web/js/app.js",
              "admin-portal/web/js/api.js"
            ],
            "acceptanceAr": "اختبار واجهة: تغيير المسودة بعد المعاينة لا يعتمد النسخة الجديدة، وإعادة المعاينة تتطلب ضغط اعتماد مستقل.",
            "resultAr": "الواجهة خزنت رقم النسخة 4 بعد اكتمال العرض. تغيير المسودة ثم ضغط الاعتماد أظهر أن المحتوى تغير ويحتاج معاينة جديدة، وبقي الاسم المنشور فستان اختبار RC3. إعادة المعاينة لم تنشر. ضغط اعتماد مستقل بعد المعاينة الجديدة نشر اسم لم يُعاين على المعرف نفسه.",
            "evidenceAr": "evidence/ph3-rc3/admin-preview.png ؛ evidence/ph3-rc3/admin-conflict.png ؛ evidence/ph3-rc3/ui-assertions.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc3/admin-preview.png",
                "label": "معاينة الإدارة 1280"
              },
              {
                "href": "evidence/ph3-rc3/admin-conflict.png",
                "label": "تعارض 409 بعد تغيّر المسودة"
              },
              {
                "href": "evidence/ph3-rc3/ui-assertions.txt",
                "label": "نتيجة اختبار الواجهة"
              }
            ],
            "remainingAr": "لم يُشغَّل على جوال. شريط الإدارة الحالي بعرض 480 يغطي جزءًا من البطاقة؛ لقطة الشريك الضيقة تعرض النموذج كاملًا."
          },
          {
            "id": "P3-RC3-03",
            "titleAr": "استكمال التخزين والرفع بأدلة حقيقية",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "اختبار الفيديو السابق استخدم ترويسة MP4 قصيرة وليست فيديو قابلًا للتشغيل، وحدود الطلب وفشل التخزين لم تُثبت بما يكفي.",
            "goalAr": "إثبات صورة صالحة وفيديو MP4 قابل للفك، وحدود 5MB و20MB، ورفض النوع غير الصالح، وفشل الكتابة، وبقاء الملف عبر عملية جديدة، وعزل المسودة والسحب.",
            "impactAr": "دليل الرفع لا يثبت صلاحية الملف ولا استدامة التخزين.",
            "taskAr": "استكمال التخزين والرفع بأدلة حقيقية",
            "fixAr": "فحص moov لا الترويسة وحدها. حد JSON للوسائط يغطي توسعة base64 دون رفع حد كل الطلبات. تمييز فشل القراءة عن غياب الملف في السجل الداخلي دون تسريب المسار.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-content.policy.ts",
              "mira-api/src/main.ts",
              "mira-api/src/marketplace/catalog-media.storage.ts",
              "mira-api/src/marketplace/fixtures/ph3-rc3-sample.mp4",
              "mira-api/src/marketplace/fixtures/ph3-rc3-sample.png"
            ],
            "acceptanceAr": "ملف صالح، والحد، وما يتجاوزه، ونوع مرفوض، وفشل كتابة بلا صف ناجح، وبقاء الملف بعد عملية جديدة، ومسودة غير عامة، وسحب يحجب الرابط.",
            "resultAr": "عينة MP4 من ffmpeg lavfi testsrc اجتازت ffprobe، وترويسة ftyp وحدها رُفضت. حدود الصورة 5MB والفيديو 20MB وما يتجاوزها رُفض، وطلب أكبر من حد JSON رجع 413. فشل الكتابة لم يزد صفوف الوسائط. فشل القراءة وسجل catalog-media-read-failed، وغياب الملف سجل catalog-media-missing، بلا مسار في رد المستخدم. الملف قُرئ بعد إغلاق العملية. المسودة غير عامة والسحب يحجب الرابط مع بقاء الملف. فشل تنظيف التخزين بعد الالتزام أرجع النشر مع cleanupPending.",
            "evidenceAr": "evidence/ph3-rc3/rc3-integration.log ؛ evidence/ph3-rc3/admin-preview.png",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc3/rc3-integration.log",
                "label": "سجل الحدود والتخزين"
              },
              {
                "href": "evidence/ph3-rc3/admin-preview.png",
                "label": "معاينة الصورة والفيديو الاختباريين"
              }
            ],
            "remainingAr": "التخزين المحلي المختبر ليس تخزين إنتاج دائمًا. لا مجلد Render ولا خدمة تخزين مدفوعة. لا اختبار جوال."
          },
          {
            "id": "P3-RC3-04",
            "titleAr": "عزل الاستيراد التجريبي عن الكتالوج العام",
            "relatedTaskIds": [
              "P3-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "وسم simulated لا يمنع اعتماد المنتج وظهوره للجمهور كمنتج حقيقي.",
            "goalAr": "تعطيل الاستيراد التجريبي في الإنتاج على الخادم، وإبقاء السجلات التجريبية خارج كل المسارات العامة حتى بعد الاعتماد الإداري.",
            "impactAr": "منتج تجريبي قد يظهر في الخلاصة والبحث والمتجر والتفاصيل والمطابقة والوسائط.",
            "taskAr": "عزل الاستيراد التجريبي عن الكتالوج العام",
            "fixAr": "catalogSource يبقى simulated ولا يتحول بالاعتماد. الاستعلامات العامة تشترط catalog. الاستيراد التجريبي مرفوض عندما NODE_ENV=production ما لم يُسمح صراحة للاختبار.",
            "filesAr": [
              "mira-api/prisma/schema.prisma",
              "mira-api/prisma/migrations/20260927013000_discover_content_ph3_rc3/migration.sql",
              "mira-api/src/marketplace/catalog-content.service.ts",
              "mira-api/src/marketplace/marketplace.service.ts"
            ],
            "acceptanceAr": "رفض الاستيراد في إعداد الإنتاج. سجل معتمد سابق لا يظهر عامًا. 50 و200 بلا تكرار. تزامن المعرف والوسائط. إعادة محاولة الوسائط. التوفر لا يعيد نشر ما سحبته الإدارة.",
            "resultAr": "الاستيراد عند NODE_ENV=production رجع 403. سجل simulated معتمد بقي خارج الخلاصة والبحث والمتجر والتفاصيل والمطابقة والوسائط العامة. دفعات 50 و200 لم تكرر الصفوف. طلبان متزامنان بمعرف ووسيط أنتجا ربطًا واحدًا ووسيطًا واحدًا. التوفر بعد السحب الإداري لم يعد النشر. السعر المرتبط لم يتغير بتحرير الشريك.",
            "evidenceAr": "evidence/ph3-rc3/rc3-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc3/rc3-integration.log",
                "label": "سجل عزل الاستيراد"
              }
            ],
            "remainingAr": "لا تكامل زد أو منصة فعلية. DEC-0007 غير محسوم."
          },
          {
            "id": "P3-RC3-05",
            "titleAr": "تحرير العناصر القائمة في بوابة الشريك",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "البوابة لا تفتح تعديلًا لعنصر قائم، فيضطر المسار إلى إنشاء عنصر جديد أو لا يُظهر المسودة.",
            "goalAr": "تعديل المنتج والخدمة على المعرف نفسه، وحفظ المسودة مع بقاء المنشور، وإظهار الحالة وسبب الرفض بعد العودة.",
            "impactAr": "الشريك لا يكمل دورة المراجعة على عنصر موجود.",
            "taskAr": "تحرير العناصر القائمة في بوابة الشريك",
            "fixAr": "زر تعديل يحمّل القيم من الخادم ويحفظ PATCH على المعرف نفسه. السعر المرتبط خارجيًا لا يُستبدل بتحرير الشريك. النص عبر textContent.",
            "filesAr": [
              "partners-portal/web/dashboard.html",
              "mira-api/src/partners-portal/partners-portal.service.ts"
            ],
            "acceptanceAr": "تعديل منتج وخدمة ثم الحفظ والعودة والإرسال. الرفض يبقي المنشور. الاعتماد يغيّر المعرف نفسه. شريك آخر ممنوع. الوسوم تظهر نصًا.",
            "resultAr": "زر تعديل حمّل القيم وميّز المنشور عن المسودة. الحفظ أبقى المعرف. بعد الخروج والعودة ظهرت المسودة من الخادم ثم أُرسلت للمراجعة. رفض الخدمة أبقى الاسم المنشور وأظهر سبب الرفض. اعتماد النسخة المعروضة غيّر الاسم على المعرف نفسه. شريك آخر لم ير العناصر. الاسم الذي فيه وسم واقتباس ظهر نصًا ولم تُنشأ صورة ولم يُطلق تنبيه.",
            "evidenceAr": "evidence/ph3-rc3/partner-desktop.png ؛ evidence/ph3-rc3/partner-edit.png ؛ evidence/ph3-rc3/partner-narrow.png ؛ evidence/ph3-rc3/partner-service-reject.png ؛ evidence/ph3-rc3/admin-narrow.png",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc3/partner-desktop.png",
                "label": "بوابة الشريك 1280"
              },
              {
                "href": "evidence/ph3-rc3/partner-edit.png",
                "label": "نموذج التعديل"
              },
              {
                "href": "evidence/ph3-rc3/partner-narrow.png",
                "label": "بوابة الشريك بعرض 480"
              },
              {
                "href": "evidence/ph3-rc3/partner-service-reject.png",
                "label": "رفض التعديل مع بقاء المنشور"
              },
              {
                "href": "evidence/ph3-rc3/admin-narrow.png",
                "label": "الإدارة بعرض 480"
              }
            ],
            "remainingAr": "فتح الرابط ليس شراءً وطلب الموعد ليس حجزًا. لا تشغيل جوال."
          },
          {
            "id": "P3-RC3-06",
            "titleAr": "أدلة مرئية وسجل موقع قابلان للتحقق",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2",
              "P3-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "لقطات RC2 صُغّرت لتناسب لوحة الالتقاط، وأدلتها لا تكفي لإثبات المعاينة والتعارض.",
            "goalAr": "أدلة داخل الموقع بروابط صحيحة، ولقطات بالحجم الطبيعي لعرض مكتبي وعرض ضيق، دون تصغير البطاقة.",
            "impactAr": "المراجع لا يتحقق من الواجهة التي رآها المستخدم.",
            "taskAr": "أدلة مرئية وسجل موقع قابلان للتحقق",
            "fixAr": "تسجيل RC3 داخل بطاقة المرحلة الثالثة مع إبقاء تاريخ RC1 وRC2. اللقطات تُلتقط بنافذة حقيقية لا بتصغير DOM.",
            "filesAr": [
              "docs/mira-commerce-reference/data/discover-phases.json",
              "docs/mira-commerce-reference/js/app.js"
            ],
            "acceptanceAr": "فحص الموقع المستقل، وفهارس الملفات، ولقطات البوابة والإدارة، وبيانات اختبار موسومة وليست لتاجر حقيقي.",
            "resultAr": "الأدلة داخل الموقع ومربوطة من البنود. اللقطات بنافذة 1280 و480 دون تصغير البطاقة. بيانات الاختبار موسومة بيانات اختبار RC3 وليست لتاجر. فحص الموقع يُشغَّل مع هذا التسليم. بصمة ZIP تُحسب خارج الحزمة.",
            "evidenceAr": "deliveries/PH3-RC3.txt ؛ evidence/ph3-rc3/ui-assertions.txt",
            "evidenceLinks": [
              {
                "href": "deliveries/PH3-RC3.txt",
                "label": "سجل التسليم"
              },
              {
                "href": "evidence/ph3-rc3/ui-assertions.txt",
                "label": "أبعاد اللقطات ونتائج الواجهة"
              }
            ],
            "remainingAr": "المراجعة المستقلة للحزمة. المعتمد يبقى 2 من 5."
          },
          {
            "id": "P3-RC4-01",
            "titleAr": "تزامن عمليات الوسائط",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2"
            ],
            "status": "مقبول من المراجع المستقل",
            "problemAr": "removeMedia يقرأ حالة النشر قبل قفل العنصر، فيحذف وسيطًا نُشر أثناء الانتظار. reorder وsetPrimary يستخدمان حالة مقروءة قبل القفل.",
            "goalAr": "إعادة قراءة العنصر والوسائط بعد القفل، وجعل تعديل المنشور مسودة مراجعة، وحذف ملف التخزين بعد التزام المعاملة فقط.",
            "impactAr": "يمكن حذف وسيط منشور وملفه، أو تغيير ترتيب المنشور دون مراجعة.",
            "taskAr": "تزامن عمليات الوسائط",
            "fixAr": "القفل أولًا ثم إعادة القراءة. الحذف المباشر للمسودة فقط. المنشور يصبح طلب إزالة. الترتيب والرئيسي المنشوران لا يتغيران إلا بمسودة.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-content.service.ts"
            ],
            "acceptanceAr": "إزالة تنتظر القفل ثم يكتمل النشر قبلها. ترتيب أو رئيسي يبدأ قبل النشر. 409 للنسخة القديمة. الاعتماد السابق ثم تعديل مسودة. على المنتجات والخدمات. حاجز القفل لا sleep وحده.",
            "resultAr": "على PostgreSQL: إزالة مسودة تنتظر قفل الصف، ويُنشر الوسيط قبل حصولها على القفل، فيبقى المنشور وملفه ويصبح الطلب pending_review. الترتيب والرئيسي بعد النشر يكتبان مسودة فقط. النسخة القديمة 409. الاعتماد السابق يبقي الترتيب المنشور. المنتجات والخدمات. الحاجز من pg_stat_activity وليس sleep وحده.",
            "evidenceAr": "evidence/ph3-rc4/rc4-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc4/rc4-integration.log",
                "label": "سجل HTTP وPostgreSQL"
              }
            ],
            "remainingAr": "مقبول في مراجعة RC4. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC4-02",
            "titleAr": "حفظ تعديلات الحقول وتفريغها",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2"
            ],
            "status": "مقبول من المراجع المستقل",
            "problemAr": "تفريغ الوصف يصبح undefined، والنشر يتجاهل الوصف الفارغ، والاسم الإنجليزي للعنصر المنشور لا يُحفظ.",
            "goalAr": "عقد واضح: غياب الحقل دون تغيير، والفارغ مسح للوصف، والقيمة الجديدة استبدال. الاسم الإنجليزي يمر بالمسودة والمراجعة والنشر.",
            "impactAr": "المستخدم يفرّغ الوصف أو يعدّل الإنجليزية ولا يظهر ذلك بعد الاعتماد.",
            "taskAr": "حفظ تعديلات الحقول وتفريغها",
            "fixAr": "سلسلة فارغة تعني طلب مسح الوصف، وnull في المسودة يعني لا تعديل. draftNameEn يُنشر عند الاعتماد. النموذج يحمّل المسودة بما فيها التفريغ.",
            "filesAr": [
              "mira-api/prisma/schema.prisma",
              "partners-portal/web/dashboard.html",
              "mira-api/src/partners-portal/partners-portal.service.ts"
            ],
            "acceptanceAr": "تعديل الأسماء والوصف وإعادة الفتح. الرفض يبقي المنشور. الاعتماد يظهر القيم. مسح الوصف واعتماده يزيله. رفض المسح يبقي الوصف. غياب الحقل لا يمسحه. النصوص الآمنة.",
            "resultAr": "للمنتج والخدمة: تعديل الاسم العربي والإنجليزي والوصف، وإعادة فتح المسودة، والرفض يبقي المنشور، والاعتماد يغيّر المعرف نفسه. مسح الوصف بسلسلة فارغة ثم اعتماده يجعل الوصف المنشور null. رفض المسح يبقي الوصف. غياب الحقل لا يمسحه. النص ذو الوسوم بقي نصًا في JSON وفي الواجهة بلا تنفيذ.",
            "evidenceAr": "evidence/ph3-rc4/rc4-integration.log ؛ evidence/ph3-rc4/partner-form-1280.png ؛ evidence/ph3-rc4/ui-assertions.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc4/rc4-integration.log",
                "label": "حفظ الحقول على PostgreSQL"
              },
              {
                "href": "evidence/ph3-rc4/partner-form-1280.png",
                "label": "إعادة فتح النموذج والوصف الفارغ"
              },
              {
                "href": "evidence/ph3-rc4/ui-assertions.txt",
                "label": "تحقق النموذج والنص الآمن"
              }
            ],
            "remainingAr": "مقبول في مراجعة RC4. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC4-03",
            "titleAr": "تجاوب لوحة الإدارة",
            "relatedTaskIds": [
              "P3-T2"
            ],
            "status": "مقبول من المراجع المستقل",
            "problemAr": "بعرض 480 القائمة الجانبية تستحوذ على المساحة والمحتوى يُقطع، لأن الإزاحة لا تراعي RTL.",
            "goalAr": "قائمة تُطوى على العرض الضيق، ومحتوى وأزرار ووسائط داخل العرض، مع بقاء المكتب سليمًا.",
            "impactAr": "المراجع لا يصل إلى أزرار الاعتماد على العرض الضيق.",
            "taskAr": "تجاوب لوحة الإدارة",
            "fixAr": "إزاحة منطقية حسب اتجاه RTL، وزر القائمة فوق الطبقة، والتفاف النصوص والوسائط داخل العرض.",
            "filesAr": [
              "admin-portal/web/css/admin.css",
              "admin-portal/web/js/app.js"
            ],
            "acceptanceAr": "لقطات 1280 و480 و390. معاينة وتعارض واعتماد ورفض. لا overflow أفقي. الأزرار داخل العرض. فتح القائمة وإغلاقها.",
            "resultAr": "Chrome بعرض 1280 و480 و390 بعد إعادة التحميل. القائمة تُفتح وتُغلق على الضيق، وscrollWidth يساوي عرض العرض، وأزرار الاعتماد والرفض داخل العرض. التعارض 409 والاعتماد والرفض نُفذت على 480. العرض المكتبي يبقي القائمة في الشبكة. لم يُشغَّل الجوال.",
            "evidenceAr": "evidence/ph3-rc4/admin-1280-preview.png ؛ evidence/ph3-rc4/admin-480-preview.png ؛ evidence/ph3-rc4/admin-480-menu-open.png ؛ evidence/ph3-rc4/admin-480-conflict.png ؛ evidence/ph3-rc4/admin-390-preview.png ؛ evidence/ph3-rc4/admin-390-menu-open.png ؛ evidence/ph3-rc4/ui-assertions.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc4/admin-1280-preview.png",
                "label": "معاينة 1280"
              },
              {
                "href": "evidence/ph3-rc4/admin-480-menu-open.png",
                "label": "القائمة مفتوحة 480"
              },
              {
                "href": "evidence/ph3-rc4/admin-480-preview.png",
                "label": "المحتوى 480"
              },
              {
                "href": "evidence/ph3-rc4/admin-480-conflict.png",
                "label": "تعارض 480"
              },
              {
                "href": "evidence/ph3-rc4/admin-390-preview.png",
                "label": "المحتوى 390"
              },
              {
                "href": "evidence/ph3-rc4/admin-390-menu-open.png",
                "label": "القائمة مفتوحة 390"
              },
              {
                "href": "evidence/ph3-rc4/ui-assertions.txt",
                "label": "قياسات العرض والإجراءات"
              }
            ],
            "remainingAr": "مقبول في مراجعة RC4. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC4-04",
            "titleAr": "تخزين الوسائط الدائم",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "غير مغلق بعد المراجعة",
            "problemAr": "التخزين المحلي يفنى على Render، والسقوط إليه في الإنتاج يُظهر نجاحًا مضللًا.",
            "goalAr": "استخدام تخزين ميرا الدائم إن وُجد، وإلا منع نجاح الإنتاج على التخزين المؤقت وتسجيل المانع بدقة.",
            "impactAr": "ملف الإنتاج قد يختفي بعد إعادة التشغيل مع أن الرفع أعاد نجاحًا.",
            "taskAr": "تخزين الوسائط الدائم",
            "fixAr": "لا مخزن كائنات معتمد لوسائط الكتالوج. Perfect Corp S3 ليس هذا المخزن. الإنتاج يرفض الرفع إذا لم يُهيأ مخزن دائم، والاختبارات تبقى على المجلد المحلي أو الذاكرة.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.storage.ts"
            ],
            "acceptanceAr": "رفع وقراءة محليان، وإعادة التشغيل، وفشل الكتابة، وعزل المسودة والسحب. ورفض الإنتاج غير المهيأ دون صف ناجح.",
            "resultAr": "الاختبار المحلي للتخزين بقي على المجلد المؤقت. الإنتاج من دون مخزن دائم يعيد 503 ولا ينشئ صفًا. لا مزود دائم متاح، لذلك البند غير مغلق وليس جاهزًا للإنتاج.",
            "evidenceAr": "evidence/ph3-rc4/storage-note.txt ؛ evidence/ph3-rc4/rc4-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc4/storage-note.txt",
                "label": "حد التخزين والمانع"
              },
              {
                "href": "evidence/ph3-rc4/rc4-integration.log",
                "label": "رفض الإنتاج وسجل التخزين المحلي"
              }
            ],
            "remainingAr": "المراجع أبقى البند غير مغلق. RC5 يعالج الحماية والمحوّل. منع الرفع ليس إغلاقًا للتخزين الدائم."
          },
          {
            "id": "P3-RC4-05",
            "titleAr": "التراجع عن فشل النشر بعد بدء الكتابة",
            "relatedTaskIds": [
              "P3-T2"
            ],
            "status": "مقبول من المراجع المستقل",
            "problemAr": "اختبار RC3 يفشل قبل تعديل الوسائط، فلا يثبت التراجع بعد بدء الكتابة.",
            "goalAr": "فشل معزول بعد كتابة واحدة على الأقل داخل معاملة النشر، مع بقاء المنشور كاملًا، وإعادة محاولة سليمة.",
            "impactAr": "نشر جزئي قد يترك وسائط أو اسمًا غير متسق.",
            "taskAr": "التراجع عن فشل النشر بعد بدء الكتابة",
            "fixAr": "نقطة الفشل الاختبارية بعد كتابات الوسائط وداخل المعاملة، وليست خيارًا للمستخدم. تنظيف الملفات بعد الالتزام يُسجل داخليًا دون تسريب.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-content.service.ts"
            ],
            "acceptanceAr": "بعد الفشل: الاسم والوصف والوسائط والترتيب والرئيسي والملفات وحالة المراجعة بلا سجل اعتماد ناجح وبلا نجاح للعميل. إعادة المحاولة تنجح مرة. فشل التنظيف بعد الالتزام يبقي النشر وcleanupPending.",
            "resultAr": "نقطة الفشل بعد تحديث صفوف الوسائط وقبل تحديث العنصر. السجل catalog-publish-failpoint-after-write. الرد 500. الاسم والوصف والترتيب والرئيسي وحالة المراجعة وعدد سجلات الاعتماد بقيت، والملفات بقيت، ثم نجحت إعادة المحاولة مرة. فشل الحذف بعد الالتزام أبقى النشر وأظهر cleanupPending دون المفتاح في جسم الرد، والمفتاح في السجل الداخلي.",
            "evidenceAr": "evidence/ph3-rc4/rc4-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc4/rc4-integration.log",
                "label": "فشل بعد الكتابة وفشل التنظيف"
              }
            ],
            "remainingAr": "مقبول في مراجعة RC4. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC5-01",
            "titleAr": "منع التخزين المحلي في الإنتاج",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "مقبول من المراجع المستقل",
            "problemAr": "ضبط MIRA_MEDIA_STORE=external في الإنتاج يجعل المحوّل المحلي يكتب على القرص رغم عدم وجود محوّل خارجي.",
            "goalAr": "رفض القرص المحلي في الإنتاج لكل من الرفع والقراءة والحذف، وربط الاختيار بمحوّل فعلي عبر DI.",
            "impactAr": "الإنتاج يمكن أن يكتب ملفات مؤقتة ويظهر كأن التخزين الدائم مهيأ.",
            "taskAr": "منع التخزين المحلي في الإنتاج",
            "fixAr": "LocalCatalogMediaStorage يرفض الرفع والقراءة والحذف في الإنتاج مهما كانت قيمة MIRA_MEDIA_STORE. المصنع لا يختار المحلي في الإنتاج، ويرفض external والاسم المجهول والإعداد الناقص، ولا يسقط إلى القرص عند فشل الاتصال.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.storage.ts"
            ],
            "acceptanceAr": "رفض بلا إعداد، ومع external، ومع اسم غير معروف، ومع إعداد ناقص، وفشل الاتصال بلا سقوط محلي. المحلي الصريح يبقى للاختبار خارج الإنتاج.",
            "resultAr": "على الكلاس والمصنع: الإنتاج بلا إعداد، ومع external، ومع اسم غير معروف، ومع إعداد ناقص، ومع فشل الاتصال، لم يكتب ملفًا. HTTP مع external أعاد 503 بلا صف. المحلي الصريح خارج الإنتاج كتب وقرأ.",
            "evidenceAr": "evidence/ph3-rc5/rc5-integration.log ؛ evidence/ph3-rc5/storage-note.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc5/rc5-integration.log",
                "label": "سجل العزل وHTTP"
              },
              {
                "href": "evidence/ph3-rc5/storage-note.txt",
                "label": "فصل طبقات التخزين"
              }
            ],
            "remainingAr": "مقبول في مراجعة RC5. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC5-02",
            "titleAr": "تنفيذ محوّل التخزين الدائم",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "مرشح منفذ على محاكي — التحقق الفعلي لم يُنفذ",
            "problemAr": "لا محوّل كتالوج دائم منفذ، وتسمية الإعداد external لا تنشئ مزودًا.",
            "goalAr": "تنفيذ محوّل حقيقي إن كان المزود معتمدًا، وإلا فصل العمل البرمجي غير المنفذ عن المورد الخارجي وعن التحقق غير المنفذ.",
            "impactAr": "غياب الكود لا يُغلق بعبارة مانع خارجي.",
            "taskAr": "تنفيذ محوّل التخزين الدائم",
            "fixAr": "لا مزود معتمد في قرارات ميرا. نُفذ محوّل S3-compatible مرشح للرفع والقراءة والحذف. Perfect Corp ليس هذا المخزن. الاختيار لم يُعتمد من التنفيذ.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.s3.ts",
              "mira-api/src/marketplace/catalog-media.storage.ts",
              "mira-api/.env.example"
            ],
            "acceptanceAr": "رفع وقراءة وحذف على المحوّل المنفذ، أو بيان صريح بأن المحوّل غير منفذ لأن المزود غير معتمد.",
            "resultAr": "الكود المرشح اختُبر على خادم HTTP محلي: مطابقة بايتات الصورة والفيديو، والحذف، ورفض 403، وقراءة من عملية ثانية دون المجلد المحلي. لم يُختبر bucket حقيقي. منع 503 ليس إكمالًا لهذا البند.",
            "evidenceAr": "evidence/ph3-rc5/storage-note.txt ؛ evidence/ph3-rc5/rc5-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc5/storage-note.txt",
                "label": "حد المحوّل والمرشح"
              },
              {
                "href": "evidence/ph3-rc5/rc5-integration.log",
                "label": "سجل المحاكي"
              }
            ],
            "remainingAr": "قرار المزود غير معتمد. بيانات الاعتماد والتحقق على المورد الفعلي لم يُنفذا. لا يُوصف بأنه جاهز للإنتاج."
          },
          {
            "id": "P3-RC5-03",
            "titleAr": "ربط الصلاحيات ودورة حياة الوسائط",
            "relatedTaskIds": [
              "P3-T1",
              "P3-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "التخزين الجديد يجب ألا ينشر المسودات أو يسرّب الاعتماد أو يترك صفًا لملف لم يُحفظ.",
            "goalAr": "إبقاء المسار الحالي والخصوصية والسحب، مع تنظيف آمن بعد فشل قاعدة البيانات وتمييز أسباب الفشل داخليًا.",
            "impactAr": "مسودة أو ملف يتيم أو حذف ملف منشور.",
            "taskAr": "ربط الصلاحيات ودورة حياة الوسائط",
            "fixAr": "بقيت روابط API والمعرفات. المسودة غير عامة. السحب يحجب المسار العام. فشل حفظ الصف ينظّف الملف الجديد ويسجل التنظيف داخليًا. أسباب القراءة تُسجل داخليًا دون تسريب. لا روابط موقعة.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-content.service.ts",
              "mira-api/src/marketplace/catalog-media.controller.ts"
            ],
            "acceptanceAr": "فشل الرفع بلا صف. تنظيف بعد فشل الكتابة. السحب يحجب العام. الشريك الآخر لا يرى المسودة. لا بيانات اعتماد في الواجهات.",
            "resultAr": "HTTP: الشريك الآخر 404، والعام 404 قبل النشر، و200 بعد الاعتماد مع مطابقة البايتات، و404 بعد السحب مع بقاء الملف. الاستيراد التجريبي بقي خارج الكتالوج العام. تكرار مفتاح المصدر لم يترك ملفًا زائدًا.",
            "evidenceAr": "evidence/ph3-rc5/rc5-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc5/rc5-integration.log",
                "label": "دورة الوسائط على HTTP"
              }
            ],
            "remainingAr": "المراجعة المستقلة. لا ترحيل للملفات المحلية السابقة. الحجب المثبت هو مسار API لا إبطال رابط موقّع."
          },
          {
            "id": "P3-RC5-04",
            "titleAr": "اختبارات التخزين وإثبات الاستدامة",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "اختبارات محلية منفذة — المورد الفعلي لم يُختبر",
            "problemAr": "نجاح الذاكرة أو إعادة كائن داخل العملية لا يثبت تخزينًا دائمًا، ومنع 503 ليس إغلاقًا للتخزين.",
            "goalAr": "فصل اختبار العزل والمحاكي وHTTP عن التحقق على مورد فعلي.",
            "impactAr": "تقرير يخلط الحماية المؤقتة بالاستدامة.",
            "taskAr": "اختبارات التخزين وإثبات الاستدامة",
            "fixAr": "سجلات تفصل عزل الكلاس، ومحاكي HTTP، وHTTP مع PostgreSQL، عن المورد الفعلي غير المختبر.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.rc5.storage-tests.ts",
              "mira-api/src/marketplace/catalog-media.rc5.http.integration-tests.ts"
            ],
            "acceptanceAr": "مطابقة المحتوى، والحدود، وإعادة تشغيل العملية، وفشل الاتصال بلا كتابة محلية، وعزل المسودة والسحب.",
            "resultAr": "خرج التكامل 0. عملية ثانية قرأت كائن المحاكي. إعادة الكائن داخل العملية نفسها لم تُستخدم دليلًا على الاستدامة. حد الصورة 5MB رجع 400 عبر حد الطلب المعتمد. لا اختبار على bucket حي.",
            "evidenceAr": "evidence/ph3-rc5/rc5-integration.log ؛ evidence/ph3-rc5/storage-note.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc5/rc5-integration.log",
                "label": "السجل الفعلي"
              },
              {
                "href": "evidence/ph3-rc5/storage-note.txt",
                "label": "ما يثبته كل نوع اختبار"
              }
            ],
            "remainingAr": "التحقق على مورد التخزين الفعلي لم يُنفذ. نجاح المحاكي لا يثبت إعداد الإنتاج."
          },
          {
            "id": "P3-RC6-01",
            "titleAr": "حماية عنوان الاتصال",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "المحوّل يقبل endpoint يبدأ بـhttp:// في الإنتاج ويجهّز طلب الرفع إليه.",
            "goalAr": "فرض HTTPS في الإنتاج، ورفض العنوان غير الصالح وبيانات الاعتماد المضمنة والمسار والاستعلام، وحصر HTTP في loopback لاختبار صريح.",
            "impactAr": "يمكن إرسال ملفات الكتالوج وبيانات الاعتماد إلى عنوان غير آمن.",
            "taskAr": "حماية عنوان الاتصال",
            "fixAr": "يُحلَّل endpoint بـURL قبل أي طلب. الإنتاج يقبل HTTPS فقط. HTTP مسموح على loopback ومع MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK=true خارج الإنتاج. تُرفض بيانات الاعتماد والمسار والاستعلام والتجزئة والبروتوكول غير المدعوم. تحويل 3xx لا يُتبع ولا يُسجل الرابط. منع القرص المحلي في الإنتاج بقي بلا fallback.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.s3.ts"
            ],
            "acceptanceAr": "رفض HTTP في الإنتاج قبل الشبكة، ورفض العنوان والبروتوكول غير الصالحين، والسماح لـHTTP على loopback بإعداد اختبار صريح، ومنع HTTP الخارجي، وعدم اتباع تحويل HTTPS إلى HTTP.",
            "resultAr": "في السجل: الإنتاج رفض HTTP قبل أي اتصال. العنوان والبروتوكول وبيانات الاعتماد والمسار والاستعلام رُفضت دون طباعتها. HTTP الخارجي رُفض حتى مع علم الاختبار. HTTP على loopback نجح ضمن العلم الصريح. تحويل HTTPS إلى HTTP لم يُتبع. HTTPS الصحيح وصل إلى المحوّل. لا تراجع لمنع المحلي في الإنتاج.",
            "evidenceAr": "evidence/ph3-rc6/rc6-integration.log ؛ evidence/ph3-rc6/storage-note.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc6/rc6-integration.log",
                "label": "سجل الاتصال والتخزين"
              },
              {
                "href": "evidence/ph3-rc6/storage-note.txt",
                "label": "فصل الكود عن المورد"
              }
            ],
            "remainingAr": "المراجعة المستقلة. هذا ليس اعتماد مزود. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC6-02",
            "titleAr": "مهلة الاتصال والانقطاع",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "لا مهلة إلغاء واضحة، وقراءة جسم الاستجابة خارج معالجة أخطاء الاتصال.",
            "goalAr": "مهلة تغطي الإرسال والترويسات وقراءة الجسم، مع تصنيف الانقطاع وتنظيف المؤقتات ومنع النجاح الوهمي.",
            "impactAr": "طلب معلّق أو نجاح جزئي أو سجل يخلط الانقطاع بغياب الملف.",
            "taskAr": "مهلة الاتصال والانقطاع",
            "fixAr": "المهلة MIRA_MEDIA_S3_TIMEOUT_MS من 1 إلى 120000 وتغطي الإرسال والترويسات وقراءة الجسم في PUT وGET وDELETE. انتهاء المهلة يلغي الطلب وينظف المؤقت. انقطاع الجسم خطأ اتصال لا غياب ملف. لا إعادة محاولة غير محدودة. انقطاع رد الرفع يحاول حذفًا واحدًا بالمفتاح نفسه ويسجل المفتاح داخليًا إذا فشل الحذف. الفشل لا يكتب محليًا ولا ينشئ صفًا ناجحًا.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.s3.ts"
            ],
            "acceptanceAr": "تعليق الترويسات، وتعليق الجسم، وانقطاع الجسم، وتعطل PUT وDELETE، وإكمال الناجح بلا مؤقت، وبلا fallback محلي وبلا أسرار في السجل.",
            "resultAr": "الخادم الصامت انتهى ضمن المهلة. تعليق الجسم أنهى GET ضمن المهلة. انقطاع الجسم أُعيد كخطأ اتصال بلا بيانات ناقصة. PUT وDELETE المعلقان انتهيا، وبقي طلب PUT واحدًا. الطلب الناجح لم يترك مؤقتًا. فشل HTTP لم ينشئ صفًا ولا ملفًا محليًا. السجل بلا Authorization وبلا سر.",
            "evidenceAr": "evidence/ph3-rc6/rc6-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc6/rc6-integration.log",
                "label": "سجل المهلة والانقطاع"
              }
            ],
            "remainingAr": "المراجعة المستقلة. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC6-03",
            "titleAr": "توافق S3 والمصادقة",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "منفذ على خدمة محلية — ليس تحقق إنتاج",
            "problemAr": "محاكي RC5 يخزن البايتات ولا يتحقق من صحة التوقيع.",
            "goalAr": "اختبار الرفع والقراءة والحذف ضد خدمة تتحقق من توقيع S3، عبر المسار نفسه في API وقاعدة البيانات.",
            "impactAr": "نجاح المحاكي لا يثبت أن المزود سيقبل الطلب.",
            "taskAr": "توافق S3 والمصادقة",
            "fixAr": "التوقيع عبر @aws-sdk/client-s3 3.1141.0. الاختبار ضد MinIO RELEASE.2025-09-07T16-13-09Z الذي يتحقق من التوقيع، لا ضد محاكي البايتات. السر الخاطئ والتوقيع المعدّل رُفضا. المسار المتكامل استخدم المحوّل نفسه مع API وPostgreSQL.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-media.s3.ts"
            ],
            "acceptanceAr": "اعتماد صحيح، وsecret خاطئ، وطلب معدّل، ومطابقة الوسائط، وعملية ثانية، والكائن المفقود، والصلاحية، وفشل الاتصال، وعدم تكرار النسخ.",
            "resultAr": "اعتماد صحيح: رفع وقراءة وحذف. سر خاطئ وتوقيع معدّل: رفض بلا كائن جديد. PNG وMP4 تطابقا. عملية ثانية قرأت الكائن من مجلد محلي فارغ. الكائن المفقود بلا خطأ اتصال. الصلاحية الناقصة منفصلة عن انقطاع المنفذ. فشل الاتصال لم يكتب محليًا. الكتابة بالمفتاح نفسه لم تنشئ نسخة ثانية. HTTP: المسودة غير عامة، والشريك الآخر لا يقرأها، والاعتماد يظهرها، والسحب يحجبها، والمحتوى المحاكى معزول، وفشل الحفظ بعد الرفع لم يترك كائنًا زائدًا.",
            "evidenceAr": "evidence/ph3-rc6/rc6-integration.log ؛ evidence/ph3-rc6/minio-local.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc6/rc6-integration.log",
                "label": "سجل MinIO والمسار المتكامل"
              },
              {
                "href": "evidence/ph3-rc6/minio-local.txt",
                "label": "إعداد MinIO وإزالته"
              }
            ],
            "remainingAr": "هذا تحقق بروتوكول محلي وليس تحقق إنتاج. المورد الفعلي لم يُنفذ. المرحلة الثالثة غير معتمدة. المعتمد مرحلتان من خمس."
          },
          {
            "id": "P3-RC6-04",
            "titleAr": "التحقق من المورد الفعلي والمتبقي الخارجي",
            "relatedTaskIds": [
              "P3-T1"
            ],
            "status": "الاختبار المحلي منفذ — التحقق من المورد الفعلي لم يُنفذ",
            "problemAr": "وجود محوّل S3-compatible لا يعني اعتماد مزود ولا التحقق من مورد ميرا.",
            "goalAr": "إبقاء قرار المزود ظاهرًا، وإكمال الاختبار المحلي، وتحديد ما يلزم للتحقق الفعلي دون طلب المفاتيح.",
            "impactAr": "وصف التخزين بأنه جاهز للإنتاج قبل وجود المورد.",
            "taskAr": "التحقق من المورد الفعلي والمتبقي الخارجي",
            "fixAr": "أُبقي قرار المزود غير معتمد. اكتمل الكود والاختبار المحلي دون انتظار أسرار إنتاج. حُدد ما يلزم للتحقق الفعلي دون طلب المفاتيح.",
            "filesAr": [
              "docs/mira-commerce-reference/evidence/ph3-rc6/storage-note.txt"
            ],
            "acceptanceAr": "بيان صريح بأن الاختبار المحلي يتحقق من البروتوكول وأن التحقق من المورد الفعلي لم يُنفذ إن غاب المورد.",
            "resultAr": "المحوّل اختُبر مقابل خدمة محلية تتحقق من البروتوكول؛ التحقق من المورد الفعلي لم يُنفذ. لا مورد مملوك لميرا في القرارات أو الإعداد. لم تُحذف وسائط تجار ولم تُستخدم موارد Perfect Corp أو دار كار أو الأماكن.",
            "evidenceAr": "evidence/ph3-rc6/storage-note.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph3-rc6/storage-note.txt",
                "label": "المتبقي الخارجي"
              }
            ],
            "remainingAr": "قرار المزود، ومورد ميرا، والمنطقة أو endpoint، وصلاحيات PutObject وGetObject وDeleteObject، وإدخال الأسرار في بيئة التشغيل. لا تُرسل المفاتيح في المحادثة ولا داخل الحزمة."
          }
        ],
        "launchBlockerIds": [
          "PH3-STORAGE-LIVE"
        ]
      },
      {
        "id": "PH-4",
        "number": 4,
        "nameAr": "المشاهدات وإعلانات المشاهير",
        "goalAr": "احتساب مشاهدات حقيقية بعد اعتماد القواعد، وربط إعلان المشهور بالكيان الأصلي مع فصل الأدوار.",
        "inScopeAr": [
          "قواعد العدّ قبل التنفيذ",
          "أيقونة العين والعدد الحقيقي",
          "فصل البائع والمعلن وناشر المحتوى"
        ],
        "outOfScopeAr": [
          "عرض صفر أو رقم تجريبي قبل تنفيذ العدّ",
          "احتساب التحميل المسبق مشاهدة"
        ],
        "tasks": [
          {
            "id": "P4-T1",
            "nameAr": "اعتماد قواعد العد ومنع التكرار",
            "status": "مؤجل بقرار المالك",
            "goalAr": "تثبيت قواعد المشاهدة ومنع التكرار قبل أي تفعيل.",
            "implementationAr": "صفحة قرار بتوصية وبديل. لا يوجد اعتماد سابق. العد مرفوض في الخادم ما دامت السياسة غير معتمدة.",
            "resultAr": "بطاقة القرار جاهزة في RC4 وتعرض التوصية والبديل والأمثلة. طلب تنفيذ RC4 ليس اعتمادًا. 50٪ والثانية و24 ساعة ما زالت غير معتمدة. العد غير مفعّل.",
            "testsAr": "HTTP محلي: الحالة disabled بلا عدد، ورفض العدد القادم من العميل، وعدم تخزين qualified_view. اختبارات العتبة الزمنية لم تُنفذ لأن السياسة غير معتمدة.",
            "evidenceAr": "evidence/ph4-rc1/ph4-integration.log ؛ evidence/ph4-rc1/view-count-contract.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/view-metrics.txt",
                "label": "فرق المقياسين"
              },
              {
                "href": "evidence/ph4-rc1/view-count-contract.txt",
                "label": "مواصفة العقد"
              }
            ],
            "remainingAr": "مؤجل بقرار المالك في 2026-09-27. البطاقة تبقى مفتوحة والعد غير مفعّل. التأجيل ليس اعتمادًا."
          },
          {
            "id": "P4-T2",
            "nameAr": "إظهار العدد الحقيقي وتمييز الصفر عن التعذر",
            "status": "مؤجل بقرار المالك",
            "goalAr": "إظهار حالة صادقة على أيقونة العين دون صفر وهمي.",
            "implementationAr": "حالات: غير مفعّل، وجارٍ الجلب، وعدد مؤكد بما فيه صفر، وتعذر الجلب. الاستجابة المتأخرة لا تنتقل إلى عرض آخر. تبديل الوسائط لا يعيد الربط.",
            "resultAr": "مصدر الأيقونة والاختبار داخل الحزمة. المسار العام يبقى «العد غير مفعّل» بلا رقم. الصفر يظهر فقط للقطة مؤكدة في الاختبار.",
            "testsAr": "flutter test test/features/marketplace/discover_view_count_test.dart وdiscover_ad_presentation_test.dart خرجا 0 محليًا. ليس اختبار جوال.",
            "evidenceAr": "evidence/ph4-rc1/view-count-widget.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/flutter-view-ad.log",
                "label": "سجل حالات الأيقونة والعرض"
              }
            ],
            "remainingAr": "مؤجل مع P4-T1. العد غير مفعّل ولم يُنفذ."
          },
          {
            "id": "P4-T3",
            "nameAr": "ربط إعلان المشهور وفصل الأحداث",
            "status": "منفذ في RC3 — بانتظار المراجعة المستقلة",
            "goalAr": "ربط الإعلان بالكيان الأصلي دون نسخ السعر أو الملكية، وفصل أحداثه عن الأصل.",
            "implementationAr": "الإعلان يحفظ المعرّف والنوع والمعلن والناشر فقط. السعر يُقرأ من المنتج عند العرض. الاعتماد للإدارة فقط. فتح الرابط link_open وليس شراءً ولا مشاهدة.",
            "resultAr": "RC3 يربط الإعلان المنشور بمسار الكتالوج، ويمنع قراءة أصل غير مؤهل عبر الإعلان، ويعزل المعاينة الموسومة، ويرفض فتح رابط غير مؤهل. العد يبقى معطلًا.",
            "testsAr": "اختبار HTTP محلي catalog-ad.ph4.rc3.http.integration-tests.ts ضمن سجل PH4 RC3، وflutter test لمسار الكتالوج. خرجا 0. ليس دليل جهاز.",
            "evidenceAr": "evidence/ph4-rc1/ph4-integration.log ؛ evidence/ph4-rc1/ad-note.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc3/ph4-rc3-integration.log",
                "label": "سجل HTTP المحلي"
              },
              {
                "href": "evidence/ph4-rc3/flutter-ad-feed.log",
                "label": "سجل مسار الإعلان في اكتشفي"
              },
              {
                "href": "evidence/ph4-rc2/ph4-rc2-integration.log",
                "label": "سجل RC2 السابق"
              }
            ],
            "remainingAr": "مراجعة مستقلة. لا عمولات ولا دفع إعلاني. مشاهدة الإعلان تبقى معطلة مع قواعد العد."
          }
        ],
        "expectedAr": "أحداث مرتبطة بالكيان الصحيح، وعدم احتساب التحميل المسبق، وعدم تضخيم العدّ، وتمييز الصفر عن تعذر الجلب.",
        "actualAr": "PH4 RC7 منفّذ — بانتظار المراجعة المستقلة. المعتمد بالكامل مرحلتان من خمس. قواعد المشاهدات بانتظار اعتماد المالك والعد غير مفعّل. PH3-STORAGE-LIVE مفتوح، واختبار الجوال في المرحلة الخامسة.",
        "status": "PH4 RC7 منفّذ — بانتظار المراجعة المستقلة",
        "dependenciesAr": "اعتماد P4-T1 قبل تفعيل العد. موضع الأيقونة من المرحلة الأولى لا ينفذ العد. مانع PH3-STORAGE-LIVE يبقى مفتوحًا.",
        "notesAr": "RC6 تمت مراجعته. قُبل تفرد المعرفات وفصل زر الفتح وإصلاح الحزمة وتحديث السجل. بقيت ملاحظتا التداخل ونمو سجل الحالات وعولجتا في RC7. الحزمة المراجعة بصمتها e9b86a6548c08a54be0b8e2163b367598f72f720a4b43e3fda1c812a9836a1df. العد غير مفعّل. لا اعتماد لـ50٪ ولا ثانية ولا 24 ساعة.",
        "blockersAr": "قواعد العد غير معتمدة. مانع الإطلاق PH3-STORAGE-LIVE مفتوح ولا يخص إغلاق المرحلة الرابعة.",
        "acceptanceAr": "أحداث مرتبطة بالكيان الصحيح، وعدم احتساب التحميل المسبق، وعدم تضخيم المشاهدات بالتكرار، وتمييز الصفر عن تعذر جلب العدد، واختبارات تثبت ذلك.",
        "evidenceIds": [],
        "reviewPackage": "deliveries/PH4-RC7.txt",
        "verificationReport": "deliveries/PH4-RC7.txt",
        "reviewResultAr": "PH4 RC7 منفّذ — بانتظار المراجعة المستقلة. لم تُعتمد المرحلة الرابعة من داخل التنفيذ.",
        "reviewDate": "2026-09-27",
        "approvalAr": "غير معتمدة",
        "deliveries": [
          {
            "id": "DEL-PH4-RC1",
            "name": "MIRA_DISCOVER_PH3_CODE_CLOSURE_PH4_RC1.zip",
            "createdAt": "2026-09-27T02:50:00+03:00",
            "deliveryStatus": "قيد التنفيذ — بانتظار المراجعة المستقلة",
            "logHref": "deliveries/PH4-RC1.txt",
            "logLabel": "سجل PH4 RC1",
            "zipHref": "../../MIRA_DISCOVER_PH3_CODE_CLOSURE_PH4_RC1.zip",
            "zipLabel": "حزمة الإغلاق البرمجي وPH4 RC1",
            "sha256Href": "../../MIRA_DISCOVER_PH3_CODE_CLOSURE_PH4_RC1.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH3_CODE_CLOSURE_PH4_RC1_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "يجمع قبول RC6 البرمجي وبدء المرحلة الرابعة. المرحلة الرابعة غير معتمدة. بصمة الحزمة تُحسب خارجها. ملحوظة تاريخية: حزمة RC1 نسبت اختبار الواجهة إلى التنفيذ بينما ملف ZIP لم يحتوِ ملفات Dart. المصدر كان في شجرة العمل، وRC2 يرفقه.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH4-RC2",
            "name": "MIRA_DISCOVER_PH4_RC2.zip",
            "createdAt": "2026-09-27T03:10:00+03:00",
            "deliveryStatus": "تمت مراجعته — يحتاج تصحيحًا",
            "logHref": "deliveries/PH4-RC2.txt",
            "logLabel": "سجل PH4 RC2",
            "zipHref": "../../MIRA_DISCOVER_PH4_RC2.zip",
            "zipLabel": "حزمة PH4 RC2",
            "sha256Href": "../../MIRA_DISCOVER_PH4_RC2.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH4_RC2_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "تصحيح RC1 بانتظار المراجعة. العد غير مفعّل. المعتمد بالكامل مرحلتان من خمس.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH4-RC3",
            "name": "MIRA_DISCOVER_PH4_RC3.zip",
            "createdAt": "2026-09-27T04:40:00+03:00",
            "deliveryStatus": "تمت مراجعته — يحتاج تصحيحًا",
            "logHref": "deliveries/PH4-RC3.txt",
            "logLabel": "سجل PH4 RC3",
            "zipHref": "../../MIRA_DISCOVER_PH4_RC3.zip",
            "zipLabel": "حزمة PH4 RC3",
            "sha256Href": "../../MIRA_DISCOVER_PH4_RC3.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH4_RC3_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "المراجعة المستقلة وجدت ملاحظات RC4. البصمة الفعلية للملف المرسل b32e13984f79710051ad156b3f898f91486f02e14e4fa1c7039697670e03689b، وملف البصمة المرفق احتوى b25852b5bb87e1204dddda8ab8583a0dc974a83a41e876db9e8fe95a2a908f57. الاختلاف مثبت ولم تُستبدل البصمة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH4-RC4",
            "name": "MIRA_DISCOVER_PH4_RC4.zip",
            "createdAt": "2026-09-27T05:20:00+03:00",
            "deliveryStatus": "تمت مراجعته — يحتاج تصحيحًا",
            "logHref": "deliveries/PH4-RC4.txt",
            "logLabel": "سجل PH4 RC4",
            "zipHref": "../../MIRA_DISCOVER_PH4_RC4.zip",
            "zipLabel": "حزمة PH4 RC4",
            "sha256Href": "../../MIRA_DISCOVER_PH4_RC4.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH4_RC4_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "المراجع استلم MIRA_DISCOVER_PH4_RC4.zip بالبصمة e82ff46b7200403f24812db015b900c5885f40ae8143eee3b10d79840ca39c56 والحجم 51805092 و6717 ملفًا. تقرير تنفيذ سابق ذكر 4096bcee وحجمًا وعدد ملفات مختلفين. الاختلاف تاريخي ولم يُعدَّل التقرير القديم ليوحي بالمطابقة.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH4-RC5",
            "name": "MIRA_DISCOVER_PH4_RC5.zip",
            "createdAt": "2026-09-27T07:30:00+03:00",
            "deliveryStatus": "تمت مراجعته — يحتاج تصحيحًا",
            "logHref": "deliveries/PH4-RC5.txt",
            "logLabel": "سجل PH4 RC5",
            "zipHref": "../../MIRA_DISCOVER_PH4_RC5.zip",
            "zipLabel": "حزمة PH4 RC5",
            "sha256Href": "../../MIRA_DISCOVER_PH4_RC5.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH4_RC5_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "المراجع استلم MIRA_DISCOVER_PH4_RC5.zip بالبصمة 6c1bbf5411b3c7d055a7107d9a806157c19a080a133e4650eb3e9f0af00d6eee. الملفات المسجلة 6738 تطابقت، واحتوى ZIP أيضًا 14 رابطًا رمزيًا غير مسجل داخل مجلدات Flutter ephemeral. لم يُعدَّل الأرشيف ولا تقريره.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH4-RC6",
            "name": "MIRA_DISCOVER_PH4_RC6.zip",
            "createdAt": "2026-09-27T08:10:00+03:00",
            "deliveryStatus": "تمت مراجعته — يحتاج تصحيحًا",
            "logHref": "deliveries/PH4-RC6.txt",
            "logLabel": "سجل PH4 RC6",
            "zipHref": "../../MIRA_DISCOVER_PH4_RC6.zip",
            "zipLabel": "حزمة PH4 RC6",
            "sha256Href": "../../MIRA_DISCOVER_PH4_RC6.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH4_RC6_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "finalChecksHref": "../../MIRA_DISCOVER_PH4_RC6_FINAL_CHECKS.log",
            "finalChecksLabel": "سجل التحقق النهائي خارج الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "قُبل تفرد معرفات فتح الرابط، وفصل زر الفتح عن انتظار التسجيل، وإصلاح الحزمة مع سجل الفك، وتحديث سجل المراحل وتصنيف الأدلة. بقيت ملاحظتان: تداخل طلبات إعادة الإرسال بعد المهلة، ونمو سجل الحالات دون حد. الحزمة e9b86a6548c08a54be0b8e2163b367598f72f720a4b43e3fda1c812a9836a1df لم تُعدَّل.",
            "approvalAr": "غير معتمدة"
          },
          {
            "id": "DEL-PH4-RC7",
            "name": "MIRA_DISCOVER_PH4_RC7_PRE_PHASE5.zip",
            "createdAt": "2026-09-27T08:40:00+03:00",
            "deliveryStatus": "PH4 RC7 منفّذ — بانتظار المراجعة المستقلة",
            "logHref": "deliveries/PH4-RC7.txt",
            "logLabel": "سجل PH4 RC7",
            "zipHref": "../../MIRA_DISCOVER_PH4_RC7_PRE_PHASE5.zip",
            "zipLabel": "حزمة ما قبل المرحلة الخامسة",
            "sha256Href": "../../MIRA_DISCOVER_PH4_RC7_PRE_PHASE5.zip.sha256",
            "sha256Label": "بصمة الحزمة خارجها",
            "verificationHref": "../../MIRA_DISCOVER_PH4_RC7_PRE_PHASE5_VERIFICATION.txt",
            "verificationLabel": "تحقق الحزمة",
            "finalChecksHref": "../../MIRA_DISCOVER_PH4_RC7_PRE_PHASE5_FINAL_CHECKS.log",
            "finalChecksLabel": "سجل التحقق النهائي خارج الحزمة",
            "sha256": "تُحسب خارج الحزمة بعد إغلاقها ولا تُكتب داخلها",
            "reviewResultAr": "إغلاق ملاحظتي إعادة الإرسال، مع بقاء اعتماد المشاهدات والعد والتخزين الفعلي خارج هذا التنفيذ.",
            "approvalAr": "غير معتمدة"
          }
        ],
        "corrections": [
          {
            "id": "P4-RC2-01",
            "titleAr": "اكتمال مصدر Flutter وإعادة إنتاج الاختبارات",
            "relatedTaskIds": [
              "P4-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "حزمة RC1 لم تحتوِ ملفات Dart ولا discover_view_count_test.dart رغم نسب نجاح الاختبار إلى التسليم.",
            "goalAr": "إرفاق المصدر والاختبار وسجل الأمر حتى يُعاد تشغيله من الحزمة.",
            "impactAr": "المراجع لا يستطيع التحقق من حالات الأيقونة من الحزمة وحدها.",
            "taskAr": "تضمين مصدر الواجهة واختباراته",
            "fixAr": "الحزمة تضم pubspec.yaml وpubspec.lock وlib وassets وحزمة الكاميرا المحلية والاختبارين. السجل يذكر الأمر والحالات وEXIT 0.",
            "filesAr": [
              "lib/features/marketplace/presentation/presentation/discover_view_count.dart",
              "lib/features/marketplace/presentation/presentation/discover_ad.dart",
              "lib/features/marketplace/presentation/presentation/discover_visual_chrome.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "test/features/marketplace/discover_view_count_test.dart",
              "test/features/marketplace/discover_ad_presentation_test.dart"
            ],
            "acceptanceAr": "فك الحزمة يظهر ملفات الاختبار، والسجل يطابق الأمر، والنتيجة ليست بديلًا عن الملف.",
            "resultAr": "flutter test للاختبارين خرج All tests passed وEXIT 0. أربع حالات. ليس تشغيل جوال.",
            "evidenceAr": "evidence/ph4-rc2/flutter-view-ad.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/flutter-view-ad.log",
                "label": "سجل Flutter"
              }
            ],
            "remainingAr": "مراجعة مستقلة للحزمة بعد فكها. العد الحي ما زال غير مفعّل."
          },
          {
            "id": "P4-RC2-02",
            "titleAr": "ربط اعتماد الإعلان بالنسخة وحماية التزامن",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "reviewRevision لم يكن شرطًا للقرار، والتعديل يمكن أن يمر بعد الإرسال، واعتماد المسحوب كان ممكنًا.",
            "goalAr": "قرار الإدارة يخص النسخة المعروضة، والتعديل والإرسال والقرار يعيدون القراءة تحت قفل الصف.",
            "impactAr": "يمكن نشر نسخة لم يعاينها المراجع أو إعادة نشر إعلان مسحوب.",
            "taskAr": "دورة المراجعة والتزامن",
            "fixAr": "الإرسال يثبت submittedRevision. القرار يرفض النسخة القديمة بـ409. التكرار للنسخة نفسها alreadyApplied. الفشل داخل المعاملة لا ينشر. الفاعل admin-api-key.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-ad.service.ts",
              "mira-api/prisma/migrations/20260927083000_discover_ads_ph4_rc2/migration.sql"
            ],
            "acceptanceAr": "النسخة القديمة 409، والتعديل المتزامن مع الإرسال لا يمر، واعتماد المسحوب مرفوض، والمدخل الناقص 400 بلا كتابة، وفشل المعاملة يبقي in_review.",
            "resultAr": "سجل PostgreSQL المحلي خرج 0 وتضمّن سطر ph4 rc2. فشل المعاملة ظهر كخطأ متوقع ثم بقيت الحالة قيد المراجعة.",
            "evidenceAr": "evidence/ph4-rc2/ph4-rc2-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/ph4-rc2-integration.log",
                "label": "سجل النسخ والتزامن"
              }
            ],
            "remainingAr": "مراجعة مستقلة. لا اعتماد للمرحلة الرابعة من داخل التنفيذ."
          },
          {
            "id": "P4-RC2-03",
            "titleAr": "تفويض الناشر وأهلية أطراف الإعلان",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "المعلن كان يستطيع وضع معرّف شريك آخر ناشرًا، والإعلان يبقى ظاهرًا بعد تعطيل المعلن أو الناشر.",
            "goalAr": "منع الإسناد بلا تفويض، وإخفاء الإعلان إذا تعطّل أي طرف أو الأصل.",
            "impactAr": "نشر باسم طرف لم يفوّض، أو إبقاء إجراء على إعلان فقد أهليته.",
            "taskAr": "التفويض والأهلية",
            "fixAr": "لا آلية تفويض قائمة، لذلك الإسناد إلى ناشر آخر 403 على API. الظهور يشترط نشاط المعلن والناشر والجهة وأهلية الأصل. إيقاف أي منهم يخفي القراءة وفتح الرابط.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-ad.service.ts",
              "docs/mira-commerce-reference/evidence/ph4-rc2/ad-rules.txt"
            ],
            "acceptanceAr": "رفض الناشر غير المفوَّض، وإخفاء الإعلان عند إيقاف المعلن أو الناشر أو الجهة أو سحب الهدف، ورفض حساب آخر، وتغطية منتج وخدمة.",
            "resultAr": "الاختبار المحلي رفض الإسناد بـ403، وأخفى الإعلان في حالات الإيقاف للمنتج والخدمة، ومنع الحساب الآخر. ليس تجربة جهاز.",
            "evidenceAr": "evidence/ph4-rc2/ph4-rc2-integration.log ؛ evidence/ph4-rc2/ad-rules.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/ph4-rc2-integration.log",
                "label": "سجل الأهلية"
              },
              {
                "href": "evidence/ph4-rc2/ad-rules.txt",
                "label": "القاعدة المطبقة"
              }
            ],
            "remainingAr": "لا منظومة تفويض جديدة في هذا التصحيح. إن وُجد تفويض معتمد لاحقًا يُربط به."
          },
          {
            "id": "P4-RC2-04",
            "titleAr": "التكامل المرئي للتطبيق والبوابتين",
            "relatedTaskIds": [
              "P4-T2",
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "RC1 أثبت مسارات API ولم يثبت استخدام الإعلان داخل اكتشفي والبوابتين.",
            "goalAr": "إظهار الرحلة في بوابة الشريك ولوحة الإدارة وشاشة العرض الحالية.",
            "impactAr": "العقد يبقى غير مستخدم في الواجهات التي يراها المراجع.",
            "taskAr": "التكامل المرئي",
            "fixAr": "بوابة الشريك تعرض القائمة والمسودة والأدوار والرفض والسحب وحالة العد المعطلة. الإدارة تعاين النسخة قبل الاعتماد وتوضح 409. اكتشفي يضع شارة الإعلان على مسار العرض الحالي ويخفي إجراء الموعد غير التشغيلي.",
            "filesAr": [
              "partners-portal/web/js/ads.js",
              "admin-portal/web/js/app.js",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "لقطات البوابتين بحجم طبيعي وعرض ضيق، واختبار Flutter للعرض، والنص ذو الوسوم يظهر كنص.",
            "resultAr": "اختبار العرض نجح محليًا. لقطات ui-fixture=labeled بحجم 1280 و390 تُظهر النص الحرفي للوسم. رحلة HTTP في السجل. اللقطات ليست كتالوجًا عامًا وليست تجربة جهاز.",
            "evidenceAr": "evidence/ph4-rc2/flutter-view-ad.log ؛ evidence/ph4-rc2/admin-ads-desktop.png",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/admin-ads-desktop.png",
                "label": "إدارة بعرض واسع"
              },
              {
                "href": "evidence/ph4-rc2/admin-ads-narrow.png",
                "label": "إدارة بعرض ضيق"
              },
              {
                "href": "evidence/ph4-rc2/partner-ads-desktop.png",
                "label": "الشريك بعرض واسع"
              },
              {
                "href": "evidence/ph4-rc2/partner-ads-narrow.png",
                "label": "الشريك بعرض ضيق"
              },
              {
                "href": "evidence/ph4-rc2/flutter-view-ad.log",
                "label": "اختبار العرض"
              }
            ],
            "remainingAr": "اللقطات بيانات اختبار موسومة. لا تشغيل على الجوال في هذه المرحلة."
          },
          {
            "id": "P4-RC2-05",
            "titleAr": "تصحيح تعريف مقاييس المشاهدات",
            "relatedTaskIds": [
              "P4-T1"
            ],
            "status": "منفذ — بانتظار اعتماد المالك",
            "problemAr": "توصية RC1 وبديلها يستخدمان النافذة نفسها لكل فاعل ولكل هدف، فلا يختلف الحساب.",
            "goalAr": "فصل إعادة الحدث عن نافذة السياسة وعن المشاهدات المؤهلة وعن الفاعلين الفريدين.",
            "impactAr": "اعتماد أحد الخيارين لا يغيّر الرقم إذا كانا متطابقين.",
            "taskAr": "تعريف المقياسين",
            "fixAr": "التوصية تعد المشاهدات المؤهلة مع نافذة 24 ساعة. البديل يعد الفاعلين الفريدين طوال عمر الهدف. جدول الأمثلة يبين أن الفرق يظهر عند العودة بعد النافذة. العد لم يُفعّل.",
            "filesAr": [
              "docs/mira-commerce-reference/data/discover-phases.json",
              "docs/mira-commerce-reference/evidence/ph4-rc2/view-metrics.txt"
            ],
            "acceptanceAr": "البديل يغيّر رقمًا واحدًا على الأقل في الجدول، والأرقام تبقى مقترحة.",
            "resultAr": "صفحة القرار تعرض الجدول. العودة بعد 25 ساعة: مشاهدتان مؤهلتان وفاعل واحد. لا تنفيذ لخوارزمية العد.",
            "evidenceAr": "evidence/ph4-rc2/view-metrics.txt",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc2/view-metrics.txt",
                "label": "فرق المقياسين"
              }
            ],
            "remainingAr": "اعتماد المالك لأحد المقياسين قبل أي تفعيل."
          },
          {
            "id": "P4-RC3-01",
            "titleAr": "إكمال مسار الإعلان الفعلي داخل اكتشفي",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "presentationSlideFromAd كان مستخدمًا في الاختبارات فقط، والمسار المعتاد لا يجلب الإعلان، والوسائط تُنشأ فارغة، وفتح الرابط لا يرسل حدث الإعلان.",
            "goalAr": "الوصول إلى إعلان منشور من مدخل الكتالوج دون حقن شرائح.",
            "impactAr": "الإعلان المنشور لا يظهر في الاستخدام الفعلي، وفتح الرابط لا يُسجَّل.",
            "taskAr": "ربط الإعلان بطبقة البيانات والحالة الموجودة",
            "fixAr": "الكتالوج يطلب الإعلانات المنشورة بعد نجاح التصفح، ويرفض الربط إذا اختلف نوع الأصل أو معرّفه، ويعرض الوسائط المنشورة أو حالة صريحة عند غيابها. فشل التحميل لا يستبدل الإعلان بشريحة محلية. فتح الرابط يسجل الحدث أولًا ثم يفتح المتصفح، ومعرّف المحاولة ثابت لإعادة المحاولة.",
            "filesAr": [
              "lib/features/marketplace/data/discover_published_ad.dart",
              "lib/features/marketplace/data/discover_catalog_gateway.dart",
              "lib/features/marketplace/presentation/discover_feed_controller.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "mira-api/src/marketplace/catalog-ad.controller.ts"
            ],
            "acceptanceAr": "إعلان منتج وإعلان خدمة من المدخل الفعلي، ووسائط أو حالة فراغ، ورفض ربط مختلف، وعدم استبدال إعلان غير متاح.",
            "resultAr": "اختبار منفّذ: flutter test discover_ad_feed_test.dart مع بوابة تسجّل browse وpublishedAds. خرج All tests passed. طلبات طبقة البيانات مثبتة في الاختبار. فتح الرابط استدعى المسجّل المحقون، وفتح المتصفح بديل اختبار. ليس اتصال Firebase حيًا وليس تشغيل جوال.",
            "evidenceAr": "evidence/ph4-rc3/flutter-ad-feed.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc3/flutter-ad-feed.log",
                "label": "سجل Flutter"
              }
            ],
            "remainingAr": "المراجعة المستقلة. اختبار المكوّن الذي يحقن الشريحة بقي ولا يكفي وحده لهذا البند."
          },
          {
            "id": "P4-RC3-02",
            "titleAr": "حماية مسودات التجار من القراءة عبر الإعلانات",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "شريك يستطيع إنشاء إعلان لمنتج غير منشور لشريك آخر ثم قراءة الاسم والسعر والرابط من معاينة الإعلان.",
            "goalAr": "منع استخدام الإعلان للوصول إلى أصل خاص أو غير مؤهل لغير مالكه.",
            "impactAr": "تسرب بيانات مسودة تاجر عبر مسار الإعلان.",
            "taskAr": "التحقق من صلاحية الاطلاع على الأصل في الخادم عند الإنشاء والربط والقراءة",
            "fixAr": "غير المالك يُرفض بـ404 بلا اسم أو سعر أو رابط إذا لم يكن الأصل مؤهلًا للظهور. المالك يرى مسودته. الإدارة تبقى على المعاينة الحالية. إعادة التحقق عند القراءة. إنشاء إعلان لمنتج محاكى غير منشور لغير مالكه لم يعد ينشئ صفًا.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-ad.service.ts",
              "mira-api/src/marketplace/catalog-ad.ph4.rc3.http.integration-tests.ts"
            ],
            "acceptanceAr": "منتج وخدمة عبر HTTP وPostgres محلي: إنشاء، وتغيير ربط، وسحب ثم قراءة، بلا تسريب، مع استمرار مسار المالك والإدارة.",
            "resultAr": "اختبار منفّذ على Postgres محلي. السجل يحتوي ph4 rc3 privacy and link events passed وcleanup=ok test_status=0. ليس مورد تخزين دائمًا.",
            "evidenceAr": "evidence/ph4-rc3/ph4-rc3-integration.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc3/ph4-rc3-integration.log",
                "label": "سجل HTTP المحلي"
              }
            ],
            "remainingAr": "المراجعة المستقلة. لا يغلق PH3-STORAGE-LIVE."
          },
          {
            "id": "P4-RC3-03",
            "titleAr": "عزل وضع المعاينة عن العمليات الفعلية",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "ui-fixture=labeled في بوابة الشركاء يستطيع إرسال POST بجلسة الشريك المحفوظة.",
            "goalAr": "منع أي طلب تشغيلي من المعاينة الموسومة حتى مع وجود جلسة محفوظة.",
            "impactAr": "المعاينة قد تنشئ إعلانًا حقيقيًا.",
            "taskAr": "قطع الطلب قبل fetch في وضع المعاينة",
            "fixAr": "دالة الطلب في البوابة ولوحة الإدارة ترمي خطأ محاكاة قبل fetch وقبل إرفاق الجلسة أو المفتاح عندما تكون ui-fixture=labeled. أزرار الإعلان تقول محاكاة ولا توحي بالحفظ. الوضع العادي يرسل الطلب. الاستعلام يبقى بعد إعادة التحميل.",
            "filesAr": [
              "partners-portal/web/js/api.js",
              "partners-portal/web/js/ads.js",
              "admin-portal/web/js/api.js"
            ],
            "acceptanceAr": "معاينة مع جلسة محفوظة بلا طلبات، ووضع عادي يرسل الطلب والجلسة.",
            "resultAr": "اختبار منفّذ ببديل: node portal-isolation-check.mjs مع fetch مزيّف. المعاينة أرسلت 0 طلبات. الوضع العادي أرسل طلبًا واحدًا لكل بوابة. ليس كتابة على الإنتاج.",
            "evidenceAr": "evidence/ph4-rc3/portal-isolation.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc3/portal-isolation.log",
                "label": "سجل عزل المعاينة"
              }
            ],
            "remainingAr": "المراجعة المستقلة. هذا بديل اختبار وليس مراقبة إنتاج."
          },
          {
            "id": "P4-RC3-04",
            "titleAr": "أهلية أحداث فتح الرابط وربطها",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "الخادم يقبل link_open لخدمة بلا رابط رغم أن الاستجابة العامة تُرجع openLink=false.",
            "goalAr": "رفض الحدث عندما لا يكون الرابط متاحًا، وربطه بالإعلان الصحيح دون أثر مكرر.",
            "impactAr": "إحصاء فتح رابط لإعلان لا يملك رابطًا صالحًا.",
            "taskAr": "استخدام قاعدة الإجراء العام قبل كتابة صف الحدث",
            "fixAr": "قبل الإدراج يُتحقق من الإعلان المنشور وأهلية الأصل ووجود رابط صالح. الغياب أو السحب لا يكتب صفًا. إعادة الحدث نفسه لا تضيف صفًا. استخدامه لإعلان آخر مؤهل يُرفض بـ409. الواجهة تسجل ثم تفتح، وفشل التسجيل لا يفتح الرابط.",
            "filesAr": [
              "mira-api/src/marketplace/catalog-ad.service.ts",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "رابط صالح ومفقود وغير صالح وخدمة بلا رابط وإعلان مسحوب وأصل غير مؤهل وحدث مكرر وحدث لإعلان مختلف، مع عدد الصفوف، واستدعاء Flutter.",
            "resultAr": "اختبار HTTP منفّذ وأثبت الأعداد في السجل عبر نجاح التأكيدات. ادعاء سابق بأن اختبار Flutter نفّذ مسارات فشل الفتح غير صحيح: الملف احتوى شروطًا لتلك المسارات ولم يستدعها. RC4 هو الذي نفّذ رجوع false ورمي الاستثناء. التسليم للمتصفح لا يُوصف بأنه شراء مكتمل.",
            "evidenceAr": "evidence/ph4-rc3/ph4-rc3-integration.log ؛ evidence/ph4-rc3/flutter-ad-feed.log",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc3/ph4-rc3-integration.log",
                "label": "سجل أحداث HTTP"
              },
              {
                "href": "evidence/ph4-rc3/flutter-ad-feed.log",
                "label": "استدعاء الحدث من Flutter"
              }
            ],
            "remainingAr": "المراجعة المستقلة. تغطية فشل الفتح في الواجهة نُقلت إلى RC4 لأن ادعاء RC3 بها لم يكن تنفيذًا فعليًا."
          },
          {
            "id": "P4-RC3-05",
            "titleAr": "إصلاح وإثبات العرض الضيق للبوابتين",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "لقطات عرض 390 في RC2 قصّت النصوص والأزرار.",
            "goalAr": "إبقاء النصوص والحقول والأزرار ظاهرة في 1280 و480 و390 مع RTL.",
            "impactAr": "لقطة ضيقة لا تثبت صلاحية التخطيط إذا كان المحتوى مقصوصًا.",
            "taskAr": "التفاف المحتوى وقياس الأزرار من متصفح بالحجم الفعلي",
            "fixAr": "أزرار الإعلان داخل حاوية تلتف، والنصوص الطويلة تستخدم overflow-wrap. لم يُضف overflow:hidden لإخفاء الخلل. رحلة محلية من الواجهة إلى API: إنشاء وتعديل وإرسال ومعاينة ورفض وتعارض 409 ثم اعتماد ثم سحب. 409 لا يعتمد النسخة الأحدث تلقائيًا.",
            "filesAr": [
              "partners-portal/web/css/site.css",
              "admin-portal/web/css/admin.css",
              "admin-portal/web/js/app.js",
              "partners-portal/web/js/ads.js"
            ],
            "acceptanceAr": "لقطات بعد إعادة التحميل مع viewport وdevicePixelRatio وscrollWidth وclientWidth، ورحلة تشغيلية محلية تشمل 409.",
            "resultAr": "اختبار متصفح منفّذ بـ Chrome محلي على viewports ‏390 و480 و1280. القياسات في portal-metrics.json. ليس تشغيل جوال. بوابة دخول الإدارة في خادم الرحلة مسار محلي للتحقق من المفتاح؛ مسارات الإعلان تستخدم خدمة الكتالوج على Postgres محلي.",
            "evidenceAr": "evidence/ph4-rc3/portal-metrics.json",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc3/partner-ads-form-390.png",
                "label": "نموذج الشريك 390"
              },
              {
                "href": "evidence/ph4-rc3/admin-ads-preview-390.png",
                "label": "معاينة الإدارة 390"
              },
              {
                "href": "evidence/ph4-rc3/admin-ads-409-390.png",
                "label": "تعارض 409"
              },
              {
                "href": "evidence/ph4-rc3/admin-ads-rejection-390.png",
                "label": "سبب الرفض"
              },
              {
                "href": "evidence/ph4-rc3/partner-ads-480.png",
                "label": "الشريك 480"
              },
              {
                "href": "evidence/ph4-rc3/admin-ads-480.png",
                "label": "الإدارة 480"
              },
              {
                "href": "evidence/ph4-rc3/partner-ads-1280.png",
                "label": "الشريك 1280"
              },
              {
                "href": "evidence/ph4-rc3/admin-ads-1280.png",
                "label": "الإدارة 1280"
              },
              {
                "href": "evidence/ph4-rc3/portal-metrics.json",
                "label": "قياسات العرض"
              }
            ],
            "remainingAr": "المراجعة المستقلة. لا يُحتسب هذا اختبار جوال."
          },
          {
            "id": "P4-RC4-01",
            "titleAr": "روابط الوسائط وطلب الإزالة قبل الاعتماد",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "الروابط النسبية تصل إلى العرض بلا تحويل إلى أصل واجهة API، وpendingRemoval يخفي الوسيط في الإعلان قبل اعتماد الإزالة.",
            "impactAr": "الصورة والفيديو لا يُحمّلان من العقد الحالي، والعرض العام يتغير قبل قرار الإدارة.",
            "fixAr": "حل الروابط عبر resolveCatalogMediaUrl في عميل البيانات. اختيار الوسائط المنشورة يستخدم publishedCatalogMediaWhere نفسه في الكتالوج والإعلان، بلا شرط pendingRemoval.",
            "filesAr": [
              "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
              "mira-api/src/marketplace/catalog-published-media.ts",
              "mira-api/src/marketplace/catalog-ad.service.ts",
              "mira-api/src/marketplace/marketplace.service.ts"
            ],
            "acceptanceAr": "رابط نسبي يصبح عنوان API كامل بلا تكرار /api/v1. الصورة تُفك بايتاتها. طلب الإزالة ثم الرفض يبقي الوسيط، والاعتماد يزيله من الإعلان والأصل معًا للمنتج والخدمة.",
            "resultAr": "اختبار Flutter مرّر روابطًا نسبية عبر عميل البيانات حتى العرض، وأثبت عنوان الصورة والفيديو على أصل API بلا تكرار /api/v1، وفك صورة بعرض 1. اختبار HTTP المحلي قارن معرّفات وسائط الإعلان والأصل بعد طلب الإزالة والرفض والاعتماد للمنتج ولمشغل الخدمة. السلسلة الكاملة توقفت قبل RC4 لغياب ثنائي MinIO؛ اختبار RC4 نفسه نُفّذ بعد ذلك ونجح.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc4/flutter-ad-rc4.log",
                "label": "سجل Flutter"
              },
              {
                "href": "evidence/ph4-rc4/ph4-rc4-integration.log",
                "label": "سجل HTTP"
              }
            ],
            "remainingAr": "مراجعة مستقلة. لا صور معاينة توليدية."
          },
          {
            "id": "P4-RC4-02",
            "titleAr": "بحث الإعلانات والصفحات وحفظ الشريحة",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "كل الإعلانات تُعرض دون البحث والفلاتر، وloadMore ينشئ حالة بلا إعلانات.",
            "impactAr": "إعلان غير مطابق يظهر مع نتيجة فارغة، وتختفي الإعلانات عند الصفحة التالية.",
            "fixAr": "التصفية عبر DiscoverCatalogQueryEngine على بيانات الأصل. الصفحات التالية تبقي الإعلانات. الاستجابة المتأخرة تُهمل بعد تغيير الجيل. هوية الشريحة هي معرّف الإعلان.",
            "filesAr": [
              "lib/features/marketplace/presentation/discover_feed_controller.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart",
              "lib/features/marketplace/presentation/presentation/presentation_models.dart"
            ],
            "acceptanceAr": "بحث فارغ ومطابق، وفلاتر المنتج والعيادة والمشغل والتصنيف والمدينة، وصفحتان، وإعلانان لأصل واحد، واستجابة متأخرة، وفشل التحميل ثم إعادته، دون تبديل الشريحة الحالية.",
            "resultAr": "discover_ad_rc4_test.dart نجح: بحث بلا نتائج وبحث مطابق، وفلتر الملابس للعلامة مع المدينة، والعيادة والمشغل مع التصنيف والمدينة، وصفحتان، وإعلانان لأصل واحد، واستجابة متأخرة، وفشل التحميل ثم إعادته.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc4/flutter-ad-rc4.log",
                "label": "سجل Flutter"
              }
            ],
            "remainingAr": "لا سياسة تجارية جديدة لترتيب الإعلانات."
          },
          {
            "id": "P4-RC4-03",
            "titleAr": "نوع الجهة وبيانات الخدمة من المصدر",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "إعلان الخدمة كان يُثبّت النوع clinic ويملأ المدة والقيم الناقصة افتراضيًا.",
            "impactAr": "إعلان المشغل يظهر بواجهة العيادة وتصنيفاتها.",
            "fixAr": "العقد العام يرسل نوع الجهة والمدينة والتصنيف والمدة من الصف. المحلل يرفض الخدمة إذا غاب النوع الحقيقي أو المدينة أو المدة. bookingEnabled لا يعني طلب موعد تشغيلي.",
            "filesAr": [
              "lib/features/marketplace/data/discover_published_ad.dart",
              "mira-api/src/marketplace/catalog-ad.service.ts"
            ],
            "acceptanceAr": "إعلان منتج وعيادة ومشغل يثبت النوع والتصنيف والمعرّف والسعر. المدة الصفرية لا تُخترع.",
            "resultAr": "اختبار Flutter يفصل المكياج عن الليزر. اختبار HTTP يقرأ نوع العيادة والمشغل والمدة 45 والسعر من الصف.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc4/flutter-ad-rc4.log",
                "label": "سجل Flutter"
              },
              {
                "href": "evidence/ph4-rc4/ph4-rc4-integration.log",
                "label": "سجل HTTP"
              }
            ],
            "remainingAr": "مراجعة مستقلة. الحجز التشغيلي خارج النطاق."
          },
          {
            "id": "P4-RC4-04",
            "titleAr": "فتح الرابط ثم تسجيل المحاولة",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "link_open كان يُسجّل قبل الفتح، ومعرّف الحدث يُعاد لكل نقرات الإعلان طوال الشاشة.",
            "impactAr": "فشل الفتح يترك حدث نجاح، وإعادة المحاولة لا تُفصل عن النقرة التالية.",
            "fixAr": "التحقق من الأهلية ثم الفتح. النجاح فقط إذا أعادت الأداة true ولم ترمِ. فشل التسجيل يحفظ معرّف تلك المحاولة لإعادة الإرسال دون فتح ثانٍ. النقرة التالية تأخذ معرّفًا جديدًا. علم الانشغال يمنع التداخل.",
            "filesAr": [
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "false والاستثناء لا يسجلان نجاحًا. إعادة الإرسال بعد فشل التسجيل فتح واحد وأثر واحد. نقرتان مستقلتان بمعرّفين. لا تسجيل عند التحميل أو تبديل الوسيط أو التفاصيل.",
            "resultAr": "اختبار الواجهة نفّذ رجوع false ورمي الاستثناء، ثم فشل التسجيل وإعادة الإرسال بالمعرّف نفسه بلا فتح ثانٍ، ثم نقرتين مستقلتين بمعرّفين مختلفين. لا تسجيل عند التفاصيل أو تبديل الوسيط. اختبار HTTP لـRC3 أُعيد تشغيله وأثبت 409 والرابط غير الصالح والإعلان المسحوب. ادعاء RC3 بتغطية فشل الفتح في Flutter صُحح في بطاقة RC3.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc4/flutter-ad-rc4.log",
                "label": "سجل Flutter"
              }
            ],
            "remainingAr": "رفض الخادم للرابط غير الصالح والمسحوب يبقى من RC3. فتح الرابط ليس شراءً."
          },
          {
            "id": "P4-RC4-05",
            "titleAr": "رحلة البوابتين من الحزمة المفكوكة",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "لقطات 480 و1280 كانت لقائمة فارغة، ونموذج 390 لا يظهر حقوله، والسكربت يثبت مسار المشروع الأصلي.",
            "impactAr": "تشغيل السكربت من حزمة مفكوكة قد يختبر الشجرة الأصلية، والأدلة لا تثبت البطاقات المحمّلة.",
            "fixAr": "جذر المشروع يُستخرج من موقع السكربت أو وسيطة --root، ومجلد الأدلة من --out. اللقطات العريضة تُؤخذ والإعلان قيد المراجعة. النقر يمر بحدث فأرة على مستطيل الزر.",
            "filesAr": [
              "docs/mira-commerce-reference/evidence/ph4-rc3/portal-journey.mjs",
              "mira-api/scripts/ph4-rc3-portal-journey.sh"
            ],
            "acceptanceAr": "رحلة من نسخة مفكوكة تسجل جذر المصدر، وتعرض الحقول والمعاينة والرفض و409، وتقيس viewport وdevicePixelRatio وscrollWidth وclientWidth وحدود الأزرار.",
            "resultAr": "الرحلة نُفذت من النسخة المفكوكة وجذر المصدر المسجّل /tmp/mira-ph4-rc4-unpack. اللقطات تشمل النموذج عند 390 و480 و1280 والإدارة عند 480 و1280 والمعاينة وسبب الرفض و409. الأزرار لها عرض وارتفاع أكبر من صفر ونقر الفأرة سُجّل على مستطيل الزر. ليست اتصال Firebase حيًا ولا تحققًا من التخزين الدائم ولا تشغيل جوال. سلسلة MinIO الكاملة لم تكتمل لغياب الثنائي.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc4/portal-metrics.json",
                "label": "مقاييس الرحلة"
              },
              {
                "href": "evidence/ph4-rc4/partner-ads-form-390.png",
                "label": "حقول النموذج"
              },
              {
                "href": "evidence/ph4-rc4/admin-ads-480.png",
                "label": "إدارة 480"
              },
              {
                "href": "evidence/ph4-rc4/admin-ads-1280.png",
                "label": "إدارة 1280"
              }
            ],
            "remainingAr": "إعادة التشغيل من الحزمة المفكوكة جزء من إغلاق التسليم. ليس اختبار جهاز."
          },
          {
            "id": "P4-RC5-01",
            "titleAr": "إبقاء الصفحات التالية أمام السحب",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "وصول صفحة جديدة يدرج عروضها قبل الإعلان الحالي ثم تقفز الشاشة إلى موضع الإعلان، فتقع النتائج الجديدة خلف المستخدم.",
            "impactAr": "متابعة السحب للأمام تتجاوز النتائج الجديدة.",
            "taskAr": "تسلسل تصفح ثابت يُلحِق الجديد بعد المعروض",
            "fixAr": "DiscoverBrowseSequence يبقي الشرائح المعروضة في ترتيبها ويُلحِق ما لم يُعرض. تغيير البحث يستبدل التسلسل. هوية الإعلان تبقى مفتاح الشريحة.",
            "filesAr": [
              "lib/features/marketplace/presentation/discover_browse_sequence.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "ثلاث صفحات، وسحب للأمام يمر بكل عنوان ظاهر مرة واحدة، وصفحة تصل أثناء الوقوف على إعلان، وإعلانان لأصل واحد، وفشل التحميل ثم إعادته، وتجاهل استجابة متأخرة بعد تغيير البحث.",
            "resultAr": "discover_ad_rc5_test.dart يتحقق من العنوان الظاهر hitTestable لا من عدّ عناصر القائمة. النتيجة تُسجل من النسخة المفكوكة.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc5/flutter-ad-rc5.log",
                "label": "سجل Flutter من النسخة المفكوكة"
              },
              {
                "href": "evidence/source/EVD-0045.txt",
                "label": "مقتطف التسلسل"
              }
            ],
            "remainingAr": "المراجعة المستقلة. لا سياسة تجارية جديدة لترتيب الإعلانات."
          },
          {
            "id": "P4-RC5-02",
            "titleAr": "فصل فتح الرابط عن إعادة إرسال الحدث",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "بعد فتح ناجح وتسجيل فاشل، النقرة التالية على افتحي الرابط تعيد التسجيل فقط ولا تفتح الرابط.",
            "impactAr": "زر الفتح يغيّر وظيفته دون تغيير نصه.",
            "taskAr": "الإبقاء على الفتح لكل محاولة مستقلة وإعادة إرسال المعلق بلا فتح",
            "fixAr": "الزر يفتح الرابط بمعرّف حدث جديد. الحدث المعلق يُعاد إرساله بمؤقت قصير داخل شاشة العرض بالمعرّف نفسه ومن دون فتح المتصفح. فشل التسجيل يُلتقط ولا يصبح استثناءً غير معالج. استجابة متأخرة لا تُعلَن على إعلان آخر.",
            "filesAr": [
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "فتح وتسجيل ناجحان، وفشل الفتح بـfalse وباستثناء، وإعادة إرسال بالمعرّف نفسه بلا فتح إضافي، ونقرة مستقلة أثناء التعليق تفتح بمعرّف جديد، واستمرار الفشل لا يمنع الفتح، واستجابة متأخرة لا تُنسب لإعلان آخر.",
            "resultAr": "الاختبار يفصل عدد الفتحات عن معرّفات الأحداث. إعادة الحدث نفسه على الخادم تبقى alreadyRecorded من اختبار HTTP السابق، وتُعاد من النسخة المفكوكة إن توفرت القاعدة المحلية.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc5/flutter-ad-rc5.log",
                "label": "سجل فتح الرابط"
              },
              {
                "href": "evidence/source/EVD-0046.txt",
                "label": "مقتطف الفصل"
              }
            ],
            "remainingAr": "تسليم الرابط لا يثبت الشراء. المراجعة المستقلة."
          },
          {
            "id": "P4-RC5-03",
            "titleAr": "بحث وصف المنتج للإعلان والأصل",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "العقد العام يرسل descriptionAr ومحلل إعلان المنتج لا ينقله إلى CatalogProduct، فيطابق الأصل ويستبعد الإعلان.",
            "impactAr": "إعلان المنتج يختفي من بحث يطابق وصفه.",
            "taskAr": "نقل الوصف المنشور إلى النموذج الذي يبحثه المحرك الحالي",
            "fixAr": "tryParse ينسخ descriptionAr كما ورد. الغائب يبقى null والفارغ يبقى فارغًا. النص الإعلاني لا يصبح وصفًا.",
            "filesAr": [
              "lib/features/marketplace/data/discover_published_ad.dart"
            ],
            "acceptanceAr": "كلمة في الوصف فقط تطابق الأصل والإعلان، وكلمة غائبة لا تطابق، والوصف الغائب والفارغ، والوصف العربي الطويل، واستمرار فلتر المدينة والتصنيف.",
            "resultAr": "الاختبار يمرر JSON عبر tryParse ثم DiscoverCatalogQueryEngine.matches.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc5/flutter-ad-rc5.log",
                "label": "سجل البحث بالوصف"
              },
              {
                "href": "evidence/source/EVD-0047.txt",
                "label": "مقتطف الوصف"
              }
            ],
            "remainingAr": "المراجعة المستقلة."
          },
          {
            "id": "P4-RC5-04",
            "titleAr": "إعادة الأرشيفين التاريخيين إلى الحزمة",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "فحص الموقع أعاد FAIL 2 لأن حزمة RC4 لم تضم أرشيفين مسجلين في MANIFEST.",
            "impactAr": "المدقق يفشل رغم وجود السجل، أو يمر إذا حُذف السجل.",
            "taskAr": "تضمين البايتات الأصلية المطابقة للسجل",
            "fixAr": "الأرشيفان في deliveries تطابق بصمتاهما سجل MANIFEST. لم يُعَد ضغطهما ولم يُحذف السجل ولم يُضعَف المدقق. التجميع لم يعد يستبعد كل ملفات zip. الحزمة الجديدة لا تحتوي نفسها.",
            "filesAr": [
              "docs/mira-commerce-reference/deliveries/MIRA_DISCOVER_PHASE1_CLOSURE_RC3_.zip",
              "docs/mira-commerce-reference/deliveries/MIRA_DISCOVER_PHASE1_CLOSURE_RC4_20260925_2324.zip"
            ],
            "acceptanceAr": "validate_package.py من النسخة المفكوكة بلا FAIL لغياب هذين الملفين، وروابط RC5 من مجلد الموقع تحل إلى الملفات الثلاثة عند جذر الفك.",
            "resultAr": "البصمات المطابقة للسجل مثبتة في evidence/ph4-rc5/historical-zips.txt. بصمة 8d78f327 المذكورة في تحقق RC4 القديم لم تُوجد ولم يُصنع ملف لها.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc5/historical-zips.txt",
                "label": "بصمات الأرشيفين"
              }
            ],
            "remainingAr": "المراجعة المستقلة لفحص الحزمة بعد الفك."
          },
          {
            "id": "P4-RC5-05",
            "titleAr": "فصل الأدلة التاريخية عن الحالة الحالية",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "فحص freshness يعد 17 اختلافًا عن أدلة سابقة دون تمييز خط الأساس عن الحالة الحالية.",
            "impactAr": "اختلاف تاريخي يُقرأ كفشل حالي، أو تحديث البصمات يخفي الاختلاف.",
            "taskAr": "تصنيف كل دليل والإبقاء على بصمة التثبيت",
            "fixAr": "بنود fact السابقة freshnessRole=baseline وبصماتها كما هي. اختلافها BASELINE_DRIFT. أُضيفت EVD-0045 وEVD-0046 وEVD-0047 للحالة الحالية فقط. المدقق يطبع العددين ولا يسمي المجموعة PASS.",
            "filesAr": [
              "docs/mira-commerce-reference/data/evidence-index.json",
              "docs/mira-commerce-reference/scripts/verify_evidence_freshness.py"
            ],
            "acceptanceAr": "الأدلة التاريخية 21، والحالية المضافة 3، والادعاءات التاريخية غير المعاد التحقق منها 21.",
            "resultAr": "تاريخية 21: تطابق 4، اختلاف 14، بلا بصمة 3. حالية مضافة 3 لتصحيحات RC5. لم يُعَد التحقق من الادعاءات التاريخية. التفاصيل في evidence/ph4-rc5/freshness-classification.txt.",
            "evidenceLinks": [
              {
                "href": "evidence/ph4-rc5/freshness-classification.txt",
                "label": "تصنيف الأدلة"
              },
              {
                "href": "evidence/ph4-rc4/freshness-mismatches.txt",
                "label": "قائمة الاختلافات السابقة"
              }
            ],
            "remainingAr": "ادعاءات خط الأساس لم تُراجع من جديد. لا يُطلب من المالك إعادة جمع ملفات سُلّمت."
          },
          {
            "id": "P4-RC6-01",
            "titleAr": "هوية مستقلة لكل فتح رابط",
            "relatedTaskIds": [
              "P4-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "عداد الشاشة يبدأ من صفر، فأول فتح للإعلان نفسه من شاشتين مستقلتين يولّد link-{adId}-1. قيد eventId الفريد على الجدول يعامل الفتح الثاني كإعادة إرسال.",
            "impactAr": "فتح مستقل لا يُسجل صفًا جديدًا ويعود alreadyRecorded=true.",
            "taskAr": "توليد معرف مرة لكل محاولة والإبقاء عليه عند إعادة الإرسال",
            "fixAr": "المعرف UUID الإصدار الرابع من Random.secure. لا يُستخدم عداد الشاشة ولا الوقت وحده، ولا تُنشأ هوية مستخدم أو بصمة جهاز. المعرف يُنشأ بعد نجاح أداة الفتح ويُثبت مع adId. قيد الخادم لم يُحذف ولم تُحذف الأحداث السابقة.",
            "filesAr": [
              "lib/features/marketplace/presentation/ad_link_open_outbox.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "مثيلان مستقلان ومعرفان مختلفان. إعادة إنشاء الشاشة لا تعيد المعرف. إعادة الإرسال تستخدم المعرف نفسه. إعلانان لأصل واحد يبقيان منفصلين. الفتح ليس شراءً ولا مشاهدة.",
            "resultAr": "discover_ad_rc6_test يغطي المثيلين وإعادة الإنشاء وإعادة الإرسال. اختبار HTTP على PostgreSQL المحلي سجل صفين لحدثين ثم أعاد alreadyRecorded دون صف ثالث، ورفض 409 و404 و503 حسب العقد. العد بقي معطلًا.",
            "evidenceLinks": [
              {
                "href": "evidence/source/EVD-0046.txt",
                "label": "مقتطف الهوية بعد التصحيح"
              },
              {
                "href": "evidence/source/EVD-0048.txt",
                "label": "حدود قائمة الإرسال"
              }
            ],
            "remainingAr": "المراجعة المستقلة. الفتح لا يثبت شراءً ولا مشاهدة."
          },
          {
            "id": "P4-RC6-02",
            "titleAr": "فصل الفتح عن انتظار التسجيل وإعادة المحاولة",
            "relatedTaskIds": [
              "P4-T2"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "قفل الزر كان يبقى أثناء التسجيل، وإعادة المحاولة Timer(Duration.zero) مرة واحدة داخل عمر الصفحة. فشل المحاولة الثانية يترك الحدث بلا مسار، ومغادرة الصفحة تلغيه.",
            "impactAr": "تسجيل معلق يمنع فتحًا لاحقًا، والحدث يضيع مع التخلص من Widget أو يُنسب إلى شريحة أخرى.",
            "taskAr": "إبقاء القفل على محاولة الفتح فقط ونقل الإرسال خارج عمر الصفحة",
            "fixAr": "AdLinkOpenOutbox يحتفظ بالحدث بعد مغادرة الشاشة. الحد: 4 محاولات، تباعد ثانيتين، مهلة الطلب 8 ثوان، الاحتفاظ 10 دقائق، والسعة 20. عند الامتلاء يُترك أقدم حدث غير مرسل، وإن كانت كلها قيد الإرسال يُترك الحدث الجديد فورًا. المتروك abandoned وليس مسجلًا. فشل الشبكة يعاد، و400 و404 و409 رفض نهائي. لا زر للمستخدم لإعادة الإرسال. إغلاق العملية يسقط القائمة؛ لا ضمان بعد إغلاق التطبيق. مغادرة الشريحة تمسح رسالة الشريحة السابقة ولا تفتح رابطًا تأخر التحقق من صلاحيته.",
            "filesAr": [
              "lib/features/marketplace/presentation/ad_link_open_outbox.dart",
              "lib/features/marketplace/data/ad_link_record.dart",
              "lib/features/marketplace/data/datasources/marketplace_api_data_source.dart",
              "lib/features/marketplace/presentation/screens/discover_presentation_screen.dart"
            ],
            "acceptanceAr": "فشل ثم نجاح لنفس الحدث بلا فتح إضافي. نقرة جديدة أثناء تعليق التسجيل تفتح بمعرف جديد. تداخل النقرات لا يفتح مرتين. false أو استثناء أداة الفتح لا ينشئ حدثًا. مغادرة الصفحة لا تضيع إعادة المحاولة ولا تعرض نتيجة الإعلان السابق.",
            "resultAr": "اختبارات الواجهة الستة في discover_ad_rc6_test تمر على زمن الاختبار المزيف، وتشمل الاستنفاد والاحتفاظ والسعة. لم يُختبر بقاء القائمة بعد إغلاق العملية لأنه غير منفذ.",
            "evidenceLinks": [
              {
                "href": "evidence/source/EVD-0048.txt",
                "label": "حدود المحاولات"
              }
            ],
            "remainingAr": "لا تسليم دائم عبر إغلاق التطبيق. المراجعة المستقلة."
          },
          {
            "id": "P4-RC6-03",
            "titleAr": "استبعاد روابط Flutter المولدة من الحزمة",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "فحص RC5 طابق 6738 ملفًا بـis_file وتجاهل 14 رابطًا رمزيًا داخل linux/flutter/ephemeral وwindows/flutter/ephemeral كانت تشير إلى pub-cache.",
            "impactAr": "extra=0 أخفى روابط ليست من مشروع دار كار.",
            "taskAr": "تصحيح قواعد التجميع والفحص دون حذف روابط جهاز المطوّر",
            "fixAr": "التجميع يستبعد ephemeral ولا يتبع الروابط. inspect_zip_package.py يصنف regular وdirectory وsymlink وmissing وmismatch وextra، ويرفض المسارات المكررة والخارجة عن الجذر. الأرشيفان التاريخيان المطلوبان في MANIFEST يبقيان. الحزمة لا تحتوي نفسها.",
            "filesAr": [
              "docs/mira-commerce-reference/scripts/inspect_zip_package.py"
            ],
            "acceptanceAr": "فحص ZIP النهائي يبلغ symlinks=0 وextra=0 وmissing=0 وmismatches=0، وكل ملف منتظم مطلوب مسجل عدا PACKAGE_MANIFEST.json.",
            "resultAr": "نتيجة الفحص النهائي تُكتب خارج الحزمة في سجل FINAL_CHECKS بعد فك النسخة المغلقة. لا تُنسب نتيجة نسخة التجهيز إلى نسخة الفك.",
            "evidenceLinks": [
              {
                "href": "deliveries/PH4-RC6.txt",
                "label": "طريقة إعادة الفحص"
              }
            ],
            "remainingAr": "المراجعة المستقلة لنوع كل مدخل في ZIP."
          },
          {
            "id": "P4-RC6-04",
            "titleAr": "تصحيح سجل تفرد فتح الرابط في الموقع",
            "relatedTaskIds": [
              "P4-T3"
            ],
            "status": "منفذ — بانتظار المراجعة المستقلة",
            "problemAr": "EVD-0046 نسب إلى شاشة RC5 تفردًا عبر الفتحات، بينما البصمة c1e0f8dc8f9ff0630cd5a4282ecf2cea9e38d82e653802b4aea48fab1201a812 كانت لعداد الشاشة الذي يتكرر بين المثيلات.",
            "impactAr": "دليل حالي يثبت سلوكًا لم يعد قائمًا، أو يُستبدل بصمتُه دون ذكر السابقة.",
            "taskAr": "تصحيح الادعاء والإبقاء على البصمة السابقة في القيد",
            "fixAr": "EVD-0046 يصف UUID الشاشة وبصمته الحالية 16e86ba569200da3e0c6adbdde816886cd8fcdc00ac1eed57df6355ac0f4520a، والقيد يذكر البصمة السابقة. EVD-0048 يثبت حدود قائمة الإرسال. جدول الأدلة يعرض baseline وcurrent وحالة التحقق. NOT_RUN وCURRENT_RECORDED ليسا نجاحًا شاملًا. بصمات baseline لم تُستبدل.",
            "filesAr": [
              "docs/mira-commerce-reference/data/evidence-index.json",
              "docs/mira-commerce-reference/js/app.js",
              "docs/mira-commerce-reference/data/discover-phases.json",
              "docs/mira-commerce-reference/data/discover-visual.json"
            ],
            "acceptanceAr": "الملخص وبطاقة المرحلة والتسليم تشير إلى RC6. RC5 حالته تمت مراجعته ويحتاج تصحيحًا. العد غير مفعّل والمرحلتان المعتمدتان كما هما.",
            "resultAr": "validate_package وverify_evidence_freshness يُعادان من جذر الفك النهائي. CURRENT_RECORDED ليس PASS.",
            "evidenceLinks": [
              {
                "href": "evidence/source/EVD-0046.txt",
                "label": "البصمة السابقة والتصحيح"
              },
              {
                "href": "evidence/source/EVD-0048.txt",
                "label": "دليل القائمة"
              }
            ],
            "remainingAr": "ادعاءات baseline لم يُعَد التحقق منها. المراجعة المستقلة."
          }
        ]
      },
      {
        "id": "PH-5",
        "number": 5,
        "nameAr": "الاختبار الشامل وتجهيز الإطلاق",
        "goalAr": "رحلات متكاملة وأداء وصلاحيات واستقلال ميرا وسلامة الوظائف الحالية، مع توثيق الموانع وخطة التراجع.",
        "inScopeAr": [
          "الرحلات المتكاملة",
          "الأداء والصلاحيات",
          "الاستقلال عن الأماكن",
          "توثيق الموانع والجاهزية والتراجع",
          "تحقق التطبيق على الجوال المؤجل من المراحل السابقة"
        ],
        "outOfScopeAr": [
          "النشر العام التلقائي لمجرد تجهيز الإطلاق"
        ],
        "tasks": [
          {
            "id": "P5-T1",
            "nameAr": "الرحلات المتكاملة",
            "status": "قيد التنفيذ"
          },
          {
            "id": "P5-T2",
            "nameAr": "الأداء والصلاحيات وسلامة وظائف ميرا",
            "status": "قيد التنفيذ"
          },
          {
            "id": "P5-T3",
            "nameAr": "الموانع والجاهزية وخطة التراجع",
            "status": "قيد التنفيذ"
          },
          {
            "id": "P5-DEV-01",
            "nameAr": "اختبار اكتشفي على الجوال — مؤجل إلى المرحلة الخامسة بقرار المالك",
            "status": "قيد التنفيذ"
          }
        ],
        "expectedAr": "أدلة اختبار شاملة، وحالة واضحة لكل مانع، وقرار جاهزية مبني على النتائج.",
        "actualAr": "بدأت في 2026-09-27 بقرار المالك لاختبار النسخة الحالية المنشورة وتشغيل التطبيق على الجوال. البنود الأربعة مؤجلة ومفتوحة. لا جاهزية تجارية شاملة.",
        "status": "قيد التنفيذ — نشر وتشغيل واختبار النسخة الحالية",
        "dependenciesAr": "اكتمال المراحل السابقة التي تدخل في قرار الجاهزية. تجهيز الإطلاق لا يعني النشر.",
        "notesAr": "2026-09-27: تأجيل البنود الأربعة المتبقية، والسماح ببدء المرحلة الخامسة لاختبار النسخة الحالية المنشورة وتشغيل التطبيق على الجوال. التأجيل لا يغلق البنود ولا يمنع التجربة الحالية.",
        "blockersAr": "لا شرط يمنع تشغيل النسخة الحالية بسبب البنود التي أجّلها المالك. التخزين الدائم والعد ما زالا غير مكتملين ولا يُعلنان جاهزين.",
        "acceptanceAr": "أدلة اختبار شاملة، وحالة واضحة لكل مانع، وقرار جاهزية مبني على النتائج. تجهيز الإطلاق لا يعني النشر العام تلقائيًا.",
        "evidenceIds": [],
        "reviewPackage": "",
        "verificationReport": "",
        "reviewResultAr": "قيد التنفيذ. ليس اعتمادًا للمرحلة ولا جاهزية تجارية.",
        "reviewDate": "",
        "launchBlockerIds": [
          "PH3-STORAGE-LIVE"
        ],
        "testPlan": [
          {
            "id": "P5-CHECK-01",
            "titleAr": "الرحلات المتكاملة للمستخدمة والشريك والإدارة",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-02",
            "titleAr": "الفيديو والصور والسحب وإدارة الذاكرة",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-03",
            "titleAr": "الثيم والعربية وRTL والتطابق مع التكوين المقبول",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-04",
            "titleAr": "البحث والفلاتر والمتاجر",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-05",
            "titleAr": "المشاهدات وفصل إحصاءات الإعلانات عن الأصل",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-06",
            "titleAr": "صلاحيات المحتوى والمسودات والنشر والسحب",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-07",
            "titleAr": "التخزين الفعلي وحالات فشل الشبكة",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-08",
            "titleAr": "سلامة وظائف ميرا الحالية",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-09",
            "titleAr": "الاستقلال عن دار كار والأماكن",
            "status": "لم تبدأ"
          },
          {
            "id": "P5-CHECK-10",
            "titleAr": "الاختبار النهائي على الجوال وخطة التراجع",
            "status": "لم تبدأ"
          }
        ]
      }
    ],
    "launchBlockers": [
      {
        "id": "PH3-STORAGE-LIVE",
        "status": "مؤجل بقرار المالك",
        "requiredAr": "اعتماد المزود، وتهيئة مورد مستقل مملوك لميرا، وضبط الصلاحيات والأسرار، والتحقق على ذلك المورد.",
        "completedAr": "المحوّل، وحماية الاتصال، والمهلة، والتحقق المحلي من التوقيع، والتكامل المحلي مع API وقاعدة البيانات.",
        "incompleteAr": "التحقق من المورد الفعلي.",
        "closeBeforeAr": "قبل الإطلاق التجاري. المالك أجّله في 2026-09-27 وسمح باختبار النسخة الحالية على الجوال دون إغلاقه.",
        "closeCriteriaAr": "رفع وقراءة صورة وفيديو، والاستمرار بعد إعادة تشغيل التطبيق، وخصوصية المسودة، والحجب بعد السحب، على المورد الفعلي.",
        "evidenceRequiredAr": "سجل تشغيل على المورد المملوك لميرا يبين العمليات الأربع بلا أسرار داخل الحزمة.",
        "reviewDecisionAr": "مؤجل بقرار المالك في 2026-09-27. ليس مغلقًا وليس جاهزًا للإنتاج.",
        "phaseFourNoteAr": "يبقى السجل الوحيد للتخزين الدائم. التأجيل لا يعني أن المورد الفعلي تحقق."
      }
    ],
    "viewCountPolicy": {
      "status": "مؤجل بقرار المالك",
      "noticeAr": "2026-09-27: المالك أجّل اعتماد القواعد. 50٪ والثانية و24 ساعة واستبعاد الزائر ما زالت غير معتمدة، والعد غير مفعّل. التأجيل ليس اعتمادًا ولا يمنع اختبار النسخة الحالية.",
      "recommendedAr": "التوصية: العدد بجانب العين يعني مشاهدات مؤهلة لا فاعلين فريدين. سبب ذلك أن العين تُقرأ كمرات ظهور، ونافذة المنع تمنع تضخيم الشخص نفسه داخل المدة، بينما العودة بعد النافذة تبقى ظهورًا جديدًا. المقياس المقترح: ظهور 50٪ من مساحة العرض لمدة ثانية متصلة والتطبيق في المقدمة والفيديو قيد التشغيل إن كان فيديو. الفاعل المسجل يُحتسب مرة لكل هدف، ثم يمكن أن يُحتسب مرة أخرى بعد 24 ساعة من زمن الخادم لقبول المشاهدة السابقة. الزائر بلا هوية ميرا لا يُحتسب. هذه النسب والمدد مقترحة ولم تُعتمد، وتنفيذ RC4 ليس اعتمادًا لها.",
      "alternativeAr": "البديل الذي يغيّر الحساب: العدد العام هو الفاعلون الفريدون طوال عمر الهدف، أي كل فاعل مسجل يُحتسب مرة واحدة مهما عاد بعد 24 ساعة. أثره رقم أقل عند العودة. يُختار فقط إذا اعتمده المالك بدل التوصية. داخل النافذة نفسها يتطابق الرقمان، والفرق يظهر بعد انتهائها.",
      "timingAr": [
        "المدة المقترحة متصلة وليست تراكمية. هبوط الظهور تحت 50٪ أو الخلفية أو تغطية العرض أو توقف الفيديو أو التخزين المؤقت يصفّر المؤقت.",
        "نافذة منع التكرار تبدأ من زمن الخادم عند قبول المشاهدة المؤهلة، لا من ساعة الجهاز.",
        "الحدث المتأخر يُقيَّم بزمن قبوله على الخادم. إعادة eventId نفسه لا تزيد أي مقياس. eventId جديد بعد انتهاء النافذة يزيد المشاهدات المؤهلة فقط.",
        "فترة الفاعلين الفريدين هي عمر الهدف كله، لا 24 ساعة. لذلك يختلف هذا المقياس عن المشاهدات المؤهلة.",
        "استبعاد الزائر يُنقص الرقم المعروض في المقياسين معًا، لأنه لا توجد هوية قياس قائمة للزائر وبلا بصمة جهاز جديدة."
      ],
      "examples": [
        {
          "caseAr": "الفاعل نفسه مرتين داخل النافذة",
          "factsAr": "فاعل مسجل يستوفي الظهور مرتين خلال ساعة.",
          "qualifiedViews": "1",
          "uniqueActors": "1",
          "differenceAr": "لا فرق هنا. النافذة ومنع تكرار الشخص يطويان التكرار."
        },
        {
          "caseAr": "العودة بعد النافذة",
          "factsAr": "الفاعل نفسه يستوفي الظهور عند القبول ثم بعد 25 ساعة بتوقيت الخادم.",
          "qualifiedViews": "2",
          "uniqueActors": "1",
          "differenceAr": "العودة مشاهدة مؤهلة جديدة وليست فاعلًا جديدًا."
        },
        {
          "caseAr": "فاعلان مختلفان",
          "factsAr": "فاعلان مسجلان يستوفيان الظهور مرة لكل منهما.",
          "qualifiedViews": "2",
          "uniqueActors": "2",
          "differenceAr": "لا فرق. كل فاعل شخص مختلف."
        },
        {
          "caseAr": "إعادة eventId",
          "factsAr": "بعد مشاهدة مقبولة واحدة يُعاد إرسال معرّف الحدث نفسه.",
          "qualifiedViews": "1",
          "uniqueActors": "1",
          "differenceAr": "لا فرق بين المقياسين. هذا منع إعادة الإرسال، وهو منفصل عن نافذة السياسة."
        },
        {
          "caseAr": "تبديل صور العرض",
          "factsAr": "الفاعل يبقى على العرض نفسه ويبدّل صوره الداخلية.",
          "qualifiedViews": "1",
          "uniqueActors": "1",
          "differenceAr": "لا فرق. تبديل الصور لا ينشئ مشاهدة."
        },
        {
          "caseAr": "إعلان ثم الأصل",
          "factsAr": "مشاهدة إعلان مؤهلة ثم فتح الأصل دون استيفاء ظهور الأصل.",
          "qualifiedViews": "1 للإعلان و0 للأصل",
          "uniqueActors": "1 للإعلان و0 للأصل",
          "differenceAr": "لا فرق داخل كل هدف. الحدثان منفصلان، ومشاهدة الإعلان لا تزيد الأصل."
        },
        {
          "caseAr": "زائر بلا هوية",
          "factsAr": "زائر يستوفي الظهور ولا يملك معرّف مستخدم ميرا.",
          "qualifiedViews": "0",
          "uniqueActors": "0",
          "differenceAr": "لا فرق بين المقياسين. الاستبعاد ينقص الرقم المعروض مقابل مرات الظهور."
        }
      ],
      "points": [
        {
          "titleAr": "1. التعريف",
          "textAr": "المشاهدة للعرض كله: صورة أو فيديو أو عرض متعدد. ليست لكل إطار أو صورة داخلية."
        },
        {
          "titleAr": "2. النسبة والمدة",
          "textAr": "التوصية 50٪ لمدة ثانية متصلة. الظهور العابر أقصر من أن يُقرأ. المصدر PLC-0008 ما زال مقترحًا."
        },
        {
          "titleAr": "3. تشغيل الفيديو",
          "textAr": "الفيديو يجب أن يكون قيد التشغيل. الإيقاف والتخزين المؤقت يصفّران المؤقت ولا يُجمعان."
        },
        {
          "titleAr": "4. الخلفية والتغطية",
          "textAr": "الخلفية أو تغطية العرض توقف المؤقت. لا تُحتسب المدة التي غاب فيها العرض."
        },
        {
          "titleAr": "5. طبقات المنع",
          "textAr": "إعادة eventId نفسه طبقة مستقلة. نافذة 24 ساعة طبقة السياسة للمشاهدات المؤهلة. الفاعل الفريد طبقة ثالثة طوال عمر الهدف."
        },
        {
          "titleAr": "6. المشاهدات والأشخاص",
          "textAr": "المشاهدة المؤهلة تعد مرات الظهور بعد النافذة. الفاعل الفريد يعد الأشخاص. لا يُجمعان في رقم واحد."
        },
        {
          "titleAr": "7. المسجل والزائر",
          "textAr": "التصفح العام موجود بلا تسجيل. المسجل يستخدم معرّف مستخدم ميرا. الزائر لا يُحتسب حتى لا تُنشأ بصمة جهاز."
        },
        {
          "titleAr": "8. المعاينة والاختبار",
          "textAr": "معاينة الشريك والإدارة وبيانات الاختبار والمحتوى المحاكى لا تدخل العدد العام."
        },
        {
          "titleAr": "9. إعادة المحاولة والتأخر",
          "textAr": "إعادة جلب العدد ليست مشاهدة. الحدث المتأخر يُحكم بزمن الخادم عند قبوله."
        },
        {
          "titleAr": "10. الإعلان والأصل",
          "textAr": "مشاهدة الإعلان للإعلان فقط. مشاهدة الأصل لا تزيد إعلاناته. فتح الرابط ليس شراءً، وطلب الموعد ليس حجزًا مؤكدًا."
        }
      ],
      "fixedRulesAr": [
        "التحميل المسبق ليس مشاهدة.",
        "تغيير صور العرض نفسه لا يضاعف مشاهدة العرض.",
        "إعادة إرسال الحدث نفسه لا تزيد العدد.",
        "فتح رابط الشراء لا يثبت اكتمال الشراء.",
        "طلب الموعد لا يثبت حجزًا مؤكدًا.",
        "لا أعداد وهمية ولا صفر افتراضي عند تعذر الجلب.",
        "القياس لا يثبت بشرية كل مشاهد ولا يمنع الاحتيال بالكامل."
      ],
      "pendingDecisionAr": "القرار الواحد المطلوب من المالك: إما اعتماد التوصية الحالية كما هي مكتوبة في هذه البطاقة، وإما اعتماد البديل الذي يجعل العدد فاعلين فريدين طوال عمر الهدف. حتى يصدر ذلك صراحة، تبقى 50٪ والثانية و24 ساعة واستبعاد الزائر مقترحة، والعد غير مفعّل، وهذا التكليف ليس اعتمادًا."
    },
    "prePhase5Closure": {
      "titleAr": "إغلاق المتبقي قبل المرحلة الخامسة",
      "noteAr": "هذه البنود مربوطة بالبطاقات الأصلية ولا تنشئ سجلًا ثانيًا للمشكلة نفسها. تجهيز قائمة المرحلة الخامسة لا يعني تنفيذها.",
      "items": [
        {
          "id": "P4-RC7-01",
          "titleAr": "إلغاء محاولة النقل قبل إعادة الإرسال",
          "linkedIds": [
            "P4-RC6-02",
            "PH-4"
          ],
          "status": "مختبر محليًا — بانتظار المراجعة",
          "ownerAr": "التنفيذ",
          "closeWhenAr": "لا يبدأ نقل ثانٍ للحدث نفسه بينما النقل الأول ما زال نشطًا لدى العميل، ومهلة المحاولة تلغي الطلب قبل الجدولة التالية.",
          "doneAr": "انتهاء المهلة يستدعي AdLinkAttemptControl.cancel، وطبقة البيانات تلغي CancelToken الخاص بـDio دون تغيير مهلات الشبكة لبقية ميرا. الإرسال التالي ينتظر اكتمال future المحاولة الملغاة. adId وeventId يبقيان. استجابة recorded المتأخرة تُحفظ ولا تُجدول محاولة إضافية. استثناء sender يُلتقط.",
          "testedAr": "اختبار محلي بزمن مزيف: نقل نشط واحد، والإلغاء يسبق البديلة، والاستجابة المسجلة تبقى recorded، وضاعت الاستجابة بعد قبول محلي ثم أعادت المحاولة الصف نفسه. طبقة Dio عبر httpClientAdapter تثبت أن الإلغاء يصل إلى النقل. إعادة الإرسال لا تفتح المتصفح.",
          "evidenceAr": "discover_ad_rc7_test.dart من جذر الفك. إلغاء اتصال العميل لا يثبت أن الخادم ألغى المعالجة؛ إعادة eventId نفسه تبقى idempotent كما في اختبار HTTP السابق.",
          "evidenceLinks": [
            {
              "href": "evidence/source/EVD-0048.txt",
              "label": "حدود الإلغاء والسعة"
            }
          ],
          "remainingAr": "المراجعة المستقلة. لا تسليم بعد إغلاق العملية."
        },
        {
          "id": "P4-RC7-02",
          "titleAr": "حد سجل الحالات النهائية",
          "linkedIds": [
            "P4-RC6-02",
            "PH-4"
          ],
          "status": "مختبر محليًا — بانتظار المراجعة",
          "ownerAr": "التنفيذ",
          "closeWhenAr": "سجل الحالات النهائية له سعة وعمر، والتنظيف أثناء التشغيل لا يمس حدثًا معلقًا.",
          "doneAr": "maxTerminal=32 وterminalRetention=10 دقائق. التنظيف يعمل عند الإدراج والإنهاء. recorded وrejected وabandoned تبقى حالات مختلفة. abandoned ليس نجاحًا. لا تخزين دائم ولا إطار طوابير.",
          "testedAr": "اختبار محلي: أربعة أحداث مكتملة بسعة 2، وانتهاء العمر يزيل الحالة القديمة، والحدث المعلق يبقى pending.",
          "evidenceAr": "discover_ad_rc7_test.dart",
          "evidenceLinks": [
            {
              "href": "evidence/source/EVD-0048.txt",
              "label": "سعة الحالات"
            }
          ],
          "remainingAr": "المراجعة المستقلة."
        },
        {
          "id": "P4-T1-CLOSE",
          "titleAr": "اعتماد قواعد المشاهدات",
          "linkedIds": [
            "P4-T1",
            "view-count-policy"
          ],
          "status": "مؤجل بقرار المالك",
          "ownerAr": "المالك",
          "closeWhenAr": "قرار صريح من المالك يحدد السياسة وإصدارها. توصية الشاشة أو هذا التكليف ليست اعتمادًا.",
          "doneAr": "فُحص السجل. لا يوجد قرار مالك سابق يعتمد الأرقام. بطاقة view-count-policy بقيت، والقرار المطلوب واحد: اعتماد التوصية أو البديل.",
          "testedAr": "لم يُنفذ عد. لم يُفعّل.",
          "evidenceAr": "بطاقة قرار قواعد المشاهدات في السجل نفسه.",
          "remainingAr": "مؤجل بقرار المالك في 2026-09-27 ويبقى مفتوحًا. التأجيل ليس إغلاقًا."
        },
        {
          "id": "P4-T2-CLOSE",
          "titleAr": "العد الحقيقي",
          "linkedIds": [
            "P4-T2",
            "P4-T1"
          ],
          "status": "مؤجل بقرار المالك",
          "ownerAr": "المالك ثم التنفيذ",
          "closeWhenAr": "بعد اعتماد P4-T1: مصدر خادمي، وفصل إعلان المشهور عن الأصل، ومنع التحميل المسبق والتكرار، وصفر مختلف عن التعذر.",
          "doneAr": "لم يُنفذ. لا سياسة مختارة افتراضيًا.",
          "testedAr": "غير منفذ.",
          "evidenceAr": "لا دليل تنفيذ لأن الشرط السابق غير متحقق.",
          "remainingAr": "مؤجل بقرار المالك في 2026-09-27 ويبقى مفتوحًا. التأجيل ليس إغلاقًا."
        },
        {
          "id": "PH3-STORAGE-LIVE-CLOSE",
          "titleAr": "التخزين على المورد الفعلي",
          "linkedIds": [
            "PH3-STORAGE-LIVE",
            "PH-3"
          ],
          "status": "مؤجل بقرار المالك",
          "ownerAr": "المالك",
          "closeWhenAr": "مزود ومورد معتمدان مملوكان لميرا، مع رفع صورة وفيديو وقراءتهما، واستمرارهما بعد إعادة تشغيل API، وخصوصية المسودة، والحجب بعد السحب.",
          "doneAr": "فُحصت البيئة المحلية دون طباعة أسرار. لا قيمة لمخزن الوسائط ولا لنقطة نهاية ولا لمفاتيح. لم يُنشأ مورد مدفوع ولم يُختر مزود جديد.",
          "testedAr": "غير منفذ على مورد فعلي. MinIO المحلي غير موجود، ورابط dl.min.io الرسمي أعاد HTTP 410.",
          "evidenceAr": "السجل الوحيد PH3-STORAGE-LIVE يبقى مفتوحًا. نجاح محول سابق أو MinIO محلي لا يغلقه.",
          "remainingAr": "مؤجل بقرار المالك في 2026-09-27 ويبقى مفتوحًا. التأجيل ليس إغلاقًا."
        },
        {
          "id": "PH4-RC7-SUITE",
          "titleAr": "سلسلة التكامل المحلية",
          "linkedIds": [
            "PH-3",
            "PH-4"
          ],
          "status": "مؤجل بقرار المالك",
          "ownerAr": "التنفيذ",
          "closeWhenAr": "تشغيل السلسلة الكاملة بأدواتها، وتمييز نتيجتها عن الاختبارات المستهدفة.",
          "doneAr": "أُضيف اختبار HTTP لأحداث RC6 سابقًا. محاولة جلب MinIO الرسمي توقفت عند HTTP 410.",
          "testedAr": "شُغّلت السلسلة المحلية على قاعدة اختبار ثم حُذفت. توقفت عند spawn /tmp/mira-rc6-tools/minio ENOENT بعد نجاح اختبارات محلية سابقة في التشغيل نفسه. اختبارات الإعلان داخل هذه السلسلة لم تُبلغ. نجاحها المستهدف لاحقًا ليس نجاح السلسلة. رابط dl.min.io الرسمي أعاد HTTP 410.",
          "evidenceAr": "evidence/ph4-rc7/suite-worktree.log سجل تجهيز وليس سجل الفك النهائي. full_suite=FAIL عند غياب MinIO.",
          "remainingAr": "مؤجل بقرار المالك في 2026-09-27 ويبقى مفتوحًا. التأجيل ليس إغلاقًا."
        },
        {
          "id": "PH4-RC7-PACKAGE",
          "titleAr": "حزمة المراجعة قبل المرحلة الخامسة",
          "linkedIds": [
            "PH-4",
            "PH-5",
            "DEL-PH4-RC7"
          ],
          "status": "بانتظار المراجعة",
          "ownerAr": "التنفيذ",
          "closeWhenAr": "حزمة مغلقة ببصمة خارجها، وفحص أنواع المدخلات، وسجل فك نهائي، وروابط أربعة تعمل من الموقع.",
          "doneAr": "روابط DEL-PH4-RC7 تشير إلى الملفات الأربعة بجانب جذر الفك. الحزمة لا تحتوي نفسها.",
          "testedAr": "نتيجة الفحص تُكتب من النسخة المفكوكة في FINAL_CHECKS، لا من نسخة التجهيز.",
          "evidenceAr": "deliveries/PH4-RC7.txt",
          "evidenceLinks": [
            {
              "href": "deliveries/PH4-RC7.txt",
              "label": "طريقة إعادة الفحص"
            }
          ],
          "remainingAr": "المراجعة المستقلة. الانتقال إلى الخامسة يبقى ممنوعًا ما بقي اعتماد المشاهدات والعد والتخزين الفعلي."
        }
      ]
    },
    "ownerDecisionAr": "2026-09-27: تأجيل البنود الأربعة المتبقية، والسماح ببدء المرحلة الخامسة لاختبار النسخة الحالية المنشورة وتشغيل التطبيق على الجوال. المعتمد بالكامل يبقى مرحلتين. البنود المؤجلة مفتوحة وليست مكتملة. تصحيحات RC7 البرمجية محفوظة. هذا ليس جاهزية تجارية ولا اكتمالًا للمشاهدات أو التخزين."
  },
  "discoverVisual": {
    "titleAr": "التصميم المعتمد لاكتشفي",
    "decisionDate": "2026-09-26",
    "decisionTitleAr": "التكوين من الصور، والهوية من ثيم ميرا",
    "decisionAr": "الصور المرجعية الثلاث مرجع للتكوين وطريقة العرض وتوزيع العناصر وتفاصيل التصفح. الثيم الحالي لميرا هو المرجع للألوان والخطوط والمكونات وحالاتها. هذا القرار يحدّث أي تعليمات سابقة تطلب نسخ ألوان الصور وخطوطها حرفيًا. لا يُنشأ ثيم مستقل لاكتشفي، ولا يُغيَّر الثيم العام للتطبيق كي يشبه الصور. عند تعارض تفصيل بصري مع مكوّن ميرا الموحّد يُحفظ اتساق ميرا ويُسجَّل الفرق وسببه. اختلاف الألوان والخطوط الناتج عن الثيم تطبيق للقرار، وليس نقص مطابقة.",
    "deviceDeferralAr": "اختبار الجوال مؤجل إلى المرحلة الخامسة بقرار المالك، بعد اكتمال التطوير والتكامل وقبل الإطلاق العام. التأجيل ليس إثباتًا أن المشغّل الحقيقي اشتغل.",
    "historicalPhaseApprovalAr": "المرحلة الأولى غير معتمدة. هذه الجولة للمراجعة فقط.",
    "phaseApprovalAr": "المعتمد بالكامل مرحلتان من خمس. 2026-09-27: المالك أجّل اعتماد المشاهدات والعد الحقيقي وتخزين PH3-STORAGE-LIVE وسلسلة MinIO، وسمح ببدء المرحلة الخامسة لاختبار النسخة الحالية. التصحيحات البرمجية لـRC7 محفوظة. لا جاهزية تجارية.",
    "priorVisualRc1Ar": "الحزمة البصرية الأولى بُنيت من وصف نصي قبل فتح الصور، ورُفضت كمطابقة بصرية. تبقى سجلًا للهيكل الأولي وليست مطابقة.",
    "themeSources": [
      {
        "path": "lib/shared/theme/colors.dart",
        "roleAr": "ألوان الواجهة: primary #E86FA9 وbackground #FFF7FA وtextPrimary #4A3A3A وborder #F8BBD0 وglassFill"
      },
      {
        "path": "lib/shared/theme/typography.dart",
        "roleAr": "Tajawal لنص الواجهة، وPlayfair Display لكلمة MIRA"
      },
      {
        "path": "assets/fonts/Tajawal-Regular.ttf",
        "roleAr": "ملف خط الواجهة"
      },
      {
        "path": "assets/fonts/PlayfairDisplay-Variable.ttf",
        "roleAr": "ملف خط الشعار"
      },
      {
        "path": "lib/features/marketplace/presentation/presentation/discover_visual_chrome.dart",
        "roleAr": "تكوين اكتشفي فوق المكوّنات المشتركة دون ثيم موازٍ"
      }
    ],
    "references": [
      {
        "file": "evidence/visual/references/3856406F-4363-4706-8F2C-D7E44477AFFA.jpeg",
        "screenAr": "المنتجات",
        "pixels": "711×1536",
        "sha256": "75c8ded57a6726e320cd3154ed49b923764e8e0c9eb0251b20bea18fc244f6d6",
        "statusAr": "فُتحت الصورة وتحققت البصمة. التكوين: شعار وسط، رجوع يمين، بحث ثم فلتر يسار، صوت يسار الوسائط، معلومات يمين، قلب ومشاركة عموديان يسار، إجراءات التفاصيل ثم اشتري الآن ثم المتجر، تصنيفات من اليمين: الكل محددة ثم الوجه والجسم والشعر والملابس."
      },
      {
        "file": "evidence/visual/references/C29F7690-9EB9-45CA-A167-D212A90D0A6C.jpeg",
        "screenAr": "العيادات",
        "pixels": "707×1536",
        "sha256": "3f6c34fc86508b041351de2a5dd5d836556ea308862712d9bcbdd1551b45ed9c",
        "statusAr": "فُتحت الصورة وتحققت البصمة. صوت يمين الوسائط. العنوان ثم العيادة ثم المدينة. قلب ومشاركة في صف. أزرار التفاصيل واطلبي موعدًا والموقع بانحناء أوضح. التصنيف المحدد البشرة."
      },
      {
        "file": "evidence/visual/references/617733F4-AC10-49C7-9768-0D8C3883850C.jpeg",
        "screenAr": "المشاغل",
        "pixels": "711×1536",
        "sha256": "a5ed531d24ec2f06e17e66e6ab333bd19b0c53ffbb04d036b365bccc3894e2c7",
        "statusAr": "فُتحت الصورة وتحققت البصمة. صوت يسار الوسائط. صف خدمة مثل العيادة مع انحناء أزرار أقل. التصنيف المحدد الشعر، ثم المكياج والأظافر والعناية."
      }
    ],
    "implementationShots": [
      "evidence/visual/implementation/product.png",
      "evidence/visual/implementation/clinic.png",
      "evidence/visual/implementation/salon.png",
      "evidence/visual/implementation/ratio-portrait.png",
      "evidence/visual/implementation/ratio-square.png",
      "evidence/visual/implementation/ratio-landscape.png",
      "evidence/visual/implementation/video.png"
    ],
    "comparisons": [
      "evidence/visual/comparisons/product.png",
      "evidence/visual/comparisons/clinic.png",
      "evidence/visual/comparisons/salon.png"
    ],
    "intentionalThemeDeltasAr": [
      "أزرار البحث والفلاتر والإجراءات والتصنيفات بلون ميرا الوردي #E86FA9 وحدود #F8BBD0، لا بالبني الظاهر في الصور.",
      "النصوص بخط Tajawal والشعار بخط Playfair Display، لا بخط الصورة.",
      "حقل البحث حبة Material وInkWell من مكوّنات Flutter، وليس حقل كتابة مفعّلًا؛ النقر يوضح أن البحث غير متاح الآن.",
      "أيقونة العين بقيت في طرف الشريط وفق الثيم، بلا عدد. المشاهدات الحقيقية مؤجلة إلى المرحلة الرابعة."
    ],
    "remainingAr": [
      "لا نسبة مطابقة رقمية. المقارنة في evidence/visual/comparisons.",
      "صور المعاينة مولّدة ومنفصلة عن التجار، ولا تُعرض إلا عند تمرير previewSlides صراحة. الدخول العادي يستخدم slides() من الكتالوج.",
      "العينات الهندسية تُعرض كاملة بـ BoxFit.contain. ملف العينة المربعة ينتهي بنصف خلية، وملف العينة الأفقية ينتهي بشريط أبيض أقصر؛ اللقطة تُظهر هذا الحد ولا تقصّه زيادة.",
      "لقطة video.png دليل تكوين وزر صوت فقط. _QuietVideoPort يعيد SizedBox.expand ولا يشغّل video_player. اختبارات الملكية والكتم والإيقاف منفصلة. التشغيل على الجوال في المرحلة الخامسة.",
      "البحث والفلاتر والمتجر والموعد والموقع والمفضلة والمشاركة غير منفذة. إطار التصنيف المحدد ليس فلترًا.",
      "شريط النظام ظاهر في المراجع وغير مرسوم في التطبيق.",
      "اختبار الجوال لم يُشغَّل في RC4. موضعه المرحلة الخامسة."
    ],
    "implementationAr": "RC4: المسار العادي على شرائح الكتالوج، والمعاينة اختيار صريح بالشاشة نفسها. شرائط الوسائط أعلى اليمين وعددها من الوسائط الفعلية. صف التصنيفات يتسع مع العرض ويتمرر أفقيًا عند الضيق. صورة الملابس فستان وردي كامل الشكل. أدلة النسب معزولة. لقطة الفيديو تثبت الكروم وزر الصوت فقط.",
    "generatedRegister": "evidence/visual/generated/assets.json"
  },
  "sections": [
    {
      "id": "s0",
      "num": "00",
      "title": "لوحة المشروع",
      "icon": "📊"
    },
    {
      "id": "s1",
      "num": "01",
      "title": "الرؤية والنطاق",
      "icon": "🎯"
    },
    {
      "id": "s2",
      "num": "02",
      "title": "خط الأساس والمستودعات",
      "icon": "📦"
    },
    {
      "id": "s3",
      "num": "03",
      "title": "الموجود حاليًا",
      "icon": "✅"
    },
    {
      "id": "s4",
      "num": "04",
      "title": "الخدمات المتوقفة",
      "icon": "⏸️"
    },
    {
      "id": "s5",
      "num": "05",
      "title": "رحلة العميل",
      "icon": "🧍"
    },
    {
      "id": "s6",
      "num": "06",
      "title": "رحلة المتجر والعيادة",
      "icon": "🏪"
    },
    {
      "id": "s7",
      "num": "07",
      "title": "المشاهير والإعلانات",
      "icon": "⭐"
    },
    {
      "id": "s8",
      "num": "08",
      "title": "التصنيفات والفلاتر",
      "icon": "🔎"
    },
    {
      "id": "s9",
      "num": "09",
      "title": "الفيديو والصور",
      "icon": "🎬"
    },
    {
      "id": "s10",
      "num": "10",
      "title": "الطلبات والحجوزات والتواصل",
      "icon": "🧾"
    },
    {
      "id": "s11",
      "num": "11",
      "title": "التحليلات",
      "icon": "📈"
    },
    {
      "id": "s12",
      "num": "12",
      "title": "الصلاحيات والخصوصية والتنظيم",
      "icon": "🔒"
    },
    {
      "id": "s13",
      "num": "13",
      "title": "البنية والتكاملات المقترحة",
      "icon": "🏗️"
    },
    {
      "id": "s14",
      "num": "14",
      "title": "مصفوفة المتطلبات والفجوات",
      "icon": "🗂️"
    },
    {
      "id": "s15",
      "num": "15",
      "title": "المراحل وشروط القبول",
      "icon": "🚦"
    },
    {
      "id": "s16",
      "num": "16",
      "title": "القرارات والأسئلة المفتوحة",
      "icon": "❓"
    },
    {
      "id": "s17",
      "num": "17",
      "title": "مكتبة الأدلة",
      "icon": "📚"
    },
    {
      "id": "s18",
      "num": "18",
      "title": "سجل التغييرات والإصدارات",
      "icon": "📝"
    },
    {
      "id": "s19",
      "num": "19",
      "title": "تحديث المرجع والتحقق",
      "icon": "🔄"
    },
    {
      "id": "s20",
      "num": "20",
      "title": "ملاحظات المراجعة ومعالجتها",
      "icon": "🧾"
    },
    {
      "id": "s21",
      "num": "21",
      "title": "تغطية التكليف والتحقق من اكتماله",
      "icon": "📌"
    },
    {
      "id": "s22",
      "num": "22",
      "title": "ملخص قرار الأماكن",
      "icon": "🧭"
    },
    {
      "id": "s23",
      "num": "23",
      "title": "ما وصل من الأماكن",
      "icon": "📥"
    },
    {
      "id": "s24",
      "num": "24",
      "title": "نتائج مراجعة الحزمة",
      "icon": "🧪"
    },
    {
      "id": "s25",
      "num": "25",
      "title": "معالجة ملاحظات الحزمة",
      "icon": "🛠️"
    },
    {
      "id": "s26",
      "num": "26",
      "title": "مصفوفة إعادة الاستخدام",
      "icon": "🧩"
    },
    {
      "id": "s27",
      "num": "27",
      "title": "تجربة المنتجات",
      "icon": "🛍️"
    },
    {
      "id": "s28",
      "num": "28",
      "title": "تجربة العيادات والمشاغل",
      "icon": "💇"
    },
    {
      "id": "s29",
      "num": "29",
      "title": "معيار الوسائط",
      "icon": "🖼️"
    },
    {
      "id": "s30",
      "num": "30",
      "title": "المشاهدات والإحصاءات",
      "icon": "👁️"
    },
    {
      "id": "s31",
      "num": "31",
      "title": "ربط المتاجر والمشاهير",
      "icon": "🔗"
    },
    {
      "id": "s32",
      "num": "32",
      "title": "خطة تنفيذ الأماكن",
      "icon": "🗺️"
    },
    {
      "id": "s33",
      "num": "33",
      "title": "قرارات أماكن مفتوحة",
      "icon": "❓"
    },
    {
      "id": "s34",
      "num": "34",
      "title": "أدلة حزمة الأماكن",
      "icon": "📦"
    },
    {
      "id": "s35",
      "num": "35",
      "title": "سجل خطة الأماكن",
      "icon": "🗒️"
    },
    {
      "id": "s36",
      "num": "36",
      "title": "التصورات المرجعية",
      "icon": "🎨"
    },
    {
      "id": "s37",
      "num": "37",
      "title": "تصحيح توثيق حزمة المصدر",
      "icon": "📎"
    },
    {
      "id": "s38",
      "num": "38",
      "title": "تفعيل اختبار اكتشفي وخطة الدمج",
      "icon": "🧪"
    },
    {
      "id": "s39",
      "num": "39",
      "title": "مراحل تطوير اكتشفي",
      "icon": "🧭"
    },
    {
      "id": "s40",
      "num": "40",
      "title": "التصميم المعتمد لاكتشفي",
      "icon": "🎨"
    }
  ]
};
