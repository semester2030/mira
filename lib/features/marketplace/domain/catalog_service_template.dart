/// Single source of truth for service registration templates and detail rendering.
/// Answers use explicit states: unset / notApplicable / value — never imply "no" from silence.
library;

enum CatalogServicePriceMode {
  /// Fixed published price on the service row.
  fixed,

  /// "Starts from" — uses the service price as the floor when known.
  from,

  /// Price decided after an assessment; do not show 0 as money.
  afterAssessment,

  /// Explicitly unknown / not published.
  unknown,
}

enum CatalogServiceFieldType {
  singleSelect,
  multiSelect,
  boolean,
  text,
  number,
}

enum CatalogServiceAnswerState {
  /// Merchant has not answered.
  unset,

  /// Field does not apply to this offering.
  notApplicable,

  /// Explicit answer (including an explicit "no" / "none").
  value,
}

class CatalogServiceFieldOption {
  const CatalogServiceFieldOption({required this.id, required this.labelAr});

  final String id;
  final String labelAr;
}

class CatalogServiceFieldDef {
  const CatalogServiceFieldDef({
    required this.id,
    required this.labelAr,
    required this.type,
    required this.sectionId,
    this.options = const [],
    this.unit,
    this.required = false,
    this.visibleWhenField,
    this.visibleWhenAnyOf = const [],
    this.iconKey = 'info',
    this.allowExplicitNone = false,
    this.noneLabelAr = 'لا',
  });

  final String id;
  final String labelAr;
  final CatalogServiceFieldType type;
  final String sectionId;
  final List<CatalogServiceFieldOption> options;
  final String? unit;
  final bool required;
  final String? visibleWhenField;
  final List<String> visibleWhenAnyOf;
  final String iconKey;
  final bool allowExplicitNone;
  final String noneLabelAr;
}

class CatalogServiceSectionDef {
  const CatalogServiceSectionDef({
    required this.id,
    required this.titleAr,
    this.iconKey = 'info',
  });

  final String id;
  final String titleAr;
  final String iconKey;
}

class CatalogServiceTemplateDef {
  const CatalogServiceTemplateDef({
    required this.id,
    required this.version,
    required this.labelAr,
    required this.category,
    required this.partnerTypes,
    required this.suggestedNameAr,
    required this.fields,
    this.sections = CatalogServiceTemplates.defaultSections,
  });

  final String id;
  final int version;
  final String labelAr;
  final String category;
  final List<String> partnerTypes;
  final String suggestedNameAr;
  final List<CatalogServiceFieldDef> fields;
  final List<CatalogServiceSectionDef> sections;
}

class CatalogServiceAnswer {
  const CatalogServiceAnswer._(this.state, this.value);

  const CatalogServiceAnswer.unset() : this._(CatalogServiceAnswerState.unset, null);
  const CatalogServiceAnswer.notApplicable() : this._(CatalogServiceAnswerState.notApplicable, null);
  const CatalogServiceAnswer.value(Object value) : this._(CatalogServiceAnswerState.value, value);

  final CatalogServiceAnswerState state;
  final Object? value;

  bool get hasDisplayableValue => state == CatalogServiceAnswerState.value;

  String? asString() {
    if (!hasDisplayableValue) return null;
    final v = value;
    if (v is String) return v;
    if (v is List) return v.map((e) => e.toString()).join('، ');
    if (v is bool) return v ? 'نعم' : 'لا';
    return v?.toString();
  }

  List<String> asStringList() {
    if (!hasDisplayableValue) return const [];
    final v = value;
    if (v is List) return v.map((e) => e.toString()).toList();
    if (v is String && v.isNotEmpty) return [v];
    return const [];
  }

  bool? asBool() {
    if (!hasDisplayableValue) return null;
    final v = value;
    if (v is bool) return v;
    return null;
  }

  int? asInt() {
    if (!hasDisplayableValue) return null;
    final v = value;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v');
  }
}

