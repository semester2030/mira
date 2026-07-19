import { PROVIDER_READINESS_VERSION } from './release';
import { ProviderReadinessStore } from './seed-registry';
import { buildActivationChecklist } from './activation-checklist';
import {
  ProviderReadinessEntry,
  ProviderReadinessReport,
  ReadinessLevel,
  ReadinessProviderId,
} from './types';

/**
 * Provider readiness report — Ready / Partially Ready / Blocked / Unknown.
 */
export function buildProviderReadinessReport(
  store: ProviderReadinessStore,
): ProviderReadinessReport {
  const entries: ProviderReadinessEntry[] = store.listProviders().map((p) => {
    const reasons: string[] = [];
    let level: ReadinessLevel = 'unknown';

    if (p.providerId === 'disabled') {
      return {
        providerId: p.providerId,
        level: 'blocked',
        reasons: ['Safety disabled provider — never activates try-on'],
      };
    }

    if (p.licenseStatus !== 'verified') {
      reasons.push(`License status: ${p.licenseStatus}`);
    }
    if (p.configurationStatus !== 'complete') {
      reasons.push(`Configuration: ${p.configurationStatus}`);
    }
    if (p.verificationStatus !== 'passed') {
      reasons.push(`Verification: ${p.verificationStatus}`);
    }
    if (p.health !== 'available') {
      reasons.push(`Health: ${p.health}`);
    }
    if (p.sandboxStatus !== 'verified') {
      reasons.push(`Sandbox: ${p.sandboxStatus}`);
    }
    if (p.documentationStatus === 'missing') {
      reasons.push('Documentation missing');
    }

    const lipChecklist =
      p.supportedCapabilities.includes('lip')
        ? buildActivationChecklist(store, p.providerId, 'lip')
        : undefined;

    if (lipChecklist?.allPassed && p.activationStatus === 'activated') {
      level = 'ready';
    } else if (reasons.length === 0 && p.verificationStatus === 'passed') {
      level = 'partially_ready';
    } else if (
      p.licenseStatus === 'unknown' &&
      p.configurationStatus === 'missing'
    ) {
      level = 'unknown';
    } else if (reasons.length > 0) {
      level = 'blocked';
    } else {
      level = 'partially_ready';
    }

    // Perfect: known product but blocked on license → blocked not unknown
    if (p.providerId === 'perfect_beauty') {
      level = 'blocked';
      if (!reasons.some((r) => r.includes('License'))) {
        reasons.unshift('Makeup VTO license not verified (Phase 5B stop)');
      }
    }

    return {
      providerId: p.providerId as ReadinessProviderId,
      level,
      reasons,
      checklist: lipChecklist,
    };
  });

  return {
    version: PROVIDER_READINESS_VERSION,
    generatedAt: new Date().toISOString(),
    entries,
  };
}
