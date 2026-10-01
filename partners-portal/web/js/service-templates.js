(function (global) {
  const sections = [
    { id: 'overview', title: 'نظرة عامة' },
    { id: 'includes', title: 'ماذا تشمل الخدمة' },
    { id: 'options', title: 'الخيارات والإضافات' },
    { id: 'duration_price', title: 'المدة والسعر' },
    { id: 'place', title: 'المكان والفرع' },
    { id: 'prep', title: 'التحضير والمتطلبات' },
    { id: 'policies', title: 'التعليمات والسياسات' },
  ];

  function field(def) {
    return Object.assign({
      options: [],
      required: false,
      visibleWhenField: null,
      visibleWhenAnyOf: [],
      unit: null,
    }, def);
  }

  const shared = {
    session_kind: field({
      id: 'session_kind', label: 'نوع الجلسة', type: 'single', sectionId: 'duration_price', required: true,
      options: [['single', 'جلسة منفردة'], ['package', 'باقة']],
    }),
    package_sessions: field({
      id: 'package_sessions', label: 'عدد الجلسات', type: 'number', sectionId: 'duration_price', unit: 'جلسة',
      visibleWhenField: 'session_kind', visibleWhenAnyOf: ['package'],
    }),
    package_validity: field({
      id: 'package_validity', label: 'صلاحية الباقة', type: 'text', sectionId: 'duration_price',
      visibleWhenField: 'session_kind', visibleWhenAnyOf: ['package'],
    }),
    place_mode: field({
      id: 'place_mode', label: 'مكان التقديم', type: 'single', sectionId: 'place', required: true,
      options: [['branch', 'في الفرع'], ['home', 'خدمة منزلية'], ['either', 'الفرع أو المنزل']],
    }),
    home_coverage: field({
      id: 'home_coverage', label: 'نطاق التغطية للخدمة المنزلية', type: 'text', sectionId: 'place',
      visibleWhenField: 'place_mode', visibleWhenAnyOf: ['home', 'either'],
    }),
    needs_assessment: field({
      id: 'needs_assessment', label: 'هل يلزم تقييم مسبق؟', type: 'boolean', sectionId: 'prep',
    }),
    assessment_note: field({
      id: 'assessment_note', label: 'ماذا يعني التقييم المسبق للعميلة؟', type: 'text', sectionId: 'prep',
      visibleWhenField: 'needs_assessment', visibleWhenAnyOf: ['true'],
    }),
    prep_required: field({
      id: 'prep_required', label: 'التحضير قبل الموعد', type: 'text', sectionId: 'prep',
    }),
    policies: field({
      id: 'policies', label: 'تعليمات وسياسات الجهة', type: 'text', sectionId: 'policies',
    }),
  };

  const templates = [
    {
      id: 'salon_hair_cut', version: 1, label: 'قص وتصفيف الشعر', category: 'hair', partnerTypes: ['salon'],
      suggestedName: 'قص وتصفيف',
      fields: [
        shared.session_kind, shared.package_sessions, shared.package_validity,
        field({ id: 'cut_style', label: 'نوع القص أو التصفيف', type: 'single', sectionId: 'overview', required: true,
          options: [['cut', 'قص'], ['style', 'تصفيف'], ['cut_style', 'قص وتصفيف']] }),
        field({ id: 'hair_length', label: 'طول الشعر (إن كان مؤثرًا)', type: 'single', sectionId: 'options',
          options: [['short', 'قصير'], ['medium', 'متوسط'], ['long', 'طويل'], ['any', 'لا يؤثر']] }),
        field({ id: 'includes_wash_dry', label: 'هل تشمل الغسيل والتجفيف؟', type: 'boolean', sectionId: 'includes' }),
        field({ id: 'includes', label: 'ما تشمله الخدمة', type: 'multi', sectionId: 'includes',
          options: [['wash', 'غسيل'], ['dry', 'تجفيف'], ['style', 'تصفيف'], ['trim', 'تشذيب الأطراف']] }),
        field({ id: 'excludes', label: 'ما لا تشمله الخدمة', type: 'text', sectionId: 'includes' }),
        field({ id: 'addons', label: 'إضافات اختيارية', type: 'multi', sectionId: 'options',
          options: [['mask', 'ماسك عناية'], ['oil', 'زيت']] }),
        shared.place_mode, shared.home_coverage, shared.needs_assessment, shared.assessment_note, shared.prep_required, shared.policies,
      ],
    },
    {
      id: 'salon_hair_color', version: 1, label: 'صبغة الشعر', category: 'hair', partnerTypes: ['salon', 'clinic'],
      suggestedName: 'صبغة شعر',
      fields: [
        shared.session_kind, shared.package_sessions,
        field({ id: 'color_kind', label: 'نوع خدمة الصبغة', type: 'single', sectionId: 'overview', required: true,
          options: [['full', 'صبغة كاملة'], ['roots', 'جذور'], ['highlights', 'هايلايت'], ['balayage', 'بالياج']] }),
        field({ id: 'price_by_length', label: 'هل يختلف السعر حسب طول الشعر؟', type: 'boolean', sectionId: 'duration_price' }),
        field({ id: 'length_tiers', label: 'خيارات الطول المؤثرة على السعر', type: 'multi', sectionId: 'duration_price',
          visibleWhenField: 'price_by_length', visibleWhenAnyOf: ['true'],
          options: [['short', 'قصير'], ['medium', 'متوسط'], ['long', 'طويل']] }),
        field({ id: 'includes_bleach', label: 'هل يشمل السعر سحب اللون؟', type: 'boolean', sectionId: 'includes' }),
        field({ id: 'includes', label: 'ما تشمله الخدمة', type: 'multi', sectionId: 'includes',
          options: [['toner', 'تونر'], ['treatment', 'علاج بعد الصبغة']] }),
        field({ id: 'addons', label: 'إضافات اختيارية', type: 'multi', sectionId: 'options',
          options: [['olaplex', 'عناية أولابليكس']] }),
        shared.place_mode, shared.needs_assessment, shared.assessment_note, shared.prep_required, shared.policies,
      ],
    },
    {
      id: 'salon_nails', version: 1, label: 'العناية بالأظافر', category: 'nails', partnerTypes: ['salon'],
      suggestedName: 'عناية أظافر',
      fields: [
        field({ id: 'hands_feet', label: 'اليدين أو القدمين', type: 'single', sectionId: 'overview', required: true,
          options: [['hands', 'يدان'], ['feet', 'قدمان'], ['both', 'الاثنان']] }),
        field({ id: 'nail_kind', label: 'نوع الخدمة', type: 'single', sectionId: 'overview', required: true,
          options: [['manicure', 'مانيكير'], ['pedicure', 'باديكير'], ['gel', 'جل'], ['acrylic', 'أكريليك']] }),
        field({ id: 'remove_old', label: 'إزالة طلاء سابق', type: 'boolean', sectionId: 'includes' }),
        field({ id: 'addons', label: 'إضافات اختيارية', type: 'multi', sectionId: 'options',
          options: [['art', 'رسم أظافر'], ['paraffin', 'بارافين']] }),
        shared.place_mode, shared.prep_required, shared.policies,
      ],
    },
    {
      id: 'salon_makeup', version: 1, label: 'المكياج', category: 'makeup', partnerTypes: ['salon'],
      suggestedName: 'مكياج',
      fields: [
        field({ id: 'occasion', label: 'نوع الخدمة أو المناسبة', type: 'single', sectionId: 'overview', required: true,
          options: [['daily', 'يومي'], ['event', 'مناسبة'], ['bridal', 'عروس'], ['photo', 'تصوير']] }),
        shared.place_mode, shared.home_coverage,
        field({ id: 'includes', label: 'ما تشمله الخدمة', type: 'multi', sectionId: 'includes',
          options: [['base', 'أساس'], ['eyes', 'عيون'], ['lashes', 'رموش'], ['brows', 'حواجب']] }),
        field({ id: 'addons', label: 'إضافات اختيارية', type: 'multi', sectionId: 'options',
          options: [['hair', 'تصفيف شعر'], ['trial', 'تجربة مسبقة']] }),
        shared.needs_assessment, shared.assessment_note, shared.prep_required, shared.policies,
      ],
    },
    {
      id: 'clinic_skin', version: 1, label: 'العناية بالبشرة', category: 'skin', partnerTypes: ['clinic', 'salon'],
      suggestedName: 'جلسة بشرة',
      fields: [
        field({ id: 'session_name', label: 'اسم أو نوع الجلسة', type: 'text', sectionId: 'overview', required: true }),
        shared.session_kind, shared.package_sessions,
        field({ id: 'includes', label: 'ما تشمله الخدمة', type: 'multi', sectionId: 'includes',
          options: [['cleanse', 'تنظيف'], ['mask', 'ماسك'], ['massage', 'مساج'], ['serum', 'سيروم']] }),
        shared.place_mode, shared.needs_assessment, shared.assessment_note, shared.prep_required,
        field({ id: 'aftercare', label: 'تعليمات بعد الجلسة', type: 'text', sectionId: 'policies' }),
        shared.policies,
      ],
    },
    {
      id: 'clinic_laser', version: 1, label: 'إزالة الشعر بالليزر', category: 'laser', partnerTypes: ['clinic'],
      suggestedName: 'جلسة ليزر',
      fields: [
        field({ id: 'laser_areas', label: 'المناطق المشمولة', type: 'multi', sectionId: 'overview', required: true,
          options: [['face', 'الوجه'], ['underarms', 'الإبط'], ['legs', 'الساقين'], ['bikini', 'البكيني'], ['full', 'جسم كامل']] }),
        shared.session_kind, shared.package_sessions, shared.package_validity,
        field({ id: 'device_info', label: 'معلومات الجهاز (إن أدخلتها الجهة)', type: 'text', sectionId: 'overview' }),
        shared.place_mode, shared.needs_assessment, shared.assessment_note, shared.prep_required, shared.policies,
      ],
    },
    {
      id: 'clinic_consult', version: 1, label: 'استشارة أو تقييم', category: 'skin', partnerTypes: ['clinic', 'salon'],
      suggestedName: 'استشارة',
      fields: [
        field({ id: 'consult_kind', label: 'نوع الاستشارة', type: 'single', sectionId: 'overview', required: true,
          options: [['skin', 'بشرة'], ['hair', 'شعر'], ['general', 'عامة']] }),
        field({ id: 'consult_mode', label: 'طريقة التقديم', type: 'single', sectionId: 'place',
          options: [['in_person', 'حضورية'], ['remote', 'عن بُعد'], ['either', 'حضورية أو عن بُعد']] }),
        field({ id: 'includes', label: 'ما تتضمنه الاستشارة', type: 'multi', sectionId: 'includes',
          options: [['exam', 'فحص'], ['plan', 'خطة مقترحة'], ['qa', 'أسئلة وأجوبة']] }),
        field({ id: 'bring_docs', label: 'مستندات أو معلومات مطلوبة', type: 'text', sectionId: 'prep' }),
        shared.prep_required, shared.policies,
      ],
    },
    {
      id: 'salon_care', version: 1, label: 'عناية عامة', category: 'care', partnerTypes: ['salon'],
      suggestedName: 'جلسة عناية',
      fields: [shared.session_kind, field({ id: 'includes', label: 'ما تشمله الخدمة', type: 'text', sectionId: 'includes' }), shared.place_mode, shared.prep_required, shared.policies],
    },
    {
      id: 'clinic_teeth', version: 1, label: 'الأسنان (محدود)', category: 'teeth', partnerTypes: ['clinic'],
      suggestedName: 'جلسة أسنان',
      fields: [
        field({ id: 'teeth_kind', label: 'نوع الجلسة', type: 'text', sectionId: 'overview', required: true }),
        shared.session_kind, shared.needs_assessment, shared.assessment_note, shared.prep_required, shared.policies,
      ],
    },
  ];

  function forPartner(partnerType, category) {
    return templates.filter((t) => t.partnerTypes.indexOf(partnerType) >= 0 && (!category || t.category === category));
  }

  function byId(id) {
    return templates.find((t) => t.id === id) || null;
  }

  function isVisible(field, answers) {
    if (!field.visibleWhenField) return true;
    const raw = answers[field.visibleWhenField];
    if (raw == null || raw === '') return false;
    if (!field.visibleWhenAnyOf || !field.visibleWhenAnyOf.length) return true;
    if (typeof raw === 'boolean') return field.visibleWhenAnyOf.indexOf(raw ? 'true' : 'false') >= 0;
    if (Array.isArray(raw)) return raw.some((v) => field.visibleWhenAnyOf.indexOf(v) >= 0);
    return field.visibleWhenAnyOf.indexOf(String(raw)) >= 0;
  }

  global.ServiceTemplates = {
    sections: sections,
    templates: templates,
    forPartner: forPartner,
    byId: byId,
    isVisible: isVisible,
    uncoveredNote: 'قالب الأسنان محدود. لا تُولَّد تشخيصات أو تعليمات طبية من ميرا.',
  };
})(window);
