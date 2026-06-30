import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeometryPayload, SemanticsPayload } from '../schema/fashion-vision-document.v1';
import { runSemanticQualityGate } from '../pipeline/semantic-quality-gate.service';
import { parseOpenAiSemanticResponse } from './openai-semantic.parser';
import { buildOpenAiSemanticsJsonSchema } from './openai-semantic.response-schema';
import { SemanticVisionInput, SemanticVisionProvider } from './semantic-vision.provider';

// ─────────────────────────────────────────────────────────────────────────────
// VISION PLATFORM — Phase 4
// OpenAI = semantic attributes only (garments, colors, layering, archetype).
// No scores · no recommendations · no occasion · no user context.
// Reference: docs/mira-vision-platform.html
// ─────────────────────────────────────────────────────────────────────────────

function buildGeometryHints(geometry?: GeometryPayload): string | null {
  if (!geometry?.segments?.length) return null;
  return JSON.stringify({
    topology: geometry.topology,
    segments: geometry.segments.map((s) => ({
      id: s.id,
      regionRole: s.regionRole,
      bbox: s.bbox,
      cropRef: s.cropRef ?? null,
    })),
  });
}

@Injectable()
export class OpenAiSemanticProvider implements SemanticVisionProvider {
  private readonly logger = new Logger(OpenAiSemanticProvider.name);

  constructor(private readonly config: ConfigService) {}

  async describe(input: SemanticVisionInput): Promise<SemanticsPayload> {
    if (!input.imageBuffer?.length) {
      throw new BadGatewayException({
        code: 'OPENAI_EMPTY_IMAGE',
        message: 'Empty image buffer',
        provider: 'openai-semantic',
      });
    }

    const apiKey = this.config.get<string>('LLM_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'OPENAI_NOT_CONFIGURED',
        message: 'LLM_API_KEY must be set on the server for semantic vision',
        provider: 'openai-semantic',
      });
    }

    const model = this.config.get<string>('LLM_MODEL', 'gpt-4o-mini');
    const configuredTemp = Number(this.config.get('LLM_TEMPERATURE') ?? 0.2);
    const temperature = Math.min(0.2, Number.isFinite(configuredTemp) ? configuredTemp : 0.2);
    const timeoutMs = Number(this.config.get('LLM_TIMEOUT_MS') ?? 45000);
    const jsonSchema = buildOpenAiSemanticsJsonSchema();

    const mime = this.detectMime(input.imageBuffer);
    const imageBase64 = input.imageBuffer.toString('base64');
    const geometryHints = buildGeometryHints(input.geometry);

    const userText = [
      'Describe visible outfit attributes using ONLY the taxonomy ids from the JSON schema.',
      'Do NOT output scores, recommendations, compatibility, luxury ratings, or Arabic explanations.',
      'Use providerConfidence 0..1 per garment/accessory based on visual certainty.',
      geometryHints
        ? `FASHN geometry hints (region roles + bboxes — use as segmentation context):\n${geometryHints}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: {
            type: 'json_schema',
            json_schema: jsonSchema,
          },
          messages: [
            {
              role: 'system',
              content:
                'You are a fashion attribute extractor for MIRA Vision Platform. ' +
                'Return ONLY JSON matching the schema. Attributes only — never scores or advice.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: userText },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mime};base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        const detail = errBody.slice(0, 800) || response.statusText;
        throw new Error(`HTTP ${response.status} ${detail}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content?.trim()) {
        throw new Error('OpenAI empty content');
      }

      const raw = JSON.parse(content) as unknown;
      const semantics = parseOpenAiSemanticResponse(raw);
      const gate = runSemanticQualityGate(raw, semantics);
      if (!gate.valid) {
        throw new BadGatewayException({
          code: 'QUALITY_GATE_REJECTED',
          message: 'OpenAI semantics failed quality gate',
          provider: 'openai-semantic',
          errors: gate.errors,
        });
      }

      return semantics;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof ServiceUnavailableException) throw error;

      this.logger.error(`OpenAI semantic request failed: ${String(error)}`);
      throw new BadGatewayException({
        code: 'VISION_PROVIDER_FAILED',
        message: 'OpenAI semantic provider failed',
        provider: 'openai-semantic',
        detail: String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private detectMime(buffer: Buffer): string {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      return 'image/jpeg';
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }
    if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    return 'image/jpeg';
  }
}
