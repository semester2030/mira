import { detectSpatialCapability } from './spatial-spike';

describe('spatial-spike (Phase 5a gate)', () => {
  it('returns 5b-fallback for global-only YouCam output', () => {
    const raw = {
      results: {
        output: [
          { type: 'oiliness', ui_score: 42 },
          { type: 'moisture', ui_score: 55 },
        ],
      },
    };

    const result = detectSpatialCapability(raw);
    expect(result.verdict).toBe('5b-fallback');
    expect(result.spatialConfidence).toBe('none');
    expect(result.hasRegionalScores).toBe(false);
    expect(result.hasMaskOrCoordinates).toBe(false);
  });

  it('returns 5b-true-regional when regional scores exist', () => {
    const raw = {
      results: {
        output: [{ type: 'oiliness', ui_score: 42, region_scores: { t_zone: 38 } }],
      },
    };

    const result = detectSpatialCapability(raw);
    expect(result.verdict).toBe('5b-true-regional');
    expect(result.spatialConfidence).toBe('regional');
  });

  it('returns 5b-true-pixel when mask/coordinates exist', () => {
    const raw = {
      results: {
        output: [{ type: 'pore', ui_score: 40, mask_url: 'https://example.com/m.png' }],
      },
    };

    const result = detectSpatialCapability(raw);
    expect(result.verdict).toBe('5b-true-pixel');
    expect(result.spatialConfidence).toBe('pixel');
    expect(result.hasMaskOrCoordinates).toBe(true);
  });
});
