/**
 * FK-5 — Document legacy isClashPair as non-curated heuristic.
 */
export const LEGACY_CLASH_PAIRS: readonly (readonly [string, string])[] =
  Object.freeze([
    Object.freeze(['red', 'pink'] as const),
    Object.freeze(['orange', 'red'] as const),
    Object.freeze(['green', 'red'] as const),
  ]);

export const LEGACY_CLASH_PAIR_POLICY = Object.freeze({
  path: 'mira-api/src/fashion-intelligence/outfit/compatibility-engine.ts',
  isCuratedFashionKnowledge: false,
  isFk5Authority: false,
  notes:
    'Arbitrary engineering short list. Do not expand with color-pair bans as FK-5 knowledge. Red+yellow is intentionally not a clash pair.',
  redYellowIsClash: false,
});

export function isLegacyClashPairDocumented(
  a: string,
  b: string,
): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return LEGACY_CLASH_PAIRS.some(
    ([p, q]) => (x === p && y === q) || (x === q && y === p),
  );
}
