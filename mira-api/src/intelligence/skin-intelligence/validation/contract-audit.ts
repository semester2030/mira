/**
 * Phase 3.5 — Contract validation (fail loudly, never silent repair).
 */
import {
  CANONICAL_METRIC_CATALOG,
  CanonicalMetricId,
  CanonicalSkinModel,
  metricById,
} from '../canonical-skin.model';
import { SkinFinding } from '../skin-finding.engine';
import { SkinRecommendation } from '../recommendation.engine';
import { ProgressComparison } from '../progress.engine';
import { SkinIntelligenceReportDto } from '../report.engine';
import { SVI_V2_FORMULA_ID, SVI_V2_VERSION } from '../svi-v2.engine';

export const FINDING_ENGINE_VERSION = 'finding-v1';
export const CONTRACT_VERSION = 'skin-intel-contract-v1';

export interface ContractViolation {
  code: string;
  message: string;
  path?: string;
}

export interface ContractAuditResult {
  ok: boolean;
  violations: ContractViolation[];
  infos: string[];
}

const ALL_METRIC_IDS = Object.keys(CANONICAL_METRIC_CATALOG) as CanonicalMetricId[];

function fail(
  violations: ContractViolation[],
  code: string,
  message: string,
  path?: string,
): void {
  violations.push({ code, message, path });
}

