import {
  CANONICAL_METRIC_CATALOG,
  CanonicalSkinMetric,
  CanonicalSkinModel,
} from './canonical-skin.model';

export type FindingSeverity = 'none' | 'mild' | 'moderate' | 'priority';
export type FindingConfidence = 'high' | 'medium' | 'low' | 'unavailable';

export interface SkinFinding {
  id: string;
  metricId: string;
  titleAr: string;
  titleEn: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  evidenceAr: string;
  evidenceEn: string;
  normalizedValue?: number;
  recommendationEligible: boolean;
  priority: number;
  limitations: string[];
  source: string;
}

function confidenceBand(c: number): FindingConfidence {
  if (c <= 0) return 'unavailable';
  if (c >= 80) return 'high';
  if (c >= 55) return 'medium';
  return 'low';
}

function severityFromHealth(
  health: number,
  polarity: 'positive' | 'negative' | 'neutral',
): FindingSeverity {
  if (polarity === 'neutral') return 'none';
  if (polarity === 'positive') {
    if (health >= 75) return 'none';
    if (health >= 55) return 'mild';
    if (health >= 35) return 'moderate';
    return 'priority';
  }
  // negative polarity: low health = issue
  const issue = 100 - health;
  if (issue < 25) return 'none';
  if (issue < 45) return 'mild';
  if (issue < 65) return 'moderate';
  return 'priority';
}

/**
 * Deterministic finding engine — only from available metrics.
 */
export function buildSkinFindings(model: CanonicalSkinModel): SkinFinding[] {
  const findings: SkinFinding[] = [];

  for (const m of model.metrics) {
    if (m.id === 'undertone') continue;
    if (m.availability !== 'available' || m.normalizedValue == null) continue;

    const cat = CANONICAL_METRIC_CATALOG[m.id];
    const severity = severityFromHealth(m.normalizedValue, cat.polarity);
    if (severity === 'none' && cat.polarity === 'positive' && m.normalizedValue >= 75) {
      // Positive strength finding
      findings.push({
        id: `strength_${m.id}`,
        metricId: m.id,
        titleAr: `${m.displayNameAr} بمستوى جيد`,
        titleEn: `Good ${m.displayNameEn.toLowerCase()}`,
        severity: 'none',
        confidence: confidenceBand(m.confidence),
        evidenceAr: `قيمة مقيسة ${Math.round(m.normalizedValue)}/100 من مصدر ${m.source}.`,
        evidenceEn: `Measured value ${Math.round(m.normalizedValue)}/100 from ${m.source}.`,
        normalizedValue: m.normalizedValue,
        recommendationEligible: false,
        priority: 90 + Math.round(m.normalizedValue / 10),
        limitations: m.limitations,
        source: m.source,
      });
      continue;
    }

    if (severity === 'none') continue;

    const priority =
      severity === 'priority' ? 10 : severity === 'moderate' ? 40 : 70;

    findings.push({
      id: `finding_${m.id}`,
      metricId: m.id,
      titleAr: m.displayNameAr,
      titleEn: m.displayNameEn,
      severity,
      confidence: confidenceBand(m.confidence),
      evidenceAr: explainAr(m),
      evidenceEn: explainEn(m),
      normalizedValue: m.normalizedValue,
      recommendationEligible: m.recommendationEligible,
      priority,
      limitations: m.limitations,
      source: m.source,
    });
  }

  return findings.sort((a, b) => a.priority - b.priority);
}

function explainAr(m: CanonicalSkinMetric): string {
  const v = Math.round(m.normalizedValue ?? 0);
  return `المؤشر «${m.displayNameAr}» بلغ ${v}/100 (مصدر: ${m.source}). هذه قراءة تجميلية من الصورة وليست تشخيصاً طبياً.`;
}

function explainEn(m: CanonicalSkinMetric): string {
  const v = Math.round(m.normalizedValue ?? 0);
  return `${m.displayNameEn} scored ${v}/100 (source: ${m.source}). Cosmetic image-based reading — not a medical diagnosis.`;
}

export function positiveFindings(findings: SkinFinding[]): SkinFinding[] {
  return findings.filter((f) => f.id.startsWith('strength_'));
}

export function priorityFindings(findings: SkinFinding[]): SkinFinding[] {
  return findings.filter(
    (f) => f.severity === 'priority' || f.severity === 'moderate',
  );
}
