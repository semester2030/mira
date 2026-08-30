import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolvePerfectCorpConfig } from '../config/perfect-corp.config';
import { SkinAnalysisResult } from '../contracts/skin-analysis-result.interface';
import { resolveUndertone } from '../../intelligence/pipeline/undertone-intelligence';

/** YouCam S2S v2.0 — multipart file upload → task → poll (server-side only). */

export type YouCamConcern = {
  type: string;
  ui_score?: number;
  raw_score?: number;
};

export const REQUIRED_YOUCAM_CONCERNS = [
  'wrinkle',
  'pore',
  'texture',
  'acne',
  'moisture',
  'oiliness',
  'redness',
  'age_spot',
] as const;

@Injectable()
export class PerfectCorpService {
  private readonly logger = new Logger(PerfectCorpService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return resolvePerfectCorpConfig(this.config).apiKey.length > 0;
  }

  /** Analyze skin via YouCam; image stays in memory on this server only. */
  async analyzeSkin(imageBytes: Buffer): Promise<{
    result: SkinAnalysisResult;
    rawYouCam: Record<string, unknown>;
  }> {
    const { apiKey, baseUrl } = resolvePerfectCorpConfig(this.config);
    if (!apiKey) {
      throw new Error('Perfect Corp API key is not configured on the server');
    }

    const fileId = await this.uploadImage(baseUrl, apiKey, imageBytes);
    const taskId = await this.createSkinTask(baseUrl, apiKey, fileId);
    const { concerns, rawData } = await this.pollUntilDone(baseUrl, apiKey, taskId);
    const result = this.mapYouCamResults(concerns, rawData);
    this.logger.log(
      `YouCam skin analysis OK (task=${taskId.slice(0, 12)}…, concerns=${concerns.length})`,
    );
    return { result, rawYouCam: rawData };
  }

  private authHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async uploadImage(
    baseUrl: string,
    apiKey: string,
    imageBytes: Buffer,
  ): Promise<string> {
    const { contentType, fileName } = detectImageMeta(imageBytes);

    const initRes = await fetch(`${baseUrl}/file/skin-analysis`, {
      method: 'POST',
      headers: this.authHeaders(apiKey),
      body: JSON.stringify({
        files: [
          {
            content_type: contentType,
            file_name: fileName,
            file_size: imageBytes.length,
          },
        ],
      }),
    });

    const initJson = (await initRes.json()) as Record<string, unknown>;
    if (!initRes.ok) {
      throw new Error(
        `File API ${initRes.status}: ${JSON.stringify(initJson).slice(0, 300)}`,
      );
    }

    const fileEntry = extractFirstFile(initJson);
    const fileId = fileEntry?.file_id;
    const uploadRequest = fileEntry?.requests?.[0];
    if (!fileId || !uploadRequest?.url) {
      throw new Error('File API response missing file_id or upload URL');
    }

    const putHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(imageBytes.length),
    };
    if (uploadRequest.headers) {
      for (const [key, value] of Object.entries(uploadRequest.headers)) {
        if (typeof value === 'string') putHeaders[key] = value;
      }
    }

    const putRes = await fetch(uploadRequest.url, {
      method: uploadRequest.method || 'PUT',
      headers: putHeaders,
      body: new Uint8Array(imageBytes),
    });

    if (!putRes.ok) {
      throw new Error(
        `S3 upload ${putRes.status}: ${(await putRes.text()).slice(0, 200)}`,
      );
    }

