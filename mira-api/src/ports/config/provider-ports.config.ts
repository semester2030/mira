/**
 * Phase 1 — typed provider port configuration + fail-fast rules.
 * Extends Phase 0 integrity without weakening it.
 */

import {
  IntegrityEnv,
  IntegrityIssue,
  isProductionEnv,
  validateProductionIntegrity as validatePhase0Integrity,
} from '../../config/production-integrity';

export type ProviderPortsEnv = IntegrityEnv & {
  FASHION_PROVIDER?: string;
  BEAUTY_TRYON_ENABLED?: string;
  BEAUTY_TRYON_PROVIDER?: string;
  MOCK_PROVIDER_ACCESS?: string;
  SKIN_PROVIDER_TIMEOUT_MS?: string;
  FASHION_PROVIDER_TIMEOUT_MS?: string;
};

export type SkinProviderName = 'perfect_corp' | 'mock';
export type FashionProviderName = 'vision_platform' | 'legacy_outfit_mock';

export interface ProviderPortsConfig {
  skinProvider: SkinProviderName;
  fashionProvider: FashionProviderName;
  beautyTryOnEnabled: boolean;
  mockProviderAccess: boolean;
  skinTimeoutMs: number;
  fashionTimeoutMs: number;
  environment: string;
}

export function resolveProviderPortsConfig(
  env: ProviderPortsEnv = process.env,
): ProviderPortsConfig {
  const skinRaw = (env.SKIN_PROVIDER ?? 'mock').toLowerCase();
  const skinProvider: SkinProviderName =
    skinRaw === 'perfect_corp' ? 'perfect_corp' : 'mock';

  const fashionRaw = (
    env.FASHION_PROVIDER ?? 'vision_platform'
  ).toLowerCase();
  let fashionProvider: FashionProviderName = 'vision_platform';
  if (fashionRaw === 'legacy_outfit_mock' || fashionRaw === 'mock') {
    fashionProvider = 'legacy_outfit_mock';
  } else if (fashionRaw !== 'vision_platform') {
    fashionProvider = fashionRaw as FashionProviderName;
  }

  const production = isProductionEnv(env.NODE_ENV);

  return {
    skinProvider,
    fashionProvider,
    beautyTryOnEnabled: (env.BEAUTY_TRYON_ENABLED ?? 'false') === 'true',
    mockProviderAccess: production
      ? env.MOCK_PROVIDER_ACCESS === 'true'
      : (env.MOCK_PROVIDER_ACCESS ?? 'true') !== 'false',
    skinTimeoutMs: Number(env.SKIN_PROVIDER_TIMEOUT_MS ?? 90000),
    fashionTimeoutMs: Number(env.FASHION_PROVIDER_TIMEOUT_MS ?? 90000),
    environment: env.NODE_ENV ?? 'development',
  };
}

export function validateProviderPortsConfig(
  env: ProviderPortsEnv = process.env,
): IntegrityIssue[] {
  const issues = [...validatePhase0Integrity(env)];
  const cfg = resolveProviderPortsConfig(env);
  const production = isProductionEnv(env.NODE_ENV);

  const fashionRaw = (env.FASHION_PROVIDER ?? 'vision_platform').toLowerCase();
  if (
    fashionRaw !== 'vision_platform' &&
    fashionRaw !== 'legacy_outfit_mock' &&
    fashionRaw !== 'mock'
  ) {
    issues.push({
      code: 'UNSUPPORTED_FASHION_PROVIDER',
      severity: 'fatal',
      message: `Unsupported FASHION_PROVIDER=${fashionRaw}. Use vision_platform.`,
    });
  }

  const skinRaw = (env.SKIN_PROVIDER ?? 'mock').toLowerCase();
  if (skinRaw !== 'perfect_corp' && skinRaw !== 'mock') {
    issues.push({
      code: 'UNSUPPORTED_SKIN_PROVIDER',
      severity: 'fatal',
      message: `Unsupported SKIN_PROVIDER=${skinRaw}. Use perfect_corp or mock.`,
    });
  }

  if (production && cfg.mockProviderAccess) {
    issues.push({
      code: 'MOCK_PROVIDER_ACCESS_IN_PROD',
      severity: 'fatal',
      message: 'MOCK_PROVIDER_ACCESS must be false in production.',
    });
  }

  if (production && cfg.fashionProvider === 'legacy_outfit_mock') {
    issues.push({
      code: 'LEGACY_OUTFIT_CANONICAL_FORBIDDEN',
      severity: 'fatal',
      message:
        'legacy_outfit_mock cannot be the canonical FASHION_PROVIDER in production. Use vision_platform.',
    });
  }

  if (cfg.beautyTryOnEnabled) {
    const tryOnProvider = (env.BEAUTY_TRYON_PROVIDER ?? '').trim();
    if (!tryOnProvider || tryOnProvider === 'disabled') {
      issues.push({
        code: 'BEAUTY_TRYON_ENABLED_WITHOUT_ADAPTER',
        severity: 'fatal',
        message:
          'BEAUTY_TRYON_ENABLED=true requires BEAUTY_TRYON_PROVIDER set to a registered adapter (Phase 5).',
      });
    }
  }

  return issues;
}

export function assertProviderPortsConfig(
  env: ProviderPortsEnv = process.env,
): ProviderPortsConfig {
  const issues = validateProviderPortsConfig(env);
  const fatals = issues.filter((i) => i.severity === 'fatal');
  for (const w of issues.filter((i) => i.severity === 'warn')) {
    // eslint-disable-next-line no-console
    console.warn(`[provider-ports] ${w.code}: ${w.message}`);
  }
  if (fatals.length > 0) {
    throw new Error(
      `Provider ports config failed:\n${fatals.map((f) => `${f.code}: ${f.message}`).join('\n')}`,
    );
  }
  return resolveProviderPortsConfig(env);
}
