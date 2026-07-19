import {
  FASHION_STYLING_DECISION_VERSION,
  FASHION_STYLING_REASONING_POLICY_VERSION,
  StyleDecision,
  StyleDecisionOutcome,
  StyleGoal,
  StyleGoalStatus,
  StyleHistoryEvent,
  StyleMilestone,
  StylePreferenceSet,
  StyleProgress,
} from './canonical-styling-profile';
import { StyleDecisionLedgerBuilder } from './decision-ledger';
import {
  citesFrozenEvidence,
  frozenEvidenceIds,
  frozenEvidenceOf,
} from './law32-frozen-evidence';
import { InterpretedStylingEvidence, StyleGoalDraft, StyleMemorySnapshot } from './styling-evidence';
import {
  deterministicDecisionId,
  STYLING_MAPPING_EPOCH_ISO,
} from './styling-identity';

/**
 * Priority bands (Law #32 remediation — claim-prefix based, not substring hope).
 * Lower = higher priority.
 */
export const STYLING_DECISION_PRIORITY_BAND: Record<string, number> = {
  preference_conflict: 0,
  outfit_requires_styling_caution: 1,
  outfit_supports_styling_direction: 2,
  wardrobe_refs_interpreted: 3,
  skin_context_acknowledged: 4,
  face_context_acknowledged: 4,
  preferences_applied: 5,
  long_term_continuity: 6,
  goal_blocked: 7,
  goal_active: 8,
  goal_observe: 8,
  goal_completed: 8,
  goal_draft: 8,
  goal_cancelled: 8,
};

export interface ReasoningInput {
  subjectId: string;
  evidence: InterpretedStylingEvidence[];
  limitationCodes: string[];
  memory?: StyleMemorySnapshot;
  goalDrafts?: StyleGoalDraft[];
  outfitsIncomplete: boolean;
  wardrobeGarmentIds: string[];
}

export interface ReasoningResult {
  decisions: StyleDecision[];
  preferences: StylePreferenceSet;
  goals: StyleGoal[];
  progress: StyleProgress;
  history: StyleHistoryEvent[];
  limitationCodes: string[];
  ledger: StyleDecisionLedgerBuilder;
  confidence: number;
  fieldConfidence: Array<{ field: string; confidence: number; evidenceIds: string[] }>;
}

/**
 * Reasoning Engine — deterministic, no LLM.
 * Law #32: every decision must cite ≥1 frozen evidence (skin|face|garment|outfit|wardrobe).
 */
