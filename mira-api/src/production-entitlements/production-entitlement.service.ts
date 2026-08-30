import { Injectable } from '@nestjs/common';

/**
 * PROD-FINAL-1 — Server-authoritative owner/canary entitlements.
 *
 * Fail-closed: missing/invalid config → all capabilities OFF.
 * Identity source: authenticated Firebase UID only (never body userId/email).
 * Allowlist is env-configured — never hardcoded in source.
 */
export const PRODUCTION_ENTITLEMENT_VERSION =
  'mira-production-entitlement-v1';

export interface ProductionEntitlementSnapshot {
  readonly faceExperienceV1: boolean;
  readonly fashionAdvisorModeB: boolean;
  readonly version: string;
}

@Injectable()
export class ProductionEntitlementService {
  resolveForFirebaseUid(
    firebaseUid: string | undefined | null,
    getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
      process.env[k] ?? d,
  ): ProductionEntitlementSnapshot {
    const uid = (firebaseUid ?? '').trim();
    if (!uid) {
      return this.off();
    }

    const allowlisted = this.isAllowlisted(uid, getEnv);
    if (!allowlisted) {
      return this.off();
    }

    return {
      faceExperienceV1: this.isMasterEnabled(
        'MIRA_FACE_EXPERIENCE_MASTER_ENABLED',
        getEnv,
      ),
      fashionAdvisorModeB: this.isMasterEnabled(
        'MIRA_FASHION_MODE_B_MASTER_ENABLED',
        getEnv,
      ),
      version: PRODUCTION_ENTITLEMENT_VERSION,
    };
  }

  isAllowlisted(
    firebaseUid: string,
    getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
      process.env[k] ?? d,
  ): boolean {
    const raw = (getEnv('MIRA_PRODUCTION_INTERNAL_UIDS', '') ?? '').trim();
    if (!raw) return false;
    const set = new Set(
      raw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
    return set.has(firebaseUid.trim());
  }

  private isMasterEnabled(
    key: string,
    getEnv: (key: string, def?: string) => string | undefined,
  ): boolean {
    const v = (getEnv(key, 'false') ?? 'false').trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }

  private off(): ProductionEntitlementSnapshot {
    return {
      faceExperienceV1: false,
      fashionAdvisorModeB: false,
      version: PRODUCTION_ENTITLEMENT_VERSION,
    };
  }
}
