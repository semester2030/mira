/**
 * Phase 9I + 9M — Projects frozen Face Intelligence report → Advisor Evidence Units.
 * Additive beauty-advisor adapter. Does not redesign envelope / Advisor engine.
 *
 * Provenance: canonical_face_report
 * Subsystem: face_intelligence
 * Never invents recommendations / geometry / attractiveness / medical claims.
 *
 * Phase 9M (MAJOR-9L-01):
 * Client free text (publicFactAr / reasonAr / …) is UNTRUSTED and NEVER sealed
 * as canonical Face evidence. Selection refs are reconciled against the stored
 * authoritative Face Intelligence report only (LOOKUP / PROJECTION — not recompute).
 */
import type { FaceIntelligenceReportDto } from '../../intelligence/face-intelligence/report/face-report.engine';
import type { FaceFinding } from '../../intelligence/face-intelligence/features/face-finding.engine';
import type { FaceRecommendation } from '../../intelligence/face-intelligence/recommendation/face-recommendation.engine';
import type { AdvisorEvidenceUnit } from '../contracts/advisor-evidence-envelope';
import { makeEvidenceUnit } from '../envelope/envelope-builder';

const CANONICAL_FACE = 'canonical_face_report';

/**
 * Client focus identifiers. Free-text fields may still arrive from old clients
 * but MUST NEVER be projected as canonical evidence.
 */
export interface FaceAdvisorFocus {
  contextType?: string;
  /** IDENTIFIER — Face Intelligence analysis id (cross-check only). */
  analysisId?: string;
  selectedResultId?: string;
  selectedInsightId?: string;
  selectedDetailRef?: string;
  selectedRegion?: string;
  selectedGuidanceId?: string;
  frozenRecommendationRef?: string;
  evidenceRefs?: string[];
  /** @deprecated UNTRUSTED_CLIENT_INPUT — ignored by projector (9M). */
  publicFactAr?: string;
  /** @deprecated UNTRUSTED_CLIENT_INPUT — ignored by projector (9M). */
  reasonAr?: string;
  confidenceQualifier?: string;
  personalizationLevel?: string;
  evidenceStale?: boolean;
}

export type FaceContextReconcileCode =
  | 'face_context_resolved'
  | 'face_context_ref_unknown'
  | 'face_context_client_text_ignored'
  | 'face_context_no_authoritative_evidence'
  | 'face_context_general_fallback'
  | 'face_context_guidance_ref_unresolved';

export interface FaceEvidenceProjectionMeta {
  reconcileCode: FaceContextReconcileCode;
  selectionType?: string;
  resolvedEvidenceId?: string;
  /** True when client sent free text that was deliberately ignored. */
  clientTextIgnored: boolean;
}

export interface FaceEvidenceProjectionResult {
  units: AdvisorEvidenceUnit[];
  meta: FaceEvidenceProjectionMeta;
}

function confFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function stripPrefix(value: string, prefixes: string[]): string {
  for (const p of prefixes) {
    if (value.startsWith(p)) return value.slice(p.length);
  }
  return value;
}

function allFindings(report: FaceIntelligenceReportDto): FaceFinding[] {
  const notable = report.notableFindings ?? [];
  const findings = report.findings ?? [];
  const byId = new Map<string, FaceFinding>();
  for (const f of [...notable, ...findings]) {
    if (f?.id) byId.set(f.id, f);
  }
  return [...byId.values()];
}

function findFinding(
  report: FaceIntelligenceReportDto,
  rawId: string | undefined,
): FaceFinding | undefined {
  if (!rawId) return undefined;
  const id = stripPrefix(rawId, [
    'insight_finding_',
    'detail_finding_',
    'finding_',
  ]);
  return allFindings(report).find((f) => f.id === id);
}

function findMetric(
  report: FaceIntelligenceReportDto,
  rawId: string | undefined,
): FaceIntelligenceReportDto['metrics'][number] | undefined {
  if (!rawId) return undefined;
  const id = stripPrefix(rawId, [
    'insight_metric_',
    'detail_metric_',
    'metric_',
  ]);
  return (report.metrics ?? []).find((m) => m.id === id);
}

