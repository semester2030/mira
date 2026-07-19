/**
 * Phase 4F — Face Intelligence contract validation (fail loudly, never silent repair).
 */
import {
  ALL_FACE_METRIC_IDS,
  CANONICAL_FACE_METRIC_CATALOG,
  CanonicalFaceMetricId,
  CanonicalFaceModel,
  FACE_INTELLIGENCE_VERSION,
  FACE_MODEL_VERSION,
} from '../canonical-face.model';
import { FaceFinding } from '../features/face-finding.engine';
import { FaceRecommendation } from '../recommendation/face-recommendation.engine';
import {
  FACE_REPORT_VERSION,
  FaceIntelligenceReportDto,
} from '../report/face-report.engine';

export const FACE_CONTRACT_VERSION = 'face-intel-contract-v1';
export const FACE_VALIDATION_VERSION = 'face-validation-v1';

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

function fail(
  violations: ContractViolation[],
  code: string,
  message: string,
  path?: string,
): void {
  violations.push({ code, message, path });
}

function merge(...parts: ContractAuditResult[]): ContractAuditResult {
  const violations = parts.flatMap((p) => p.violations);
  const infos = parts.flatMap((p) => p.infos);
  return { ok: violations.length === 0, violations, infos };
}

export function assertContractOk(
  audit: ContractAuditResult,
  label: string,
): void {
  if (!audit.ok) {
    const detail = audit.violations
      .map((v) => `${v.code}${v.path ? `@${v.path}` : ''}: ${v.message}`)
      .join('; ');
    throw new Error(`Face contract failed (${label}): ${detail}`);
  }
}

