import {
  PerfectHdMaskArtifact,
  PerfectHdMaskParseResult,
  PERFECT_SD_ACTIONS,
} from '../contracts/perfect-hd-mask.types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * Parse Perfect HD / Skin Analysis JSON task payload.
 * Preserves raw_score, ui_score, mask_urls, output_mask_name, subcategories.
 * Does NOT invent masks.
 */
export function parsePerfectHdMaskPayload(
  rawTaskData: unknown,
): PerfectHdMaskParseResult {
  const root = asRecord(rawTaskData) ?? {};
  const data = asRecord(root.data) ?? root;
  const results = asRecord(data.results) ?? asRecord(root.results);
  const artifacts: PerfectHdMaskArtifact[] = [];

  const output = results ? results.output : undefined;
  if (Array.isArray(output)) {
    for (const finalItem of output) {
      const row = asRecord(finalItem);
      if (!row || typeof row.type !== 'string') continue;
      pushArtifact(artifacts, {
        concernType: row.type,
        region: asString(row.region),
        rawScore: asNumber(row.raw_score),
        uiScore: asNumber(row.ui_score),
        outputMaskName: asString(row.output_mask_name),
        maskUrls: asStringArray(row.mask_urls),
      });
    }
  }

  // Nested HD score_info-style objects (when present alongside / instead of output[]).
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('hd_') && key !== 'skin_age') continue;
    if (key === 'skin_age') continue;
    collectNested(artifacts, key, value);
  }
  if (results) {
    for (const [key, value] of Object.entries(results)) {
      if (!key.startsWith('hd_')) continue;
      collectNested(artifacts, key, value);
    }
  }

  const skinAge =
    asNumber(data.skin_age) ??
    asNumber(results?.skin_age) ??
    asNumber(root.skin_age);

  const hasAnyMask = artifacts.some(
    (a) => a.maskUrls.length > 0 || !!a.outputMaskName,
  );

  return {
    artifacts: dedupeArtifacts(artifacts),
    skinAge,
    hasAnyMask,
    mixedSdHdRejected: false,
  };
}

function collectNested(
  artifacts: PerfectHdMaskArtifact[],
  concernType: string,
  value: unknown,
): void {
  const rec = asRecord(value);
  if (!rec) return;

  // Flat: { raw_score, ui_score, output_mask_name, mask_urls }
  if (
    'raw_score' in rec ||
    'ui_score' in rec ||
    'output_mask_name' in rec ||
    'mask_urls' in rec
  ) {
    pushArtifact(artifacts, {
      concernType,
      rawScore: asNumber(rec.raw_score),
      uiScore: asNumber(rec.ui_score),
      outputMaskName: asString(rec.output_mask_name),
      maskUrls: asStringArray(rec.mask_urls),
    });
    return;
  }

  // Subcategories: forehead / nose / cheek / whole / ...
  for (const [region, regionVal] of Object.entries(rec)) {
    const sub = asRecord(regionVal);
    if (!sub) continue;
    if (
      !('raw_score' in sub) &&
      !('ui_score' in sub) &&
      !('output_mask_name' in sub) &&
      !('mask_urls' in sub)
    ) {
      continue;
    }
    pushArtifact(artifacts, {
      concernType,
      region,
      rawScore: asNumber(sub.raw_score),
      uiScore: asNumber(sub.ui_score),
      outputMaskName: asString(sub.output_mask_name),
      maskUrls: asStringArray(sub.mask_urls),
    });
  }
}

function pushArtifact(
  artifacts: PerfectHdMaskArtifact[],
  partial: Omit<PerfectHdMaskArtifact, 'scoreOnly'>,
): void {
  const scoreOnly =
    partial.maskUrls.length === 0 && !partial.outputMaskName;
  artifacts.push({ ...partial, scoreOnly });
}

function dedupeArtifacts(
  artifacts: PerfectHdMaskArtifact[],
): PerfectHdMaskArtifact[] {
  const map = new Map<string, PerfectHdMaskArtifact>();
  for (const a of artifacts) {
    const key = `${a.concernType}::${a.region ?? 'root'}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, a);
      continue;
    }
    map.set(key, {
      concernType: a.concernType,
      region: a.region ?? prev.region,
      rawScore: a.rawScore ?? prev.rawScore,
      uiScore: a.uiScore ?? prev.uiScore,
      outputMaskName: a.outputMaskName ?? prev.outputMaskName,
      maskUrls:
        a.maskUrls.length > 0 ? a.maskUrls : prev.maskUrls,
      scoreOnly:
        (a.maskUrls.length === 0 && !a.outputMaskName) &&
        (prev.maskUrls.length === 0 && !prev.outputMaskName),
    });
  }
  return [...map.values()];
}

/** Reject SD+HD mixes before calling Perfect. */
export function assertHdOnlyActions(actions: string[]): void {
  const hasHd = actions.some((a) => a.startsWith('hd_'));
  const hasSd = actions.some((a) => PERFECT_SD_ACTIONS.has(a));
  if (hasHd && hasSd) {
    throw new Error('cannot mix HD and SD dst_actions');
  }
  if (!hasHd) {
    throw new Error('HD acceptance requires hd_* dst_actions only');
  }
}