export class StylingReasoningEngine {
  reason(input: ReasoningInput): ReasoningResult {
    const limitationCodes = [...input.limitationCodes];
    const ledger = new StyleDecisionLedgerBuilder(`sdl_${input.subjectId}`);
    const history: StyleHistoryEvent[] = [];
    const decisions: StyleDecision[] = [];
    const evidence = input.evidence;
    const frozen = frozenEvidenceOf(evidence);

    const conflicts = evidence.filter((e) => e.polarity === 'conflicts');
    const supports = evidence.filter((e) => e.polarity === 'supports');

    const conflictSources = new Set(
      conflicts.filter((c) => c.sourceKind === 'outfit').map((c) => c.sourceRef),
    );
    for (const s of supports.filter((x) => x.sourceKind === 'outfit')) {
      if (conflictSources.has(s.sourceRef)) {
        limitationCodes.push('contradictory_evidence:outfit');
      }
    }

    const wardrobeEv = evidence.filter((e) => e.sourceKind === 'wardrobe');
    if (wardrobeEv.length) {
      tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
        claim: 'wardrobe_refs_interpreted',
        outcome: 'observe',
        evidenceRefs: wardrobeEv.map((e) => e.evidenceId),
        subjectRefs: [input.subjectId],
        limitations: [],
        confidence: avgStrength(wardrobeEv),
      });
    }

    const outfitEv = evidence.filter((e) => e.sourceKind === 'outfit');
    if (outfitEv.length) {
      const hasConflict = outfitEv.some((e) => e.polarity === 'conflicts');
      const outcome: StyleDecisionOutcome = hasConflict
        ? input.outfitsIncomplete
          ? 'caution'
          : 'revise'
        : 'affirm';
      const lims = hasConflict
        ? ['decision_from_conflicting_outfit_evidence']
        : [];
      if (input.outfitsIncomplete) lims.push('incomplete_outfit_evidence');
      tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
        claim: hasConflict
          ? 'outfit_requires_styling_caution'
          : 'outfit_supports_styling_direction',
        outcome,
        evidenceRefs: outfitEv.map((e) => e.evidenceId),
        subjectRefs: [input.subjectId, ...outfitEv.map((e) => e.sourceRef)],
        limitations: lims,
        confidence: avgStrength(outfitEv),
      });
    } else {
      limitationCodes.push('decision_blocked:missing_outfit_evidence');
      limitationCodes.push('missing_evidence:outfit');
    }

    const prefEv = evidence.filter(
      (e) => e.sourceKind === 'preference' || e.sourceKind === 'memory',
    );
    const preferences = buildPreferences(input.memory, prefEv);
    // Preferences decision only if frozen evidence also cited (Law #32)
    if (prefEv.length && frozen.length) {
      tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
        claim: 'preferences_applied',
        outcome: 'observe',
        evidenceRefs: [
          ...prefEv.map((e) => e.evidenceId),
          ...frozen.map((e) => e.evidenceId),
        ],
        subjectRefs: [input.subjectId],
        limitations: [],
        confidence: avgStrength([...prefEv, ...frozen.slice(0, 2)]),
      });
    } else if (prefEv.length && !frozen.length) {
      limitationCodes.push('missing_evidence:preferences_need_frozen_context');
    }

    const dislikeTags = new Set(input.memory?.dislikedStyleTags ?? []);
    const garmentHints = evidence
      .filter((e) => e.sourceKind === 'garment' && e.claim.includes('hints='))
      .flatMap((e) => {
        const m = e.claim.match(/hints=([^:]*)/);
        return m?.[1] ? m[1].split(',').filter(Boolean) : [];
      });
    const dislikeHits = garmentHints.filter((h) => dislikeTags.has(h));
    if (dislikeHits.length && outfitEv.length) {
      tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
        claim: `preference_conflict:disliked=${[...dislikeHits].sort().join(',')}`,
        outcome: 'caution',
        evidenceRefs: [
          ...outfitEv.map((e) => e.evidenceId),
          ...prefEv.map((e) => e.evidenceId),
        ],
        subjectRefs: [input.subjectId],
        limitations: ['preference_conflict'],
        confidence: 0.7,
      });
      limitationCodes.push('preference_conflict');
    }

    const goals = buildGoals(
      input.goalDrafts ?? [],
      evidence,
      input.wardrobeGarmentIds,
      limitationCodes,
    );
    for (const g of goals) {
      // Decision cites goal.evidenceRefs which are frozen-only after buildGoals
      if (!g.evidenceRefs.length) {
        limitationCodes.push(`goal_without_frozen_evidence:${g.target}`);
        continue;
      }
      tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
        claim: `goal_${g.status}:${g.target}`,
        outcome:
          g.status === 'blocked'
            ? 'block'
            : g.status === 'active'
              ? 'affirm'
              : 'observe',
        evidenceRefs: g.evidenceRefs,
        subjectRefs: [input.subjectId, g.goalId],
        limitations: g.conflictCodes,
        confidence: g.status === 'blocked' ? 0.4 : 0.65,
      });
    }

    for (const kind of ['skin', 'face'] as const) {
      const ev = evidence.filter((e) => e.sourceKind === kind);
      if (ev.length) {
        tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
          claim: `${kind}_context_acknowledged`,
          outcome: 'observe',
          evidenceRefs: ev.map((e) => e.evidenceId),
          subjectRefs: [input.subjectId],
          limitations: [],
          confidence: avgStrength(ev),
        });
      }
    }

    const frozenIds = frozenEvidenceIds(evidence);
    if ((input.memory?.priorDecisionIds.length ?? 0) > 0 && frozenIds.length) {
      tryPushFrozen(decisions, ledger, history, evidence, limitationCodes, {
        claim: `long_term_continuity:priors=${input.memory!.priorDecisionIds.length}`,
        outcome: 'observe',
        evidenceRefs: frozenIds.slice(0, 8),
        subjectRefs: [input.subjectId],
        limitations: [],
        confidence: 0.55,
      });
    }

    decisions.sort((a, b) => {
      const pa = priorityBand(a.claim);
      const pb = priorityBand(b.claim);
      if (pa !== pb) return pa - pb;
      return a.decisionId.localeCompare(b.decisionId);
    });

    const progress = buildProgress(goals, decisions);
    const conf = aggregateConfidence(decisions, evidence);
    const overallEvidenceIds = [
      ...new Set(decisions.flatMap((d) => d.evidenceRefs)),
    ].sort();
    const fieldConfidence = [
      {
        field: 'overall',
        confidence: conf.overall,
        evidenceIds: overallEvidenceIds,
      },
      {
        field: 'decisions',
        confidence: conf.decisions,
        evidenceIds: decisions.flatMap((d) => d.evidenceRefs),
      },
      {
        field: 'goals',
        confidence: conf.goals,
        evidenceIds: goals.flatMap((g) => g.evidenceRefs),
      },
      {
        field: 'preferences',
        confidence: conf.preferences,
        evidenceIds: [
          ...prefEv.map((e) => e.evidenceId),
          ...frozenIds.slice(0, 4),
        ],
      },
    ].map((f) => ({
      ...f,
      evidenceIds: [...new Set(f.evidenceIds)].sort(),
    }));

    return {
      decisions,
      preferences,
      goals,
      progress,
      history: history.sort((a, b) => a.eventId.localeCompare(b.eventId)),
      limitationCodes: [...new Set(limitationCodes)].sort(),
      ledger,
      confidence: conf.overall,
      fieldConfidence: fieldConfidence.filter((f) => f.evidenceIds.length > 0),
    };
  }
}

