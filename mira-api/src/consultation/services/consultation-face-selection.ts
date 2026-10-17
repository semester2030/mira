import type { FaceAdvisorFocus, FaceEvidenceProjectionResult } from '../../beauty-advisor/evidence/face-intelligence-projector';
import { projectFaceIntelligenceEvidence } from '../../beauty-advisor/evidence/face-intelligence-projector';
import type { FaceIntelligenceReportDto } from '../../intelligence/face-intelligence/report/face-report.engine';
import { FaceSelectionContextV1, MceFactEntry } from '../contracts/mce-context-snapshot.v1';

export interface FaceSelectionInput {
  contextType?: string;
  analysisId?: string;
  reportRef?: string;
  selectedResultId?: string;
  selectedInsightId?: string;
  selectedDetailRef?: string;
  selectedRegion?: string;
  selectedGuidanceId?: string;
  frozenRecommendationRef?: string;
  evidenceRefs?: string[];
  limitationRefs?: string[];
  resultVersion?: string;
  evidenceStale?: boolean;
  publicFactAr?: string;
  reasonAr?: string;
  contextLabelAr?: string;
}

const UNAVAILABLE = 'نتيجة الوجه المختارة غير متاحة في هذا الحساب، ولن أختار تقريرًا آخر.';
const STALE = 'نتيجة الوجه المختارة قديمة أو لا تطابق إصدار التقرير المحفوظ. لن أستخدم نتيجة أخرى بدلها.';
const UNKNOWN = 'مرجع الاختيار غير موجود في التقرير المحفوظ، ولن أستبدله بتفصيل آخر.';

function reportConfidence(report: FaceIntelligenceReportDto): 'high' | 'medium' | 'low' {
  const value = report.confidence <= 1 ? report.confidence : report.confidence / 100;
  if (value >= 0.75) return 'high';
  if (value >= 0.45) return 'medium';
  return 'low';
}

function analysisConstraintLines(report: FaceIntelligenceReportDto): string[] {
  const percent = report.confidence <= 1 ? Math.round(report.confidence * 100) : Math.round(report.confidence);
  return [
    ...report.limitations.filter((item) => item.trim()).map((item) => `قيد التحليل: ${item.trim()}`),
    `مستوى الثقة في التقرير: ${percent}٪`,
  ];
}

function generalFaceStatements(report: FaceIntelligenceReportDto): string[] {
  const lines: string[] = [];
  if (report.executiveSummaryAr.trim()) lines.push(report.executiveSummaryAr.trim());
  if (report.shape.availability === 'available' && report.shape.explanationAr.trim()) {
    lines.push(`شكل الوجه: ${report.shape.explanationAr.trim()}`);
  }
  for (const finding of report.notableFindings.slice(0, 4)) {
    if (finding.detailAr.trim()) lines.push(`${finding.titleAr}: ${finding.detailAr.trim()}`);
  }
  lines.push(...analysisConstraintLines(report));
  return lines;
}

export function sanitizeFaceSelection(input: FaceSelectionInput): FaceAdvisorFocus & { reportRef?: string; resultVersion?: string } {
  return {
    contextType: input.contextType,
    analysisId: input.analysisId,
    reportRef: input.reportRef,
    selectedResultId: input.selectedResultId,
    selectedInsightId: input.selectedInsightId,
    selectedDetailRef: input.selectedDetailRef,
    selectedRegion: input.selectedRegion,
    selectedGuidanceId: input.selectedGuidanceId,
    frozenRecommendationRef: input.frozenRecommendationRef,
    evidenceRefs: input.evidenceRefs,
    evidenceStale: input.evidenceStale,
    resultVersion: input.resultVersion,
  };
}

export function resolveFaceSelection(input: {
  owned: boolean;
  report: FaceIntelligenceReportDto | null;
  focus: FaceSelectionInput;
}): { selection: FaceSelectionContextV1; facts: MceFactEntry[] } {
  const focus = sanitizeFaceSelection(input.focus);
  const base = {
    reportRef: input.focus.reportRef,
    analysisId: input.focus.analysisId,
    contextType: input.focus.contextType,
    selectedResultId: input.focus.selectedResultId,
    selectedInsightId: input.focus.selectedInsightId,
    selectedDetailRef: input.focus.selectedDetailRef,
    selectedRegion: input.focus.selectedRegion,
    selectedGuidanceId: input.focus.selectedGuidanceId,
    frozenRecommendationRef: input.focus.frozenRecommendationRef,
    evidenceRefs: input.focus.evidenceRefs ?? [],
    limitationRefs: input.focus.limitationRefs ?? [],
    resultVersion: input.report?.reportVersion ?? input.focus.resultVersion,
    statementsAr: [] as string[],
  };
  if (!input.owned || !input.report) {
    return {
      selection: { ...base, status: 'unavailable', reconcileCode: 'face_context_no_authoritative_evidence', noticeAr: UNAVAILABLE },
      facts: [],
    };
  }
  const versionMismatch = Boolean(
    input.focus.resultVersion
    && input.report.reportVersion
    && input.focus.resultVersion !== input.report.reportVersion,
  );
  if (input.focus.evidenceStale || versionMismatch) {
    return {
      selection: { ...base, status: 'stale', reconcileCode: 'face_context_stale', resultVersion: input.report.reportVersion, noticeAr: STALE },
      facts: [],
    };
  }
  const projected: FaceEvidenceProjectionResult = projectFaceIntelligenceEvidence(input.report, focus);
  const code = projected.meta.reconcileCode;
  if (code === 'face_context_ref_unknown' || code === 'face_context_guidance_ref_unresolved' || code === 'face_context_no_authoritative_evidence') {
    return {
      selection: { ...base, status: 'unavailable', reconcileCode: code, noticeAr: UNKNOWN, resultVersion: input.report.reportVersion },
      facts: [],
    };
  }
  const selected = projected.units.filter((unit) => {
    if (unit.claimKey.startsWith('face.context.') || unit.claimKey === 'face.region.association') return true;
    return Boolean(projected.meta.resolvedEvidenceId && unit.sourceRef === projected.meta.resolvedEvidenceId);
  });
  const general = code === 'face_context_general_fallback'
    || focus.contextType === 'generalFaceResult'
    || !focus.contextType;
  const statements = general
    ? generalFaceStatements(input.report)
    : [...selected.map((unit) => unit.statementAr), ...analysisConstraintLines(input.report)];
  const confidence = reportConfidence(input.report);
  const facts: MceFactEntry[] = statements.map((statement, index) => ({
    id: `face-selection-${index + 1}`,
    labelAr: general ? 'ملخص الوجه المحفوظ' : 'اختيار الوجه المحفوظ',
    valueAr: statement,
    confidence,
  }));
  return {
    selection: {
      ...base,
      status: 'resolved',
      reconcileCode: code,
      resolvedEvidenceId: projected.meta.resolvedEvidenceId,
      resultVersion: input.report.reportVersion,
      statementsAr: statements,
    },
    facts,
  };
}
