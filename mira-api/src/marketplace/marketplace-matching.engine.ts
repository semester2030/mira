/** Scores catalog items against skin concern ui_scores (0–100, higher = healthier). */

export type ConcernMap = Record<string, number>;

export function scoreProductMatch(
  concernTags: string[],
  skinTypes: string[],
  concerns: ConcernMap,
  skinTypeAr: string,
): number {
  if (concernTags.length === 0) return 50;

  let needWeight = 0;
  let matchWeight = 0;

  for (const tag of concernTags) {
    const ui = concerns[tag];
    if (ui == null) continue;
    const need = 100 - ui;
    if (need < 15) continue;
    needWeight += need;
    matchWeight += need;
  }

  if (needWeight === 0) return 40;

  const skinBonus = _skinTypeBonus(skinTypes, skinTypeAr);
  return Math.min(100, Math.round(matchWeight / concernTags.length + skinBonus));
}

function _skinTypeBonus(skinTypes: string[], skinTypeAr: string): number {
  if (skinTypes.length === 0) return 0;
  const normalized = skinTypeAr.trim();
  const map: Record<string, string> = {
    دهنية: 'oily',
    جافة: 'dry',
    مختلطة: 'combination',
    عادية: 'normal',
  };
  const key = map[normalized] ?? '';
  if (key && skinTypes.includes(key)) return 12;
  if (skinTypes.includes('all')) return 8;
  return 0;
}

export function scoreServiceMatch(
  concernTags: string[],
  concerns: ConcernMap,
): number {
  return scoreProductMatch(concernTags, [], concerns, '');
}
