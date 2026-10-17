import assert from 'node:assert/strict';
import { MceFactExtractorService } from '../../consultation/services/mce-fact-extractor.service';
import { MiraBeautyReport } from '../contracts/mira-beauty-report.interface';
import { buildFaceMapBundle } from './face-map-engine';
import { buildProgressForecast } from './progress-engine';
import { parseYouCamSpatial, readContractUiScore } from './youcam-spatial-parser';

function overlayScore(raw: unknown, globals: Record<string, number> = {}): number | null | undefined {
  const parsed = parseYouCamSpatial(raw, globals, 'educational');
  return parsed.concernOverlays.find((row) => row.concernId === 'moisture')?.globalScore;
}

function testSpatialScores(): void {
  assert.equal(overlayScore({ results: { output: [{ type: 'moisture' }] } }), null);
  assert.equal(overlayScore({ results: { output: [{ type: 'moisture', ui_score: null }] } }), null);
  assert.equal(overlayScore({ results: { output: [{ type: 'moisture', raw_score: 72 }] } }), null);
  assert.equal(overlayScore({ results: { output: [{ type: 'moisture', ui_score: 101 }] } }), null);
  assert.equal(overlayScore({ results: { output: [{ type: 'moisture', ui_score: '72' }] } }), null);
  assert.equal(overlayScore({ results: { output: [{ type: 'moisture', ui_score: 0 }] } }), 0);
  for (const score of [40, 64, 70, 72]) {
    assert.equal(overlayScore({ results: { output: [{ type: 'moisture', ui_score: score }] } }), score);
  }
  const zoned = parseYouCamSpatial(
    { results: { output: [{ type: 'moisture', ui_score: 64 }] } },
    {},
    'regional',
  );
  const moisture = zoned.concernOverlays.find((row) => row.concernId === 'moisture');
  assert.equal(moisture?.globalScore, 64);
  assert.equal(Object.keys(moisture?.zoneScores ?? {}).length, 0);
  assert.equal(readContractUiScore(undefined), null);
}

function report(score: number | null, id = 'moisture'): MiraBeautyReport {
  return {
    overallBeautyScore: 70,
    overallScoreAvailable: true,
    skinTypeAr: 'مختلطة',
    headlineAr: 'عنوان',
    summaryAdviceAr: 'ملخص',
    tipsAr: [],
    dailyRoutine: { morning: [], evening: [] },
    confidenceLayer: { enabled: false, headlineAr: '' },
    childSafety: { isMinor: false },
    faceHealthMap: {
      enabled: true,
      confidence: 'low',
      confidenceLabelAr: '',
      mode: 'educational',
      titleAr: '',
      subtitleAr: '',
      disclaimerAr: '',
      zones: [],
      insightCards: [],
      concernOverlays: [
        {
          concernId: id,
          labelAr: 'الترطيب',
          labelEn: 'moisture',
          globalScore: score,
          severity: score == null ? null : 'moderate',
          zoneScores: {},
          highlightZoneIds: [],
          highlightColor: '#3B82F6',
          hasRegionalData: false,
        },
      ],
      defaultConcernId: id,
      markers: [],
    },
    mainConcerns: [{ id, titleAr: 'الترطيب', narrativeAr: 'وصف', severity: 'moderate' }],
  } as unknown as MiraBeautyReport;
}

function testProgressAndFacts(): void {
  const missing = buildProgressForecast([
    { id: 'a', createdAt: new Date('2026-01-01'), miraReport: report(null) },
    { id: 'b', createdAt: new Date('2026-02-01'), miraReport: report(null) },
  ]);
  assert.equal(missing.trends.some((row) => row.id === 'moisture'), false);
  assert.equal(missing.trends.find((row) => row.id === 'overall')?.currentScore, 70);

  const compared = buildProgressForecast([
    { id: 'a', createdAt: new Date('2026-01-01'), miraReport: report(40) },
    { id: 'b', createdAt: new Date('2026-02-01'), miraReport: report(64) },
  ]);
  const moisture = compared.trends.find((row) => row.id === 'moisture');
  assert.equal(moisture?.previousScore, 40);
  assert.equal(moisture?.currentScore, 64);
  const again = buildProgressForecast([
    { id: 'a', createdAt: new Date('2026-01-01'), miraReport: report(40) },
    { id: 'b', createdAt: new Date('2026-02-01'), miraReport: report(64) },
  ]);
  assert.equal(JSON.stringify(again.trends), JSON.stringify(compared.trends));

  const original = report(70);
  const before = JSON.stringify(original);
  const facts = new MceFactExtractorService().buildFactRegistry({
    schemaVersion: 1,
    skin: new MceFactExtractorService().buildSkinSummary('a1', original),
  } as never);
  assert.equal(JSON.stringify(original), before);
  const scoreFact = facts.find((fact) => fact.id === 'skin.score.moisture');
  assert.equal(scoreFact?.valueAr.includes('70'), true);
  assert.equal(scoreFact?.valueAr.includes('مؤشر تقديري من الصورة'), true);
  const absent = new MceFactExtractorService().buildFactRegistry({
    schemaVersion: 1,
    skin: new MceFactExtractorService().buildSkinSummary('a1', report(null)),
  } as never);
  assert.equal(absent.some((fact) => fact.id === 'skin.score.moisture'), false);
}

