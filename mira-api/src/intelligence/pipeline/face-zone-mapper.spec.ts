import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { mapFaceZones } from './face-zone-mapper';

describe('face-zone-mapper (Phase 5b-fallback)', () => {
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

  it('uses narrative-only mode when YouCam is global-only', () => {
    const raw = {
      results: { output: [{ type: 'oiliness', ui_score: 38 }] },
    };
    const mapped = mapFaceZones(oilySkin, raw);

    expect(mapped.spatialConfidence).toBe('none');
    expect(mapped.faceMap.enabled).toBe(false);
    expect(mapped.faceMap.zones).toHaveLength(0);
    expect(mapped.concernZonesSection.mode).toBe('narrative_only');
    expect(mapped.concernZonesSection.enabled).toBe(true);
    expect(mapped.concernZonesSection.zones.length).toBeGreaterThan(0);
    expect(mapped.concernZonesSection.disclaimerAr).toContain('استرشادية');
    expect(mapped.faceHealthMap.enabled).toBe(true);
    expect(mapped.faceHealthMap.mode).toBe('educational');
    expect(mapped.faceHealthMap.confidence).toBe('low');
  });

  it('never enables face map markers without spatial data', () => {
    const mapped = mapFaceZones(oilySkin);
    expect(mapped.faceMap.enabled).toBe(false);
    expect(mapped.concernZonesSection.spatialConfidence).toBe('none');
  });

  it('includes oiliness insight when oiliness is low', () => {
    const mapped = mapFaceZones(oilySkin);
    const oilInsight = mapped.faceHealthMap.insightCards.find(
      (c) => c.concernId === 'oiliness',
    );
    expect(oilInsight).toBeDefined();
    expect(oilInsight?.bodyAr).toContain('غالباً');
    expect(mapped.concernZonesNarrative).toContain(oilInsight?.bodyAr);
  });
});
