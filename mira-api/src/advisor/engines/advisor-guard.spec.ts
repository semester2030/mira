import { checkAdvisorGuard } from './advisor-guard';

describe('advisor-guard', () => {
  it('blocks medical diagnosis requests', () => {
    const result = checkAdvisorGuard('أريد تشخيص طبي لحبوبي');
    expect(result.blocked).toBe(true);
    expect(result.safeReply).toContain('طبيبة جلدية');
  });

  it('allows skincare questions', () => {
    const result = checkAdvisorGuard('هل أحتاج سيروم؟');
    expect(result.blocked).toBe(false);
  });
});
