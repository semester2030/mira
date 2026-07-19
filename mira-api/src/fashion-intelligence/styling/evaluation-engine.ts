import { CanonicalGarment } from '../garment/canonical-garment';
import { CanonicalOutfit } from '../outfit/canonical-outfit';
import {
  fashionRuntime,
  toPublicFashionRuntime,
} from '../runtime/fashion-runtime-state';
import {
  CanonicalStylingProfile,
  FASHION_STYLING_EVALUATION_VERSION,
  FASHION_STYLING_MAPPING_VERSION,
  FASHION_STYLING_REASONING_POLICY_VERSION,
  styleSchemaVersion,
} from './canonical-styling-profile';
import { StyleDecisionLedger } from './decision-ledger';
import { EvidenceInterpretationEngine } from './evidence-interpretation-engine';
import { StylingReasoningEngine } from './reasoning-engine';
import {
  FrozenReportRef,
  InterpretedStylingEvidence,
  StyleGoalDraft,
  StyleMemorySnapshot,
  WardrobeRefInput,
} from './styling-evidence';
import {
  deterministicStyleProfileId,
  deterministicStylingTraceId,
  STYLING_MAPPING_EPOCH_ISO,
} from './styling-identity';

export interface StylingEvaluationInput {
  subjectId: string;
  skin?: FrozenReportRef;
  face?: FrozenReportRef;
  garments?: CanonicalGarment[];
  outfits?: CanonicalOutfit[];
  wardrobe?: WardrobeRefInput;
  memory?: StyleMemorySnapshot;
  goalDrafts?: StyleGoalDraft[];
  sessionId?: string;
  traceId?: string;
}

export interface StylingEvaluationResult {
  profile: CanonicalStylingProfile;
  /** Internal — not public API */
  decisionLedger: StyleDecisionLedger;
  interpretedEvidenceIds: string[];
  /** Internal — for Law #32 validation */
  interpretedEvidence: InterpretedStylingEvidence[];
}

/**
 * Styling Evaluation — Evidence Interpretation → Reasoning → Profile.
 * Does not analyze garments/outfits; consumes frozen outputs only.
 */
export class StylingEvaluationEngine {
  constructor(
    private readonly interpreter = new EvidenceInterpretationEngine(),
    private readonly reasoning = new StylingReasoningEngine(),
  ) {}

  evaluate(input: StylingEvaluationInput): StylingEvaluationResult {
    const garments = [...(input.garments ?? [])].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    const outfits = [...(input.outfits ?? [])].sort((a, b) =>
      a.outfitId.localeCompare(b.outfitId),
    );

    const interpreted = this.interpreter.interpret({
      subjectId: input.subjectId,
      skin: input.skin,
      face: input.face,
      garments,
      outfits,
      wardrobe: input.wardrobe,
      memory: input.memory,
      goalDrafts: input.goalDrafts,
    });

    const styleProfileId = deterministicStyleProfileId({
      subjectId: input.subjectId,
      outfitIds: outfits.map((o) => o.outfitId),
      garmentIds: garments.map((g) => g.garmentId),
      goalTargets: (input.goalDrafts ?? []).map((g) => g.target),
    });
    const traceId =
      input.traceId ?? deterministicStylingTraceId(styleProfileId);

    const outfitsIncomplete = outfits.some((o) =>
      o.limitations.some((l) => l.includes('incomplete')),
    );

    const reasoned = this.reasoning.reason({
      subjectId: input.subjectId,
      evidence: interpreted.evidence,
      limitationCodes: interpreted.limitationCodes,
      memory: input.memory,
      goalDrafts: input.goalDrafts,
      outfitsIncomplete,
      wardrobeGarmentIds: [
        ...(input.wardrobe?.garmentIds ?? []),
        ...garments.map((g) => g.garmentId),
      ],
    });

    const builtLedger = reasoned.ledger.build();
    const ledger: StyleDecisionLedger = {
      ledgerId: `sdl_${styleProfileId}`,
      entries: builtLedger.entries,
    };

    const status =
      interpreted.evidence.length === 0
        ? ('FAILED' as const)
        : reasoned.limitationCodes.some((c) => c.startsWith('impossible_goal'))
          ? ('DEGRADED' as const)
          : reasoned.limitationCodes.length > 3
            ? ('PARTIAL' as const)
            : ('AVAILABLE' as const);

    const runtime = toPublicFashionRuntime(
      fashionRuntime({
        status,
        stage: status === 'FAILED' ? 'terminal' : 'mapping',
        reasonCode:
          status === 'FAILED'
            ? 'styling_evaluation_failed'
            : status === 'DEGRADED'
              ? 'styling_evaluation_degraded'
              : status === 'PARTIAL'
                ? 'styling_evaluation_partial'
                : 'styling_evaluation_complete',
        reasonEn: `Styling evaluation ${status.toLowerCase()}.`,
        reasonAr: `تقييم التنسيق ${status}.`,
        capabilityId: 'analyze_style',
        capabilityVersion: styleSchemaVersion(),
        traceId,
        policyRuleId: FASHION_STYLING_REASONING_POLICY_VERSION,
      }),
    );

    const evidenceIds = interpreted.evidence.map((e) => e.evidenceId).sort();
    const profile: CanonicalStylingProfile = {
      styleProfileId,
      version: styleSchemaVersion(),
      subjectId: input.subjectId,
      preferences: reasoned.preferences,
      goals: reasoned.goals,
      progress: reasoned.progress,
      history: reasoned.history,
      evidenceIds,
      decisions: reasoned.decisions,
      limitations: reasoned.limitationCodes,
      confidence: reasoned.confidence,
      fieldConfidence: reasoned.fieldConfidence,
      runtime,
      evaluationVersion: FASHION_STYLING_EVALUATION_VERSION,
      mappingVersion: FASHION_STYLING_MAPPING_VERSION,
      reasoningPolicyVersion: FASHION_STYLING_REASONING_POLICY_VERSION,
      createdAt: STYLING_MAPPING_EPOCH_ISO,
      updatedAt: STYLING_MAPPING_EPOCH_ISO,
      decisionLedgerRef: ledger.ledgerId,
    };

    return {
      profile,
      decisionLedger: ledger,
      interpretedEvidenceIds: evidenceIds,
      interpretedEvidence: interpreted.evidence,
    };
  }
}
