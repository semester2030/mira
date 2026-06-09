import { parseYouCamSpatial } from './youcam-spatial-parser';

describe('youcam-spatial-parser', () => {
  it('builds concern overlays from global scores in educational mode', () => {
    const parsed = parseYouCamSpatial(
      { results: { output: [{ type: 'oiliness', ui_score: 38 }] } },
      { oiliness: 38, pore: 55, moisture: 60 },
      'educational',
    );

    expect(parsed.concernOverlays.length).toBeGreaterThan(0);
    expect(parsed.defaultConcernId).toBe('oiliness');
    const oil = parsed.concernOverlays.find((o) => o.concernId === 'oiliness');
    expect(oil?.globalScore).toBe(38);
    expect(oil?.hasRegionalData).toBe(false);
    expect(Object.keys(oil?.zoneScores ?? {})).toHaveLength(0);
  });

  it('extracts regional zone scores when present', () => {
    const parsed = parseYouCamSpatial(
      {
        results: {
          output: [
            {
              type: 'pore',
              ui_score: 40,
              region_scores: { t_zone: 32, nose: 35, cheek_left: 55 },
            },
          ],
        },
      },
      { pore: 40 },
      'regional',
    );

    const pore = parsed.concernOverlays.find((o) => o.concernId === 'pore');
    expect(pore?.hasRegionalData).toBe(true);
    expect(pore?.zoneScores.t_zone).toBe(32);
    expect(pore?.zoneScores.nose).toBe(35);
    expect(pore?.highlightZoneIds).toContain('t_zone');
  });

  it('extracts spatial markers from coordinates', () => {
    const parsed = parseYouCamSpatial(
      {
        results: {
          output: [
            {
              type: 'redness',
              ui_score: 42,
              coordinates: [{ x: 0.3, y: 0.5, severity: 4 }],
            },
          ],
        },
      },
      { redness: 42 },
      'spatial',
    );

    expect(parsed.markers.length).toBe(1);
    expect(parsed.markers[0].concernId).toBe('redness');
    expect(parsed.markers[0].x).toBeCloseTo(0.3);
  });
});
