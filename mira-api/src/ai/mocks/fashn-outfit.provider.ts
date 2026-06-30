import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MiraOccasion } from '../contracts/mira-occasion';
import { OutfitAnalysisResult } from '../contracts/outfit-analysis-result.interface';
import { OutfitAnalysisProvider } from '../providers/outfit-analysis.provider';
import { MockOutfitAnalysisProvider } from './mock-outfit-analysis.provider';

/**
 * Placeholder for FASHN.ai API.
 * Set FASHN_API_KEY — implement HTTP call in analyze().
 *
 * VISION PLATFORM — LEGACY (OUTFIT_PROVIDER path only).
 * Do NOT use for Vision Platform geometry — use FashnGeometryProvider (Phase 3).
 * Reference: docs/mira-vision-platform.html
 * This provider returns compatibilityScore — forbidden in new vision pipeline.
 */
@Injectable()
export class FashnOutfitProvider implements OutfitAnalysisProvider {
  private readonly logger = new Logger(FashnOutfitProvider.name);
  private readonly mock = new MockOutfitAnalysisProvider();

  constructor(private readonly config: ConfigService) {}

  async analyze(
    imageBytes: Buffer,
    occasion: MiraOccasion,
  ): Promise<OutfitAnalysisResult> {
    const apiKey = this.config.get<string>('FASHN_API_KEY');
    const baseUrl = this.config.get<string>('FASHN_BASE_URL');
    if (!apiKey?.trim() || !baseUrl?.trim()) {
      this.logger.warn('FASHN credentials/url not set — using mock outfit analysis');
      return this.mock.analyze(imageBytes, occasion);
    }

    const endpoint = this.config.get<string>(
      'FASHN_ENDPOINT',
      '/v1/outfit-analysis',
    );
    const timeoutMs = this.config.get<number>('FASHN_TIMEOUT_MS', 20000);
    const headerName = this.config.get<string>('FASHN_API_KEY_HEADER', 'Authorization');
    const headerPrefix = this.config.get<string>('FASHN_API_KEY_PREFIX', 'Bearer ');

    const url = `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [headerName]: `${headerPrefix}${apiKey}`,
        },
        body: JSON.stringify({
          imageBase64: imageBytes.toString('base64'),
          occasion,
          locale: 'ar',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const outfit = this.extractOutfit(payload);
      return this.normalizeOutfit(outfit, occasion);
    } catch (error) {
      this.logger.error(`FASHN request failed — fallback to mock: ${String(error)}`);
      return this.mock.analyze(imageBytes, occasion);
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOutfit(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const candidates = [
      payload,
      this.asRecord(payload.result),
      this.asRecord(payload.data),
      this.asRecord(this.asRecord(payload.result)?.outfit),
      this.asRecord(this.asRecord(payload.data)?.outfit),
    ].filter((v): v is Record<string, unknown> => v != null);

    for (const candidate of candidates) {
      if (
        candidate.compatibilityScore != null ||
        candidate.compatibility_score != null ||
        candidate.garmentTypeAr != null
      ) {
        return candidate;
      }
    }
    return payload;
  }

  private normalizeOutfit(
    input: Record<string, unknown>,
    occasion: MiraOccasion,
  ): OutfitAnalysisResult {
    return {
      compatibilityScore: this.pickNumber(
        input,
        ['compatibilityScore', 'compatibility_score'],
        82,
        0,
        100,
      ),
      dominantColors: this.pickStringArray(input, ['dominantColors', 'dominant_colors'], [
        'بيج',
        'أسود',
      ]),
      garmentTypeAr: this.pickString(
        input,
        ['garmentTypeAr', 'garment_type_ar'],
        'إطلالة متناسقة',
      ),
      garmentTypeEn: this.pickString(
        input,
        ['garmentTypeEn', 'garment_type_en'],
        'Coordinated outfit',
      ),
      styleCategoryAr: this.pickString(
        input,
        ['styleCategoryAr', 'style_category_ar'],
        'أنيق',
      ),
      styleCategoryEn: this.pickString(
        input,
        ['styleCategoryEn', 'style_category_en'],
        'Elegant',
      ),
      occasionSuitabilityAr: this.pickString(
        input,
        ['occasionSuitabilityAr', 'occasion_suitability_ar'],
        'مناسب للمناسبة المختارة',
      ),
      occasionSuitabilityEn: this.pickString(
        input,
        ['occasionSuitabilityEn', 'occasion_suitability_en'],
        'Suitable for the selected occasion',
      ),
      alternativeColorsAr: this.pickStringArray(
        input,
        ['alternativeColorsAr', 'alternative_colors_ar'],
        ['كحلي', 'بيج', 'عنابي'],
      ),
      alternativeColorsEn: this.pickStringArray(
        input,
        ['alternativeColorsEn', 'alternative_colors_en'],
        ['Navy', 'Beige', 'Burgundy'],
      ),
      occasion,
    };
  }

  private pickString(
    source: Record<string, unknown>,
    keys: string[],
    fallback: string,
  ): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return fallback;
  }

  private pickNumber(
    source: Record<string, unknown>,
    keys: string[],
    fallback: number,
    min: number,
    max: number,
  ): number {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.min(max, Math.max(min, value));
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return Math.min(max, Math.max(min, parsed));
        }
      }
    }
    return fallback;
  }

  private pickStringArray(
    source: Record<string, unknown>,
    keys: string[],
    fallback: string[],
  ): string[] {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        const list = value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0);
        if (list.length > 0) {
          return list;
        }
      }
    }
    return fallback;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }
}
