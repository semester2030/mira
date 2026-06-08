export type UndertoneSource = 'youcam' | 'inferred';

export interface ResolvedUndertone {
  undertoneAr: string;
  undertoneEn: 'Warm' | 'Cool' | 'Neutral';
  skinToneAr: string;
  skinToneEn: 'Light' | 'Medium' | 'Deep';
  source: UndertoneSource;
}

/** Extract undertone from YouCam raw task payload when present. */
export function extractUndertoneFromYouCam(raw: unknown): ResolvedUndertone | null {
  const data = asRecord(raw);
  const results = asRecord(data?.results);
  const output = Array.isArray(results?.output) ? results!.output : [];

  for (const item of output) {
    const row = asRecord(item);
    if (!row) continue;
    const type = String(row.type ?? row.action ?? '').toLowerCase();

    if (type.includes('undertone') || type.includes('skin_tone') || type.includes('skintone')) {
      const parsed = parseUndertoneValue(row);
      if (parsed) {
        return {
          ...parsed,
          skinToneAr: parseSkinToneAr(row) ?? 'متوسط',
          skinToneEn: parseSkinToneEn(row) ?? 'Medium',
          source: 'youcam',
        };
      }
    }

    if (row.undertone != null || row.skin_tone != null) {
      const parsed = parseUndertoneValue(row);
      if (parsed) {
        return {
          ...parsed,
          skinToneAr: parseSkinToneAr(row) ?? 'متوسط',
          skinToneEn: parseSkinToneEn(row) ?? 'Medium',
          source: 'youcam',
        };
      }
    }
  }

  return null;
}

/** Infer undertone from concern scores when YouCam has no undertone action. */
export function inferUndertoneFromScores(
  concernScores: Record<string, number>,
  metrics: { redness: number; hydration: number },
): ResolvedUndertone {
  const rednessUi = concernScores.redness ?? 100 - metrics.redness * 20;
  const moistureUi = concernScores.moisture ?? metrics.hydration;
  const ageSpotUi = concernScores.age_spot ?? 75;

  let undertoneEn: ResolvedUndertone['undertoneEn'] = 'Neutral';
  if (rednessUi < 58 && (moistureUi > 62 || ageSpotUi < 55)) {
    undertoneEn = 'Warm';
  } else if (rednessUi > 72 && moistureUi > 58) {
    undertoneEn = 'Cool';
  }

  const avg = average(Object.values(concernScores).filter(Number.isFinite));
  const skinToneEn: ResolvedUndertone['skinToneEn'] =
    avg >= 78 ? 'Light' : avg >= 62 ? 'Medium' : 'Deep';

  return {
    undertoneAr: undertoneLabelAr(undertoneEn),
    undertoneEn,
    skinToneAr: skinToneLabelAr(skinToneEn),
    skinToneEn,
    source: 'inferred',
  };
}

export function resolveUndertone(
  rawYouCam: unknown,
  concernScores: Record<string, number>,
  metrics: { redness: number; hydration: number },
): ResolvedUndertone {
  return (
    extractUndertoneFromYouCam(rawYouCam) ??
    inferUndertoneFromScores(concernScores, metrics)
  );
}

function parseUndertoneValue(row: Record<string, unknown>): Pick<
  ResolvedUndertone,
  'undertoneAr' | 'undertoneEn'
> | null {
  const raw =
    row.undertone ??
    row.skin_tone ??
    row.value ??
    row.result ??
    row.ui_score;
  const text = String(raw ?? '').toLowerCase();

  if (/warm|golden|yellow|داف/i.test(text)) {
    return { undertoneAr: 'دافئ', undertoneEn: 'Warm' };
  }
  if (/cool|pink|blue|بارد/i.test(text)) {
    return { undertoneAr: 'بارد', undertoneEn: 'Cool' };
  }
  if (/neutral|neutral|محا/i.test(text)) {
    return { undertoneAr: 'محايد', undertoneEn: 'Neutral' };
  }
  return null;
}

function parseSkinToneAr(row: Record<string, unknown>): string | null {
  const depth = String(row.depth ?? row.tone_level ?? '').toLowerCase();
  if (/light|fair|فاتح/i.test(depth)) return 'فاتح';
  if (/deep|dark|داكن/i.test(depth)) return 'داكن';
  if (/medium|متوسط/i.test(depth)) return 'متوسط';
  return null;
}

function parseSkinToneEn(row: Record<string, unknown>): ResolvedUndertone['skinToneEn'] | null {
  const depth = String(row.depth ?? row.tone_level ?? '').toLowerCase();
  if (/light|fair|فاتح/i.test(depth)) return 'Light';
  if (/deep|dark|داكن/i.test(depth)) return 'Deep';
  if (/medium|متوسط/i.test(depth)) return 'Medium';
  return null;
}

function undertoneLabelAr(en: ResolvedUndertone['undertoneEn']): string {
  switch (en) {
    case 'Warm':
      return 'دافئ';
    case 'Cool':
      return 'بارد';
    default:
      return 'محايد';
  }
}

function skinToneLabelAr(en: ResolvedUndertone['skinToneEn']): string {
  switch (en) {
    case 'Light':
      return 'فاتح';
    case 'Deep':
      return 'داكن';
    default:
      return 'متوسط';
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 70;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