function tryPushFrozen(
  decisions: StyleDecision[],
  ledger: StyleDecisionLedgerBuilder,
  history: StyleHistoryEvent[],
  evidence: InterpretedStylingEvidence[],
  limitationCodes: string[],
  input: {
    claim: string;
    outcome: StyleDecisionOutcome;
    evidenceRefs: string[];
    subjectRefs: string[];
    limitations: string[];
    confidence: number;
  },
): void {
  const evidenceRefs = [...new Set(input.evidenceRefs)].sort();
  if (!evidenceRefs.length) {
    limitationCodes.push(`decision_without_evidence:${input.claim}`);
    return;
  }
  if (!citesFrozenEvidence(evidenceRefs, evidence)) {
    limitationCodes.push(`decision_without_frozen_evidence:${input.claim}`);
    return;
  }
  pushDecision(decisions, ledger, history, { ...input, evidenceRefs });
}

function pushDecision(
  decisions: StyleDecision[],
  ledger: StyleDecisionLedgerBuilder,
  history: StyleHistoryEvent[],
  input: {
    claim: string;
    outcome: StyleDecisionOutcome;
    evidenceRefs: string[];
    subjectRefs: string[];
    limitations: string[];
    confidence: number;
  },
): void {
  const evidenceRefs = [...new Set(input.evidenceRefs)].sort();
  if (!evidenceRefs.length) {
    throw new Error('decision_without_evidence');
  }
  const decisionId = deterministicDecisionId({
    claim: input.claim,
    evidenceRefs,
    outcome: input.outcome,
  });
  const decision: StyleDecision = {
    decisionId,
    decisionVersion: FASHION_STYLING_DECISION_VERSION,
    reasoningPolicyVersion: FASHION_STYLING_REASONING_POLICY_VERSION,
    claim: input.claim,
    outcome: input.outcome,
    confidence: clamp01(input.confidence),
    evidenceRefs,
    limitations: [...new Set(input.limitations)].sort(),
    subjectRefs: [...new Set(input.subjectRefs)].sort(),
    createdAt: STYLING_MAPPING_EPOCH_ISO,
  };
  if (decisions.some((d) => d.decisionId === decisionId)) return;
  decisions.push(decision);
  const histId = `shev_${decisionId}`;
  history.push({
    eventId: histId,
    type: 'style_decision',
    at: STYLING_MAPPING_EPOCH_ISO,
    refs: evidenceRefs,
    decisionId,
  });
  ledger.append(decision, histId);
}

