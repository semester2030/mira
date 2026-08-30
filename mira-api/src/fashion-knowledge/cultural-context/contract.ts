/**
 * FK-8 — FashionCulturalContext contract + safe normalization.
 * Locale ≠ identity. GPS/language alone ≠ cultural identity.
 */
import { FASHION_KNOWLEDGE_CULTURAL_CONTEXT_VERSION } from '../versioning/release';
import {
  CulturalContextConfidence,
  CulturalContextSourceType,
  CulturalContextType,
  ModestyPreference,
  RegionScope,
  TraditionalElementLabel,
} from './models';

export interface FashionCulturalContextInput {
  readonly contextId?: string;
  readonly regionCode?: string;
  readonly countryCode?: string;
  readonly locale?: string;
  readonly culturalContextType?: string;
  readonly socialContext?: string;
  readonly eventContext?: string;
  readonly modestyContext?: string;
  readonly traditionalContext?: string;
  /** Explicit user free-text / selection label e.g. "Saudi wedding" */
  readonly explicitLabel?: string;
  readonly userDeclared?: boolean;
  readonly sourceType?: string;
  readonly confidence?: string;
  readonly evidenceRefs?: readonly string[];
  readonly limitations?: readonly string[];
  /** Weak signals — must never alone produce EXPLICIT Saudi identity. */
  readonly appLocale?: string;
  readonly locationHint?: string;
  readonly timezoneHint?: string;
  readonly cleared?: boolean;
  readonly modestyPreference?: string;
  readonly constraintStrength?: string;
}

export interface FashionCulturalContext {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_CULTURAL_CONTEXT_VERSION | string;
  readonly contextId: string;
  readonly regionCode?: string;
  readonly countryCode?: string;
  readonly locale?: string;
  readonly culturalContextType: string;
  readonly socialContext?: string;
  readonly eventContext?: string;
  readonly modestyContext?: string;
  readonly traditionalContext: string;
  readonly explicitLabel?: string;
  readonly userDeclared: boolean;
  readonly sourceType: string;
  readonly confidence: string;
  readonly regionScope: string;
  readonly modestyPreference: string;
  readonly constraintStrength: string;
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
  /** True only when user/event explicitly supplied cultural context. */
  readonly mayInvokeRegionalKnowledgePath: boolean;
  /** App locale / weak geo never equals identity. */
  readonly identityInferred: false;
  readonly privacy: {
    readonly minimizePersistence: true;
    readonly noInferredReligionOrEthnicity: true;
  };
}

const SOURCE_OK = new Set(Object.values(CulturalContextSourceType));
const CONF_OK = new Set(Object.values(CulturalContextConfidence));
const TYPE_OK = new Set(Object.values(CulturalContextType));
const MODESTY_OK = new Set(Object.values(ModestyPreference));
const TRAD_OK = new Set(Object.values(TraditionalElementLabel));

function detectExplicitRegionalEvent(label?: string): boolean {
  if (!label) return false;
  return /saudi|gulf|gcc|خليج|سعود|زواج سعودي|مناسبة سعودية/i.test(label);
}

/**
 * Normalize cultural context. Never invents Saudi/Gulf identity from locale/GPS.
 */
