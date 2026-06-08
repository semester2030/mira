import {
  applyChildSafetyGuard,
  filterConcernsForSafety,
} from './child-safety-guard';
import { buildAgeComparison } from './age-intelligence';

describe('child-safety-guard', () => {
  it('suppresses skin age for minors', () => {
    const birthYear = new Date().getFullYear() - 14;
    const safety = applyChildSafetyGuard({ birthYear, skinAge: 28 });
    expect(safety.isMinor).toBe(true);
    expect(safety.sanitizedSkinAge).toBeUndefined();
    expect(safety.restrictionsApplied).toContain('no_skin_age_delta');
  });

  it('filters wrinkle concerns for minors', () => {
    const birthYear = new Date().getFullYear() - 15;
    const safety = applyChildSafetyGuard({ birthYear, skinAge: 22 });
    const filtered = filterConcernsForSafety(
      [{ id: 'wrinkle' }, { id: 'moisture' }],
      safety,
    );
    expect(filtered.map((c) => c.id)).toEqual(['moisture']);
  });

  it('suppresses unrealistic skin age', () => {
    const birthYear = new Date().getFullYear() - 30;
    const safety = applyChildSafetyGuard({ birthYear, skinAge: 92 });
    expect(safety.sanitizedSkinAge).toBeUndefined();
    expect(safety.restrictionsApplied).toContain(
      'unrealistic_skin_age_suppressed',
    );
  });
});

describe('age-intelligence', () => {
  it('builds comparison when birth year provided', () => {
    const birthYear = new Date().getFullYear() - 30;
    const safety = applyChildSafetyGuard({ birthYear, skinAge: 35 });
    const comparison = buildAgeComparison({
      birthYear,
      skinAge: 35,
      safety,
      concernIds: ['moisture', 'age_spot'],
    });
    expect(comparison.enabled).toBe(true);
    expect(comparison.userAge).toBe(30);
    expect(comparison.skinAge).toBe(35);
    expect(comparison.deltaYears).toBe(5);
    expect(comparison.causesAr.length).toBeGreaterThan(0);
  });

  it('prompts for birth year when missing', () => {
    const safety = applyChildSafetyGuard({ birthYear: null, skinAge: 32 });
    const comparison = buildAgeComparison({
      birthYear: null,
      skinAge: 32,
      safety,
    });
    expect(comparison.enabled).toBe(false);
    expect(comparison.suppressedReason).toBe('missing_birth_year');
  });
});
