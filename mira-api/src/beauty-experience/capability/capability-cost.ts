import { BeautyCostClass } from './capability-ids';

export interface CostClassDefinition {
  id: BeautyCostClass;
  intendedUse: string;
  intendedUseAr: string;
  exampleCapabilities: string[];
}

export const COST_CLASS_DEFINITIONS: CostClassDefinition[] = [
  {
    id: 'LOW',
    intendedUse: 'Lightweight overlays; low credit burn; frequent use OK.',
    intendedUseAr: 'طبقات خفيفة؛ استهلاك منخفض؛ استخدام متكرر مقبول.',
    exampleCapabilities: ['blush'],
  },
  {
    id: 'MEDIUM',
    intendedUse: 'Standard try-on; default entitlement class.',
    intendedUseAr: 'تجربة قياسية؛ فئة الاستحقاق الافتراضية.',
    exampleCapabilities: ['lip', 'foundation', 'eyeshadow', 'contour', 'glasses'],
  },
  {
    id: 'HIGH',
    intendedUse: 'Heavier segmentation / hair color; tighter quotas.',
    intendedUseAr: 'تقسيم أثقل / لون شعر؛ حصص أضيق.',
    exampleCapabilities: ['hair_color'],
  },
  {
    id: 'VERY_HIGH',
    intendedUse: 'Full look / hair style; premium entitlement.',
    intendedUseAr: 'إطلالة كاملة / تسريحة؛ استحقاق مميز.',
    exampleCapabilities: ['hair_style', 'look'],
  },
];