function isShapeRef(rawId: string | undefined): boolean {
  if (!rawId) return false;
  return (
    rawId.startsWith('insight_shape_') ||
    rawId.startsWith('detail_shape_') ||
    rawId.startsWith('primary_shape_') ||
    rawId === 'face_shape' ||
    rawId === 'primary_shape'
  );
}

function findRecommendation(
  report: FaceIntelligenceReportDto,
  rawId: string | undefined,
): FaceRecommendation | undefined {
  if (!rawId) return undefined;
  const id = stripPrefix(rawId, [
    'guidance_',
    'detail_reco_',
    'reco_',
    'recommendation_',
  ]);
  return (report.recommendations ?? []).find((r) => r.id === id || r.id === rawId);
}

function shapeStatement(report: FaceIntelligenceReportDto): string | null {
  if (report.shape?.availability !== 'available' || !report.shape.displayNameAr) {
    return null;
  }
  return `شكل الوجه الأقرب: ${report.shape.displayNameAr}. ${
    report.shape.explanationAr ?? ''
  }`.trim();
}

function findingStatement(f: FaceFinding): string {
  return `${f.titleAr}: ${f.detailAr}`;
}

function metricStatement(
  m: FaceIntelligenceReportDto['metrics'][number],
): string {
  // Authoritative display fields only — no fabricated beauty/progress claims.
  if (m.categoricalValue) {
    return `${m.displayNameAr}: ${m.categoricalValue}`;
  }
  return m.displayNameAr;
}

function recommendationStatement(
  r: FaceRecommendation,
  personalizationLevel?: string,
): string {
  const prefix =
    personalizationLevel === 'educational'
      ? 'توضيح'
      : personalizationLevel === 'general'
        ? 'ملاحظة عامة'
        : 'إرشاد تنسيقي';
  return `${prefix}: ${r.titleAr}. ${r.bodyAr}`;
}

function pushUnit(
  units: AdvisorEvidenceUnit[],
  args: Parameters<typeof makeEvidenceUnit>[0],
): void {
  // Deduplicate by claimKey — focused selection may repeat base projection.
  if (units.some((u) => u.claimKey === args.claimKey)) return;
  units.push(makeEvidenceUnit(args));
}

function clientSentFreeText(focus?: FaceAdvisorFocus): boolean {
  return !!(
    (focus?.publicFactAr && focus.publicFactAr.trim()) ||
    (focus?.reasonAr && focus.reasonAr.trim())
  );
}

/**
 * Project Face Intelligence → evidence units.
 * Client free text is always ignored (9M).
 */
export function projectFaceIntelligenceToEvidenceUnits(
  report: FaceIntelligenceReportDto,
  focus?: FaceAdvisorFocus,
  now?: string,
): AdvisorEvidenceUnit[] {
  return projectFaceIntelligenceEvidence(report, focus, now).units;
}

/**
 * Authoritative projection + reconciliation metadata (9M).
 */