export function auditCanonicalFaceModel(
  model: CanonicalFaceModel,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];

  if (model.version !== FACE_MODEL_VERSION) {
    fail(
      violations,
      'model_version',
      `Expected ${FACE_MODEL_VERSION}`,
      'version',
    );
  }
  if (model.intelligenceVersion !== FACE_INTELLIGENCE_VERSION) {
    fail(
      violations,
      'intel_version',
      `Expected ${FACE_INTELLIGENCE_VERSION}`,
      'intelligenceVersion',
    );
  }

  const byId = new Map(model.metrics.map((m) => [m.id, m]));
  for (const id of ALL_FACE_METRIC_IDS) {
    const m = byId.get(id);
    if (!m) {
      fail(violations, 'missing_catalog_metric', `Missing metric ${id}`, id);
      continue;
    }
    const cat = CANONICAL_FACE_METRIC_CATALOG[id];
    if (
      m.displayNameAr !== cat.displayNameAr ||
      m.displayNameEn !== cat.displayNameEn
    ) {
      fail(violations, 'display_name_drift', `Name drift for ${id}`, id);
    }
    if (m.availability === 'unavailable') {
      if (m.normalizedValue != null) {
        fail(
          violations,
          'unavailable_has_value',
          `Unavailable ${id} must not carry normalizedValue`,
          id,
        );
      }
      if (m.confidence !== 0) {
        fail(
          violations,
          'unavailable_confidence',
          `Unavailable ${id} confidence must be 0`,
          id,
        );
      }
    } else {
      if (m.normalizedValue == null && m.categoricalValue == null) {
        fail(
          violations,
          'available_without_value',
          `Available ${id} lacks value`,
          id,
        );
      }
      if (!m.source || m.source === 'unavailable') {
        fail(violations, 'available_bad_source', `Invalid source for ${id}`, id);
      }
      if (!m.limitations?.length) {
        fail(violations, 'missing_limitations', `Missing limitations for ${id}`, id);
      }
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditFaceFindings(
  findings: FaceFinding[],
  model: CanonicalFaceModel,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const byId = new Map(model.metrics.map((m) => [m.id, m]));

  for (const f of findings) {
    const path = f.id;
    if (!f.titleAr?.trim() || !f.titleEn?.trim()) {
      fail(violations, 'finding_missing_title', 'Missing bilingual title', path);
    }
    if (!f.detailAr?.trim() || !f.detailEn?.trim()) {
      fail(violations, 'finding_missing_detail', 'Missing bilingual detail', path);
    }
    if (!f.source) {
      fail(violations, 'finding_missing_source', 'Missing source', path);
    }
    if (!f.limitations?.length) {
      fail(violations, 'finding_missing_limitations', 'Missing limitations', path);
    }
    if (!f.confidence) {
      fail(violations, 'finding_missing_confidence', 'Missing confidence', path);
    }
    if (typeof f.recommendationEligible !== 'boolean') {
      fail(violations, 'finding_missing_reco_flag', 'Missing recommendationEligible', path);
    }
    if (!f.metricIds?.length) {
      fail(violations, 'finding_missing_metrics', 'Finding needs metricIds', path);
    }
    for (const mid of f.metricIds) {
      const m = byId.get(mid as CanonicalFaceMetricId);
      if (!m || m.availability !== 'available') {
        fail(
          violations,
          'finding_untraceable',
          `Finding ${f.id} not traceable to available metric ${mid}`,
          path,
        );
      }
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditFaceRecommendations(
  recommendations: FaceRecommendation[],
  findings: FaceFinding[],
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const findingIds = new Set(findings.map((f) => f.id));

  for (const r of recommendations) {
    const path = r.id;
    if (r.cosmeticOnly !== true) {
      fail(violations, 'reco_not_cosmetic', 'Must be cosmeticOnly', path);
    }
    if (r.productLockIn !== false) {
      fail(violations, 'reco_product_lock', 'productLockIn must be false', path);
    }
    if (!r.limitations?.length) {
      fail(violations, 'reco_missing_limitations', 'Missing limitations', path);
    }
    if (r.category !== 'educational') {
      const hasEvidence =
        (r.evidence?.metricIds?.length ?? 0) > 0 ||
        (r.evidence?.findingIds?.length ?? 0) > 0;
      if (!hasEvidence) {
        fail(violations, 'reco_without_evidence', 'Non-edu reco lacks evidence', path);
      }
      if (!r.reasonAr?.trim() || !r.reasonEn?.trim()) {
        fail(violations, 'reco_missing_reason', 'Missing bilingual reason', path);
      }
    }
    for (const fid of r.evidence?.findingIds ?? []) {
      if (!findingIds.has(fid)) {
        fail(
          violations,
          'reco_orphan_finding',
          `References missing finding ${fid}`,
          path,
        );
      }
    }
    if (r.category !== 'educational') {
      if (/^\s*prescribe\b/i.test(r.bodyEn) || /^\s*diagnose\b/i.test(r.bodyEn)) {
        fail(violations, 'reco_medical_action', 'Must not prescribe/diagnose', path);
      }
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditFaceReportContract(
  report: FaceIntelligenceReportDto,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const required: (keyof FaceIntelligenceReportDto)[] = [
    'analysisId',
    'provider',
    'formulaVersion',
    'captureVersion',
    'faceVersion',
    'intelligenceVersion',
    'geometryVersion',
    'shapeVersion',
    'recommendationVersion',
    'reportVersion',
    'generatedAt',
    'confidence',
    'limitations',
    'language',
    'executiveSummaryAr',
    'executiveSummaryEn',
    'measurementEligible',
    'eligibilityReasonCodes',
    'shape',
    'findings',
    'notableFindings',
    'metrics',
    'recommendations',
    'featureLayers',
    'retakeGuidanceAr',
    'retakeGuidanceEn',
    'metadata',
  ];

  for (const key of required) {
    if (report[key] === undefined || report[key] === null) {
      fail(violations, 'report_missing_field', `Missing ${String(key)}`, String(key));
    }
  }

  if (report.reportVersion !== FACE_REPORT_VERSION) {
    fail(
      violations,
      'report_version',
      `Expected ${FACE_REPORT_VERSION}`,
      'reportVersion',
    );
  }

  if (!report.metadata.schemaNote.toLowerCase().includes('facehealthmap')) {
    fail(
      violations,
      'schema_note_missing',
      'metadata.schemaNote must document FaceHealthMap separation',
      'metadata.schemaNote',
    );
  }

  for (const m of report.metrics) {
    if (m.availability === 'unavailable' && m.normalizedValue != null) {
      fail(
        violations,
        'report_unavailable_value',
        `Unavailable metric ${m.id} has normalizedValue`,
        m.id,
      );
    }
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditFaceLocalization(
  report: FaceIntelligenceReportDto,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];

  const requirePair = (ar: string, en: string, path: string) => {
    if (!ar?.trim()) fail(violations, 'loc_missing_ar', 'Missing Arabic', path);
    if (!en?.trim()) fail(violations, 'loc_missing_en', 'Missing English', path);
  };

  requirePair(report.executiveSummaryAr, report.executiveSummaryEn, 'executiveSummary');
  requirePair(report.retakeGuidanceAr, report.retakeGuidanceEn, 'retakeGuidance');
  requirePair(report.shape.explanationAr, report.shape.explanationEn, 'shape.explanation');

  for (const m of report.metrics) {
    requirePair(m.displayNameAr, m.displayNameEn, `metrics.${m.id}.name`);
    const cat = CANONICAL_FACE_METRIC_CATALOG[m.id as CanonicalFaceMetricId];
    if (cat) {
      if (
        m.displayNameAr !== cat.displayNameAr ||
        m.displayNameEn !== cat.displayNameEn
      ) {
        fail(
          violations,
          'loc_terminology_drift',
          `Display name drift for ${m.id}`,
          `metrics.${m.id}`,
        );
      }
    }
  }

  for (const f of report.findings) {
    requirePair(f.titleAr, f.titleEn, `findings.${f.id}.title`);
    requirePair(f.detailAr, f.detailEn, `findings.${f.id}.detail`);
  }

  for (const r of report.recommendations) {
    requirePair(r.titleAr, r.titleEn, `reco.${r.id}.title`);
    requirePair(r.bodyAr, r.bodyEn, `reco.${r.id}.body`);
  }

  for (const layer of report.featureLayers) {
    requirePair(layer.titleAr, layer.titleEn, `layers.${layer.id}.title`);
    requirePair(layer.detailAr, layer.detailEn, `layers.${layer.id}.detail`);
  }

  return { ok: violations.length === 0, violations, infos };
}

export function auditFaceProviderLeakage(
  report: FaceIntelligenceReportDto,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const json = JSON.stringify(report);
  const banned = [
    'raw' + 'YouCam',
    'raw_' + 'youcam',
    'secret' + 'Token',
    'api' + 'Key',
    'access_' + 'token',
    'perfect_corp_' + 'payload',
  ];
  for (const b of banned) {
    if (json.includes(b)) {
      fail(violations, 'provider_leakage', `Report JSON contains forbidden token ${b}`);
    }
  }
  return { ok: violations.length === 0, violations, infos };
}

export function auditAttractivenessBan(
  report: FaceIntelligenceReportDto,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const infos: string[] = [];
  const blob = JSON.stringify(report).toLowerCase();
  if (/\battractiveness score\b/.test(blob)) {
    fail(violations, 'attractiveness_score', 'Attractiveness score is forbidden');
  }
  if (/\bbeauty ranking\b/.test(blob) && !/not/.test(blob)) {
    fail(violations, 'beauty_ranking', 'Beauty ranking claim without negation');
  }
  return { ok: violations.length === 0, violations, infos };
}

export function auditFaceIntelligencePipeline(input: {
  model: CanonicalFaceModel;
  findings: FaceFinding[];
  recommendations: FaceRecommendation[];
  report: FaceIntelligenceReportDto;
}): ContractAuditResult {
  return merge(
    auditCanonicalFaceModel(input.model),
    auditFaceFindings(input.findings, input.model),
    auditFaceRecommendations(input.recommendations, input.findings),
    auditFaceReportContract(input.report),
    auditFaceLocalization(input.report),
    auditFaceProviderLeakage(input.report),
    auditAttractivenessBan(input.report),
  );
}
