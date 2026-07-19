import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveFashionFeatureFlags } from '../feature-flags';
import { getFashionCapability } from '../capability/fashion-capability-catalog';
import { fashionTelemetry } from '../telemetry/fashion-telemetry';
import { assertNoFashionProviderLeakage } from '../runtime/fashion-runtime-state';
import { toPublicCanonicalStylingProfile } from './canonical-styling-profile';
import { StyleDecisionLedger } from './decision-ledger';
import {
  StylingEvaluationEngine,
  StylingEvaluationInput,
} from './evaluation-engine';
import {
  evolveMemorySnapshot,
  normalizeMemorySnapshot,
} from './style-memory';
import { StyleMemorySnapshot } from './styling-evidence';
import { assertValidStylingProfileLaw32 } from './styling-validators';

export interface AnalyzeStyleResult {
  success: boolean;
  profile: ReturnType<typeof toPublicCanonicalStylingProfile>;
  /** Internal — audit / advisor / debug only */
  decisionLedger: StyleDecisionLedger;
  /** Evolved memory snapshot for caller persistence — not process-global */
  memorySnapshot: StyleMemorySnapshot;
  capabilityId: 'analyze_style';
}

/**
 * Styling Intelligence Service — Mira-owned reasoning.
 * Stateless across requests: no singleton StyleMemoryStore.
 */
@Injectable()
export class StylingIntelligenceService {
  private readonly evaluator = new StylingEvaluationEngine();

  constructor(private readonly config: ConfigService) {}

  private flags() {
    return resolveFashionFeatureFlags((k, d) => this.config.get(k, d));
  }

  private assertCap(id: string): void {
    const flags = this.flags();
    const cap = getFashionCapability(id);
    if (!flags.fashionStylingIntelEnabled || !cap?.executionEnabled) {
      throw new Error(
        `${id} disabled (FASHION_STYLING_INTEL_ENABLED / capability)`,
      );
    }
  }

  analyzeStyle(input: StylingEvaluationInput): AnalyzeStyleResult {
    this.assertCap('analyze_style');
    const mem = normalizeMemorySnapshot(input.memory);

    // Trace policy: engine owns deterministicStylingTraceId(styleProfileId).
    // Do NOT override with subject|pending.
    const result = this.evaluator.evaluate({
      ...input,
      memory: mem,
      traceId: input.traceId,
    });
    assertValidStylingProfileLaw32(
      result.profile,
      result.decisionLedger,
      result.interpretedEvidence,
    );
    const pub = toPublicCanonicalStylingProfile(result.profile);
    assertNoFashionProviderLeakage(pub);

    const memorySnapshot = evolveMemorySnapshot({
      prior: mem,
      decisions: result.profile.decisions,
      sessionId: input.sessionId,
    });

    const traceId = result.profile.runtime.traceId ?? 'seval_unknown';
    fashionTelemetry.track({
      name: 'fashion_capability_requested',
      traceId,
      capabilityId: 'analyze_style',
    });
    fashionTelemetry.track({
      name: 'fashion_attempt_recorded',
      traceId,
      capabilityId: 'analyze_style',
      runtimeStatus: result.profile.runtime.status,
    });

    return {
      success: true,
      profile: pub,
      decisionLedger: result.decisionLedger,
      memorySnapshot,
      capabilityId: 'analyze_style',
    };
  }

  reasonStyle(input: StylingEvaluationInput) {
    this.assertCap('style_reason');
    const result = this.evaluator.evaluate({
      ...input,
      memory: normalizeMemorySnapshot(input.memory),
      traceId: input.traceId,
    });
    assertValidStylingProfileLaw32(
      result.profile,
      result.decisionLedger,
      result.interpretedEvidence,
    );
    return {
      decisions: result.profile.decisions,
      limitations: result.profile.limitations,
      decisionLedger: result.decisionLedger,
      runtime: result.profile.runtime,
      capabilityId: 'style_reason' as const,
    };
  }

  evaluateGoals(input: StylingEvaluationInput) {
    this.assertCap('style_goals');
    const result = this.evaluator.evaluate({
      ...input,
      memory: normalizeMemorySnapshot(input.memory),
      traceId: input.traceId,
    });
    assertValidStylingProfileLaw32(
      result.profile,
      result.decisionLedger,
      result.interpretedEvidence,
    );
    return {
      goals: result.profile.goals,
      progress: result.profile.progress,
      decisionLedger: result.decisionLedger,
      runtime: result.profile.runtime,
      capabilityId: 'style_goals' as const,
    };
  }
}
