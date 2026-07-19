/**
 * Fashion Capability Catalog — Wardrobe Foundation subset (6B).
 * Full catalog designed in 6A.5; only Mira-owned capabilities execute here.
 * No provider selection. No external APIs.
 */
export const FASHION_CAPABILITY_IDS = [
  'wardrobe',
  'wardrobe_insights',
  'history',
  'progress',
  'report',
  'analyze_outfit',
  'analyze_garment',
  'analyze_style',
  'style_reason',
  'style_goals',
  'recommendations',
  'color_harmony',
  'compatibility',
  'occasion_matching',
  'season_matching',
  'recolor_garment',
  'compare_looks',
] as const;

export type FashionCapabilityId = (typeof FASHION_CAPABILITY_IDS)[number];

export interface FashionCapabilityDefinition {
  capabilityId: FashionCapabilityId;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  dependencies: FashionCapabilityId[];
  requiredData: string[];
  providerRequirements: 'none' | 'geometry' | 'semantic' | 'recolor';
  /** Foundation: only Mira-owned caps are executionEnabled */
  executionEnabled: boolean;
  activationRule: string;
}

export const FASHION_CAPABILITY_CATALOG: FashionCapabilityDefinition[] = [
  {
    capabilityId: 'wardrobe',
    labelEn: 'Wardrobe',
    labelAr: 'الخزانة',
    descriptionEn: 'Mira-owned wardrobe CRUD and bind.',
    descriptionAr: 'إدارة خزانة ميرا وربطها بالجلسة.',
    dependencies: [],
    requiredData: ['userId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_WARDROBE_ENABLED !== false',
  },
  {
    capabilityId: 'wardrobe_insights',
    labelEn: 'Wardrobe Insights',
    labelAr: 'رؤى الخزانة',
    descriptionEn: 'Statistics and gap hints from wardrobe refs only.',
    descriptionAr: 'إحصاءات وفجوات من مراجع الخزانة فقط.',
    dependencies: ['wardrobe'],
    requiredData: ['wardrobeId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'wardrobe present',
  },
  {
    capabilityId: 'history',
    labelEn: 'History',
    labelAr: 'السجل',
    descriptionEn: 'Session and wardrobe history events.',
    descriptionAr: 'أحداث سجل الجلسة والخزانة.',
    dependencies: [],
    requiredData: ['sessionId|userId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'always',
  },
  {
    capabilityId: 'progress',
    labelEn: 'Progress',
    labelAr: 'التقدم',
    descriptionEn: 'Progress skeleton (goals/milestones) — Wardrobe session; Style Progress owned by Styling Intelligence.',
    descriptionAr: 'هيكل التقدم — الجلسة؛ تقدم التنسيق تملكه ذكاء التنسيق.',
    dependencies: [],
    requiredData: ['sessionId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'session present',
  },
  {
    capabilityId: 'report',
    labelEn: 'Fashion Report',
    labelAr: 'تقرير الموضة',
    descriptionEn: 'Assemble report — blocked until later phases.',
    descriptionAr: 'تجميع التقرير — محظور حتى مراحل لاحقة.',
    dependencies: [],
    requiredData: ['sessionId'],
    providerRequirements: 'none',
    executionEnabled: false,
    activationRule: 'Phase 6E+',
  },
  {
    capabilityId: 'analyze_outfit',
    labelEn: 'Analyze Outfit',
    labelAr: 'تحليل الإطلالة',
    descriptionEn:
      'Compose + evaluate CanonicalGarment[] → CanonicalOutfit (Mira OI). No provider call.',
    descriptionAr:
      'تركيب وتقييم قطع قانونية → إطلالة قانونية (ذكاء الإطلالة). بدون استدعاء مزوّد.',
    dependencies: ['analyze_garment'],
    requiredData: ['canonicalGarments'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_OUTFIT_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'analyze_garment',
    labelEn: 'Analyze Garment',
    labelAr: 'تحليل القطعة',
    descriptionEn:
      'Map FashionVisionDocument → CanonicalGarment (Mira GI). No direct provider call.',
    descriptionAr:
      'تعيين وثيقة الرؤية → قطعة قانونية (ذكاء القطعة). بدون استدعاء مزوّد مباشر.',
    dependencies: [],
    requiredData: ['fashionVisionDocument'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_GARMENT_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'analyze_style',
    labelEn: 'Analyze Style',
    labelAr: 'تحليل التنسيق',
    descriptionEn:
      'Reason over frozen Skin/Face/Garment/Outfit → Canonical Styling Profile. No recommendations.',
    descriptionAr:
      'استدلال على ذكاء مجمّد → ملف تنسيق قانوني. بدون توصيات.',
    dependencies: ['analyze_outfit', 'analyze_garment'],
    requiredData: ['subjectId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_STYLING_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'style_reason',
    labelEn: 'Style Reason',
    labelAr: 'استدلال التنسيق',
    descriptionEn: 'Emit Style Decisions with Law #32 evidence refs only.',
    descriptionAr: 'إصدار قرارات تنسيق بأدلة قانون #32 فقط.',
    dependencies: ['analyze_style'],
    requiredData: ['subjectId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_STYLING_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'style_goals',
    labelEn: 'Style Goals',
    labelAr: 'أهداف التنسيق',
    descriptionEn: 'Goal lifecycle + progress from styling reasoning.',
    descriptionAr: 'دورة حياة الأهداف والتقدم من استدلال التنسيق.',
    dependencies: ['analyze_style'],
    requiredData: ['subjectId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_STYLING_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'recommendations',
    labelEn: 'Recommendations',
    labelAr: 'التوصيات',
    descriptionEn: 'Registered — not executed (Recommendation Engine phase).',
    descriptionAr: 'مسجّل — غير منفّذ (مرحلة محرك التوصيات).',
    dependencies: [],
    requiredData: ['sessionId'],
    providerRequirements: 'none',
    executionEnabled: false,
    activationRule: 'Recommendation Engine phase — not 6E.1',
  },
  {
    capabilityId: 'color_harmony',
    labelEn: 'Color Harmony',
    labelAr: 'تناغم الألوان',
    descriptionEn: 'Evidence-based color/style harmony metrics (Outfit Intelligence).',
    descriptionAr: 'مقاييس تناغم الألوان/الأسلوب المبنية على الأدلة.',
    dependencies: ['analyze_outfit'],
    requiredData: ['canonicalGarments'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_OUTFIT_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'compatibility',
    labelEn: 'Compatibility',
    labelAr: 'التوافق',
    descriptionEn: 'Pair/set compatibility evaluation (Outfit Intelligence).',
    descriptionAr: 'تقييم توافق الأزواج/المجموعة.',
    dependencies: ['analyze_outfit'],
    requiredData: ['canonicalGarments'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_OUTFIT_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'occasion_matching',
    labelEn: 'Occasion Matching',
    labelAr: 'ملاءمة المناسبة',
    descriptionEn: 'Occasion context evaluation only — no recommendations.',
    descriptionAr: 'تقييم سياق المناسبة فقط — بدون توصيات.',
    dependencies: ['analyze_outfit'],
    requiredData: ['canonicalGarments', 'occasionId'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_OUTFIT_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'season_matching',
    labelEn: 'Season Matching',
    labelAr: 'ملاءمة الموسم',
    descriptionEn: 'Season/climate context evaluation only — no recommendations.',
    descriptionAr: 'تقييم سياق الموسم/المناخ فقط — بدون توصيات.',
    dependencies: ['analyze_outfit'],
    requiredData: ['canonicalGarments', 'season'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_OUTFIT_INTEL_ENABLED !== false',
  },
  {
    capabilityId: 'recolor_garment',
    labelEn: 'Recolor Garment',
    labelAr: 'إعادة تلوين القطعة',
    descriptionEn: 'Registered — no FASHN in 6B.',
    descriptionAr: 'مسجّل — بدون FASHN في 6B.',
    dependencies: [],
    requiredData: ['garmentId', 'color'],
    providerRequirements: 'recolor',
    executionEnabled: false,
    activationRule: 'licensed adapter — not 6B',
  },
  {
    capabilityId: 'compare_looks',
    labelEn: 'Compare Looks',
    labelAr: 'مقارنة الإطلالات',
    descriptionEn: 'Compare two CanonicalOutfit evaluations (Outfit Intelligence).',
    descriptionAr: 'مقارنة تقييمَي إطلالة قانونيين.',
    dependencies: ['analyze_outfit'],
    requiredData: ['canonicalGarmentsA', 'canonicalGarmentsB'],
    providerRequirements: 'none',
    executionEnabled: true,
    activationRule: 'FASHION_OUTFIT_INTEL_ENABLED !== false',
  },
];

export function getFashionCapability(
  id: string,
): FashionCapabilityDefinition | undefined {
  return FASHION_CAPABILITY_CATALOG.find((c) => c.capabilityId === id);
}

export function listPublicFashionCapabilities(): FashionCapabilityDefinition[] {
  return FASHION_CAPABILITY_CATALOG.map((c) => ({ ...c }));
}