function buildPreferences(
  memory: StyleMemorySnapshot | undefined,
  prefEv: InterpretedStylingEvidence[],
): StylePreferenceSet {
  return {
    preferredColors: [...(memory?.preferredColors ?? [])].sort(),
    avoidedColors: [...(memory?.avoidedColors ?? [])].sort(),
    preferredSilhouettes: [...(memory?.preferredSilhouettes ?? [])].sort(),
    avoidedStyles: [
      ...new Set([
        ...(memory?.avoidedStyles ?? []),
        ...(memory?.dislikedStyleTags ?? []),
      ]),
    ].sort(),
    formality: prefEv.length ? 'unevaluated' : 'unevaluated',
  };
}

function buildGoals(
  drafts: StyleGoalDraft[],
  evidence: InterpretedStylingEvidence[],
  wardrobeGarmentIds: string[],
  limitationCodes: string[],
): StyleGoal[] {
  const goals: StyleGoal[] = [];
  const byTarget = new Map<string, StyleGoal>();
  const frozen = frozenEvidenceOf(evidence);
  const frozenIds = frozen.map((e) => e.evidenceId);

  for (const d of [...drafts].sort((a, b) => a.target.localeCompare(b.target))) {
    const conflictCodes: string[] = [];
    let status: StyleGoalStatus = 'active';

    // Law #32: only frozen evidence qualifies — never goal_draft alone
    const refs = [...frozenIds];

    if (!refs.length) {
      status = 'blocked';
      conflictCodes.push('blocked_goal:missing_frozen_evidence');
      limitationCodes.push(`missing_evidence:goal_frozen:${d.target}`);
      limitationCodes.push(`blocked_goal:${d.target}`);
      // Still record blocked goal with empty evidenceRefs — no fabricated refs
      const goalId = `sgoal_${createShortHash(d.target)}`;
      const goal: StyleGoal = {
        goalId,
        titleEn: d.titleEn,
        titleAr: d.titleAr,
        target: d.target,
        status: 'blocked',
        horizon: d.horizon,
        evidenceRefs: [],
        dependsOnGoalIds: [],
        conflictCodes: [...new Set(conflictCodes)].sort(),
        createdAt: STYLING_MAPPING_EPOCH_ISO,
        updatedAt: STYLING_MAPPING_EPOCH_ISO,
      };
      byTarget.set(d.target, goal);
      goals.push(goal);
      continue;
    }

    if (
      (d.target.includes('wardrobe') || d.target.includes('complete_look')) &&
      wardrobeGarmentIds.length === 0
    ) {
      status = 'blocked';
      conflictCodes.push('impossible_goal:empty_wardrobe');
      limitationCodes.push(`impossible_goal:${d.target}`);
    }

    if (
      d.target.includes('look') &&
      !evidence.some((e) => e.sourceKind === 'outfit')
    ) {
      status = 'blocked';
      conflictCodes.push('impossible_goal:missing_outfit');
      limitationCodes.push(`impossible_goal:${d.target}`);
    }

    const goalId = `sgoal_${createShortHash(d.target)}`;
    const goal: StyleGoal = {
      goalId,
      titleEn: d.titleEn,
      titleAr: d.titleAr,
      target: d.target,
      status,
      horizon: d.horizon,
      evidenceRefs: [...new Set(refs)].sort(),
      dependsOnGoalIds: [],
      conflictCodes: [...new Set(conflictCodes)].sort(),
      createdAt: STYLING_MAPPING_EPOCH_ISO,
      updatedAt: STYLING_MAPPING_EPOCH_ISO,
    };
    byTarget.set(d.target, goal);
    goals.push(goal);
  }

  for (const d of drafts) {
    const g = byTarget.get(d.target);
    if (!g) continue;
    for (const dep of d.dependsOnTargets ?? []) {
      const parent = byTarget.get(dep);
      if (parent) {
        g.dependsOnGoalIds.push(parent.goalId);
        if (parent.status === 'blocked' && g.status === 'active') {
          g.status = 'blocked';
          g.conflictCodes.push(`dependency_blocked:${parent.goalId}`);
        }
      } else {
        g.conflictCodes.push(`missing_dependency:${dep}`);
      }
    }
    g.dependsOnGoalIds = [...new Set(g.dependsOnGoalIds)].sort();
    g.conflictCodes = [...new Set(g.conflictCodes)].sort();
  }

  return goals.sort((a, b) => a.goalId.localeCompare(b.goalId));
}