export function projectFaceIntelligenceEvidence(
  report: FaceIntelligenceReportDto,
  focus?: FaceAdvisorFocus,
  now?: string,
): FaceEvidenceProjectionResult {
  const ts = now ?? report.generatedAt ?? new Date().toISOString();
  const stale = focus?.evidenceStale === true;
  const units: AdvisorEvidenceUnit[] = [];
  const textIgnored = clientSentFreeText(focus);
  const baseConf = focus?.confidenceQualifier
    ? 'low'
    : confFromScore(report.confidence ?? 0);

  if (!report.measurementEligible) {
    pushUnit(units, {
      subsystemId: 'face_intelligence',
      claimKey: 'face.retake',
      statementAr:
        report.retakeGuidanceAr ||
        'جودة الالتقاط لا تدعم نتيجة وجه موثوقة — يُفضّل إعادة الصورة.',
      confidence: 'low',
      capabilityId: 'face_report',
      sourceRef: report.analysisId,
      provenance: CANONICAL_FACE,
      now: ts,
      freshness: { builtAt: ts, stale: true },
    });
  }

  const shapeStmt = shapeStatement(report);
  if (shapeStmt) {
    pushUnit(units, {
      subsystemId: 'face_intelligence',
      claimKey: 'face.shape',
      statementAr: shapeStmt,
      confidence: confFromScore(report.shape.confidence ?? report.confidence),
      capabilityId: 'face_shape',
      sourceRef: report.analysisId,
      provenance: CANONICAL_FACE,
      now: ts,
      freshness: { builtAt: ts, stale },
    });
  }

  if (report.executiveSummaryAr) {
    pushUnit(units, {
      subsystemId: 'face_intelligence',
      claimKey: 'face.summary',
      statementAr: report.executiveSummaryAr,
      confidence: baseConf,
      capabilityId: 'face_report',
      sourceRef: report.analysisId,
      provenance: CANONICAL_FACE,
      now: ts,
      freshness: { builtAt: ts, stale },
    });
  }

  const findings = (report.notableFindings?.length
    ? report.notableFindings
    : report.findings
  ).slice(0, 3);
  for (const f of findings) {
    pushUnit(units, {
      subsystemId: 'face_intelligence',
      claimKey: `face.finding.${f.id}`,
      statementAr: findingStatement(f),
      confidence:
        f.confidence === 'high' ||
        f.confidence === 'medium' ||
        f.confidence === 'low'
          ? f.confidence
          : baseConf,
      capabilityId: 'face_finding',
      sourceRef: f.id,
      provenance: CANONICAL_FACE,
      now: ts,
      freshness: { builtAt: ts, stale },
    });
  }

  // --- Selection reconciliation (refs only; never client prose) ---
  let reconcileCode: FaceContextReconcileCode = textIgnored
    ? 'face_context_client_text_ignored'
    : 'face_context_general_fallback';
  let resolvedEvidenceId: string | undefined;
  const selectionType = focus?.contextType;

  const ctx = focus?.contextType;

  if (ctx === 'guidance') {
    const rec =
      findRecommendation(report, focus?.frozenRecommendationRef) ||
      findRecommendation(report, focus?.selectedGuidanceId);
    if (rec) {
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.recommendation.${rec.id}`,
        statementAr: recommendationStatement(rec, focus?.personalizationLevel),
        confidence: baseConf,
        capabilityId: 'face_recommendation',
        sourceRef: rec.id,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      // Server-owned reason only (never focus.reasonAr).
      if (rec.reasonAr && rec.reasonAr.trim()) {
        pushUnit(units, {
          subsystemId: 'face_intelligence',
          claimKey: 'face.guidance.reason',
          statementAr: rec.reasonAr,
          confidence: baseConf,
          capabilityId: 'face_recommendation',
          sourceRef: rec.id,
          provenance: CANONICAL_FACE,
          now: ts,
          freshness: { builtAt: ts, stale },
        });
      }
      reconcileCode = 'face_context_resolved';
      resolvedEvidenceId = rec.id;
    } else if (focus?.frozenRecommendationRef || focus?.selectedGuidanceId) {
      // Fail closed — do not narrate first recommendation as personalized.
      reconcileCode = 'face_context_guidance_ref_unresolved';
    } else {
      reconcileCode = 'face_context_ref_unknown';
    }
  } else if (ctx === 'insight' || ctx === 'detail' || ctx === 'primaryResult') {
    const insightId = focus?.selectedInsightId;
    const detailRef = focus?.selectedDetailRef;
    const resultId = focus?.selectedResultId;

    const finding =
      findFinding(report, insightId) || findFinding(report, detailRef);
    const metric =
      findMetric(report, insightId) || findMetric(report, detailRef);
    const shapeHit =
      isShapeRef(insightId) ||
      isShapeRef(detailRef) ||
      isShapeRef(resultId) ||
      ctx === 'primaryResult';

    if (finding) {
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.finding.${finding.id}`,
        statementAr: findingStatement(finding),
        confidence:
          finding.confidence === 'high' ||
          finding.confidence === 'medium' ||
          finding.confidence === 'low'
            ? finding.confidence
            : baseConf,
        capabilityId: 'face_finding',
        sourceRef: finding.id,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      // Focused selection claim — statement still from stored finding only.
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.context.${ctx}`,
        statementAr: findingStatement(finding),
        confidence:
          finding.confidence === 'high' ||
          finding.confidence === 'medium' ||
          finding.confidence === 'low'
            ? finding.confidence
            : baseConf,
        capabilityId: 'face_finding',
        sourceRef: finding.id,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      reconcileCode = 'face_context_resolved';
      resolvedEvidenceId = finding.id;
    } else if (metric && metric.availability === 'available') {
      const stmt = metricStatement(metric);
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.metric.${metric.id}`,
        statementAr: stmt,
        confidence: confFromScore(metric.confidence ?? report.confidence),
        capabilityId: 'face_finding',
        sourceRef: metric.id,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.context.${ctx}`,
        statementAr: stmt,
        confidence: confFromScore(metric.confidence ?? report.confidence),
        capabilityId: 'face_finding',
        sourceRef: metric.id,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      reconcileCode = 'face_context_resolved';
      resolvedEvidenceId = metric.id;
    } else if (shapeHit && shapeStmt) {
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.context.${ctx}`,
        statementAr: shapeStmt,
        confidence: confFromScore(report.shape.confidence ?? report.confidence),
        capabilityId: 'face_shape',
        sourceRef: report.shape.shapeId ?? report.analysisId,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      reconcileCode = 'face_context_resolved';
      resolvedEvidenceId = report.shape.shapeId ?? 'face_shape';
    } else if (insightId || detailRef || resultId) {
      reconcileCode = 'face_context_ref_unknown';
      // Base report units remain (general Face context) — no client text.
    } else {
      reconcileCode = 'face_context_general_fallback';
    }
  } else if (ctx === 'region') {
    // Illustrative only — never escalate to measured localization from client.
    pushUnit(units, {
      subsystemId: 'face_intelligence',
      claimKey: 'face.region.association',
      statementAr:
        'ارتباط المنطقة توضيحي/دلالي — وليس قياسًا موضعيًا مستقلًا ما لم يُذكر خلاف ذلك.',
      confidence: 'medium',
      capabilityId: 'face_region_policy',
      sourceRef: focus?.selectedRegion ?? 'region',
      provenance: CANONICAL_FACE,
      now: ts,
      freshness: { builtAt: ts, stale },
    });
    // Optionally attach a resolved related finding if a ref resolves — still server text.
    const related =
      findFinding(report, focus?.selectedInsightId) ||
      findFinding(report, focus?.selectedDetailRef);
    if (related) {
      pushUnit(units, {
        subsystemId: 'face_intelligence',
        claimKey: `face.finding.${related.id}`,
        statementAr: findingStatement(related),
        confidence:
          related.confidence === 'high' ||
          related.confidence === 'medium' ||
          related.confidence === 'low'
            ? related.confidence
            : baseConf,
        capabilityId: 'face_finding',
        sourceRef: related.id,
        provenance: CANONICAL_FACE,
        now: ts,
        freshness: { builtAt: ts, stale },
      });
      reconcileCode = 'face_context_resolved';
      resolvedEvidenceId = related.id;
    } else {
      reconcileCode = 'face_context_resolved';
      resolvedEvidenceId = focus?.selectedRegion ?? 'region';
    }
  } else if (ctx === 'generalFaceResult' || !ctx) {
    reconcileCode = textIgnored
      ? 'face_context_client_text_ignored'
      : 'face_context_general_fallback';
  }

  for (const lim of (report.limitations ?? []).slice(0, 3)) {
    pushUnit(units, {
      subsystemId: 'face_intelligence',
      claimKey: `face.limitation.${lim}`,
      statementAr: `قيد التحليل: ${lim}`,
      confidence: 'low',
      capabilityId: 'face_report',
      sourceRef: report.analysisId,
      provenance: CANONICAL_FACE,
      now: ts,
      freshness: { builtAt: ts, stale: true },
    });
  }

  if (units.length === 0) {
    reconcileCode = 'face_context_no_authoritative_evidence';
  } else if (textIgnored && reconcileCode === 'face_context_resolved') {
    // Keep resolved; client text was still ignored.
  } else if (textIgnored && reconcileCode === 'face_context_general_fallback') {
    reconcileCode = 'face_context_client_text_ignored';
  }

  return {
    units,
    meta: {
      reconcileCode,
      selectionType,
      resolvedEvidenceId,
      clientTextIgnored: textIgnored,
    },
  };
}
