/**
 * AT-2 — Strict structural parser for provider JSON → FashionAdviceCandidateDraft.
 * Does not invent fields. Fail-closed on malformed / oversized content.
 */
import type {
  FashionAdviceCandidateDraft,
  FashionAdviceSuggestion,
} from '../../advice/advice-candidate';
import type { FashionAdviceAlternative } from '../../contracts/alternatives';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../../versioning/release';

const MAX_TEXT = 2000;
const MAX_ARRAY = 32;
const MAX_ALTS = 8;

export interface FashionDraftParseOk {
  readonly ok: true;
  readonly draft: FashionAdviceCandidateDraft;
}

export interface FashionDraftParseFail {
  readonly ok: false;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export type FashionDraftParseResult =
  | FashionDraftParseOk
  | FashionDraftParseFail;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function asString(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

function asStringArray(v: unknown, maxItems = MAX_ARRAY): string[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length > maxItems) return null;
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item, MAX_TEXT);
    if (s == null) return null;
    out.push(s);
  }
  return out;
}

function asBoolean(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function parseSuggestion(v: unknown): FashionAdviceSuggestion | null {
  if (!isRecord(v)) return null;
  const structuredText = asString(v.structuredText);
  const adviceType = asString(v.adviceType, 120);
  const absoluteClaim = asBoolean(v.absoluteClaim);
  const knownRuleWording = asBoolean(v.knownRuleWording);
  if (
    structuredText == null ||
    adviceType == null ||
    absoluteClaim == null ||
    knownRuleWording == null
  ) {
    return null;
  }
  return {
    structuredText,
    adviceType: adviceType as FashionAdviceSuggestion['adviceType'],
    absoluteClaim,
    knownRuleWording,
  };
}

function parseAlternative(v: unknown): FashionAdviceAlternative | null {
  if (!isRecord(v)) return null;
  const alternativeId = asString(v.alternativeId, 120);
  const direction = asString(v.direction, 200);
  const expectedStyleEffect = asString(v.expectedStyleEffect);
  const qualification = asString(v.qualification, 240);
  const confidence = asString(v.confidence, 40);
  const subjectivity = asString(v.subjectivity, 40);
  const preferenceAlignment = asString(v.preferenceAlignment, 40);
  const evidenceRefs = asStringArray(v.evidenceRefs);
  const ruleRefs = asStringArray(v.ruleRefs ?? []);
  if (
    alternativeId == null ||
    direction == null ||
    expectedStyleEffect == null ||
    qualification == null ||
    confidence == null ||
    subjectivity == null ||
    preferenceAlignment == null ||
    evidenceRefs == null ||
    ruleRefs == null
  ) {
    return null;
  }
  if (
    !['aligned', 'partial', 'opposed', 'unknown'].includes(preferenceAlignment)
  ) {
    return null;
  }
  if (!Array.isArray(v.changes) || v.changes.length > MAX_ARRAY) return null;
  const changes = [];
  for (const c of v.changes) {
    if (!isRecord(c)) return null;
    const changeId = asString(c.changeId, 120);
    const targetRef = asString(c.targetRef, 200);
    const action = asString(c.action, 40);
    if (changeId == null || targetRef == null || action == null) return null;
    const toDirection =
      c.toDirection === undefined || c.toDirection === null
        ? undefined
        : asString(c.toDirection, 200) ?? undefined;
    if (c.toDirection != null && toDirection === undefined) return null;
    changes.push({
      changeId,
      targetRef,
      action: action as FashionAdviceAlternative['changes'][number]['action'],
      ...(toDirection != null ? { toDirection } : {}),
      ...(typeof c.notes === 'string' && c.notes.trim()
        ? { notes: c.notes.trim().slice(0, MAX_TEXT) }
        : {}),
    });
  }
  return {
    alternativeId,
    direction,
    changes,
    expectedStyleEffect,
    evidenceRefs,
    ruleRefs,
    confidence: confidence as FashionAdviceAlternative['confidence'],
    subjectivity: subjectivity as FashionAdviceAlternative['subjectivity'],
    qualification,
    preferenceAlignment: preferenceAlignment as FashionAdviceAlternative['preferenceAlignment'],
  };
}

/**
 * Parse provider JSON text into a draft. Enum legality deferred to FK-3 validator.
 */
export function parseOpenAiFashionDraftJson(
  rawText: string,
): FashionDraftParseResult {
  if (!rawText?.trim()) {
    return {
      ok: false,
      errorCode: 'malformed_json',
      errorMessage: 'Empty provider content',
    };
  }
  if (rawText.length > 100_000) {
    return {
      ok: false,
      errorCode: 'malformed_json',
      errorMessage: 'Provider payload too large',
    };
  }

  let parsed: unknown;
  try {
    // Strip accidental markdown fences if model wraps JSON.
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      errorCode: 'malformed_json',
      errorMessage: 'Provider content is not JSON',
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errorCode: 'schema_mismatch',
      errorMessage: 'Root must be object',
    };
  }

  // Reject chain-of-thought / provider metadata masquerading as draft fields.
  for (const banned of [
    'reasoning',
    'chainOfThought',
    'chain_of_thought',
    'systemPrompt',
    'apiKey',
    'providerRaw',
  ]) {
    if (banned in parsed) {
      return {
        ok: false,
        errorCode: 'provider_leakage',
        errorMessage: `Forbidden field: ${banned}`,
      };
    }
  }

  const draftId = asString(parsed.draftId, 160);
  const schemaVersion =
    asString(parsed.schemaVersion, 80) ?? FASHION_ADVICE_CANDIDATE_VERSION;
  const adviceType = asString(parsed.adviceType, 120);
  const targetRefs = asStringArray(parsed.targetRefs);
  const currentObservation = asString(parsed.currentObservation);
  const suggestion = parseSuggestion(parsed.suggestion);
  const rationale = asString(parsed.rationale);
  const evidenceRefs = asStringArray(parsed.evidenceRefs);
  const subjectivity = asString(parsed.subjectivity, 40);
  const limitations = asStringArray(parsed.limitations ?? []);
  const createdAt = asString(parsed.createdAt, 64);

  if (
    draftId == null ||
    adviceType == null ||
    targetRefs == null ||
    currentObservation == null ||
    suggestion == null ||
    rationale == null ||
    evidenceRefs == null ||
    subjectivity == null ||
    limitations == null ||
    createdAt == null
  ) {
    return {
      ok: false,
      errorCode: 'missing_required_field',
      errorMessage: 'Draft missing required fields',
    };
  }

  if (!Array.isArray(parsed.alternatives) || parsed.alternatives.length > MAX_ALTS) {
    return {
      ok: false,
      errorCode: 'schema_mismatch',
      errorMessage: 'alternatives must be array within limits',
    };
  }
  const alternatives: FashionAdviceAlternative[] = [];
  for (const alt of parsed.alternatives) {
    const a = parseAlternative(alt);
    if (a == null) {
      return {
        ok: false,
        errorCode: 'schema_mismatch',
        errorMessage: 'Invalid alternative entry',
      };
    }
    alternatives.push(a);
  }

  const draft: FashionAdviceCandidateDraft = {
    draftId,
    schemaVersion,
    adviceType: adviceType as FashionAdviceCandidateDraft['adviceType'],
    targetRefs,
    currentObservation,
    suggestion,
    rationale,
    evidenceRefs,
    subjectivity: subjectivity as FashionAdviceCandidateDraft['subjectivity'],
    alternatives,
    limitations,
    createdAt,
    ...(typeof parsed.traceId === 'string'
      ? { traceId: parsed.traceId.slice(0, 120) }
      : {}),
    ...(typeof parsed.knowledgeType === 'string'
      ? {
          knowledgeType:
            parsed.knowledgeType as FashionAdviceCandidateDraft['knowledgeType'],
        }
      : {}),
    ...(typeof parsed.confidenceEstimate === 'string'
      ? {
          confidenceEstimate:
            parsed.confidenceEstimate as FashionAdviceCandidateDraft['confidenceEstimate'],
        }
      : {}),
    ...(typeof parsed.preferenceConflict === 'string'
      ? {
          preferenceConflict:
            parsed.preferenceConflict as FashionAdviceCandidateDraft['preferenceConflict'],
        }
      : {}),
    ...(typeof parsed.culturalConflict === 'string'
      ? {
          culturalConflict:
            parsed.culturalConflict as FashionAdviceCandidateDraft['culturalConflict'],
        }
      : {}),
    ...(typeof parsed.occasionDependency === 'boolean'
      ? { occasionDependency: parsed.occasionDependency }
      : {}),
    ...(Array.isArray(parsed.occasionContext)
      ? {
          occasionContext:
            asStringArray(parsed.occasionContext) ?? undefined,
        }
      : {}),
    ...(Array.isArray(parsed.assumptions)
      ? { assumptions: asStringArray(parsed.assumptions) ?? undefined }
      : {}),
    ...(Array.isArray(parsed.clarificationNeeds)
      ? {
          clarificationNeeds:
            asStringArray(parsed.clarificationNeeds) ?? undefined,
        }
      : {}),
    ...(typeof parsed.forbiddenClaimDetected === 'boolean'
      ? { forbiddenClaimDetected: parsed.forbiddenClaimDetected }
      : {}),
  };

  if (
    Array.isArray(parsed.occasionContext) &&
    draft.occasionContext === undefined
  ) {
    return {
      ok: false,
      errorCode: 'schema_mismatch',
      errorMessage: 'Invalid occasionContext',
    };
  }

  return { ok: true, draft };
}
