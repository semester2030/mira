import { ConfigWizardStep } from './types';

/**
 * Configuration wizard — architecture only (no UI).
 * Law #20: Provider activation is configuration, not coding.
 */
export const PROVIDER_CONFIGURATION_WIZARD: ConfigWizardStep[] = [
  {
    id: 'choose_provider',
    titleEn: 'Choose Provider',
    titleAr: 'اختر المزوّد',
    requiresPass: true,
  },
  {
    id: 'verify_license',
    titleEn: 'Verify License',
    titleAr: 'تحقّق من الترخيص',
    requiresPass: true,
  },
  {
    id: 'verify_capabilities',
    titleEn: 'Verify Capabilities',
    titleAr: 'تحقّق من القدرات',
    requiresPass: true,
  },
  {
    id: 'configure_keys',
    titleEn: 'Configure Keys (env only)',
    titleAr: 'تهيئة المفاتيح (بيئة فقط)',
    requiresPass: true,
  },
  {
    id: 'health_check',
    titleEn: 'Health Check',
    titleAr: 'فحص الصحة',
    requiresPass: true,
  },
  {
    id: 'activate',
    titleEn: 'Activate',
    titleAr: 'تفعيل',
    requiresPass: true,
  },
  {
    id: 'smoke_test',
    titleEn: 'Smoke Test',
    titleAr: 'اختبار دخان',
    requiresPass: true,
  },
  {
    id: 'ready',
    titleEn: 'Ready',
    titleAr: 'جاهز',
    requiresPass: true,
  },
];
