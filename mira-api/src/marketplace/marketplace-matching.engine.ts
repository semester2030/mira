/** Scores catalog items against skin concern ui_scores (0–100, higher = healthier). */

export type ConcernMap = Record<string, number>;

export function scoreProductMatch(
  concernTags: string[],
  skinTypes: string[],
  concerns: ConcernMap,
  skinTypeAr: string,
  undertoneEn?: string,
  userAge?: number,
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
  const undertoneBonus = _undertoneBonus(concernTags, undertoneEn);
  const ageBonus = _ageBonus(userAge, concernTags);
  return Math.min(
    100,
    Math.round(matchWeight / concernTags.length + skinBonus + undertoneBonus + ageBonus),
  );
}

function _undertoneBonus(concernTags: string[], undertoneEn?: string): number {
  if (!undertoneEn) return 0;
  const tone = undertoneEn.toLowerCase();
  const tags = concernTags.join(' ').toLowerCase();
  if (tone === 'warm' && (tags.includes('hydration') || tags.includes('moisture'))) {
    return 6;
  }
  if (tone === 'cool' && tags.includes('redness')) {
    return 6;
  }
  if (tone === 'warm' && tags.includes('glow')) {
    return 4;
  }
  return 0;
}

function _ageBonus(userAge?: number, concernTags: string[] = []): number {
  if (!userAge) return 0;
  const tags = concernTags.join(' ').toLowerCase();
  if (userAge < 22 && tags.includes('acne')) return 8;
  if (userAge >= 35 && tags.includes('wrinkle')) return 8;
  if (userAge >= 28 && tags.includes('age')) return 5;
  return 0;
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
