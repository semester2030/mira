import { CanonicalSkinMetric, CanonicalSkinModel, metricById } from './canonical-skin.model';
import { SkinFinding } from './skin-finding.engine';
import { SviV2Result } from './svi-v2.engine';

export interface MetricExplanation {
  metricId: string;
  titleAr: string;
  titleEn: string;
  levelAr: string;
  levelEn: string;
  confidenceAr: string;
  confidenceEn: string;
  reasonAr: string;
  reasonEn: string;
  evidenceAr: string;
  evidenceEn: string;
  limitationsAr: string;
  limitationsEn: string;
  howAr: string;
  howEn: string;
  availability: 'available' | 'unavailable';
  source: string;
  provider?: string;
  version: string;
}

function levelFromHealth(v: number): { ar: string; en: string } {
  if (v >= 75) return { ar: 'مرتفع', en: 'High' };
  if (v >= 55) return { ar: 'متوسط', en: 'Moderate' };
  if (v >= 35) return { ar: 'يحتاج عناية', en: 'Needs care' };
  return { ar: 'فرصة تحسين واضحة', en: 'Clear improvement opportunity' };
}

function confidenceLabel(c: number): { ar: string; en: string } {
  if (c <= 0) return { ar: 'غير متاح', en: 'Unavailable' };
  if (c >= 80) return { ar: 'مرتفع', en: 'High' };
  if (c >= 55) return { ar: 'متوسط', en: 'Medium' };
  return { ar: 'منخفض', en: 'Low' };
}

/**
 * Explainable AI layer — every displayed metric answers why/how/evidence/confidence/limitations.
 */
export function explainMetric(
  metric: CanonicalSkinMetric,
  options?: { version?: string; provider?: string },
): MetricExplanation {
  const version = options?.version ?? 'explain-v1';
  const provider = options?.provider ?? metric.provider ?? 'unknown';

  if (metric.availability !== 'available') {
    return {
      metricId: metric.id,
      titleAr: metric.displayNameAr,
      titleEn: metric.displayNameEn,
      levelAr: 'غير متاح',
      levelEn: 'Unavailable',
      confidenceAr: 'غير متاح',
      confidenceEn: 'Unavailable',
      reasonAr: 'لم يوفّر المزود هذا المؤشر في جلسة التحليل الحالية.',
      reasonEn: 'The provider did not supply this metric in the current analysis.',
      evidenceAr: 'لا توجد قيمة قابلة للتتبع.',
      evidenceEn: 'No traceable measured value.',
      limitationsAr: metric.limitations.join(' ') || 'المؤشر غير متاح.',
      limitationsEn: metric.limitations.join(' ') || 'Metric unavailable.',
      howAr: 'لا يُحسب أي تقدير بديل — تُعرض الحالة كـ «غير متاح» فقط.',
      howEn: 'No substitute estimate is invented — status remains Unavailable.',
      availability: 'unavailable',
      source: 'unavailable',
      provider,
      version,
    };
  }

  if (metric.id === 'undertone') {
    return {
      metricId: metric.id,
      titleAr: metric.displayNameAr,
      titleEn: metric.displayNameEn,
      levelAr: metric.categoricalValue ?? '—',
      levelEn: metric.categoricalValue ?? '—',
      confidenceAr: confidenceLabel(metric.confidence).ar,
      confidenceEn: confidenceLabel(metric.confidence).en,
      reasonAr: 'تصنيف تجميلي للأساس اللوني من تسميات المزود.',
      reasonEn: 'Cosmetic undertone classification from provider labels.',
      evidenceAr: `القيمة: ${metric.categoricalValue ?? '—'} (مصدر: ${metric.source}).`,
      evidenceEn: `Value: ${metric.categoricalValue ?? '—'} (source: ${metric.source}).`,
      limitationsAr: 'ليس قياساً لونياً مخبرياً. الإضاءة قد تؤثر.',
      limitationsEn: 'Not lab colorimetry. Lighting may influence the result.',
      howAr: 'يُعرض التصنيف كما ورد من طبقة التعيين الكانوني دون اختراع.',
      howEn: 'Shown as mapped from the canonical adapter without invention.',
      availability: 'available',
      source: metric.source,
      provider,
      version,
    };
  }

  const v = Math.round(metric.normalizedValue ?? 0);
  const level = levelFromHealth(v);
  const conf = confidenceLabel(metric.confidence);

  return {
    metricId: metric.id,
    titleAr: metric.displayNameAr,
    titleEn: metric.displayNameEn,
    levelAr: level.ar,
    levelEn: level.en,
    confidenceAr: conf.ar,
    confidenceEn: conf.en,
    reasonAr:
      v >= 75
        ? `قياس المزود لـ«${metric.displayNameAr}» أعلى من النطاق المستهدف التجميلي.`
        : v >= 55
          ? `قياس المزود لـ«${metric.displayNameAr}» ضمن نطاق متوسط تجميلي.`
          : `قياس المزود لـ«${metric.displayNameAr}» أقل من النطاق المستهدف التجميلي — فرصة عناية.`,
    reasonEn:
      v >= 75
        ? `Provider measured ${metric.displayNameEn.toLowerCase()} above the cosmetic target range.`
        : v >= 55
          ? `Provider measured ${metric.displayNameEn.toLowerCase()} in a moderate cosmetic range.`
          : `Provider measured ${metric.displayNameEn.toLowerCase()} below the cosmetic target range — a care opportunity.`,
    evidenceAr: `قيمة مقيّسة ${v}/100 · مصدر ${metric.source} · ثقة ${Math.round(metric.confidence)}.`,
    evidenceEn: `Measured ${v}/100 · source ${metric.source} · confidence ${Math.round(metric.confidence)}.`,
    limitationsAr:
      metric.limitations.join(' ') ||
      'الإضاءة وجودة الالتقاط قد تؤثر على النتيجة. تحليل تجميلي وليس طبياً.',
    limitationsEn:
      metric.limitations.join(' ') ||
      'Lighting and capture quality may influence the result. Cosmetic, not medical.',
    howAr:
      'تُحوَّل قيمة المزود إلى مقياس صحي موحّد 0–100 عبر محوّل المزود، ثم تُعرض مع المصدر والثقة.',
    howEn:
      'Provider value is normalized to a 0–100 health-oriented scale via the provider adapter, then shown with source and confidence.',
    availability: 'available',
    source: metric.source,
    provider,
    version,
  };
}

