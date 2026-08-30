/**
 * FK-5A — Coverage + Mode A vs Mode B + gate runner (honest blocked path).
 */
import { FashionRuleDomain } from '../contracts/rule-domains';
import {
  askApplicableCuratedRules,
  loadProductionFashionKnowledgeRegistry,
  LookupReasonCode,
} from '../registry';
import { emptyProductionRegistry } from '../registry/storage';
import { resolveCuratedOverLlm } from '../conflict/curated-precedence';
import { evaluateRedYellowWeddingFlow } from '../curated/red-yellow-wedding-flow';
import { FK5_COLOR_REVIEW_CANDIDATES } from '../curated/review-candidates-color';
import { FK5_OCCASION_REVIEW_CANDIDATES } from '../curated/review-candidates-occasion';
import { listActivatingSources } from '../curated/source-discovery';
import {
  FK5A_INGESTED_SOURCES,
  listActivationCapableSources,
  type IngestedFashionSource,
} from './source-ingest';
import { buildAllEvidenceMaps } from './evidence-map';
import { decideReviewOutcome, ReviewOutcome } from './review-outcomes';
import { buildFk5aCandidateInventory } from './source-requirements';
import {
  FASHION_KNOWLEDGE_BLOCKED_BY_SOURCING,
  FASHION_KNOWLEDGE_SOURCING_REQUIRED,
} from '../versioning/release';

export const CoverageStatus = {
  COVERED: 'COVERED',
  PARTIAL: 'PARTIAL',
  NOT_COVERED: 'NOT_COVERED',
} as const;

export type CoverageStatus =
  (typeof CoverageStatus)[keyof typeof CoverageStatus];

export interface Fk5aCoverageReport {
  readonly color: Readonly<Record<string, CoverageStatus>>;
  readonly occasion: Readonly<Record<string, CoverageStatus>>;
  readonly activeRuleCount: number;
  readonly notes: string;
}

export function buildCoverageReport(activeRuleIds: readonly string[]): Fk5aCoverageReport {
  const active = new Set(activeRuleIds);
  const colorKeys = [
    'relationships',
    'balance',
    'saturation',
    'value',
    'neutral_handling',
  ] as const;
  const occKeys = [
    'wedding',
    'formal',
    'black_tie',
    'cocktail',
    'business',
    'smart_casual',
  ] as const;

  const color: Record<string, CoverageStatus> = {};
  for (const k of colorKeys) color[k] = CoverageStatus.NOT_COVERED;
  const occasion: Record<string, CoverageStatus> = {};
  for (const k of occKeys) occasion[k] = CoverageStatus.NOT_COVERED;

  // With zero ACTIVE, everything remains NOT_COVERED (honest).
  if (active.size === 0) {
    return Object.freeze({
      color: Object.freeze(color),
      occasion: Object.freeze(occasion),
      activeRuleCount: 0,
      notes: 'No ACTIVE curated rules — all coverage NOT_COVERED',
    });
  }

  return Object.freeze({
    color: Object.freeze(color),
    occasion: Object.freeze(occasion),
    activeRuleCount: active.size,
    notes: 'Coverage derived from ACTIVE ids only',
  });
}

export interface ModeAVsModeBReport {
  readonly modeA: {
    readonly applicableActiveRuleIds: readonly string[];
    readonly adviceDirections: readonly string[];
    readonly unknownContexts: readonly string[];
    readonly dressCodeClarificationRequired: boolean;
  };
  readonly modeB: {
    readonly llmMaySuggestUnderQualification: boolean;
    readonly notes: string;
  };
  readonly coverageGap: string;
}

export function buildModeAVsModeBReport(input?: {
  readonly activeRuleIds?: readonly string[];
  readonly styleGoal?: string;
}): ModeAVsModeBReport {
  const active = input?.activeRuleIds ?? [];
  const flow = evaluateRedYellowWeddingFlow({
    dressCode: 'unknown',
    styleGoal: input?.styleGoal ?? 'bold',
  });

  const modeADirections =
    active.length === 0
      ? Object.freeze(['NO_APPLICABLE_CURATED_RULE'] as string[])
      : flow.adviceDirections;

  return Object.freeze({
    modeA: Object.freeze({
      applicableActiveRuleIds: Object.freeze([...active]),
      adviceDirections: modeADirections,
      unknownContexts: Object.freeze([
        'dress_code',
        ...(active.length === 0 ? ['all_curated_color_occasion'] : []),
      ]),
      dressCodeClarificationRequired: true,
    }),
    modeB: Object.freeze({
      llmMaySuggestUnderQualification: true,
      notes:
        'FK-3 Mode B may produce UNCURATED drafts under Claim Lock — not Mira curated truth',
    }),
    coverageGap:
      active.length === 0
        ? 'Mode A empty; Mode B is the only advisory path until Tier A/B sources + human approval'
        : 'Partial Mode A; Mode B may fill unqualified gaps only',
  });
}

