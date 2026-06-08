import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { buildFaceMapBundle } from './face-map-engine';

describe('face-map-engine (Educational Face Map)', () => {
  const oilySkin: SkinAnalysisResult = {
    beautyScore: 68,
    skinTypeAr: 'دهنية',
    skinTypeEn: 'oily',
    hydration: 48,
    oiliness: 72,
    pores: 3,
    wrinkles: 1,
    darkSpots: 1,
    acne: 0,
    redness: 2,
    recommendationsAr: [],
    skinAge: 28,
    concernScores: { oiliness: 38, moisture: 50, pore: 45 },
  };

  it('builds educational map with low confidence for global-only YouCam', () => {
    const raw = { results: { output: [{ type: 'oiliness', ui_score: 38 }] } };
    const bundle = buildFaceMapBundle(oilySkin, raw);

    expect(bundle.spatialConfidence).toBe('none');
    expect(bundle.faceMap.enabled).toBe(false);
    expect(bundle.faceHealthMap.enabled).toBe(true);
    expect(bundle.faceHealthMap.mode).toBe('educational');
    expect(bundle.faceHealthMap.confidence).toBe('low');
    expect(bundle.faceHealthMap.confidenceLabelAr).toContain('ثقة منخفضة');
    expect(bundle.faceHealthMap.disclaimerAr).toContain('استرشادية');
  });

  it('highlights t_zone for elevated pores/oiliness without red markers', () => {
    const bundle = buildFaceMapBundle(oilySkin);
    const highlighted = bundle.faceHealthMap.zones.filter((z) => z.highlight);
    expect(highlighted.some((z) => z.id === 't_zone' || z.id === 'nose')).toBe(true);
    expect(highlighted.every((z) => z.highlightColor === '#C19EE0')).toBe(true);
    expect(highlighted.every((z) => z.source === 'educational')).toBe(true);
  });

  it('uses insight cards with «غالباً» wording — not confirmed diagnosis', () => {
    const bundle = buildFaceMapBundle(oilySkin);
    expect(bundle.faceHealthMap.insightCards.length).toBeGreaterThan(0);
    for (const card of bundle.faceHealthMap.insightCards) {
      expect(card.bodyAr).toMatch(/غالباً|شائعة|ليست تشخيصاً مؤكداً/);
      expect(card.bodyAr).not.toMatch(/تم اكتشاف|مؤكدة على وجهك/);
    }
  });

  it('returns medium confidence for regional YouCam data', () => {
    const raw = {
      results: {
        output: [{ type: 'pore', ui_score: 40, region_scores: { t_zone: 35 } }],
      },
    };
    const bundle = buildFaceMapBundle(oilySkin, raw);
    expect(bundle.faceHealthMap.confidence).toBe('medium');
    expect(bundle.faceHealthMap.mode).toBe('regional');
  });

  it('returns high confidence for mask/coordinates', () => {
    const raw = {
      results: {
        output: [{ type: 'redness', ui_score: 40, mask_url: 'https://x/m.png' }],
      },
    };
    const bundle = buildFaceMapBundle(oilySkin, raw);
    expect(bundle.faceHealthMap.confidence).toBe('high');
    expect(bundle.faceHealthMap.mode).toBe('spatial');
  });
});
