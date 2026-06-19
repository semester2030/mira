import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseOccasion } from '../contracts/mira-occasion';
import {
  OutfitIntelligenceAnalysisDto,
  OutfitVisualProfileDto,
  SkinReportSnapshot,
} from '../contracts/outfit-intelligence.interface';

@Injectable()
export class LlmOutfitReasoningService {
  private readonly logger = new Logger(LlmOutfitReasoningService.name);

  constructor(private readonly config: ConfigService) {}

  async reason(
    skin: SkinReportSnapshot,
    visual: OutfitVisualProfileDto,
    occasionId: string,
  ): Promise<OutfitIntelligenceAnalysisDto> {
    const apiKey = this.config.get<string>('LLM_API_KEY')?.trim();
    const baseUrl = this.config.get<string>(
      'LLM_BASE_URL',
      'https://api.openai.com/v1',
    );
    const model = this.config.get<string>('LLM_MODEL', 'gpt-4o-mini');

    if (!apiKey) throw new Error('LLM_API_KEY not configured');

    const occasion = parseOccasion(occasionId);
    const occasionLabelAr = occasion ?? occasionId;

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are MIRA outfit intelligence. Return ONLY JSON. User-facing strings in Arabic. Integer scores 0-100.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'outfit_intelligence_reasoning',
              skin,
              visual,
              occasion: occasionId,
              occasionLabelAr,
              schema: {
                compatibilityScore: 'int',
                explanation: 'string',
                recommendations: ['string'],
                avoidColors: ['string'],
                suggestedColors: ['string'],
                suggestedAccessories: ['string'],
                suggestedMakeup: 'string',
                styleVerdict: 'string',
                confidence: 'int',
                matchReasons: ['string'],
                mismatchReasons: ['string'],
                skinCompatibilityScore: 'int',
                occasionMatchScore: 'int',
                styleBalanceScore: 'int',
                colorHarmonyScore: 'int',
              },
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM empty content');

    const parsed = JSON.parse(content) as Record<string, unknown>;
    return this.map(parsed, visual, occasionId);
  }

  private map(
    json: Record<string, unknown>,
    visual: OutfitVisualProfileDto,
    occasionId: string,
  ): OutfitIntelligenceAnalysisDto {
    const list = (key: string): string[] => {
      const v = json[key];
      return Array.isArray(v) ? v.map(String) : [];
    };

    const score = (key: string, fallback = 0): number => {
      const v = json[key];
      return typeof v === 'number' ? Math.round(Math.min(100, Math.max(0, v))) : fallback;
    };

    return {
      clothingType: visual.garmentTypeAr,
      styleType: visual.styleTypeAr,
      dominantColors: visual.dominantColors,
      compatibilityScore: score('compatibilityScore', 70),
      recommendedColors: list('suggestedColors'),
      rejectedColors: list('avoidColors'),
      suggestedAccessories: list('suggestedAccessories'),
      suggestedMakeup: String(json.suggestedMakeup ?? ''),
      explanation: String(json.explanation ?? ''),
      confidence: score('confidence', visual.confidence),
      matchReasons: list('matchReasons'),
      mismatchReasons: list('mismatchReasons'),
      recommendations: list('recommendations'),
      styleVerdict: String(json.styleVerdict ?? ''),
      detectedPieces: visual.clothingTypes,
      visionLabels: visual.labels,
      visualConfidence: visual.confidence,
      contrastLevel:
        visual.contrastLevel >= 0.72
          ? 'تباين عالٍ'
          : visual.contrastLevel >= 0.48
            ? 'تباين متوسط'
            : 'تباين منخفض',
      formalityLevel:
        visual.formalityLevel >= 0.72
          ? 'رسمي'
          : visual.formalityLevel >= 0.48
            ? 'شبه رسمي'
            : 'كاجوال',
      analysisSource: 'hybrid_llm',
      visualSource: visual.source,
      skinCompatibilityScore: score('skinCompatibilityScore'),
      occasionMatchScore: score('occasionMatchScore'),
      styleBalanceScore: score('styleBalanceScore'),
      colorHarmonyScore: score('colorHarmonyScore'),
    };
  }
}
