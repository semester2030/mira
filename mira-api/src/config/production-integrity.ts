/**
 * Phase 0 — Production integrity gates.
 * Unsafe mock / fallback settings must fail fast in production.
 */

export type IntegrityEnv = {
  NODE_ENV?: string;
  AUTH_SKIP?: string;
  PARTNER_AUTO_APPROVE?: string;
  PERFECT_CORP_FALLBACK_MOCK?: string;
  SKIN_PROVIDER?: string;
  OUTFIT_PROVIDER?: string;
  ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD?: string;
};

export type IntegrityIssue = {
  code: string;
  message: string;
  severity: 'fatal' | 'warn';
};

export function isProductionEnv(nodeEnv?: string): boolean {
  return (nodeEnv ?? process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

/** Mock Perfect fallback is allowed only outside production, and only when explicitly true. */
export function isPerfectMockFallbackAllowed(env: IntegrityEnv = process.env): boolean {
  if (isProductionEnv(env.NODE_ENV)) return false;
  return (env.PERFECT_CORP_FALLBACK_MOCK ?? 'false') === 'true';
}

/** No legacy OUTFIT_PROVIDER path may serve scored results in production. */
export function isLegacyOutfitPathBlockedInProduction(
  env: IntegrityEnv = process.env,
): boolean {
  return isProductionEnv(env.NODE_ENV);
}

/** @deprecated Compatibility alias for existing callers/tests. */
export function isLegacyOutfitMockBlocked(env: IntegrityEnv = process.env): boolean {
  return isLegacyOutfitPathBlockedInProduction(env);
}

export function validateProductionIntegrity(
  env: IntegrityEnv = process.env,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (!isProductionEnv(env.NODE_ENV)) return issues;

  if (env.AUTH_SKIP === 'true') {
    issues.push({
      code: 'AUTH_SKIP_IN_PROD',
      severity: 'fatal',
      message: 'AUTH_SKIP=true is forbidden in production.',
    });
  }

  if (env.PARTNER_AUTO_APPROVE === 'true') {
    issues.push({
      code: 'PARTNER_AUTO_APPROVE_IN_PROD',
      severity: 'fatal',
      message: 'PARTNER_AUTO_APPROVE=true is forbidden in production.',
    });
  }

  const fallback = env.PERFECT_CORP_FALLBACK_MOCK ?? 'true';
  if (fallback !== 'false') {
    issues.push({
      code: 'PERFECT_CORP_FALLBACK_MOCK_UNSAFE',
      severity: 'fatal',
      message:
        'PERFECT_CORP_FALLBACK_MOCK must be "false" in production. Silent mock skin results are forbidden.',
    });
  }

  const skinProvider = env.SKIN_PROVIDER ?? 'mock';
  if (skinProvider === 'mock') {
    issues.push({
      code: 'SKIN_PROVIDER_MOCK_IN_PROD',
      severity: 'fatal',
      message:
        'SKIN_PROVIDER=mock is not allowed in production. Use perfect_corp.',
    });
  }

  if ((env.OUTFIT_PROVIDER ?? 'mock') === 'mock') {
    issues.push({
      code: 'OUTFIT_PROVIDER_LEGACY_MOCK',
      severity: 'warn',
      message:
        'OUTFIT_PROVIDER=mock is legacy. Canonical fashion path is Vision Platform (/ai/vision/outfit/analyze). Legacy outfit-analysis endpoint rejects mock results in production.',
    });
  }

  if (env.ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD === 'true') {
    issues.push({
      code: 'ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD_UNSAFE',
      severity: 'fatal',
      message:
        'ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD=true is forbidden. Legacy outfit paths are disabled in production.',
    });
  }

  return issues;
}

export function assertProductionIntegrity(env: IntegrityEnv = process.env): void {
  const issues = validateProductionIntegrity(env);
  const fatals = issues.filter((i) => i.severity === 'fatal');
  for (const w of issues.filter((i) => i.severity === 'warn')) {
    // eslint-disable-next-line no-console
    console.warn(`[production-integrity] ${w.code}: ${w.message}`);
  }
  if (fatals.length > 0) {
    const detail = fatals.map((f) => `${f.code}: ${f.message}`).join('\n');
    throw new Error(`Production integrity check failed:\n${detail}`);
  }
}
