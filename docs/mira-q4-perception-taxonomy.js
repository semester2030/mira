/**
 * MIRA Q4 — Perception Taxonomy (single source of truth)
 * Atelier: color-only recolor · no face/body regeneration
 * Reference: mira-vision-platform.html#atelier-q4-perception
 */
(function (global) {
  const RECOLOR_SCOPE = {
    id: 'color_only',
    titleAr: 'تلوين القماش فقط — بدون إعادة توليد',
    allowed: [
      'تغيير لون الصبغة على القطعة/المنطقة المحددة (mask)',
      'الحفاظ على خامة القماش (ساتان · قطن · دنيم…)',
      'الحفاظ على ثنيات القماش وقصّة الإطلالة',
      'QEL: رفض إن تغيّر الوجه أو البشرة أو الشعر',
    ],
    forbidden: [
      'إعادة توليد الصورة كاملة',
      'تغيير ملامح الوجه أو الهوية',
      'try-on من كatalog (Phase B)',
      'تلوين الخلفية أو الجلد أو الحذاء (إلا إن اختيرت القطعة صراحة)',
    ],
  };

  const TOPOLOGY = {
    one_piece: {
      id: 'one_piece',
      labelAr: 'قطعة واحدة',
      labelEn: 'One-piece',
      pieceCount: 1,
      examples: ['فستان', 'جumpsuit', 'عباءة كاملة'],
      regionRoles: ['full_body'],
      detection: 'geometry.full_body أو semantics.typeId=dress/abaya بدون tops+bottoms منفصلين',
    },
    two_piece: {
      id: 'two_piece',
      labelAr: 'قطعتان',
      labelEn: 'Two-piece',
      pieceCount: 2,
      examples: ['بلوزة + بنطلون', 'تيشيرت + جينز', 'بلوزة + تنورة'],
      regionRoles: ['upper', 'lower'],
      detection: 'upper+lower في geometry أو tops+bottoms في semantics',
    },
    layered: {
      id: 'layered',
      labelAr: 'طبقات',
      labelEn: 'Layered',
      pieceCount: 3,
      examples: ['جاكيت + بلوزة + بنطلون', 'بلوفر + تيشيرت + جينز', 'عباءة + تحت'],
      regionRoles: ['outerwear', 'upper', 'lower'],
      detection: 'outerwear + upper + lower أو segments≥3 + layering في semantics',
    },
  };

  /** Perception layer — PASS/FAIL before any recolor (Phase Q4 rubric). */
  const PERCEPTION_RUBRIC = [
    {
      id: 'topo_match',
      dimAr: 'Topology',
      questionAr: 'هل pieceCount و silhouette يطابقان الإطلالة الحقيقية؟',
      passAr: 'فستان=1 · بلوزة+بنطلون=2 · جاكيت+داخل=3+',
      failAr: 'خلط فستان مع قطعتين · أو 1 piece بينما 3 ظاهرة',
      autoFail: true,
    },
    {
      id: 'region_isolation',
      dimAr: 'Region',
      questionAr: 'هل regionRole للقطعة المستهدفة صحيح؟',
      passAr: 'full_body للفستان · upper للبلوزة · lower للجينز · outerwear للعباءة/جاكيت',
      failAr: 'تلوين بنطلون بينما الهدف بلوزة · أو العكس',
      autoFail: true,
    },
    {
      id: 'identity_lock',
      dimAr: 'Identity',
      questionAr: 'هل الوجه/البشرة/الشعر لم يُمس؟',
      passAr: 'نفس الشخص — لا تجميل · لا تغيير ملامح',
      failAr: 'أي تغيير في الوجه = FAIL فوري',
      autoFail: true,
    },
    {
      id: 'material_preserve',
      dimAr: 'Fabric',
      questionAr: 'هل الخامة محفوظة؟',
      passAr: 'ساتان لامع · قطن مطفي · دنيم محبوك',
      failAr: 'تحويل ساتان إلى قطن مسطح · أو العكس',
      autoFail: false,
    },
    {
      id: 'edge_clean',
      dimAr: 'Edge',
      questionAr: 'حواف القطعة الملوّنة',
      passAr: 'zero bleeding · حدود واضحة عند الجلد',
      failAr: 'لون ينزف للبشرة أو قطعة مجاورة',
      autoFail: false,
    },
    {
      id: 'color_accuracy',
      dimAr: 'Color',
      questionAr: 'دقة اللون المطلوب',
      passAr: 'اللون After قريب من targetColorAr',
      failAr: 'لون مختلف كلياً عن المطلوب',
      autoFail: false,
    },
  ];

  const PIECE_META = {
    فستان: {
      topology: 'one_piece',
      pieceCount: 1,
      regionRole: 'full_body',
      outfitDesc: 'فستان — قطعة واحدة كاملة',
    },
    بلوزة: {
      topology: 'two_piece',
      pieceCount: 2,
      regionRole: 'upper',
      outfitDesc: 'بلوزة + بنطلون أو تنورة',
    },
    بنطلون: {
      topology: 'two_piece',
      pieceCount: 2,
      regionRole: 'lower',
      outfitDesc: 'بلوزة/تيشيرت + بنطلون',
    },
    جينز: {
      topology: 'two_piece',
      pieceCount: 2,
      regionRole: 'lower',
      outfitDesc: 'تيشيرت أو بلوزة + جينز',
    },
    تنورة: {
      topology: 'two_piece',
      pieceCount: 2,
      regionRole: 'lower',
      outfitDesc: 'بلوزة + تنورة',
    },
    جاكيت: {
      topology: 'layered',
      pieceCount: 3,
      regionRole: 'outerwear',
      outfitDesc: 'جاكيت + بلوزة + بنطلون',
    },
    عباءة: {
      topology: 'layered',
      pieceCount: 2,
      regionRole: 'outerwear',
      outfitDesc: 'عباءة (+ لبس داخلي)',
    },
  };

  const RAW_SCENARIOS = [
    { id: '001', piece: 'فستان', beforeColor: 'أزرق', afterColor: 'أسود', notes: 'فستان · تحويل داكن' },
    { id: '002', piece: 'فستان', beforeColor: 'أزرق', afterColor: 'أبيض', notes: 'فستان · فاتح على داكن' },
    { id: '003', piece: 'فستان', beforeColor: 'سماوي', afterColor: 'كحلي', notes: 'فستان · أزرق → كحلي' },
    { id: '004', piece: 'فستان', beforeColor: 'أحمر', afterColor: 'أسود', notes: 'فستان · أحمر قوي' },
    { id: '005', piece: 'فستان', beforeColor: 'بيج', afterColor: 'خمري', notes: 'فستان · محايد → خمري' },
    { id: '006', piece: 'فستان', beforeColor: 'خمري', afterColor: 'أخضر زمردي', notes: 'فستان · أخضر' },
    { id: '007', piece: 'فستان', beforeColor: 'أخضر', afterColor: 'أسود', notes: 'فستان · أخضر → أسود' },
    { id: '008', piece: 'بلوزة', beforeColor: 'أبيض', afterColor: 'كحلي', notes: 'بلوزة قطن · upper · إطلالة قطعتين' },
    { id: '009', piece: 'بلوزة', beforeColor: 'وردي', afterColor: 'نبيتي', notes: 'بلوزة · وردي → نبيتي' },
    { id: '010', piece: 'بلوزة', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'بلوزة · رمادي' },
    { id: '011', piece: 'بلوزة', beforeColor: 'ذهبي', afterColor: 'بيج', notes: 'بلوزة · لامع → مطفي' },
    { id: '012', piece: 'بلوزة', beforeColor: 'أزرق', afterColor: 'تركواز', notes: 'بلوزة · أزرق فاتح' },
    { id: '013', piece: 'بلوزة', beforeColor: 'أسود', afterColor: 'أحمر', notes: 'بلوزة · داكن → أحمر' },
    { id: '014', piece: 'بلوزة', beforeColor: 'كريمي', afterColor: 'زيتوني', notes: 'بلوزة · محايد' },
    { id: '015', piece: 'بلوزة', beforeColor: 'مرجاني', afterColor: 'خمري', notes: 'بلوزة · دافئ' },
    { id: '016', piece: 'بنطلون', beforeColor: 'أسود', afterColor: 'كحلي', notes: 'بنطلون · lower · بلوزة+بنطلون' },
    { id: '017', piece: 'بنطلون', beforeColor: 'بيج', afterColor: 'بني', notes: 'بنطلون · بيج' },
    { id: '018', piece: 'بنطلون', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'بنطلون · رمادي' },
    { id: '019', piece: 'بنطلون', beforeColor: 'أبيض', afterColor: 'زيتوني', notes: 'بنطلون · فاتح' },
    { id: '020', piece: 'بنطلون', beforeColor: 'كحلي', afterColor: 'أسود', notes: 'بنطلون · كحلي' },
    { id: '021', piece: 'جينز', beforeColor: 'دنيم', afterColor: 'أسود', notes: 'جينز · تيشيرت+جينز · lower' },
    { id: '022', piece: 'جينز', beforeColor: 'دنيم', afterColor: 'كحلي', notes: 'جينز · دنيم فاتح' },
    { id: '023', piece: 'عباءة', beforeColor: 'أسود', afterColor: 'كحلي', notes: 'عباءة · outerwear · layered' },
    { id: '024', piece: 'عباءة', beforeColor: 'بيج', afterColor: 'خمري', notes: 'عباءة · محايد' },
    { id: '025', piece: 'عباءة', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'عباءة · رمادي' },
    { id: '026', piece: 'عباءة', beforeColor: 'أبيض', afterColor: 'كريمي', notes: 'عباءة · فاتح' },
    { id: '027', piece: 'عباءة', beforeColor: 'زيتوني', afterColor: 'أسود', notes: 'عباءة · زيتوني' },
    { id: '028', piece: 'عباءة', beforeColor: 'وردي', afterColor: 'نبيتي', notes: 'عباءة · وردي' },
    { id: '029', piece: 'فستان', beforeColor: 'أسود', afterColor: 'ذهبي', notes: 'فستان سهرة · ساتان · one_piece' },
    { id: '030', piece: 'فستان', beforeColor: 'أبيض', afterColor: 'فضي', notes: 'فستان · فضي' },
    { id: '031', piece: 'فستان', beforeColor: 'كحلي', afterColor: 'أسود', notes: 'فستان · كحلي' },
    { id: '032', piece: 'فستان', beforeColor: 'تركواز', afterColor: 'أزرق', notes: 'فستان · تركواز' },
    { id: '033', piece: 'فستان', beforeColor: 'نبيتي', afterColor: 'أسود', notes: 'فستان · نبيتي' },
    { id: '034', piece: 'فستان', beforeColor: 'زيتوني', afterColor: 'بيج', notes: 'فستان · زيتوني' },
    { id: '035', piece: 'فستان', beforeColor: 'بني', afterColor: 'خمري', notes: 'فستان · بني' },
    { id: '036', piece: 'جاكيت', beforeColor: 'أسود', afterColor: 'كحلي', notes: 'جاكيت · layered · outerwear' },
    { id: '037', piece: 'جاكيت', beforeColor: 'بيج', afterColor: 'زيتوني', notes: 'جاكيت · محايد' },
    { id: '038', piece: 'جاكيت', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'جاكيت · رمادي' },
    { id: '039', piece: 'جاكيت', beforeColor: 'أحمر', afterColor: 'أسود', notes: 'جاكيت · أحمر' },
    { id: '040', piece: 'جاكيت', beforeColor: 'كحلي', afterColor: 'بني', notes: 'جاكيت · كحلي' },
    { id: '041', piece: 'تنورة', beforeColor: 'أسود', afterColor: 'خمري', notes: 'تنورة · بلوزة+تنورة · lower' },
    { id: '042', piece: 'تنورة', beforeColor: 'أبيض', afterColor: 'كحلي', notes: 'تنورة · أبيض' },
    { id: '043', piece: 'تنورة', beforeColor: 'بيج', afterColor: 'ذهبي', notes: 'تنورة · بيج' },
    { id: '044', piece: 'تنورة', beforeColor: 'وردي', afterColor: 'نبيتي', notes: 'تنورة · وردي' },
    { id: '045', piece: 'تنورة', beforeColor: 'رمادي', afterColor: 'أسود', notes: 'تنورة · رمادي' },
    { id: '046', piece: 'فستان', beforeColor: 'أصفر', afterColor: 'ذهبي', notes: 'حافة · فاتح → لامع · one_piece' },
    { id: '047', piece: 'بلوزة', beforeColor: 'أسود', afterColor: 'أبيض', notes: 'حافة · تباين · two_piece upper' },
    { id: '048', piece: 'فستان', beforeColor: 'فضي', afterColor: 'أسود', notes: 'حافة · معدني · one_piece' },
    { id: '049', piece: 'عباءة', beforeColor: 'كحلي', afterColor: 'أسود', notes: 'حافة · عباءة · layered' },
    { id: '050', piece: 'فستان', beforeColor: 'خمري', afterColor: 'أسود', notes: 'حافة · خمري · one_piece' },
  ];

  function enrichScenario(raw) {
    const meta = PIECE_META[raw.piece] || {
      topology: 'two_piece',
      pieceCount: 2,
      regionRole: 'upper',
      outfitDesc: raw.piece,
    };
    const topo = TOPOLOGY[meta.topology];
    return {
      ...raw,
      topology: meta.topology,
      topologyAr: topo.labelAr,
      pieceCount: meta.pieceCount,
      regionRole: meta.regionRole,
      outfitDesc: meta.outfitDesc,
      recolorScope: 'color_only',
      phase: 'A',
      perceptionChecks: ['topo_match', 'region_isolation', 'identity_lock'],
    };
  }

  function buildPhase1Scenarios() {
    return RAW_SCENARIOS.map(enrichScenario);
  }

  function topologyStats(scenarios) {
    const stats = { one_piece: 0, two_piece: 0, layered: 0 };
    for (const s of scenarios) {
      if (stats[s.topology] !== undefined) stats[s.topology]++;
    }
    return stats;
  }

  global.MIRA_Q4_TAXONOMY = {
    RECOLOR_SCOPE,
    TOPOLOGY,
    PERCEPTION_RUBRIC,
    PIECE_META,
    buildPhase1Scenarios,
    topologyStats,
  };
  global.Q4_PHASE1_SCENARIOS = buildPhase1Scenarios();
})(typeof window !== 'undefined' ? window : globalThis);
