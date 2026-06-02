import { ConfigService } from '@nestjs/config';

/** Official YouCam S2S v2.0 base (from Perfect Corp console / docs). */
export const PERFECT_CORP_DEFAULT_BASE_URL =
  'https://yce-api-01.makeupar.com/s2s/v2.0';

export const PERFECT_CORP_DEFAULT_DST_ACTIONS = [
  'wrinkle',
  'pore',
  'texture',
  'acne',
  'moisture',
  'oiliness',
  'redness',
  'age_spot',
];

export type PerfectCorpRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  dstActions: string[];
  pollIntervalMs: number;
  pollMaxMs: number;
};

/**
 * Accepts Render-style names (PERFECT_API_KEY) and legacy PERFECT_CORP_*.
 * Keys never leave the server — not used in Flutter.
 */
export function resolvePerfectCorpConfig(
  config: ConfigService,
): PerfectCorpRuntimeConfig {
  const apiKey = (
    config.get<string>('PERFECT_API_KEY') ??
    config.get<string>('PERFECT_CORP_API_KEY') ??
    ''
  ).trim();

  const baseUrl = normalizeBaseUrl(
    config.get<string>('PERFECT_BASE_URL') ??
      config.get<string>('PERFECT_CORP_BASE_URL') ??
      PERFECT_CORP_DEFAULT_BASE_URL,
  );

  const dstActions = (
    config.get<string>('PERFECT_CORP_DST_ACTIONS') ??
    PERFECT_CORP_DEFAULT_DST_ACTIONS.join(',')
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    apiKey,
    baseUrl,
    dstActions,
    pollIntervalMs: config.get<number>('PERFECT_CORP_POLL_INTERVAL_MS', 1500),
    pollMaxMs: config.get<number>('PERFECT_CORP_POLL_MAX_MS', 90000),
  };
}

/** Ensures Render/console values like `yce-api-01.makeupar.com/...` still work. */
function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (!url) return PERFECT_CORP_DEFAULT_BASE_URL;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}