/// Snapshot of template answers stored on a service. Does not duplicate price/duration/partner.
class CatalogServiceProfile {
  const CatalogServiceProfile({
    this.templateId,
    this.templateVersion = 0,
    this.priceMode = CatalogServicePriceMode.fixed,
    this.answers = const {},
  });

  final String? templateId;
  final int templateVersion;
  final CatalogServicePriceMode priceMode;
  final Map<String, CatalogServiceAnswer> answers;

  CatalogServiceAnswer answer(String fieldId) =>
      answers[fieldId] ?? const CatalogServiceAnswer.unset();

  bool get isEmpty => templateId == null && answers.isEmpty;

  CatalogServiceProfile copyWith({
    String? templateId,
    int? templateVersion,
    CatalogServicePriceMode? priceMode,
    Map<String, CatalogServiceAnswer>? answers,
  }) {
    return CatalogServiceProfile(
      templateId: templateId ?? this.templateId,
      templateVersion: templateVersion ?? this.templateVersion,
      priceMode: priceMode ?? this.priceMode,
      answers: answers ?? this.answers,
    );
  }
}

/// Visibility + section projection from the same template definition.
abstract final class CatalogServiceTemplateEngine {
  static bool isFieldVisible(CatalogServiceFieldDef field, Map<String, CatalogServiceAnswer> answers) {
    final gate = field.visibleWhenField;
    if (gate == null || gate.isEmpty) return true;
    final current = answers[gate] ?? const CatalogServiceAnswer.unset();
    if (!current.hasDisplayableValue) return false;
    if (field.visibleWhenAnyOf.isEmpty) return true;
    final raw = current.value;
    if (raw is bool) {
      return field.visibleWhenAnyOf.contains(raw ? 'true' : 'false');
    }
    final selected = current.asStringList();
    if (selected.isEmpty) {
      final single = current.asString();
      if (single == null) return false;
      return field.visibleWhenAnyOf.contains(single);
    }
    return selected.any(field.visibleWhenAnyOf.contains);
  }

  static List<CatalogServiceFieldDef> visibleFields(
    CatalogServiceTemplateDef template,
    Map<String, CatalogServiceAnswer> answers,
  ) {
    return template.fields.where((field) => isFieldVisible(field, answers)).toList();
  }

  /// Detail-ready rows: only applicable fields with displayable answers.
  static List<({CatalogServiceFieldDef field, CatalogServiceAnswer answer, String display})> detailRows({
    required CatalogServiceTemplateDef template,
    required CatalogServiceProfile profile,
  }) {
    final rows = <({CatalogServiceFieldDef field, CatalogServiceAnswer answer, String display})>[];
    for (final field in visibleFields(template, profile.answers)) {
      final answer = profile.answer(field.id);
      if (answer.state == CatalogServiceAnswerState.unset) continue;
      if (answer.state == CatalogServiceAnswerState.notApplicable) continue;
      final display = _format(field, answer);
      if (display == null || display.trim().isEmpty) continue;
      rows.add((field: field, answer: answer, display: display));
    }
    return rows;
  }

  static String? _format(CatalogServiceFieldDef field, CatalogServiceAnswer answer) {
    if (answer.state == CatalogServiceAnswerState.notApplicable) return null;
    if (!answer.hasDisplayableValue) return null;
    if (field.type == CatalogServiceFieldType.boolean) {
      final flag = answer.asBool();
      if (flag == null) return null;
      return flag ? 'نعم' : (field.allowExplicitNone ? field.noneLabelAr : 'لا');
    }
    if (field.type == CatalogServiceFieldType.multiSelect || field.type == CatalogServiceFieldType.singleSelect) {
      final ids = answer.asStringList();
      if (ids.isEmpty) {
        final one = answer.asString();
        if (one == null) return null;
        return _optionLabel(field, one);
      }
      return ids.map((id) => _optionLabel(field, id)).join('، ');
    }
    if (field.type == CatalogServiceFieldType.number) {
      final n = answer.asInt();
      if (n == null) return null;
      final unit = field.unit;
      return unit == null || unit.isEmpty ? '$n' : '$n $unit';
    }
    return answer.asString();
  }

