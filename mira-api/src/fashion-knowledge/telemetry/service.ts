/**
 * FK-9 — Internal telemetry service (flag-gated).
 * No Advisor wiring. No registry writes. No public HTTP.
 */
import {
  FASHION_FEEDBACK_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_KNOWLEDGE_TELEMETRY_RUNTIME_VERSION,
  FASHION_TELEMETRY_SCHEMA_VERSION,
} from '../versioning/release';
import type { FashionKnowledgeEventStorePort } from './port';
import type { FashionKnowledgeTelemetryEventInput } from './event-contract';
import type { FashionAdviceFeedbackInput } from './feedback-contract';
import {
  validateFeedback,
  validateTelemetryEvent,
  minimizeFeedbackText,
} from './validation';
import { isFashionKnowledgeTelemetryEnabled } from './feature-flag';
import { ENGINEERING_LAW_39 } from './engineering-law-39';
import { assertNoRegistryWriteSurface } from './no-promotion';
import {
  classifyFeedbackSignal,
  mapPreferenceSignal,
} from './semantics';
import { FeedbackExplicitness } from './feedback-contract';
import { YEAR1_DEFAULT_SOURCE_MODE } from './event-taxonomy';
import {
  isFashionTelemetryConsentAllowed,
  resolveFashionTelemetryConsent,
  type FashionTelemetryConsentState,
} from './consent-gate';

export interface FashionKnowledgeTelemetryService {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_TELEMETRY_RUNTIME_VERSION | string;
  readonly law39: typeof ENGINEERING_LAW_39.lawId;
  recordEvent(
    input: FashionKnowledgeTelemetryEventInput,
  ): Promise<{
    recorded: boolean;
    duplicate: boolean;
    disabled?: boolean;
    consentBlocked?: boolean;
    issues?: readonly string[];
  }>;
  recordFeedback(
    input: FashionAdviceFeedbackInput,
  ): Promise<{
    recorded: boolean;
    duplicate: boolean;
    disabled?: boolean;
    consentBlocked?: boolean;
    signalClass?: string;
    issues?: readonly string[];
  }>;
  queryAggregates(input: {
    readonly clockNowIso: string;
    readonly preferenceSegment?: string;
  }): ReturnType<FashionKnowledgeEventStorePort['queryAggregates']>;
  buildResearchCandidates(input: {
    readonly clockNowIso: string;
  }): ReturnType<FashionKnowledgeEventStorePort['buildResearchCandidates']>;
  loadEvents(): ReturnType<FashionKnowledgeEventStorePort['loadEvents']>;
  loadFeedback(input?: {
    readonly adviceCandidateId?: string;
  }): ReturnType<FashionKnowledgeEventStorePort['loadFeedback']>;
}

export function createFashionKnowledgeTelemetryService(input: {
  readonly port: FashionKnowledgeEventStorePort;
  readonly enabled?: boolean;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
  /** Explicit consent — never inferred from feature flag. */
  readonly consentState?: FashionTelemetryConsentState | string;
  readonly analyticsAllowed?: boolean;
}): FashionKnowledgeTelemetryService {
  const enabled =
    input.enabled ?? isFashionKnowledgeTelemetryEnabled(input.getEnv);
  const consent = resolveFashionTelemetryConsent({
    consentState: input.consentState,
    analyticsAllowed: input.analyticsAllowed,
  });
  const consentOk = isFashionTelemetryConsentAllowed(consent);
  const port = input.port;

  const service: FashionKnowledgeTelemetryService = {
    schemaVersion: FASHION_KNOWLEDGE_TELEMETRY_RUNTIME_VERSION,
    law39: ENGINEERING_LAW_39.lawId,

    async recordEvent(raw) {
      if (!enabled) {
        return { recorded: false, disabled: true, duplicate: false };
      }
      if (!consentOk) {
        return {
          recorded: false,
          disabled: false,
          consentBlocked: true,
          duplicate: false,
          issues: [`TELEMETRY_CONSENT_${consent}`],
        };
      }
      const validation = validateTelemetryEvent(raw);
      if (!validation.ok) {
        return {
          recorded: false,
          duplicate: false,
          issues: validation.issues.map((i) => i.code),
        };
      }
      const event = Object.freeze({
        ...raw,
        schemaVersion: raw.schemaVersion ?? FASHION_TELEMETRY_SCHEMA_VERSION,
        ruleIds: Object.freeze([...(raw.ruleIds ?? [])]),
        domains: Object.freeze([...(raw.domains ?? [])]),
        reasonCodes: Object.freeze([...(raw.reasonCodes ?? [])]),
        metadata: Object.freeze({ ...(raw.metadata ?? {}) }),
        releaseVersion: raw.releaseVersion || FASHION_KNOWLEDGE_RELEASE,
        sourceMode: raw.sourceMode || YEAR1_DEFAULT_SOURCE_MODE,
      });
      return port.recordEvent(event);
    },

    async recordFeedback(raw) {
      if (!enabled) {
        return { recorded: false, disabled: true, duplicate: false };
      }
      if (!consentOk) {
        return {
          recorded: false,
          disabled: false,
          consentBlocked: true,
          duplicate: false,
          issues: [`TELEMETRY_CONSENT_${consent}`],
        };
      }
      const minimized = raw.freeTextMinimized
        ? minimizeFeedbackText(raw.freeTextMinimized)
        : undefined;
      const feedback = Object.freeze({
        ...raw,
        freeTextMinimized: minimized,
        schemaVersion: raw.schemaVersion ?? FASHION_FEEDBACK_SCHEMA_VERSION,
        preferenceSignal:
          raw.preferenceSignal ?? mapPreferenceSignal(raw.feedbackType),
        explicitness:
          raw.explicitness ?? FeedbackExplicitness.EXPLICIT,
      });
      const validation = validateFeedback(feedback);
      if (!validation.ok) {
        return {
          recorded: false,
          duplicate: false,
          issues: validation.issues.map((i) => i.code),
        };
      }
      const result = await port.recordFeedback(feedback);
      return {
        ...result,
        signalClass: classifyFeedbackSignal(feedback),
      };
    },

    queryAggregates: (i) => port.queryAggregates(i),
    buildResearchCandidates: (i) => port.buildResearchCandidates(i),
    loadEvents: () => port.loadEvents(),
    loadFeedback: (i) => port.loadFeedback(i),
  };

  // Self-check: no registry write surface
  const guard = assertNoRegistryWriteSurface(service);
  if (!guard.ok) {
    throw new Error(
      `FK-9 telemetry service exposes forbidden methods: ${guard.forbiddenFound.join(',')}`,
    );
  }

  return service;
}
