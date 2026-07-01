import { ConfigService } from '@nestjs/config';

export type FashnRunResponse = { id?: string; error?: unknown };
export type FashnStatusResponse = {
  id?: string;
  status?: string;
  output?: unknown[];
  error?: { name?: string; message?: string } | null;
};

/** Normalize Authorization value — fixes "Bearer" without trailing space on Render. */
export function buildFashnAuthHeader(
  apiKey: string,
  headerName = 'Authorization',
  headerPrefix = 'Bearer ',
): Record<string, string> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { [headerName]: '' };

  if (/^bearer\s+/i.test(trimmed)) {
    return { [headerName]: trimmed };
  }

  let prefix = (headerPrefix ?? 'Bearer ').trim();
  if (/^bearer$/i.test(prefix)) prefix = 'Bearer';
  const value = prefix.endsWith(' ') ? `${prefix}${trimmed}` : `${prefix} ${trimmed}`;
  return { [headerName]: value };
}

export function resolveFashnRunPath(config: ConfigService): string {
  const legacy = config.get<string>('FASHN_GEOMETRY_ENDPOINT', '/v1/run')?.trim() ?? '/v1/run';
  // Legacy docs used /v1/segmentation — FASHN only exposes /v1/run
  if (legacy.includes('segmentation')) return '/v1/run';
  return config.get<string>('FASHN_RUN_ENDPOINT', legacy) ?? '/v1/run';
}

export function resolveFashnStatusPath(config: ConfigService): string {
  return config.get<string>('FASHN_STATUS_ENDPOINT', '/v1/status') ?? '/v1/status';
}

export async function fashnRunPrediction(
  config: ConfigService,
  modelName: string,
  inputs: Record<string, unknown>,
): Promise<string> {
  const apiKey = config.get<string>('FASHN_API_KEY')?.trim();
  const baseUrl = config.get<string>('FASHN_BASE_URL')?.trim();
  if (!apiKey || !baseUrl) {
    throw new Error('FASHN_NOT_CONFIGURED');
  }

  const runPath = resolveFashnRunPath(config);
  const url = `${baseUrl.replace(/\/+$/, '')}/${runPath.replace(/^\/+/, '')}`;
  const headerName = config.get<string>('FASHN_API_KEY_HEADER', 'Authorization');
  const headerPrefix = config.get<string>('FASHN_API_KEY_PREFIX', 'Bearer ');
  const timeoutMs = config.get<number>('FASHN_TIMEOUT_MS', 20000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...buildFashnAuthHeader(apiKey, headerName, headerPrefix),
      },
      body: JSON.stringify({ model_name: modelName, inputs }),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as FashnRunResponse & {
      message?: string;
      error?: string;
    };

    if (response.status === 401) {
      throw new Error(
        'HTTP 401 Unauthorized — invalid FASHN_API_KEY or malformed Bearer prefix (use FASHN_API_KEY_PREFIX="Bearer " with space)',
      );
    }
    if (!response.ok) {
      const detail = body.message ?? body.error ?? response.statusText;
      throw new Error(`HTTP ${response.status} ${String(detail)}`);
    }

    const id = body.id?.trim();
    if (!id) {
      throw new Error('FASHN /v1/run did not return prediction id');
    }
    return id;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fashnPollPrediction(
  config: ConfigService,
  predictionId: string,
  options?: { pollMaxMs?: number; pollIntervalMs?: number },
): Promise<FashnStatusResponse> {
  const apiKey = config.get<string>('FASHN_API_KEY')?.trim();
  const baseUrl = config.get<string>('FASHN_BASE_URL')?.trim();
  if (!apiKey || !baseUrl) {
    throw new Error('FASHN_NOT_CONFIGURED');
  }

  const statusPath = resolveFashnStatusPath(config);
  const url = `${baseUrl.replace(/\/+$/, '')}/${statusPath.replace(/^\/+/, '')}/${predictionId}`;
  const headerName = config.get<string>('FASHN_API_KEY_HEADER', 'Authorization');
  const headerPrefix = config.get<string>('FASHN_API_KEY_PREFIX', 'Bearer ');
  const pollIntervalMs =
    options?.pollIntervalMs ?? config.get<number>('FASHN_POLL_INTERVAL_MS', 1500);
  const pollMaxMs = options?.pollMaxMs ?? config.get<number>('FASHN_POLL_MAX_MS', 45000);

  const started = Date.now();
  const inProgress = new Set(['starting', 'in_queue', 'processing']);

  while (Date.now() - started < pollMaxMs) {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildFashnAuthHeader(apiKey, headerName, headerPrefix),
    });

    const body = (await response.json().catch(() => ({}))) as FashnStatusResponse;

    if (response.status === 401) {
      throw new Error('HTTP 401 Unauthorized during FASHN status poll');
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const status = String(body.status ?? '').toLowerCase();
    if (status === 'completed') return body;
    if (status === 'failed') {
      const msg = body.error?.message ?? body.error?.name ?? 'FASHN prediction failed';
      throw new Error(String(msg));
    }
    if (inProgress.has(status) || !status) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      continue;
    }
    throw new Error(`Unexpected FASHN status: ${status || 'unknown'}`);
  }

  throw new Error('FASHN prediction timed out');
}

export function toFashnImageInput(imageBuffer: Buffer): string {
  return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

export async function resolveFashnOutputBuffer(
  output: unknown,
  authHeaders: Record<string, string>,
): Promise<Buffer> {
  if (typeof output !== 'string' || !output.trim()) {
    throw new Error('FASHN output missing');
  }

  if (output.startsWith('data:image')) {
    const comma = output.indexOf(',');
    if (comma < 0) throw new Error('Invalid FASHN base64 output');
    return Buffer.from(output.slice(comma + 1), 'base64');
  }

  if (output.startsWith('http://') || output.startsWith('https://')) {
    const response = await fetch(output, { headers: authHeaders });
    if (!response.ok) {
      throw new Error(`Failed to fetch FASHN output: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('Unsupported FASHN output format');
}