  static String _optionLabel(CatalogServiceFieldDef field, String id) {
    for (final option in field.options) {
      if (option.id == id) return option.labelAr;
    }
    return id;
  }

  /// Fields that may need review after switching templates.
  static List<String> staleAnswerIds({
    required CatalogServiceTemplateDef? previous,
    required CatalogServiceTemplateDef next,
    required Map<String, CatalogServiceAnswer> answers,
  }) {
    if (previous == null) return const [];
    final nextIds = next.fields.map((f) => f.id).toSet();
    return answers.keys.where((id) => !nextIds.contains(id)).toList();
  }
}

abstract final class CatalogServiceTemplates {
  static const defaultSections = <CatalogServiceSectionDef>[
    CatalogServiceSectionDef(id: 'overview', titleAr: 'نظرة عامة', iconKey: 'overview'),
    CatalogServiceSectionDef(id: 'includes', titleAr: 'ماذا تشمل الخدمة', iconKey: 'includes'),
    CatalogServiceSectionDef(id: 'options', titleAr: 'الخيارات والإضافات', iconKey: 'options'),
    CatalogServiceSectionDef(id: 'duration_price', titleAr: 'المدة والسعر', iconKey: 'price'),
    CatalogServiceSectionDef(id: 'place', titleAr: 'المكان والفرع', iconKey: 'place'),
    CatalogServiceSectionDef(id: 'prep', titleAr: 'التحضير والمتطلبات', iconKey: 'prep'),
    CatalogServiceSectionDef(id: 'policies', titleAr: 'التعليمات والسياسات', iconKey: 'policies'),
  ];

  static const sharedSession = CatalogServiceFieldDef(
    id: 'session_kind',
    labelAr: 'نوع الجلسة',
    type: CatalogServiceFieldType.singleSelect,
    sectionId: 'duration_price',
    required: true,
    iconKey: 'price',
    options: [
      CatalogServiceFieldOption(id: 'single', labelAr: 'جلسة منفردة'),
      CatalogServiceFieldOption(id: 'package', labelAr: 'باقة'),
    ],
  );

  static const packageSessions = CatalogServiceFieldDef(
    id: 'package_sessions',
    labelAr: 'عدد الجلسات',
    type: CatalogServiceFieldType.number,
    sectionId: 'duration_price',
    unit: 'جلسة',
    visibleWhenField: 'session_kind',
    visibleWhenAnyOf: ['package'],
    iconKey: 'price',
  );

  static const packageValidity = CatalogServiceFieldDef(
    id: 'package_validity',
    labelAr: 'صلاحية الباقة',
    type: CatalogServiceFieldType.text,
    sectionId: 'duration_price',
    visibleWhenField: 'session_kind',
    visibleWhenAnyOf: ['package'],
    iconKey: 'price',
  );

  static const placeMode = CatalogServiceFieldDef(
    id: 'place_mode',
    labelAr: 'مكان التقديم',
    type: CatalogServiceFieldType.singleSelect,
    sectionId: 'place',
    required: true,
    iconKey: 'place',
    options: [
      CatalogServiceFieldOption(id: 'branch', labelAr: 'في الفرع'),
      CatalogServiceFieldOption(id: 'home', labelAr: 'خدمة منزلية'),
      CatalogServiceFieldOption(id: 'either', labelAr: 'الفرع أو المنزل'),
    ],
  );

  static const homeCoverage = CatalogServiceFieldDef(
    id: 'home_coverage',
    labelAr: 'نطاق التغطية للخدمة المنزلية',
    type: CatalogServiceFieldType.text,
    sectionId: 'place',
    visibleWhenField: 'place_mode',
    visibleWhenAnyOf: ['home', 'either'],
    iconKey: 'place',
  );

  static const needsAssessment = CatalogServiceFieldDef(
    id: 'needs_assessment',
    labelAr: 'هل يلزم تقييم مسبق؟',
    type: CatalogServiceFieldType.boolean,
    sectionId: 'prep',
    allowExplicitNone: true,
    noneLabelAr: 'لا يتطلب تقييمًا مسبقًا',
    iconKey: 'prep',
  );

