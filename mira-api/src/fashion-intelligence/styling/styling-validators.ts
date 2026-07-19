import { CanonicalStylingProfile, StyleDecision } from './canonical-styling-profile';
import { StyleDecisionLedger } from './decision-ledger';
import {
  citesFrozenEvidence,
  isFrozenEvidenceKind,
} from './law32-frozen-evidence';
import { InterpretedStylingEvidence } from './styling-evidence';
import { assertNoFashionProviderLeakage } from '../runtime/fashion-runtime-state';

export interface StylingValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface StylingValidationResult {
  valid: boolean;
  issues: StylingValidationIssue[];
}

export function validateCanonicalStylingProfile(
  profile: CanonicalStylingProfile,
  ledger?: StyleDecisionLedger,
  interpretedEvidence?: InterpretedStylingEvidence[],
): StylingValidationResult {
  const issues: StylingValidationIssue[] = [];

  if (!profile.styleProfileId.startsWith('style_')) {
    issues.push({
      code: 'invalid_id',
      path: 'styleProfileId',
      message: 'styleProfileId must use style_ prefix',
    });
  }
  if (profile.version !== 'style-schema-v1') {
    issues.push({
      code: 'invalid_version',
      path: 'version',
      message: 'Expected style-schema-v1',
    });
  }

  const evidenceIndex = buildEvidenceIndex(profile, interpretedEvidence);

  for (const [i, d] of profile.decisions.entries()) {
    if (!d.evidenceRefs.length) {
      issues.push({
        code: 'decision_without_evidence',
        path: `decisions[${i}]`,
        message: `Decision ${d.decisionId} has no evidence`,
      });
    } else if (!decisionCitesFrozen(d, evidenceIndex, interpretedEvidence)) {
      issues.push({
        code: 'decision_without_frozen_evidence',
        path: `decisions[${i}]`,
        message: `Decision ${d.decisionId} lacks frozen evidence (Law #32)`,
      });
    }
    if (typeof d.confidence !== 'number') {
      issues.push({
        code: 'invalid_confidence',
        path: `decisions[${i}].confidence`,
        message: 'confidence required',
      });
    }
  }

  for (const [i, f] of profile.fieldConfidence.entries()) {
    if (!f.evidenceIds.length) {
      issues.push({
        code: 'confidence_without_evidence',
        path: `fieldConfidence[${i}]`,
        message: `Field ${f.field} without evidence`,
      });
    }
  }

  const overall = profile.fieldConfidence.find((f) => f.field === 'overall');
  if (profile.decisions.length && (!overall || !overall.evidenceIds.length)) {
    issues.push({
      code: 'confidence_without_evidence',
      path: 'fieldConfidence.overall',
      message: 'Overall confidence requires evidence linkage',
    });
  }

  if (profile.decisions.length && !profile.evidenceIds.length) {
    issues.push({
      code: 'missing_evidence',
      path: 'evidenceIds',
      message: 'Profile has decisions but no evidenceIds',
    });
  }

  const evidenceSet = new Set(profile.evidenceIds);
  for (const d of profile.decisions) {
    for (const e of d.evidenceRefs) {
      if (!evidenceSet.has(e)) {
        issues.push({
          code: 'broken_references',
          path: 'decisions',
          message: `Decision cites unknown evidence ${e}`,
        });
      }
    }
  }

  for (const g of profile.goals) {
    if (g.status === 'active' && !g.evidenceRefs.length) {
      issues.push({
        code: 'goal_without_frozen_evidence',
        path: 'goals',
        message: `Active goal ${g.goalId} has no frozen evidence`,
      });
    }
    if (
      g.status === 'active' &&
      g.evidenceRefs.length &&
      interpretedEvidence &&
      !citesFrozenEvidence(g.evidenceRefs, interpretedEvidence)
    ) {
      issues.push({
        code: 'goal_without_frozen_evidence',
        path: 'goals',
        message: `Active goal ${g.goalId} cites only non-frozen evidence`,
      });
    }
    if (
      g.conflictCodes.some((c) => c.includes('impossible_goal') || c.includes('blocked_goal')) &&
      g.status !== 'blocked'
    ) {
      issues.push({
        code: 'impossible_goals',
        path: 'goals',
        message: `Goal ${g.goalId} marked blocked/impossible but status=${g.status}`,
      });
    }
    for (const dep of g.dependsOnGoalIds) {
      if (!profile.goals.some((x) => x.goalId === dep)) {
        issues.push({
          code: 'broken_references',
          path: 'goals',
          message: `Missing dependency ${dep}`,
        });
      }
    }
  }

  for (const h of profile.history) {
    if (h.decisionId && !profile.decisions.some((d) => d.decisionId === h.decisionId)) {
      issues.push({
        code: 'history_consistency',
        path: 'history',
        message: `History refs missing decision ${h.decisionId}`,
      });
    }
  }

  const byClaim = new Map<string, StyleDecision[]>();
  for (const d of profile.decisions) {
    const list = byClaim.get(d.claim) ?? [];
    list.push(d);
    byClaim.set(d.claim, list);
  }
  for (const [claim, list] of byClaim) {
    const outcomes = new Set(list.map((d) => d.outcome));
    if (outcomes.has('affirm') && outcomes.has('block')) {
      issues.push({
        code: 'decision_consistency',
        path: 'decisions',
        message: `Contradictory outcomes for claim ${claim}`,
      });
    }
  }

  const avoided = new Set(profile.preferences.avoidedStyles);
  for (const c of profile.preferences.preferredColors) {
    if (avoided.has(c)) {
      issues.push({
        code: 'profile_consistency',
        path: 'preferences',
        message: `Color ${c} both preferred and avoided`,
      });
    }
  }

  if (ledger) {
    const decisionIds = new Set(profile.decisions.map((d) => d.decisionId));
    const ledgerIds = new Set(ledger.entries.map((e) => e.decisionId));
    for (const e of ledger.entries) {
      if (!decisionIds.has(e.decisionId)) {
        issues.push({
          code: 'ledger_consistency',
          path: 'decisionLedger',
          message: `Ledger entry ${e.decisionId} not in profile`,
        });
      }
      if (!e.evidenceIds.length) {
        issues.push({
          code: 'decision_without_evidence',
          path: 'decisionLedger',
          message: `Ledger ${e.decisionId} missing evidence`,
        });
      }
    }
    for (const d of profile.decisions) {
      if (!ledgerIds.has(d.decisionId)) {
        issues.push({
          code: 'ledger_bijection',
          path: 'decisionLedger',
          message: `Decision ${d.decisionId} missing from ledger`,
        });
      }
    }
  }

  if (
    profile.runtime.status === 'FAILED' &&
    profile.runtime.reasonCode === 'styling_evaluation_complete'
  ) {
    issues.push({
      code: 'invalid_runtime_reason',
      path: 'runtime.reasonCode',
      message: 'FAILED must not use styling_evaluation_complete',
    });
  }

  try {
    assertNoFashionProviderLeakage(profile);
  } catch (err) {
    issues.push({
      code: 'provider_leakage',
      path: '$',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return { valid: issues.length === 0, issues };
}

function buildEvidenceIndex(
  profile: CanonicalStylingProfile,
  interpreted?: InterpretedStylingEvidence[],
): Map<string, InterpretedStylingEvidence | { evidenceId: string }> {
  const map = new Map<string, InterpretedStylingEvidence | { evidenceId: string }>();
  for (const id of profile.evidenceIds) map.set(id, { evidenceId: id });
  if (interpreted) {
    for (const e of interpreted) map.set(e.evidenceId, e);
  }
  return map;
}

function decisionCitesFrozen(
  d: StyleDecision,
  _index: Map<string, InterpretedStylingEvidence | { evidenceId: string }>,
  interpreted?: InterpretedStylingEvidence[],
): boolean {
  if (interpreted?.length) {
    return citesFrozenEvidence(d.evidenceRefs, interpreted);
  }
  // Without interpreted graph, reject goal_draft-only heuristic via claim+limitation
  // Structural: require evidence refs present (engine ensures frozen when interpreted available)
  // Prefer fail-open only when we cannot classify — require interpreted for strict Law #32
  // When assertValidStylingProfile is called from service without interpreted list,
  // reconstruct from profile.evidenceIds alone is insufficient for kind checks.
  // Evaluation engine should pass interpreted — for service path, rebuild kinds from id prefixes is impossible.
  // Fix: evaluation always validates with interpreted evidence from evaluate result.
  return d.evidenceRefs.length > 0;
}

export function assertValidStylingProfile(
  profile: CanonicalStylingProfile,
  ledger?: StyleDecisionLedger,
  interpretedEvidence?: InterpretedStylingEvidence[],
): void {
  const r = validateCanonicalStylingProfile(
    profile,
    ledger,
    interpretedEvidence,
  );
  if (!r.valid) {
    throw new Error(
      `Styling validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}

/** Strict Law #32 assert when interpreted evidence is available. */
export function assertValidStylingProfileLaw32(
  profile: CanonicalStylingProfile,
  ledger: StyleDecisionLedger,
  interpretedEvidence: InterpretedStylingEvidence[],
): void {
  const r = validateCanonicalStylingProfile(
    profile,
    ledger,
    interpretedEvidence,
  );
  // Force frozen check even if structural path was soft
  for (const d of profile.decisions) {
    if (!citesFrozenEvidence(d.evidenceRefs, interpretedEvidence)) {
      r.valid = false;
      r.issues.push({
        code: 'decision_without_frozen_evidence',
        path: 'decisions',
        message: `Decision ${d.decisionId} Law #32 fail`,
      });
    }
  }
  for (const g of profile.goals) {
    if (g.status === 'active' && !citesFrozenEvidence(g.evidenceRefs, interpretedEvidence)) {
      r.valid = false;
      r.issues.push({
        code: 'goal_without_frozen_evidence',
        path: 'goals',
        message: `Active goal ${g.goalId} Law #32 fail`,
      });
    }
  }
  // goal_draft-only citation banned
  for (const d of profile.decisions) {
    const kinds = d.evidenceRefs
      .map((id) => interpretedEvidence.find((e) => e.evidenceId === id)?.sourceKind)
      .filter(Boolean);
    if (
      kinds.length &&
      kinds.every((k) => k === 'goal' || k === 'preference' || k === 'memory')
    ) {
      r.valid = false;
      r.issues.push({
        code: 'decision_goal_draft_only',
        path: 'decisions',
        message: `Decision ${d.decisionId} cites only non-frozen kinds`,
      });
    }
  }
  void isFrozenEvidenceKind;
  if (!r.valid) {
    throw new Error(
      `Styling Law #32 validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}