export function explainAllMetrics(model: CanonicalSkinModel): MetricExplanation[] {
  return model.metrics.map((m) =>
    explainMetric(m, { provider: model.provider, version: 'explain-v1' }),
  );
}

export function explainSvi(svi: SviV2Result): {
  whyAr: string;
  whyEn: string;
  howAr: string;
  howEn: string;
  confidenceAr: string;
  confidenceEn: string;
  limitationsAr: string;
  limitationsEn: string;
} {
  const conf = confidenceLabel(svi.confidence);
  return {
    whyAr: svi.explanationAr,
    whyEn: svi.explanationEn,
    howAr: `الصيغة ${svi.formulaId}: متوسط مرجّح للمؤشرات المتاحة فقط (مقام ديناميكي). المؤشرات غير المتاحة تُستبعد ولا تُعوَّض.`,
    howEn: `Formula ${svi.formulaId}: weighted blend of available metrics only (dynamic denominator). Unavailable metrics are excluded, never filled.`,
    confidenceAr: conf.ar,
    confidenceEn: conf.en,
    limitationsAr: svi.limitations.join(' '),
    limitationsEn: svi.limitations.join(' '),
  };
}

export function explainFinding(finding: SkinFinding): MetricExplanation {
  return {
    metricId: finding.metricId,
    titleAr: finding.titleAr,
    titleEn: finding.titleEn,
    levelAr:
      finding.severity === 'priority'
        ? 'أولوية عناية'
        : finding.severity === 'moderate'
          ? 'متوسط'
          : finding.severity === 'mild'
            ? 'خفيف'
            : 'إيجابي',
    levelEn:
      finding.severity === 'priority'
        ? 'Care priority'
        : finding.severity === 'moderate'
          ? 'Moderate'
          : finding.severity === 'mild'
            ? 'Mild'
            : 'Strength',
    confidenceAr:
      finding.confidence === 'high'
        ? 'مرتفع'
        : finding.confidence === 'medium'
          ? 'متوسط'
          : finding.confidence === 'low'
            ? 'منخفض'
            : 'غير متاح',
    confidenceEn: finding.confidence,
    reasonAr: finding.evidenceAr,
    reasonEn: finding.evidenceEn,
    evidenceAr: finding.evidenceAr,
    evidenceEn: finding.evidenceEn,
    limitationsAr: finding.limitations.join(' '),
    limitationsEn: finding.limitations.join(' '),
    howAr: 'مستنتج بشكل حتمي من القيمة المقيّسة وعتبات الشدة الثابتة.',
    howEn: 'Deterministically derived from the measured value and fixed severity thresholds.',
    availability: finding.confidence === 'unavailable' ? 'unavailable' : 'available',
    source: finding.source,
    version: 'explain-v1',
  };
}

/** Convenience for a single metric id. */
export function explainMetricById(
  model: CanonicalSkinModel,
  id: Parameters<typeof metricById>[1],
): MetricExplanation | undefined {
  const m = metricById(model, id);
  if (!m) return undefined;
  return explainMetric(m, { provider: model.provider });
}
