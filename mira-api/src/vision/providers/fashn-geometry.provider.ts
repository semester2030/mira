import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeometryPayload } from '../schema/fashion-vision-document.v1';
import { runGeometryQualityGate } from '../pipeline/geometry-quality-gate.service';
import { GeometryVisionProvider } from './geometry-vision.provider';
import { parseFashnGeometryResponse } from './fashn-geometry.parser';

// ─────────────────────────────────────────────────────────────────────────────
// VISION PLATFORM — Phase 3
// FASHN = geometry only (mask, polygon, bbox, crop, topology).
// No occasion · no user · no scores · no recommendations.
// Reference: docs/mira-vision-platform.html
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FashnGeometryProvider implements GeometryVisionProvider {
  private readonly logger = new Logger(FashnGeometryProvider.name);

  constructor(private readonly config: ConfigService) {}

  async segment(imageBuffer: Buffer): Promise<GeometryPayload> {
    if (!imageBuffer.length) {
      throw new BadGatewayException({
        code: 'FASHN_EMPTY_IMAGE',
        message: 'Empty image buffer',
        provider: 'fashn-geometry',
      });
    }

    const apiKey = this.config.get<string>('FASHN_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('FASHN_BASE_URL')?.trim();
    if (!apiKey || !baseUrl) {
      throw new ServiceUnavailableException({
        code: 'FASHN_NOT_CONFIGURED',
        message: 'FASHN_API_KEY and FASHN_BASE_URL must be set on the server',
        provider: 'fashn-geometry',
      });
    }

    const endpoint = this.config.get<string>(
      'FASHN_GEOMETRY_ENDPOINT',
      '/v1/segmentation',
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
          imageBase64: imageBuffer.toString('base64'),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const raw = (await response.json()) as unknown;
      const geometry = parseFashnGeometryResponse(raw);
      const gate = runGeometryQualityGate(raw, geometry);
      if (!gate.valid) {
        throw new BadGatewayException({
          code: 'QUALITY_GATE_REJECTED',
          message: 'FASHN geometry failed quality gate',
          provider: 'fashn-geometry',
          errors: gate.errors,
        });
      }

      return geometry;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof ServiceUnavailableException) throw error;

      this.logger.error(`FASHN geometry request failed: ${String(error)}`);
      throw new BadGatewayException({
        code: 'VISION_PROVIDER_FAILED',
        message: 'FASHN geometry provider failed',
        provider: 'fashn-geometry',
        detail: String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
