import {
  extractUndertoneFromYouCam,
  inferUndertoneFromScores,
  resolveUndertone,
} from './undertone-intelligence';

describe('undertone-intelligence', () => {
  it('extracts warm undertone from YouCam payload', () => {
    const raw = {
      results: {
        output: [{ type: 'skin_undertone', undertone: 'warm' }],
      },
    };
    const result = extractUndertoneFromYouCam(raw);
    expect(result?.undertoneEn).toBe('Warm');
    expect(result?.source).toBe('youcam');
  });

  it('infers warm undertone from low redness and good moisture', () => {
    const result = inferUndertoneFromScores(
      { redness: 50, moisture: 68, age_spot: 50 },
      { redness: 2, hydration: 65 },
    );
    expect(result.undertoneEn).toBe('Warm');
    expect(result.source).toBe('inferred');
  });

  it('prefers YouCam over inference', () => {
    const raw = {
      results: {
        output: [{ type: 'skin_tone', undertone: 'cool' }],
      },
    };
    const result = resolveUndertone(
      raw,
      { redness: 50, moisture: 68 },
      { redness: 2, hydration: 65 },
    );
    expect(result.undertoneEn).toBe('Cool');
    expect(result.source).toBe('youcam');
  });
});