  static const assessmentNote = CatalogServiceFieldDef(
    id: 'assessment_note',
    labelAr: 'ماذا يعني التقييم المسبق للعميلة؟',
    type: CatalogServiceFieldType.text,
    sectionId: 'prep',
    visibleWhenField: 'needs_assessment',
    visibleWhenAnyOf: ['true'],
    iconKey: 'prep',
  );

  static const prepRequired = CatalogServiceFieldDef(
    id: 'prep_required',
    labelAr: 'التحضير قبل الموعد',
    type: CatalogServiceFieldType.text,
    sectionId: 'prep',
    allowExplicitNone: true,
    noneLabelAr: 'لا يتطلب تحضيرًا',
    iconKey: 'prep',
  );

  static const includes = CatalogServiceFieldDef(
    id: 'includes',
    labelAr: 'ما تشمله الخدمة',
    type: CatalogServiceFieldType.multiSelect,
    sectionId: 'includes',
    iconKey: 'includes',
  );

  static const excludes = CatalogServiceFieldDef(
    id: 'excludes',
    labelAr: 'ما لا تشمله الخدمة',
    type: CatalogServiceFieldType.text,
    sectionId: 'includes',
    iconKey: 'includes',
  );

  static const addons = CatalogServiceFieldDef(
    id: 'addons',
    labelAr: 'إضافات اختيارية',
    type: CatalogServiceFieldType.multiSelect,
    sectionId: 'options',
    iconKey: 'options',
  );

  static const policies = CatalogServiceFieldDef(
    id: 'policies',
    labelAr: 'تعليمات وسياسات الجهة',
    type: CatalogServiceFieldType.text,
    sectionId: 'policies',
    iconKey: 'policies',
  );

  static final all = <CatalogServiceTemplateDef>[
    hairCut,
    hairColor,
    nails,
    makeup,
    skinCare,
    laser,
    consult,
    salonCare,
    teeth,
  ];

  static CatalogServiceTemplateDef? byId(String? id) {
    if (id == null || id.isEmpty) return null;
    for (final item in all) {
      if (item.id == id) return item;
    }
    return null;
  }

  static List<CatalogServiceTemplateDef> forPartnerCategory({
    required String partnerType,
    required String? category,
  }) {
    return all.where((t) {
      if (!t.partnerTypes.contains(partnerType)) return false;
      if (category == null || category.isEmpty) return true;
      return t.category == category;
    }).toList();
  }