export interface Fk5aGateRunResult {
  readonly verdict: typeof FASHION_KNOWLEDGE_BLOCKED_BY_SOURCING | 'CURATED_READY' | 'PARTIAL_CURATED';
  readonly code: typeof FASHION_KNOWLEDGE_SOURCING_REQUIRED | 'OK';
  readonly candidateCount: number;
  readonly ingestedSourceCount: number;
  readonly activationCapableSourceCount: number;
  readonly repoActivatingSourceCount: number;
  readonly researchMoreIds: readonly string[];
  readonly approveIds: readonly string[];
  readonly rejectIds: readonly string[];
  readonly mergeIds: readonly string[];
  readonly activePromotedIds: readonly string[];
  readonly productionRegistryActiveCount: number;
  readonly coverage: Fk5aCoverageReport;
  readonly modeComparison: ModeAVsModeBReport;
  readonly notes: string;
}

export function runFk5aApprovalGate(input?: {
  readonly sources?: readonly IngestedFashionSource[];
}): Fk5aGateRunResult {
  const sources = input?.sources ?? FK5A_INGESTED_SOURCES;
  const inventory = buildFk5aCandidateInventory();
  const maps = buildAllEvidenceMaps(sources);
  const decisions = maps.map((m) => decideReviewOutcome(m));

  const researchMoreIds = decisions
    .filter((d) => d.outcome === ReviewOutcome.RESEARCH_MORE)
    .map((d) => d.ruleId);
  const approveIds = decisions
    .filter(
      (d) =>
        (d.outcome === ReviewOutcome.APPROVE ||
          d.outcome === ReviewOutcome.APPROVE_WITH_NARROWER_SCOPE) &&
        d.humanApproved,
    )
    .map((d) => d.ruleId);
  const rejectIds = decisions
    .filter((d) => d.outcome === ReviewOutcome.REJECT)
    .map((d) => d.ruleId);
  const mergeIds = decisions
    .filter((d) => d.outcome === ReviewOutcome.MERGE)
    .map((d) => d.ruleId);

  const activationCapable = listActivationCapableSources(sources);
  const loaded = loadProductionFashionKnowledgeRegistry({
    clockNowIso: '2026-08-10T00:00:00.000Z',
  });
  const prodActive = loaded.registry?.rules.filter(
    (r) => r.status === 'ACTIVE' && r.lifecycle === 'ACTIVE' && r.testOnly !== true,
  ).length ?? 0;

  const activePromotedIds: string[] = []; // honest: none without sources+human

  const blocked =
    activationCapable.length === 0 ||
    approveIds.length === 0 ||
    activePromotedIds.length === 0;

  const coverage = buildCoverageReport(activePromotedIds);
  const modeComparison = buildModeAVsModeBReport({
    activeRuleIds: activePromotedIds,
    styleGoal: 'bold',
  });

  return Object.freeze({
    verdict: blocked
      ? FASHION_KNOWLEDGE_BLOCKED_BY_SOURCING
      : activePromotedIds.length >= 5
        ? 'CURATED_READY'
        : 'PARTIAL_CURATED',
    code: blocked
      ? FASHION_KNOWLEDGE_SOURCING_REQUIRED
      : 'OK',
    candidateCount: inventory.length,
    ingestedSourceCount: sources.length,
    activationCapableSourceCount: activationCapable.length,
    repoActivatingSourceCount: listActivatingSources().length,
    researchMoreIds: Object.freeze(researchMoreIds),
    approveIds: Object.freeze(approveIds),
    rejectIds: Object.freeze(rejectIds),
    mergeIds: Object.freeze(mergeIds),
    activePromotedIds: Object.freeze(activePromotedIds),
    productionRegistryActiveCount: prodActive,
    coverage,
    modeComparison,
    notes: blocked
      ? 'FK-5A blocked: no Tier A/B materials present and no proven human approvals. Do not begin FK-6 knowledge population. Options: supply real references, or operate Year-1 on Mode B (LLM+Claim Lock) with empty curated Mode A.'
      : 'FK-5A promoted curated ACTIVE rules',
  });
}

/** Precedence check: empty ACTIVE → LLM may proceed; with ACTIVE curated wins. */
export function fk5aCuratedPrecedenceProbe(): {
  readonly winner: string;
  readonly notes: string;
} {
  const empty = emptyProductionRegistry('2026-08-10T00:00:00.000Z');
  const ask = askApplicableCuratedRules(empty, {
    domain: FashionRuleDomain.COLOR,
    clockNowIso: '2026-08-10T00:00:00.000Z',
    activeOnly: true,
  });
  const allCandidates = [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ].map((c) => c.rule);
  const prec = resolveCuratedOverLlm({
    curatedRules: allCandidates,
    llmCandidateRuleIds: ['llm_draft_conflict'],
    domain: FashionRuleDomain.COLOR,
  });
  return {
    winner: prec.winner,
    notes: `ask=${ask.code}; draft_candidates_do_not_win; expected llm when no ACTIVE`,
  };
}

export function assertEmptyRegistryLookup(): boolean {
  const empty = emptyProductionRegistry('2026-08-10T00:00:00.000Z');
  const ask = askApplicableCuratedRules(empty, {
    domain: FashionRuleDomain.OCCASION,
    occasion: 'wedding',
    clockNowIso: '2026-08-10T00:00:00.000Z',
    activeOnly: true,
  });
  return (
    ask.available === false &&
    ask.code === LookupReasonCode.NO_APPLICABLE_CURATED_RULE
  );
}
