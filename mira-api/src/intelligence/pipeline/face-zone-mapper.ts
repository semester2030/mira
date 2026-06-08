import { buildFaceMapBundle } from './face-map-engine';

export { buildFaceMapBundle } from './face-map-engine';

/** @deprecated Use buildFaceMapBundle — kept for pipeline imports. */
export function mapFaceZones(
  skin: Parameters<typeof buildFaceMapBundle>[0],
  rawYouCam?: unknown,
) {
  return buildFaceMapBundle(skin, rawYouCam);
}

export function buildSafeZoneNarratives(
  skin: Parameters<typeof buildFaceMapBundle>[0],
): string[] {
  return buildFaceMapBundle(skin).concernZonesNarrative;
}
