import { BeautyCapabilityId } from '../capability/capability-ids';
import { BeautyProviderId } from '../provider-manager/provider-ids';

/** Readiness platform provider ids — includes unknown */
export type ReadinessProviderId = BeautyProviderId | 'unknown';

export type LicenseStatus =
  | 'purchased'
  | 'verified'
  | 'expired'
  | 'unknown'
  | 'pending'
  | 'rejected';

export type ProviderActivationStatus =
  | 'inactive'
  | 'pending_verification'
  | 'ready'
  | 'activated'
  | 'suspended'
  | 'blocked';

export type CapabilityActivationStatus =
  | 'disabled'
  | 'pending_verification'
  | 'ready'
  | 'activated'
  | 'suspended'
  | 'deprecated'
  | 'removed';

export type ConfigurationStatus =
  | 'missing'
  | 'partial'
  | 'complete'
  | 'invalid';

export type VerificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'unknown';

export type DocumentationStatus =
  | 'missing'
  | 'partial'
  | 'complete';

export type SandboxStatus =
  | 'unavailable'
  | 'available'
  | 'verified'
  | 'unknown';

export type CheckResult = 'pass' | 'fail' | 'unknown';

export type ProviderHealthStatus =
  | 'available'
  | 'unavailable'
  | 'maintenance'
  | 'quota_exhausted'
  | 'authentication_failed'
  | 'license_missing'
  | 'configuration_invalid'
  | 'unknown';

export type ReadinessLevel =
  | 'ready'
  | 'partially_ready'
  | 'blocked'
  | 'unknown';

export interface ProviderLicenseRecord {
  providerId: ReadinessProviderId;
  status: LicenseStatus;
  /** Never invent — operator-set only */
  verifiedAt?: string;
  expiresAt?: string;
  evidenceRef?: string;
  notes?: string;
}

/**
 * Configuration model — secrets are env var NAMES only, never values in code.
 */
export interface ProviderConfiguration {
  providerId: ReadinessProviderId;
  /** Env var name holding API key — not the secret */
  apiKeyEnvVar?: string;
  environment: 'sandbox' | 'production' | 'unknown';
  endpoints: {
    restBaseUrlEnvVar?: string;
    restBaseUrlDefault?: string;
    healthPath?: string;
  };
  sdkVersion?: string;
  restVersion?: string;
  featureFlags: Record<string, string>;
  timeoutMs?: number;
  quota?: {
    unitLabel?: string;
    softLimit?: number;
    hardLimit?: number;
  };
  region?: string;
  healthCheck: {
    enabled: boolean;
    /** Live probe forbidden in 5B.0 — config only */
    allowLiveProbe: false;
  };
  status: ConfigurationStatus;
}

export interface ProviderCostMetadata {
  providerId: ReadinessProviderId;
  costClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'unknown';
  estimatedCostPerUnit?: number;
  billingUnit?: string;
  currency?: string;
  quotaRemaining?: number | 'unknown';
  costVersion: string;
}

export interface ProviderSandboxRecord {
  providerId: ReadinessProviderId;
  sandboxAvailable: boolean;
  sandboxVerified: boolean;
  /** Env var name only */
  sandboxCredentialsEnvVar?: string;
  limitations: string[];
  productionReady: boolean;
  status: SandboxStatus;
}

export interface ProviderDocumentationRecord {
  providerId: ReadinessProviderId;
  officialDocsUrl?: string;
  integrationGuideUrl?: string;
  sdkGuideUrl?: string;
  restGuideUrl?: string;
  pricingGuideUrl?: string;
  licenseGuideUrl?: string;
  retentionPolicyUrl?: string;
  privacyPolicyUrl?: string;
  versionHistoryUrl?: string;
  status: DocumentationStatus;
}

export interface VerificationCheck {
  id: string;
  label: string;
  result: CheckResult;
  detail?: string;
}

export interface ProviderVerificationReport {
  providerId: ReadinessProviderId;
  capabilityId?: BeautyCapabilityId;
  checks: VerificationCheck[];
  overall: VerificationStatus;
  completedAt: string;
}

export interface ProviderHealthRecord {
  providerId: ReadinessProviderId;
  status: ProviderHealthStatus;
  updatedAt: string;
  reason?: string;
}

export interface CapabilityActivationRecord {
  capabilityId: BeautyCapabilityId;
  providerId: ReadinessProviderId;
  status: CapabilityActivationStatus;
  updatedAt: string;
  reason?: string;
}

export interface CanonicalProviderRecord {
  providerId: ReadinessProviderId;
  displayName: string;
  version: string;
  health: ProviderHealthStatus;
  status: ProviderActivationStatus;
  licenseStatus: LicenseStatus;
  activationStatus: ProviderActivationStatus;
  supportedCapabilities: BeautyCapabilityId[];
  configurationStatus: ConfigurationStatus;
  verificationStatus: VerificationStatus;
  documentationStatus: DocumentationStatus;
  sandboxStatus: SandboxStatus;
}

export interface ActivationChecklistItem {
  id: string;
  label: string;
  required: true;
  result: CheckResult;
  detail?: string;
}

export interface ActivationChecklist {
  providerId: ReadinessProviderId;
  capabilityId: BeautyCapabilityId;
  items: ActivationChecklistItem[];
  allPassed: boolean;
}

export interface ProviderReadinessEntry {
  providerId: ReadinessProviderId;
  level: ReadinessLevel;
  reasons: string[];
  checklist?: ActivationChecklist;
}

export interface ProviderReadinessReport {
  version: string;
  generatedAt: string;
  entries: ProviderReadinessEntry[];
}

/** Configuration wizard — architecture only (no UI) */
export type ConfigWizardStepId =
  | 'choose_provider'
  | 'verify_license'
  | 'verify_capabilities'
  | 'configure_keys'
  | 'health_check'
  | 'activate'
  | 'smoke_test'
  | 'ready';

export interface ConfigWizardStep {
  id: ConfigWizardStepId;
  titleEn: string;
  titleAr: string;
  requiresPass: boolean;
}