export function normalizeFashionCulturalContext(
  input: FashionCulturalContextInput = {},
): FashionCulturalContext {
  if (input.cleared) {
    return Object.freeze({
      schemaVersion: FASHION_KNOWLEDGE_CULTURAL_CONTEXT_VERSION,
      contextId: input.contextId ?? 'cultural:cleared',
      culturalContextType: CulturalContextType.UNKNOWN,
      traditionalContext: TraditionalElementLabel.UNKNOWN,
      userDeclared: false,
      sourceType: CulturalContextSourceType.UNKNOWN,
      confidence: CulturalContextConfidence.UNKNOWN,
      regionScope: RegionScope.UNKNOWN,
      modestyPreference: ModestyPreference.UNKNOWN,
      constraintStrength: 'UNKNOWN',
      evidenceRefs: Object.freeze([] as string[]),
      limitations: Object.freeze(['context_cleared_by_user']),
      mayInvokeRegionalKnowledgePath: false,
      identityInferred: false as const,
      privacy: Object.freeze({
        minimizePersistence: true as const,
        noInferredReligionOrEthnicity: true as const,
      }),
    });
  }

  const limitations: string[] = [...(input.limitations ?? [])];
  const userDeclared =
    input.userDeclared === true || Boolean(input.explicitLabel);
  let sourceType =
    input.sourceType && SOURCE_OK.has(input.sourceType as never)
      ? input.sourceType
      : CulturalContextSourceType.UNKNOWN;
  let confidence =
    input.confidence && CONF_OK.has(input.confidence as never)
      ? input.confidence
      : CulturalContextConfidence.UNKNOWN;

  if (userDeclared && input.explicitLabel) {
    sourceType = CulturalContextSourceType.EXPLICIT_USER_SELECTION;
    confidence = CulturalContextConfidence.EXPLICIT;
  } else if (
    input.sourceType === CulturalContextSourceType.EVENT_CONFIGURATION
  ) {
    confidence =
      confidence === CulturalContextConfidence.UNKNOWN
        ? CulturalContextConfidence.SUPPORTED
        : confidence;
  } else if (input.appLocale || input.locale) {
    if (!userDeclared) {
      sourceType = CulturalContextSourceType.APP_LOCALE_WEAK;
      confidence = CulturalContextConfidence.WEAK;
      limitations.push('locale_is_not_cultural_identity');
      limitations.push('arabic_locale_is_not_saudi_identity');
    }
  }

  if ((input.locationHint || input.timezoneHint) && !userDeclared) {
    limitations.push('location_hint_is_not_cultural_identity');
    if (confidence === CulturalContextConfidence.UNKNOWN) {
      confidence = CulturalContextConfidence.WEAK;
      sourceType =
        sourceType === CulturalContextSourceType.UNKNOWN
          ? CulturalContextSourceType.APP_LOCALE_WEAK
          : sourceType;
    }
  }

  const explicitRegional = detectExplicitRegionalEvent(input.explicitLabel);
  const mayInvokeRegionalKnowledgePath =
    userDeclared &&
    explicitRegional &&
    confidence === CulturalContextConfidence.EXPLICIT;

  let regionScope: string = RegionScope.UNKNOWN;
  if (mayInvokeRegionalKnowledgePath) {
    regionScope = RegionScope.REGION;
  } else if (input.countryCode && userDeclared) {
    regionScope = RegionScope.COUNTRY;
  } else if (input.regionCode && userDeclared) {
    regionScope = RegionScope.REGION;
  }

  const modestyPreference =
    input.modestyPreference && MODESTY_OK.has(input.modestyPreference as never)
      ? input.modestyPreference
      : ModestyPreference.UNKNOWN;

  if (
    !input.modestyPreference &&
    /modest|محافظ/i.test(input.explicitLabel ?? '')
  ) {
    limitations.push('modesty_not_inferred_from_culture_label');
  }

  const traditionalContext =
    input.traditionalContext && TRAD_OK.has(input.traditionalContext as never)
      ? input.traditionalContext
      : TraditionalElementLabel.UNKNOWN;

  const culturalContextType =
    input.culturalContextType && TYPE_OK.has(input.culturalContextType as never)
      ? input.culturalContextType
      : mayInvokeRegionalKnowledgePath
        ? CulturalContextType.REGIONAL_EVENT
        : input.eventContext
          ? CulturalContextType.EVENT
          : CulturalContextType.UNKNOWN;

  limitations.push('law38_no_identity_inference');
  limitations.push('oi_modesty_consume_only');

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_CULTURAL_CONTEXT_VERSION,
    contextId: input.contextId ?? `cultural:${confidence.toLowerCase()}`,
    regionCode: userDeclared ? input.regionCode : undefined,
    countryCode: userDeclared ? input.countryCode : undefined,
    locale: input.locale ?? input.appLocale,
    culturalContextType,
    socialContext: input.socialContext,
    eventContext: input.eventContext,
    modestyContext: input.modestyContext,
    traditionalContext,
    explicitLabel: userDeclared ? input.explicitLabel : undefined,
    userDeclared,
    sourceType,
    confidence,
    regionScope,
    modestyPreference,
    constraintStrength: input.constraintStrength ?? 'UNKNOWN',
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    limitations: Object.freeze([...new Set(limitations)]),
    mayInvokeRegionalKnowledgePath,
    identityInferred: false as const,
    privacy: Object.freeze({
      minimizePersistence: true as const,
      noInferredReligionOrEthnicity: true as const,
    }),
  });
}

/** Projection string for LLM request — never invents regional authority. */
export function culturalContextToLlmToken(
  ctx: FashionCulturalContext,
): string | undefined {
  if (ctx.confidence === CulturalContextConfidence.UNKNOWN) return undefined;
  if (ctx.userDeclared && ctx.explicitLabel) {
    return `explicit:${ctx.explicitLabel}`;
  }
  if (ctx.confidence === CulturalContextConfidence.WEAK) {
    return `weak_locale:${ctx.locale ?? 'unknown'}`;
  }
  if (ctx.eventContext) return `event:${ctx.eventContext}`;
  return undefined;
}

export function isReligiousRulingRequest(text: string): boolean {
  return /مخالفة دينيًا|حكم شرعي|is this (outfit )?religiously|حلال|حرام|فتوى/i.test(
    text,
  );
}
