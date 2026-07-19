import { CanonicalSkinModel, SKIN_INTELLIGENCE_VERSION, SKIN_MODEL_VERSION } from './canonical-skin.model';
import { MetricExplanation } from './explanation.engine';
import { ProgressComparison } from './progress.engine';
import { SkinRecommendation } from './recommendation.engine';
import {
  priorityFindings,
  positiveFindings,
  SkinFinding,
} from './skin-finding.engine';
import { SVI_V2_VERSION, SviV2Result } from './svi-v2.engine';

export const SKIN_REPORT_VERSION = 'skin-report-v1';
export const CAPTURE_VERSION_DEFAULT = 'cq-thresholds-v2.1';
export const QUALITY_VERSION_DEFAULT = 'iq-v2.1+qc-v1.1';

/** Clean client DTO — no provider JSON leakage. */
export interface SkinIntelligenceReportDto {
  analysisId: string;
  provider: string;
  providerVersion?: string;
  formulaVersion: string;
  captureVersion: string;
  qualityVersion: string;
  skinVersion: string;
  intelligenceVersion: string;
  reportVersion: string;
  generatedAt: string;
  confidence: number;
  limitations: string[];
  language: 'ar' | 'en' | 'ar+en';

  executiveSummaryAr: string;
  executiveSummaryEn: string;

  positiveFindings: SkinFinding[];
  priorityFindings: SkinFinding[];
  allFindings: SkinFinding[];

  metrics: Array<{
    id: string;
    displayNameAr: string;
    displayNameEn: string;
    availability: 'available' | 'unavailable';
    normalizedValue?: number;
    categoricalValue?: string;
    confidence: number;
    source: string;
    provider?: string;
    limitations: string[];
    recommendationEligible: boolean;
    explanation: MetricExplanation;
  }>;

  svi: {
    score: number;
    confidence: number;
    version: string;
    formulaId: string;
    explanationAr: string;
    explanationEn: string;
    positiveContributors: SviV2Result['positiveContributors'];
    negativeContributors: SviV2Result['negativeContributors'];
    unavailableExcluded: string[];
    limitations: string[];
  };

  recommendations: SkinRecommendation[];
  progress: ProgressComparison;
  retakeGuidanceAr: string;
  retakeGuidanceEn: string;
  metadata: {
    isMock: boolean;
    skinTypeAr?: string;
    skinTypeEn?: string;
  };
}

export function buildSkinIntelligenceReport(input: {
  analysisId: string;
  model: CanonicalSkinModel;
  findings: SkinFinding[];
  svi: SviV2Result;
  explanations: MetricExplanation[];
  recommendations: SkinRecommendation[];
  progress: ProgressComparison;
  captureVersion?: string;
  qualityVersion?: string;
  language?: 'ar' | 'en' | 'ar+en';
}): SkinIntelligenceReportDto {
  const generatedAt = new Date().toISOString();
  const explainById = new Map(input.explanations.map((e) => [e.metricId, e]));
  const pos = positiveFindings(input.findings);
  const pri = priorityFindings(input.findings);

  const topStrength = pos[0];
  const topPriority = pri[0];

  const executiveSummaryAr = [
    `مؤشر حيوية البشرة ${input.svi.score} (ثقة ${input.svi.confidence}).`,
    topStrength
      ? `نقطة قوة: ${topStrength.titleAr}.`
      : 'نقاط القوة تُعرض عند توفر مؤشرات إيجابية.',
    topPriority
      ? `فرصة عناية: ${topPriority.titleAr}.`
      : 'لا توجد أولويات عناية ملحوظة في هذه القراءة.',
    'تحليل تجميلي إرشادي — ليس تشخيصاً طبياً ولا تقييماً للجمال.',
  ].join(' ');

  const executiveSummaryEn = [
    `Skin Vitality Index ${input.svi.score} (confidence ${input.svi.confidence}).`,
    topStrength
      ? `Strength: ${topStrength.titleEn}.`
      : 'Strengths appear when positive metrics are available.',
    topPriority
      ? `Care opportunity: ${topPriority.titleEn}.`
      : 'No notable care priorities in this reading.',
    'Cosmetic informational analysis — not medical diagnosis or beauty ranking.',
  ].join(' ');

  return {
    analysisId: input.analysisId,
    provider: input.model.provider,
    providerVersion: input.model.providerVersion,
    formulaVersion: input.svi.formulaId,
    captureVersion: input.captureVersion ?? CAPTURE_VERSION_DEFAULT,
    qualityVersion: input.qualityVersion ?? QUALITY_VERSION_DEFAULT,
    skinVersion: SKIN_MODEL_VERSION,
    intelligenceVersion: SKIN_INTELLIGENCE_VERSION,
    reportVersion: SKIN_REPORT_VERSION,
    generatedAt,
    confidence: input.svi.confidence,
    limitations: [
      ...input.svi.limitations,
      ...input.model.limitations.slice(0, 4),
    ],
    language: input.language ?? 'ar+en',
    executiveSummaryAr,
    executiveSummaryEn,
    positiveFindings: pos,
    priorityFindings: pri,
    allFindings: input.findings,
    metrics: input.model.metrics.map((m) => ({
      id: m.id,
      displayNameAr: m.displayNameAr,
      displayNameEn: m.displayNameEn,
      availability: m.availability,
      normalizedValue: m.normalizedValue,
      categoricalValue: m.categoricalValue,
      confidence: m.confidence,
      source: m.source,
      provider: m.provider ?? input.model.provider,
      limitations: m.limitations,
      recommendationEligible: m.recommendationEligible,
      explanation:
        explainById.get(m.id) ??
        ({
          metricId: m.id,
          titleAr: m.displayNameAr,
          titleEn: m.displayNameEn,
          levelAr: '—',
          levelEn: '—',
          confidenceAr: '—',
          confidenceEn: '—',
          reasonAr: '',
          reasonEn: '',
          evidenceAr: '',
          evidenceEn: '',
          limitationsAr: '',
          limitationsEn: '',
          howAr: '',
          howEn: '',
          availability: m.availability,
          source: m.source,
          version: 'explain-v1',
        } satisfies MetricExplanation),
    })),
    svi: {
      score: input.svi.score,
      confidence: input.svi.confidence,
      version: SVI_V2_VERSION,
      formulaId: input.svi.formulaId,
      explanationAr: input.svi.explanationAr,
      explanationEn: input.svi.explanationEn,
      positiveContributors: input.svi.positiveContributors,
      negativeContributors: input.svi.negativeContributors,
      unavailableExcluded: input.svi.unavailableExcluded,
      limitations: input.svi.limitations,
    },
    recommendations: input.recommendations,
    progress: input.progress,
    retakeGuidanceAr:
      'للحصول على مقارنة عادلة لاحقاً: إضاءة أمامية ناعمة، وجه ثابت، نفس زاوية الكاميرا تقريباً.',
    retakeGuidanceEn:
      'For a fair later comparison: soft front lighting, steady face, similar camera angle.',
    metadata: {
      isMock: input.model.isMock,
      skinTypeAr: input.model.skinTypeAr,
      skinTypeEn: input.model.skinTypeEn,
    },
  };
}