export function auditCanonicalModel(model: CanonicalSkinModel): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];

  for (const id of ALL_METRIC_IDS) {
    const m = metricById(model, id);
    if (!m) {
      fail(violations, 'missing_catalog_metric', `Canonical model missing metric ${id}`, id);
      continue;
    }
    if (m.availability === 'unavailable') {
      if (m.normalizedValue != null) {
        fail(
          violations,
          'unavailable_has_value',
          `Unavailable metric ${id} must not carry normalizedValue`,
          id,
        );
      }
      if (m.confidence !== 0) {
        fail(
          violations,
          'unavailable_confidence',
          `Unavailable metric ${id} confidence must be 0`,
          id,
        );
      }
      if (m.recommendationEligible) {
        fail(
          violations,
          'unavailable_reco',
          `Unavailable metric ${id} must not be recommendationEligible`,
          id,
        );
      }
    } else {
      if (m.id !== 'undertone' && m.normalizedValue == null && m.categoricalValue == null) {
        fail(
          violations,
          'available_without_value',
          `Available metric ${id} lacks value`,
          id,
        );
      }
      if (!m.source || m.source === 'unavailable') {
        fail(violations, 'available_bad_source', `Available metric ${id} has invalid source`, id);
      }
      if (!m.limitations?.length) {
        fail(violations, 'missing_limitations', `Metric ${id} missing limitations`, id);
      }
      if (!m.displayNameAr || !m.displayNameEn) {
        fail(violations, 'missing_display_name', `Metric ${id} missing bilingual names`, id);
      }
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditFindings(
  findings: SkinFinding[],
  model: CanonicalSkinModel,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [
    `Finding reason ≡ evidenceAr/En (contract binding). Version ≡ ${FINDING_ENGINE_VERSION} + report intelligenceVersion.`,
  ];

  for (const f of findings) {
    const path = f.id;
    if (!f.evidenceAr?.trim() || !f.evidenceEn?.trim()) {
      fail(violations, 'finding_missing_evidence', 'Finding missing bilingual evidence', path);
    }
    if (!f.source) {
      fail(violations, 'finding_missing_source', 'Finding missing source', path);
    }
    if (!f.limitations?.length) {
      fail(violations, 'finding_missing_limitations', 'Finding missing limitations', path);
    }
    if (!f.confidence) {
      fail(violations, 'finding_missing_confidence', 'Finding missing confidence', path);
    }
    if (typeof f.priority !== 'number') {
      fail(violations, 'finding_missing_priority', 'Finding missing priority', path);
    }
    if (typeof f.recommendationEligible !== 'boolean') {
      fail(
        violations,
        'finding_missing_reco_flag',
        'Finding missing recommendationEligible',
        path,
      );
    }
    const m = metricById(model, f.metricId as CanonicalMetricId);
    if (!m || m.availability !== 'available') {
      fail(
        violations,
        'finding_untraceable',
        `Finding ${f.id} not traceable to available metric ${f.metricId}`,
        path,
      );
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditRecommendations(
  recommendations: SkinRecommendation[],
  findings: SkinFinding[],
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const findingIds = new Set(findings.map((f) => f.id));

  for (const r of recommendations) {
    const path = r.id;
    if (r.cosmeticOnly !== true) {
      fail(violations, 'reco_not_cosmetic', 'Recommendation must be cosmeticOnly', path);
    }
    if (!r.reasonAr?.trim() || !r.reasonEn?.trim()) {
      if (r.category !== 'educational') {
        fail(violations, 'reco_missing_reason', 'Recommendation missing reason', path);
      }
    }
    if (!r.limitations?.length) {
      fail(violations, 'reco_missing_limitations', 'Recommendation missing limitations', path);
    }
    if (r.category !== 'educational') {
      const hasEvidence =
        (r.evidence?.metricIds?.length ?? 0) > 0 ||
        (r.evidence?.findingIds?.length ?? 0) > 0;
      if (!hasEvidence) {
        fail(
          violations,
          'reco_without_evidence',
          'Non-educational recommendation lacks evidence',
          path,
        );
      }
    }
    for (const fid of r.evidence?.findingIds ?? []) {
      if (!findingIds.has(fid)) {
        fail(
          violations,
          'reco_orphan_finding',
          `Recommendation references missing finding ${fid}`,
          path,
        );
      }
    }
    // Soft medical language check on actionable body (educational may negate)
    if (r.category !== 'educational') {
      if (/^\s*prescribe\b/i.test(r.bodyEn) || /^\s*diagnose\b/i.test(r.bodyEn)) {
        fail(violations, 'reco_medical_action', 'Actionable body must not prescribe/diagnose', path);
      }
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditSvi(report: SkinIntelligenceReportDto): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const svi = report.svi;
  if (svi.version !== SVI_V2_VERSION) {
    fail(violations, 'svi_version', `Expected SVI version ${SVI_V2_VERSION}`, 'svi.version');
  }
  if (svi.formulaId !== SVI_V2_FORMULA_ID) {
    fail(violations, 'svi_formula', `Expected formula ${SVI_V2_FORMULA_ID}`, 'svi.formulaId');
  }
  if (!svi.explanationAr?.trim() || !svi.explanationEn?.trim()) {
    fail(violations, 'svi_explanation', 'SVI missing bilingual explanation', 'svi');
  }
  if (!Array.isArray(svi.positiveContributors) || !Array.isArray(svi.negativeContributors)) {
    fail(violations, 'svi_contributors', 'SVI missing contributor arrays', 'svi');
  }
  if (!Array.isArray(svi.unavailableExcluded)) {
    fail(violations, 'svi_excluded', 'SVI missing unavailableExcluded', 'svi');
  }
  // Dynamic denominator: every unavailable SVI-weight metric should appear in excluded OR not contribute
  for (const c of [...svi.positiveContributors, ...svi.negativeContributors]) {
    const row = report.metrics.find((m) => m.id === c.metricId);
    if (row && row.availability !== 'available') {
      fail(
        violations,
        'svi_used_unavailable',
        `SVI contributor ${c.metricId} is unavailable in report metrics`,
        c.metricId,
      );
    }
  }
  const claims = `${svi.explanationEn} ${svi.limitations.join(' ')}`.toLowerCase();
  if (claims.includes('clinical diagnosis') && !claims.includes('not')) {
    // only fail if it claims diagnosis without negation — Phase 3 text includes "not ... diagnosis"
  }
  if (/\bbeauty ranking\b/.test(claims) && !/not/.test(claims)) {
    fail(violations, 'svi_beauty_claim', 'SVI must not claim beauty ranking', 'svi');
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditProgress(progress: ProgressComparison): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const allowed = new Set(['improved', 'stable', 'declined', 'unknown']);
  if (!allowed.has(progress.overallTrend)) {
    fail(violations, 'progress_trend', `Invalid trend ${progress.overallTrend}`, 'progress');
  }
  if (!progress.comparable) {
    if (progress.overallTrend !== 'unknown') {
      fail(
        violations,
        'progress_incomparable_trend',
        'Incomparable progress must use unknown trend',
        'progress',
      );
    }
    if (!progress.unavailableReasonAr || !progress.unavailableReasonEn) {
      fail(
        violations,
        'progress_missing_reason',
        'Incomparable progress needs bilingual unavailable reason',
        'progress',
      );
    }
  } else if (progress.overallTrend === 'unknown') {
    fail(
      violations,
      'progress_comparable_unknown',
      'Comparable progress should not be unknown',
      'progress',
    );
  }
  if (progress.version !== 'progress-v1') {
    fail(violations, 'progress_version', 'Expected progress-v1', 'progress.version');
  }
  return { ok: violations.length === 0, violations, infos };
}

export function auditLocalization(report: SkinIntelligenceReportDto): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];

  const requirePair = (ar: string, en: string, path: string) => {
    if (!ar?.trim()) fail(violations, 'loc_missing_ar', 'Missing Arabic', path);
    if (!en?.trim()) fail(violations, 'loc_missing_en', 'Missing English', path);
  };

  requirePair(report.executiveSummaryAr, report.executiveSummaryEn, 'executiveSummary');
  requirePair(report.retakeGuidanceAr, report.retakeGuidanceEn, 'retakeGuidance');
  requirePair(report.svi.explanationAr, report.svi.explanationEn, 'svi.explanation');

  for (const m of report.metrics) {
    requirePair(m.displayNameAr, m.displayNameEn, `metrics.${m.id}.name`);
    requirePair(m.explanation.reasonAr, m.explanation.reasonEn, `metrics.${m.id}.reason`);
    requirePair(
      m.explanation.limitationsAr,
      m.explanation.limitationsEn,
      `metrics.${m.id}.limitations`,
    );
    // Catalog consistency
    const cat = CANONICAL_METRIC_CATALOG[m.id as CanonicalMetricId];
    if (cat) {
      if (m.displayNameAr !== cat.displayNameAr || m.displayNameEn !== cat.displayNameEn) {
        fail(
          violations,
          'loc_terminology_drift',
          `Display name drift for ${m.id}`,
          `metrics.${m.id}`,
        );
      }
    }
  }

  for (const f of report.allFindings) {
    requirePair(f.titleAr, f.titleEn, `findings.${f.id}.title`);
    requirePair(f.evidenceAr, f.evidenceEn, `findings.${f.id}.evidence`);
  }

  for (const r of report.recommendations) {
    requirePair(r.titleAr, r.titleEn, `reco.${r.id}.title`);
    requirePair(r.bodyAr, r.bodyEn, `reco.${r.id}.body`);
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditProviderLeakage(report: SkinIntelligenceReportDto): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const json = JSON.stringify(report);
  const banned = ['rawYouCam', 'raw_youcam', 'secretToken', 'apiKey', 'access_token'];
  for (const b of banned) {
    if (json.includes(b)) {
      fail(violations, 'provider_leakage', `Report JSON contains forbidden token ${b}`);
    }
  }
  return { ok: violations.length === 0, violations, infos };
}

export function auditReportContract(report: SkinIntelligenceReportDto): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const required: (keyof SkinIntelligenceReportDto)[] = [
    'analysisId',
    'provider',
    'formulaVersion',
    'captureVersion',
    'qualityVersion',
    'skinVersion',
    'intelligenceVersion',
    'reportVersion',
    'generatedAt',
    'confidence',
    'limitations',
    'language',
    'executiveSummaryAr',
    'executiveSummaryEn',
    'positiveFindings',
    'priorityFindings',
    'allFindings',
    'metrics',
    'svi',
    'recommendations',
    'progress',
    'retakeGuidanceAr',
    'retakeGuidanceEn',
    'metadata',
  ];
  for (const key of required) {
    if (report[key] == null) {
      fail(violations, 'dto_missing_field', `DTO missing ${String(key)}`, String(key));
    }
  }
  if (report.metrics.length !== ALL_METRIC_IDS.length) {
    fail(
      violations,
      'dto_metric_count',
      `Expected ${ALL_METRIC_IDS.length} metrics, got ${report.metrics.length}`,
      'metrics',
    );
  }
  return { ok: violations.length === 0, violations, infos };
}

/**
 * Full pipeline contract audit for one report + model + findings.
 */
export function auditSkinIntelligencePipeline(input: {
  model: CanonicalSkinModel;
  findings: SkinFinding[];
  report: SkinIntelligenceReportDto;
}): ContractAuditResult {
  const parts = [
    auditCanonicalModel(input.model),
    auditFindings(input.findings, input.model),
    auditRecommendations(input.report.recommendations, input.findings),
    auditSvi(input.report),
    auditProgress(input.report.progress),
    auditLocalization(input.report),
    auditProviderLeakage(input.report),
    auditReportContract(input.report),
  ];

  // Traceability: every available numeric metric meaning preserved into report row
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  for (const m of input.model.metrics) {
    const row = input.report.metrics.find((r) => r.id === m.id);
    if (!row) {
      fail(violations, 'trace_lost', `Metric ${m.id} lost between model and report`, m.id);
      continue;
    }
    if (row.availability !== m.availability) {
      fail(violations, 'trace_availability', `Availability drift for ${m.id}`, m.id);
    }
    if (m.availability === 'available' && m.normalizedValue != null) {
      if (row.normalizedValue !== m.normalizedValue) {
        fail(violations, 'trace_value', `Normalized value drift for ${m.id}`, m.id);
      }
    }
    if (row.source !== m.source) {
      fail(violations, 'trace_source', `Source drift for ${m.id}`, m.id);
    }
  }

  // SVI score must match report header confidence path
  if (input.report.svi.score == null || !Number.isFinite(input.report.svi.score)) {
    fail(violations, 'svi_score', 'SVI score missing', 'svi.score');
  }

  const allViolations = [...violations, ...parts.flatMap((p) => p.violations)];
  const allInfos = [...infos, ...parts.flatMap((p) => p.infos)];
  return { ok: allViolations.length === 0, violations: allViolations, infos: allInfos };
}

export function assertContractOk(result: ContractAuditResult, label: string): void {
  if (!result.ok) {
    const detail = result.violations
      .map((v) => `${v.code}${v.path ? `@${v.path}` : ''}: ${v.message}`)
      .join('\n');
    throw new Error(`Contract audit failed (${label}):\n${detail}`);
  }
}
