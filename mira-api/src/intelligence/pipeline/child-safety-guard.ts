import { ChildSafetyPayload } from '../contracts/mira-beauty-report.interface';

export const CHILD_AGE_THRESHOLD = 16;
export const MAX_REALISTIC_SKIN_AGE = 80;

export interface ChildSafetyResult {
  isMinor: boolean;
  userAge?: number;
  restrictionsApplied: string[];
  messageAr?: string;
  sanitizedSkinAge?: number;
}

export function computeUserAge(
  birthYear?: number | null,
  now = new Date(),
): number | undefined {
  if (birthYear == null) return undefined;
  const year = Math.trunc(birthYear);
  if (year < 1920 || year > now.getFullYear()) return undefined;
  return now.getFullYear() - year;
}

export function applyChildSafetyGuard(params: {
  birthYear?: number | null;
  skinAge?: number;
}): ChildSafetyResult {
  const userAge = computeUserAge(params.birthYear);
  const isMinor = userAge !== undefined && userAge < CHILD_AGE_THRESHOLD;
  const restrictions: string[] = [];
  let messageAr: string | undefined;
  let sanitizedSkinAge = params.skinAge;

  if (isMinor) {
    restrictions.push('no_wrinkle_diagnosis', 'no_skin_age_delta');
    messageAr =
      'تحليل البشرة للمراهقات يركز على العناية اللطيفة — بدون تشخيص تجاعيد أو مقارنة عمر.';
    sanitizedSkinAge = undefined;
  }

  if (
    sanitizedSkinAge !== undefined &&
    sanitizedSkinAge > MAX_REALISTIC_SKIN_AGE
  ) {
    restrictions.push('unrealistic_skin_age_suppressed');
    sanitizedSkinAge = undefined;
    messageAr =
      messageAr ??
      'تقدير عمر البشرة غير موثوق في هذه الصورة — ركزنا على ملاحظات عامة آمنة.';
  }

  return {
    isMinor,
    userAge,
    restrictionsApplied: restrictions,
    messageAr,
    sanitizedSkinAge,
  };
}

export function filterConcernsForSafety<T extends { id: string }>(
  concerns: T[],
  safety: ChildSafetyResult,
): T[] {
  if (!safety.isMinor) return concerns;
  return concerns.filter((c) => c.id !== 'wrinkle');
}

export function toChildSafetyPayload(
  safety: ChildSafetyResult,
): ChildSafetyPayload {
  return {
    isMinor: safety.isMinor,
    ageThreshold: CHILD_AGE_THRESHOLD,
    restrictionsApplied: safety.restrictionsApplied,
    messageAr: safety.messageAr,
  };
}