function testDarkCircleDoesNotInvent72(): void {
  const bundle = buildFaceMapBundle({
    beautyScore: 70,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    hydration: 64,
    oiliness: 40,
    pores: 1,
    wrinkles: 1,
    darkSpots: 1,
    acne: 1,
    redness: 1,
    undertoneAr: '',
    undertoneEn: '',
    skinToneAr: '',
    skinToneEn: '',
    recommendationsAr: [],
    recommendationsEn: [],
    concernScores: { moisture: 64 },
  });
  assert.equal(bundle.faceHealthMap.insightCards.some((card) => card.concernId === 'dark_circle'), false);
  const moisture = bundle.faceHealthMap.concernOverlays.find((row) => row.concernId === 'moisture');
  assert.equal(moisture?.globalScore, 64);
}

function withPore(score: unknown): MiraBeautyReport {
  const row = report(40);
  row.faceHealthMap.concernOverlays[0].globalScore = score as never;
  row.faceHealthMap.concernOverlays.push({
    concernId: 'pore',
    labelAr: 'المسام',
    labelEn: 'pore',
    globalScore: 40,
    severity: 'moderate',
    zoneScores: {},
    highlightZoneIds: [],
    highlightColor: '#A855F7',
    hasRegionalData: false,
  });
  return row;
}

function testInvalidScoresStayOutOfFactsAndProgress(): void {
  const extractor = new MceFactExtractorService();
  function pair(current: unknown) {
    const currentReport = withPore(current);
    const before = JSON.stringify(currentReport);
    const summary = extractor.buildSkinSummary('a1', currentReport);
    const facts = extractor.buildFactRegistry({ schemaVersion: 1, skin: summary } as never);
    const progress = buildProgressForecast([
      { id: 'a', createdAt: new Date('2026-01-01'), miraReport: withPore(40) },
      { id: 'b', createdAt: new Date('2026-02-01'), miraReport: currentReport },
    ]);
    assert.equal(JSON.stringify(currentReport), before);
    return { summary, facts, progress };
  }

  const high = pair(101);
  assert.equal(high.summary.concernScores.some((row) => row.score === 101), false);
  assert.equal(high.facts.some((fact) => fact.valueAr.includes('101')), false);
  assert.equal(high.progress.trends.some((row) => row.id === 'moisture'), false);
  assert.equal(JSON.stringify(high.progress).includes('61'), false);
  assert.equal(high.progress.trends.some((row) => row.id === 'pore'), true);

  const low = pair(-1);
  assert.equal(low.facts.some((fact) => fact.id === 'skin.score.moisture'), false);
  assert.equal(low.progress.trends.some((row) => row.id === 'moisture'), false);
  assert.equal(JSON.stringify(low.progress).includes('تراجع الترطيب'), false);

  for (const value of ['72', Number.NaN, Number.POSITIVE_INFINITY, null]) {
    const row = pair(value);
    assert.equal(row.facts.some((fact) => fact.id === 'skin.score.moisture'), false);
    assert.equal(row.progress.trends.some((trend) => trend.id === 'moisture'), false);
  }

  const zero = buildProgressForecast([
    { id: 'a', createdAt: new Date('2026-01-01'), miraReport: report(0) },
    { id: 'b', createdAt: new Date('2026-02-01'), miraReport: report(40) },
  ]);
  const zeroTrend = zero.trends.find((row) => row.id === 'moisture');
  assert.equal(zeroTrend?.previousScore, 0);
  assert.equal(zeroTrend?.currentScore, 40);
  assert.equal(zeroTrend?.messageAr.includes('تحسّن'), true);

  for (const score of [64, 70, 72, 100]) {
    const kept = extractor.buildSkinSummary('a1', report(score));
    assert.equal(kept.concernScores[0]?.score, score);
  }

  const stored = extractor.buildFactRegistry({
    schemaVersion: 1,
    skin: {
      analysisId: 'stored',
      beautyScore: 70,
      skinTypeAr: 'مختلطة',
      headlineAr: 'h',
      summaryAdviceAr: 's',
      mainConcerns: [],
      tipsAr: [],
      routineMorningAr: [],
      routineEveningAr: [],
      concernScores: [
        { concernId: 'moisture', labelAr: 'الترطيب', score: 101, severity: 'moderate' },
        { concernId: 'pore', labelAr: 'المسام', score: 0, severity: 'moderate' },
      ],
      isMinor: false,
    },
  } as never);
  assert.equal(stored.some((fact) => fact.id === 'skin.score.moisture'), false);
  assert.equal(stored.find((fact) => fact.id === 'skin.score.pore')?.valueAr.includes('0'), true);

  const zoned = parseYouCamSpatial(
    { results: { output: [{ type: 'moisture', ui_score: 64, cheek: 101 }] } },
    {},
    'regional',
  );
  const zones = zoned.concernOverlays.find((row) => row.concernId === 'moisture')?.zoneScores ?? {};
  assert.equal(zones.cheek_left, undefined);
  const keptZone = parseYouCamSpatial(
    { results: { output: [{ type: 'moisture', ui_score: 64, cheek: 40 }] } },
    {},
    'regional',
  );
  assert.equal(
    keptZone.concernOverlays.find((row) => row.concernId === 'moisture')?.zoneScores.cheek_left,
    40,
  );
  assert.equal(readContractUiScore(100), 100);
  assert.equal(readContractUiScore(-1), null);
}

testSpatialScores();
testProgressAndFacts();
testDarkCircleDoesNotInvent72();
testInvalidScoresStayOutOfFactsAndProgress();
console.log('score-absence: PASS');
console.log('T-SCORE-ABSENCE-B2 T-SCORE-PROGRESS-B2 T-SCORE-FACT-B2 T-SCORE-RANGE-RC2');
