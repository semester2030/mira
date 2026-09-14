/**
 * PROD-FINAL-1 — Production entitlement fail-closed tests (ts-node).
 * Run: npx ts-node --transpile-only src/production-entitlements/phase-prod-final1-entitlement.schema-tests.ts
 */
import assert from 'node:assert/strict';
import {
  ProductionEntitlementService,
  PRODUCTION_ENTITLEMENT_VERSION,
} from './production-entitlement.service';

function envMap(map: Record<string, string | undefined>) {
  return (k: string, d?: string) => map[k] ?? d;
}

const svc = new ProductionEntitlementService();

{
  const snap = svc.resolveForFirebaseUid('uid-owner', envMap({}));
  assert.equal(snap.faceExperienceV1, false);
  assert.equal(snap.fashionAdvisorModeB, false);
  assert.equal(snap.version, PRODUCTION_ENTITLEMENT_VERSION);
}

{
  const snap = svc.resolveForFirebaseUid('uid-owner', envMap({
    MIRA_FACE_EXPERIENCE_MASTER_ENABLED: 'true',
    MIRA_FASHION_MODE_B_MASTER_ENABLED: 'true',
    // no allowlist
  }));
  assert.equal(snap.faceExperienceV1, false);
  assert.equal(snap.fashionAdvisorModeB, false);
}

{
  const snap = svc.resolveForFirebaseUid('uid-other', envMap({
    MIRA_FACE_EXPERIENCE_MASTER_ENABLED: 'true',
    MIRA_FASHION_MODE_B_MASTER_ENABLED: 'true',
    MIRA_PRODUCTION_INTERNAL_UIDS: 'uid-owner',
  }));
  assert.equal(snap.faceExperienceV1, false);
  assert.equal(snap.fashionAdvisorModeB, false);
}

{
  const snap = svc.resolveForFirebaseUid('uid-owner', envMap({
    MIRA_FACE_EXPERIENCE_MASTER_ENABLED: 'true',
    MIRA_FASHION_MODE_B_MASTER_ENABLED: 'false',
    MIRA_PRODUCTION_INTERNAL_UIDS: 'uid-owner,uid-qa',
  }));
  assert.equal(snap.faceExperienceV1, true);
  assert.equal(snap.fashionAdvisorModeB, false);
}

{
  const snap = svc.resolveForFirebaseUid('uid-owner', envMap({
    MIRA_FACE_EXPERIENCE_MASTER_ENABLED: 'true',
    MIRA_FASHION_MODE_B_MASTER_ENABLED: 'true',
    MIRA_PRODUCTION_INTERNAL_UIDS: 'uid-owner',
  }));
  assert.equal(snap.faceExperienceV1, true);
  assert.equal(snap.fashionAdvisorModeB, true);
}

{
  const snap = svc.resolveForFirebaseUid('', envMap({
    MIRA_FACE_EXPERIENCE_MASTER_ENABLED: 'true',
    MIRA_PRODUCTION_INTERNAL_UIDS: 'uid-owner',
  }));
  assert.equal(snap.faceExperienceV1, false);
}

console.log('phase_prod_final1_entitlement: PASS');