  static final hairCut = CatalogServiceTemplateDef(
    id: 'salon_hair_cut',
    version: 1,
    labelAr: 'قص وتصفيف الشعر',
    category: 'hair',
    partnerTypes: const ['salon'],
    suggestedNameAr: 'قص وتصفيف',
    fields: [
      sharedSession,
      packageSessions,
      packageValidity,
      CatalogServiceFieldDef(
        id: 'cut_style',
        labelAr: 'نوع القص أو التصفيف',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'cut', labelAr: 'قص'),
          CatalogServiceFieldOption(id: 'style', labelAr: 'تصفيف'),
          CatalogServiceFieldOption(id: 'cut_style', labelAr: 'قص وتصفيف'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'hair_length',
        labelAr: 'طول الشعر (إن كان مؤثرًا)',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'options',
        options: const [
          CatalogServiceFieldOption(id: 'short', labelAr: 'قصير'),
          CatalogServiceFieldOption(id: 'medium', labelAr: 'متوسط'),
          CatalogServiceFieldOption(id: 'long', labelAr: 'طويل'),
          CatalogServiceFieldOption(id: 'any', labelAr: 'لا يؤثر'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'includes_wash_dry',
        labelAr: 'هل تشمل الغسيل والتجفيف؟',
        type: CatalogServiceFieldType.boolean,
        sectionId: 'includes',
        allowExplicitNone: true,
        noneLabelAr: 'لا يشمل الغسيل والتجفيف',
      ),
      includes.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'wash', labelAr: 'غسيل'),
        CatalogServiceFieldOption(id: 'dry', labelAr: 'تجفيف'),
        CatalogServiceFieldOption(id: 'style', labelAr: 'تصفيف'),
        CatalogServiceFieldOption(id: 'trim', labelAr: 'تشذيب الأطراف'),
      ]),
      excludes,
      addons.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'mask', labelAr: 'ماسك عناية'),
        CatalogServiceFieldOption(id: 'oil', labelAr: 'زيت'),
      ]),
      placeMode,
      homeCoverage,
      needsAssessment,
      assessmentNote,
      prepRequired,
      policies,
    ],
  );

  static final hairColor = CatalogServiceTemplateDef(
    id: 'salon_hair_color',
    version: 1,
    labelAr: 'صبغة الشعر',
    category: 'hair',
    partnerTypes: const ['salon', 'clinic'],
    suggestedNameAr: 'صبغة شعر',
    fields: [
      sharedSession,
      packageSessions,
      CatalogServiceFieldDef(
        id: 'color_kind',
        labelAr: 'نوع خدمة الصبغة',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'full', labelAr: 'صبغة كاملة'),
          CatalogServiceFieldOption(id: 'roots', labelAr: 'جذور'),
          CatalogServiceFieldOption(id: 'highlights', labelAr: 'هايلايت'),
          CatalogServiceFieldOption(id: 'balayage', labelAr: 'بالياج'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'price_by_length',
        labelAr: 'هل يختلف السعر حسب طول الشعر؟',
        type: CatalogServiceFieldType.boolean,
        sectionId: 'duration_price',
        allowExplicitNone: true,
        noneLabelAr: 'السعر لا يختلف حسب الطول',
      ),
      CatalogServiceFieldDef(
        id: 'length_tiers',
        labelAr: 'خيارات الطول المؤثرة على السعر',
        type: CatalogServiceFieldType.multiSelect,
        sectionId: 'duration_price',
        visibleWhenField: 'price_by_length',
        visibleWhenAnyOf: ['true'],
        options: const [
          CatalogServiceFieldOption(id: 'short', labelAr: 'قصير'),
          CatalogServiceFieldOption(id: 'medium', labelAr: 'متوسط'),
          CatalogServiceFieldOption(id: 'long', labelAr: 'طويل'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'includes_bleach',
        labelAr: 'هل يشمل السعر سحب اللون؟',
        type: CatalogServiceFieldType.boolean,
        sectionId: 'includes',
        allowExplicitNone: true,
        noneLabelAr: 'سحب اللون غير مشمول',
      ),
      includes.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'toner', labelAr: 'تونر'),
        CatalogServiceFieldOption(id: 'treatment', labelAr: 'علاج بعد الصبغة'),
      ]),
      excludes,
      addons.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'olaplex', labelAr: 'عناية أولابليكس'),
      ]),
      placeMode,
      needsAssessment,
      assessmentNote,
      prepRequired,
      policies,
    ],
  );

  static final nails = CatalogServiceTemplateDef(
    id: 'salon_nails',
    version: 1,
    labelAr: 'العناية بالأظافر',
    category: 'nails',
    partnerTypes: const ['salon'],
    suggestedNameAr: 'عناية أظافر',
    fields: [
      CatalogServiceFieldDef(
        id: 'hands_feet',
        labelAr: 'اليدين أو القدمين',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'hands', labelAr: 'يدان'),
          CatalogServiceFieldOption(id: 'feet', labelAr: 'قدمان'),
          CatalogServiceFieldOption(id: 'both', labelAr: 'الاثنان'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'nail_kind',
        labelAr: 'نوع الخدمة',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'manicure', labelAr: 'مانيكير'),
          CatalogServiceFieldOption(id: 'pedicure', labelAr: 'باديكير'),
          CatalogServiceFieldOption(id: 'gel', labelAr: 'جل'),
          CatalogServiceFieldOption(id: 'acrylic', labelAr: 'أكريليك'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'remove_old',
        labelAr: 'إزالة طلاء سابق',
        type: CatalogServiceFieldType.boolean,
        sectionId: 'includes',
        allowExplicitNone: true,
        noneLabelAr: 'لا تشمل إزالة طلاء سابق',
      ),
      includes,
      excludes,
      addons.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'art', labelAr: 'رسم أظافر'),
        CatalogServiceFieldOption(id: 'paraffin', labelAr: 'بارافين'),
      ]),
      placeMode,
      prepRequired,
      policies,
    ],
  );

  static final makeup = CatalogServiceTemplateDef(
    id: 'salon_makeup',
    version: 1,
    labelAr: 'المكياج',
    category: 'makeup',
    partnerTypes: const ['salon'],
    suggestedNameAr: 'مكياج',
    fields: [
      CatalogServiceFieldDef(
        id: 'occasion',
        labelAr: 'نوع الخدمة أو المناسبة',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'daily', labelAr: 'يومي'),
          CatalogServiceFieldOption(id: 'event', labelAr: 'مناسبة'),
          CatalogServiceFieldOption(id: 'bridal', labelAr: 'عروس'),
          CatalogServiceFieldOption(id: 'photo', labelAr: 'تصوير'),
        ],
      ),
      placeMode,
      homeCoverage,
      includes.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'base', labelAr: 'أساس'),
        CatalogServiceFieldOption(id: 'eyes', labelAr: 'عيون'),
        CatalogServiceFieldOption(id: 'lashes', labelAr: 'رموش'),
        CatalogServiceFieldOption(id: 'brows', labelAr: 'حواجب'),
      ]),
      excludes,
      addons.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'hair', labelAr: 'تصفيف شعر'),
        CatalogServiceFieldOption(id: 'trial', labelAr: 'تجربة مسبقة'),
      ]),
      needsAssessment,
      assessmentNote,
      prepRequired,
      policies,
    ],
  );

  static final skinCare = CatalogServiceTemplateDef(
    id: 'clinic_skin',
    version: 1,
    labelAr: 'العناية بالبشرة',
    category: 'skin',
    partnerTypes: const ['clinic', 'salon'],
    suggestedNameAr: 'جلسة بشرة',
    fields: [
      CatalogServiceFieldDef(
        id: 'session_name',
        labelAr: 'اسم أو نوع الجلسة',
        type: CatalogServiceFieldType.text,
        sectionId: 'overview',
        required: true,
      ),
      sharedSession,
      packageSessions,
      includes.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'cleanse', labelAr: 'تنظيف'),
        CatalogServiceFieldOption(id: 'mask', labelAr: 'ماسك'),
        CatalogServiceFieldOption(id: 'massage', labelAr: 'مساج'),
        CatalogServiceFieldOption(id: 'serum', labelAr: 'سيروم'),
      ]),
      excludes,
      placeMode,
      needsAssessment,
      assessmentNote,
      prepRequired,
      CatalogServiceFieldDef(
        id: 'aftercare',
        labelAr: 'تعليمات بعد الجلسة',
        type: CatalogServiceFieldType.text,
        sectionId: 'policies',
      ),
      policies,
    ],
  );

  static final laser = CatalogServiceTemplateDef(
    id: 'clinic_laser',
    version: 1,
    labelAr: 'إزالة الشعر بالليزر',
    category: 'laser',
    partnerTypes: const ['clinic'],
    suggestedNameAr: 'جلسة ليزر',
    fields: [
      CatalogServiceFieldDef(
        id: 'laser_areas',
        labelAr: 'المناطق المشمولة',
        type: CatalogServiceFieldType.multiSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'face', labelAr: 'الوجه'),
          CatalogServiceFieldOption(id: 'underarms', labelAr: 'الإبط'),
          CatalogServiceFieldOption(id: 'legs', labelAr: 'الساقين'),
          CatalogServiceFieldOption(id: 'bikini', labelAr: 'البكيني'),
          CatalogServiceFieldOption(id: 'full', labelAr: 'جسم كامل'),
        ],
      ),
      sharedSession,
      packageSessions,
      packageValidity,
      CatalogServiceFieldDef(
        id: 'device_info',
        labelAr: 'معلومات الجهاز (إن أدخلتها الجهة)',
        type: CatalogServiceFieldType.text,
        sectionId: 'overview',
      ),
      includes,
      excludes,
      placeMode,
      needsAssessment,
      assessmentNote,
      prepRequired,
      policies,
    ],
  );

  static final consult = CatalogServiceTemplateDef(
    id: 'clinic_consult',
    version: 1,
    labelAr: 'استشارة أو تقييم',
    category: 'skin',
    partnerTypes: const ['clinic', 'salon'],
    suggestedNameAr: 'استشارة',
    fields: [
      CatalogServiceFieldDef(
        id: 'consult_kind',
        labelAr: 'نوع الاستشارة',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'overview',
        required: true,
        options: const [
          CatalogServiceFieldOption(id: 'skin', labelAr: 'بشرة'),
          CatalogServiceFieldOption(id: 'hair', labelAr: 'شعر'),
          CatalogServiceFieldOption(id: 'general', labelAr: 'عامة'),
        ],
      ),
      CatalogServiceFieldDef(
        id: 'consult_mode',
        labelAr: 'طريقة التقديم',
        type: CatalogServiceFieldType.singleSelect,
        sectionId: 'place',
        options: const [
          CatalogServiceFieldOption(id: 'in_person', labelAr: 'حضورية'),
          CatalogServiceFieldOption(id: 'remote', labelAr: 'عن بُعد'),
          CatalogServiceFieldOption(id: 'either', labelAr: 'حضورية أو عن بُعد'),
        ],
      ),
      includes.copyWithOptions(const [
        CatalogServiceFieldOption(id: 'exam', labelAr: 'فحص'),
        CatalogServiceFieldOption(id: 'plan', labelAr: 'خطة مقترحة'),
        CatalogServiceFieldOption(id: 'qa', labelAr: 'أسئلة وأجوبة'),
      ]),
      CatalogServiceFieldDef(
        id: 'bring_docs',
        labelAr: 'مستندات أو معلومات مطلوبة',
        type: CatalogServiceFieldType.text,
        sectionId: 'prep',
        allowExplicitNone: true,
        noneLabelAr: 'لا يلزم إحضار مستندات',
      ),
      prepRequired,
      policies,
    ],
  );

  static final salonCare = CatalogServiceTemplateDef(
    id: 'salon_care',
    version: 1,
    labelAr: 'عناية عامة',
    category: 'care',
    partnerTypes: const ['salon'],
    suggestedNameAr: 'جلسة عناية',
    fields: [
      sharedSession,
      includes,
      excludes,
      placeMode,
      prepRequired,
      policies,
    ],
  );

  static final teeth = CatalogServiceTemplateDef(
    id: 'clinic_teeth',
    version: 1,
    labelAr: 'الأسنان (محدود)',
    category: 'teeth',
    partnerTypes: const ['clinic'],
    suggestedNameAr: 'جلسة أسنان',
    fields: [
      CatalogServiceFieldDef(
        id: 'teeth_kind',
        labelAr: 'نوع الجلسة',
        type: CatalogServiceFieldType.text,
        sectionId: 'overview',
        required: true,
      ),
      sharedSession,
      includes,
      excludes,
      needsAssessment,
      assessmentNote,
      prepRequired,
      policies,
    ],
  );

  /// Categories present in Mira without a dedicated rich template yet.
  static const uncoveredNotesAr = <String, String>{
    'laser': 'مغطى بقالب clinic_laser للعيادات.',
    'teeth': 'مغطى بقالب محدود clinic_teeth — بلا تشخيص طبي.',
  };
}

extension on CatalogServiceFieldDef {
  CatalogServiceFieldDef copyWithOptions(List<CatalogServiceFieldOption> options) {
    return CatalogServiceFieldDef(
      id: id,
      labelAr: labelAr,
      type: type,
      sectionId: sectionId,
      options: options,
      unit: unit,
      required: required,
      visibleWhenField: visibleWhenField,
      visibleWhenAnyOf: visibleWhenAnyOf,
      iconKey: iconKey,
      allowExplicitNone: allowExplicitNone,
      noneLabelAr: noneLabelAr,
    );
  }
}
