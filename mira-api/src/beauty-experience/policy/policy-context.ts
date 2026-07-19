/**
 * Policy context — all checks before any provider is contacted.
 */
import { BeautyPlatform } from '../capability/capability-ids';

export type { BeautyPlatform };

export interface BeautyPolicyContext {
  capabilityId: string;
  userId?: string;
  subscriptionTier?: 'free' | 'plus' | 'premium' | 'unknown';
  /** Feature flag: master beauty experience */
  beautyExperienceEnabled: boolean;
  /** Feature flag: allow real try-on (must stay false in 5A) */
  realTryOnEnabled: boolean;
  countryCode?: string;
  platform: BeautyPlatform;
  deviceClass?: string;
  /** Estimated cost units for this capability class */
  estimatedCostUnits: number;
  remainingQuota: number;
  consentTryOn: boolean;
  /** Future-ready */
  ageVerified?: boolean;
  minAgeRequired?: number;
  qualityGatePassed: boolean;
  /** Any licensed provider currently registered for this capability */
  hasLicensedProviderCandidate: boolean;
  licenseOk: boolean;
  traceId?: string;
}

export type PolicyRuleId =
  | 'feature_flag'
  | 'real_tryon_flag'
  | 'subscription'
  | 'license'
  | 'country'
  | 'platform'
  | 'device'
  | 'provider_availability'
  | 'cost'
  | 'quota'
  | 'consent'
  | 'age'
  | 'quality';

export interface PolicyRuleResult {
  ruleId: PolicyRuleId;
  passed: boolean;
  reasonCode?: string;
  reasonEn?: string;
  reasonAr?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  results: PolicyRuleResult[];
  blockingRule?: PolicyRuleId;
  reasonCode?: string;
  reasonEn?: string;
  reasonAr?: string;
}