function buildProgress(
  goals: StyleGoal[],
  decisions: StyleDecision[],
): StyleProgress {
  const milestones: StyleMilestone[] = goals.map((g) => ({
    milestoneId: `sms_${g.goalId}`,
    goalId: g.goalId,
    labelEn: `Goal ${g.status}: ${g.target}`,
    labelAr: `هدف ${g.status}: ${g.target}`,
    achieved: g.status === 'completed',
    evidenceRefs: g.evidenceRefs,
    at: STYLING_MAPPING_EPOCH_ISO,
  }));
  const completed = goals.filter((g) => g.status === 'completed').length;
  const ratio = goals.length === 0 ? 1 : completed / goals.length;
  const decisionEvidence = [
    ...new Set(decisions.flatMap((d) => d.evidenceRefs)),
  ].sort();
  const evidenceRefs = [
    ...goals.flatMap((g) => g.evidenceRefs),
    ...decisionEvidence,
  ];
  return {
    progressId: `sprog_${createShortHash(goals.map((g) => g.goalId).join(',') || 'empty')}`,
    milestones: milestones.sort((a, b) =>
      a.milestoneId.localeCompare(b.milestoneId),
    ),
    completionRatio: clamp01(ratio),
    deltas: decisionEvidence.length
      ? [
          {
            code: 'decision_count',
            value: decisions.length,
            evidenceRefs: decisionEvidence,
          },
        ]
      : [],
    evidenceRefs: [...new Set(evidenceRefs)].sort(),
  };
}

function aggregateConfidence(
  decisions: StyleDecision[],
  evidence: InterpretedStylingEvidence[],
): { overall: number; decisions: number; goals: number; preferences: number } {
  const decisionsC =
    decisions.length === 0
      ? 0
      : decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length;
  const pref = evidence.filter(
    (e) => e.sourceKind === 'preference' || e.sourceKind === 'memory',
  );
  const frozen = frozenEvidenceOf(evidence);
  const preferences =
    pref.length === 0
      ? frozen.length
        ? 0.35
        : 0
      : pref.reduce((s, e) => s + e.strength, 0) / pref.length;
  const goals =
    decisions.filter((d) => d.claim.startsWith('goal_')).length === 0
      ? 0.3
      : decisions
          .filter((d) => d.claim.startsWith('goal_'))
          .reduce((s, d) => s + d.confidence, 0) /
        Math.max(1, decisions.filter((d) => d.claim.startsWith('goal_')).length);
  const coverage = frozen.length > 0 ? 1 : 0;
  const overall = clamp01(
    decisionsC * 0.6 + preferences * 0.15 + goals * 0.1 + coverage * 0.15,
  );
  return { overall, decisions: decisionsC, goals, preferences };
}

function priorityBand(claim: string): number {
  if (claim.startsWith('preference_conflict')) return 0;
  if (claim.startsWith('goal_')) {
    const status = claim.split(':')[0] ?? claim;
    return STYLING_DECISION_PRIORITY_BAND[status] ?? 8;
  }
  const key = claim.split(':')[0] ?? claim;
  if (key in STYLING_DECISION_PRIORITY_BAND) {
    return STYLING_DECISION_PRIORITY_BAND[key]!;
  }
  return 9;
}

function avgStrength(ev: InterpretedStylingEvidence[]): number {
  if (!ev.length) return 0;
  return clamp01(ev.reduce((s, e) => s + e.strength, 0) / ev.length);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function createShortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
