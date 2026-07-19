import { BEAUTY_POLICY_VERSION } from '../release';
import {
  BeautyPolicyContext,
  PolicyDecision,
  PolicyRuleResult,
} from './policy-context';

/**
 * Capability Policy Engine — runs BEFORE Provider Manager.
 * On any failure: return canonical blocked runtime — never call provider.
 */
export class CapabilityPolicyEngine {
  readonly version = BEAUTY_POLICY_VERSION;

  evaluate(ctx: BeautyPolicyContext): PolicyDecision {
    const results: PolicyRuleResult[] = [];

    results.push({
      ruleId: 'feature_flag',
      passed: ctx.beautyExperienceEnabled,
      reasonCode: ctx.beautyExperienceEnabled
        ? undefined
        : 'beauty_experience_disabled',
      reasonEn: 'Beauty Experience feature flag is off.',
      reasonAr: 'علم ميزة تجربة الجمال متوقف.',
    });

    results.push({
      ruleId: 'real_tryon_flag',
      passed: ctx.realTryOnEnabled,
      reasonCode: ctx.realTryOnEnabled
        ? undefined
        : 'real_tryon_disabled_foundation',
      reasonEn:
        'Real try-on is disabled in Phase 5A Foundation (no licensed beauty SDK).',
      reasonAr:
        'التجربة الحقيقية معطّلة في أساس المرحلة 5A (بدون SDK جمال مرخّص).',
    });

    results.push({
      ruleId: 'subscription',
      passed: true, // Foundation: always pass; 5B wires real tiers
      reasonEn: 'Subscription check deferred to Phase 5B.',
    });

    results.push({
      ruleId: 'license',
      passed: ctx.licenseOk,
      reasonCode: ctx.licenseOk ? undefined : 'provider_license_missing',
      reasonEn: 'No licensed beauty provider for this environment.',
      reasonAr: 'لا يوجد مزوّد جمال مرخّص لهذه البيئة.',
    });

    const countryBlocked =
      ctx.countryCode !== undefined &&
      ['XX'].includes(ctx.countryCode.toUpperCase());
    results.push({
      ruleId: 'country',
      passed: !countryBlocked,
      reasonCode: countryBlocked ? 'country_blocked' : undefined,
      reasonEn: 'Capability blocked in this country.',
      reasonAr: 'القدرة محظورة في هذا البلد.',
    });

    const platformOk =
      ctx.platform === 'ios' ||
      ctx.platform === 'android' ||
      ctx.platform === 'server' ||
      ctx.platform === 'unknown';
    results.push({
      ruleId: 'platform',
      passed: platformOk,
      reasonCode: platformOk ? undefined : 'platform_unsupported',
      reasonEn: 'Platform not supported for beauty capabilities.',
      reasonAr: 'المنصة غير مدعومة لقدرات الجمال.',
    });

    results.push({
      ruleId: 'device',
      passed: true, // future device class gates
    });

    results.push({
      ruleId: 'provider_availability',
      passed: ctx.hasLicensedProviderCandidate,
      reasonCode: ctx.hasLicensedProviderCandidate
        ? undefined
        : 'no_provider_candidate',
      reasonEn: 'No provider candidate available for this capability.',
      reasonAr: 'لا يوجد مرشّح مزوّد لهذه القدرة.',
    });

    results.push({
      ruleId: 'cost',
      passed: ctx.estimatedCostUnits >= 0,
    });

    results.push({
      ruleId: 'quota',
      passed: ctx.remainingQuota > 0,
      reasonCode: ctx.remainingQuota > 0 ? undefined : 'quota_exceeded',
      reasonEn: 'Beauty try-on quota exceeded.',
      reasonAr: 'تم تجاوز حصة تجربة الجمال.',
    });

    results.push({
      ruleId: 'consent',
      passed: ctx.consentTryOn,
      reasonCode: ctx.consentTryOn ? undefined : 'consent_required',
      reasonEn: 'User consent required for try-on.',
      reasonAr: 'موافقة المستخدم مطلوبة للتجربة.',
    });

    const ageOk =
      ctx.minAgeRequired === undefined ||
      ctx.ageVerified === true ||
      ctx.ageVerified === undefined; // future-ready: pass when unset
    results.push({
      ruleId: 'age',
      passed: ageOk,
      reasonCode: ageOk ? undefined : 'age_restriction',
      reasonEn: 'Age restriction not satisfied.',
      reasonAr: 'قيود العمر غير مستوفاة.',
    });

    results.push({
      ruleId: 'quality',
      passed: ctx.qualityGatePassed,
      reasonCode: ctx.qualityGatePassed ? undefined : 'quality_gate_failed',
      reasonEn: 'Capture quality gate failed — provider not called.',
      reasonAr: 'بوابة جودة الالتقاط فشلت — لم يُستدعَ المزوّد.',
    });

    const blocking = results.find((r) => !r.passed);
    if (blocking) {
      return {
        allowed: false,
        results,
        blockingRule: blocking.ruleId,
        reasonCode: blocking.reasonCode ?? `blocked_${blocking.ruleId}`,
        reasonEn: blocking.reasonEn ?? `Blocked by ${blocking.ruleId}`,
        reasonAr: blocking.reasonAr ?? `محظور بواسطة ${blocking.ruleId}`,
      };
    }

    return { allowed: true, results };
  }
}

export const defaultCapabilityPolicyEngine = new CapabilityPolicyEngine();