    return fileId;
  }

  private async createSkinTask(
    baseUrl: string,
    apiKey: string,
    fileId: string,
  ): Promise<string> {
    const { dstActions } = resolvePerfectCorpConfig(this.config);

    const res = await fetch(`${baseUrl}/task/skin-analysis`, {
      method: 'POST',
      headers: this.authHeaders(apiKey),
      body: JSON.stringify({
        src_file_id: fileId,
        dst_actions: dstActions,
        format: 'json',
      }),
    });

    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `Task create ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
      );
    }

    const taskId = extractTaskId(json);
    if (!taskId) {
      throw new Error('Task API response missing task_id');
    }
    return taskId;
  }

  private async pollUntilDone(
    baseUrl: string,
    apiKey: string,
    taskId: string,
  ): Promise<{ concerns: YouCamConcern[]; rawData: Record<string, unknown> }> {
    const { pollIntervalMs: intervalMs, pollMaxMs: maxMs } =
      resolvePerfectCorpConfig(this.config);
    const deadline = Date.now() + maxMs;

    while (Date.now() < deadline) {
      const res = await fetch(
        `${baseUrl}/task/skin-analysis/${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: this.authHeaders(apiKey),
        },
      );

      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          `Task poll ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
        );
      }

      const data = asRecord(json.data) ?? json;
      const status = String(
        data.task_status ?? data.taskStatus ?? '',
      ).toLowerCase();

      if (status === 'success') {
        return { concerns: extractConcerns(data), rawData: data };
      }
      if (status === 'error') {
        throw new Error(
          `YouCam task error: ${JSON.stringify(data.error ?? data).slice(0, 300)}`,
        );
      }

      await sleep(intervalMs);
    }

    throw new Error(`YouCam task timed out after ${maxMs}ms`);
  }

  mapYouCamResults(
    concerns: YouCamConcern[],
    rawData?: Record<string, unknown>,
  ): SkinAnalysisResult {
    const byType = new Map<string, number>();
    for (const item of concerns) {
      if (
        typeof item.ui_score === 'number' &&
        Number.isFinite(item.ui_score) &&
        item.ui_score >= 0 &&
        item.ui_score <= 100
      ) {
        byType.set(item.type.toLowerCase(), item.ui_score);
      }
    }

    const missing = REQUIRED_YOUCAM_CONCERNS.filter(
      (type) => !byType.has(type),
    );
    if (missing.length > 0) {
      throw new Error(
        `YouCam incomplete result: missing or invalid ui_score for ${missing.join(',')}`,
      );
    }

    const beautyScore = average(
      [...byType.values()].filter((v) => Number.isFinite(v)),
    );

    const score = (type: (typeof REQUIRED_YOUCAM_CONCERNS)[number]) =>
      byType.get(type)!;

    const hydration = score('moisture');
    const oiliness = score('oiliness');
    const pores = severityFromUi(score('pore'));
    const wrinkles = severityFromUi(score('wrinkle'));
    const acne = severityFromUi(score('acne'));
    const darkSpots = severityFromUi(score('age_spot'));
    const redness = severityFromUi(score('redness'));

    const { skinTypeAr, skinTypeEn } = inferSkinType(hydration, oiliness);

    const recommendationsAr = buildRecommendationsAr({
      hydration,
      oiliness,
      pores,
      wrinkles,
      acne,
      darkSpots,
      redness,
    });

    const concernScores: Record<string, number> = {};
    for (const [type, value] of byType.entries()) {
      concernScores[normalizeConcernId(type)] = Math.round(value);
    }

    const skinAge = estimateSkinAge(concernScores);
    const undertone = resolveUndertone(rawData ?? {}, concernScores, {
      redness,
      hydration,
    });

    return {
      beautyScore: Math.round(beautyScore),
      skinTypeAr,
      skinTypeEn,
      hydration: Math.round(hydration),
      oiliness: Math.round(oiliness),
      pores,
      wrinkles,
      acne,
      darkSpots,
      redness,
      undertoneAr: undertone.undertoneAr,
      undertoneEn: undertone.undertoneEn,
      skinToneAr: undertone.skinToneAr,
      skinToneEn: undertone.skinToneEn,
      recommendationsAr,
      recommendationsEn: recommendationsAr.map((ar) =>
        translateRecommendationStub(ar),
      ),
      concernScores,
      skinAge,
    };
  }
}

function detectImageMeta(bytes: Buffer): {
  contentType: string;
  fileName: string;
} {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return { contentType: 'image/jpeg', fileName: 'mira_skin.jpg' };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { contentType: 'image/png', fileName: 'mira_skin.png' };
  }
  return { contentType: 'image/jpeg', fileName: 'mira_skin.jpg' };
}

function extractFirstFile(json: Record<string, unknown>): {
  file_id?: string;
  requests?: Array<{
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  }>;
} | null {
  const data = asRecord(json.data);
  const files = data?.files;
  if (!Array.isArray(files) || files.length === 0) return null;
  const first = asRecord(files[0]);
  if (!first) return null;
  return {
    file_id: typeof first.file_id === 'string' ? first.file_id : undefined,
    requests: Array.isArray(first.requests)
      ? first.requests.map((r) => {
          const req = asRecord(r);
          return {
            method: typeof req?.method === 'string' ? req.method : 'PUT',
            url: typeof req?.url === 'string' ? req.url : undefined,
            headers:
              req?.headers && typeof req.headers === 'object'
                ? (req.headers as Record<string, string>)
                : undefined,
          };
        })
      : undefined,
  };
}

function extractTaskId(json: Record<string, unknown>): string | null {
  const data = asRecord(json.data);
  const id = data?.task_id ?? data?.taskId ?? json.task_id;
  return typeof id === 'string' ? id : null;
}

function extractConcerns(data: Record<string, unknown>): YouCamConcern[] {
  const results = asRecord(data.results);
  const output = results?.output;
  if (!Array.isArray(output)) return [];

  const concerns: YouCamConcern[] = [];
  for (const item of output) {
    const row = asRecord(item);
    if (!row || typeof row.type !== 'string') continue;
    concerns.push({
      type: row.type,
      ui_score: typeof row.ui_score === 'number' ? row.ui_score : undefined,
      raw_score: typeof row.raw_score === 'number' ? row.raw_score : undefined,
    });
  }
  return concerns;
}

function severityFromUi(uiScore: number): number {
  const inverted = 100 - clamp(uiScore, 0, 100);
  return Math.min(5, Math.max(0, Math.round(inverted / 20)));
}

function inferSkinType(
  hydration: number,
  oiliness: number,
): { skinTypeAr: string; skinTypeEn: string } {
  if (oiliness >= 65 && hydration < 50) {
    return { skinTypeAr: 'دهنية', skinTypeEn: 'Oily' };
  }
  if (hydration < 45 && oiliness < 45) {
    return { skinTypeAr: 'جافة', skinTypeEn: 'Dry' };
  }
  if (oiliness >= 55 && hydration >= 45) {
    return { skinTypeAr: 'مختلطة', skinTypeEn: 'Combination' };
  }
  return { skinTypeAr: 'عادية', skinTypeEn: 'Normal' };
}

function buildRecommendationsAr(metrics: {
  hydration: number;
  oiliness: number;
  pores: number;
  wrinkles: number;
  acne: number;
  darkSpots: number;
  redness: number;
}): string[] {
  const tips: string[] = ['روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.'];
  if (metrics.hydration < 55) {
    tips.push('زيدي الترطيب بسيروم أو كريم يحتوي على حمض الهيالورونيك.');
  }
  if (metrics.oiliness >= 65) {
    tips.push('استخدمي منظفًا خفيفًا غير كوميدوجينيك ومنتجات oil-free.');
  }
  if (metrics.pores >= 3) {
    tips.push('مقشر BHA (ساليسيليك) 1–2 مرات أسبوعيًا يساعد على المسام.');
  }
  if (metrics.acne >= 3) {
    tips.push('للحبوب الخفيفة: نياسيناميد أو BPO بتركيز منخفض بعد استشارة.');
  }
  if (metrics.wrinkles >= 3) {
    tips.push('واقي الشمس يوميًا أساسي؛ ريتينويد ليلي يساعد على الخطوط عند التحمل.');
  }
  if (metrics.darkSpots >= 3) {
    tips.push('فيتامين C صباحًا قد يساعد على توحيد لون البشرة تدريجيًا.');
  }
  if (metrics.redness >= 3) {
    tips.push('تجنبي الحرارة والمنتجات القاسية؛ مرطبات مهدئة للاحمرار.');
  }
  return tips.slice(0, 5);
}

function translateRecommendationStub(ar: string): string {
  const map: Record<string, string> = {
    'روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.':
      'Daily routine: gentle cleanse, moisturize, and sunscreen.',
    'زيدي الترطيب بسيروم أو كريم يحتوي على حمض الهيالورونيك.':
      'Boost hydration with hyaluronic acid serum or cream.',
    'استخدمي منظفًا خفيفًا غير كوميدوجينيك ومنتجات oil-free.':
      'Use a light non-comedogenic cleanser and oil-free products.',
    'مقشر BHA (ساليسيليك) 1–2 مرات أسبوعيًا يساعد على المسام.':
      'BHA exfoliant 1–2× weekly can help pores.',
    'للحبوب الخفيفة: نياسيناميد أو BPO بتركيز منخفض بعد استشارة.':
      'For mild acne: low-strength niacinamide or BPO after consultation.',
    'واقي الشمس يوميًا أساسي؛ ريتينويد ليلي يساعد على الخطوط عند التحمل.':
      'Daily SPF is essential; nighttime retinoid may help fine lines.',
    'فيتامين C صباحًا قد يساعد على توحيد لون البشرة تدريجيًا.':
      'Morning vitamin C may gradually even skin tone.',
    'تجنبي الحرارة والمنتجات القاسية؛ مرطبات مهدئة للاحمرار.':
      'Avoid heat and harsh products; soothing moisturizers for redness.',
  };
  return map[ar] ?? ar;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function average(values: number[]): number {
  if (values.length === 0) {
    throw new Error('YouCam incomplete result: no measurable ui_score values');
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeConcernId(type: string): string {
  const t = type.toLowerCase();
  if (t === 'dark_circle' || t === 'dark_circle_v2') return 'dark_circle';
  if (t === 'age_spot') return 'age_spot';
  return t;
}

function estimateSkinAge(scores: Record<string, number>): number {
  const values = Object.values(scores).filter((v) => Number.isFinite(v));
  if (values.length === 0) {
    throw new Error('YouCam incomplete result: cannot estimate skin age');
  }
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(28 + (100 - avg) / 4);
}
