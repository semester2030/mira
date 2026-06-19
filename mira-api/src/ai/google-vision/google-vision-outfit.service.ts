import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutfitVisualProfileDto } from '../contracts/outfit-intelligence.interface';

const COLOR_NAMES: Array<[string, number, number, number]> = [
  ['أسود', 20, 20, 20],
  ['أبيض', 245, 245, 245],
  ['بيج', 210, 190, 160],
  ['كريمي', 235, 225, 200],
  ['رمادي', 128, 128, 128],
  ['كحلي', 25, 40, 80],
  ['أزرق', 40, 80, 180],
  ['زيتوني', 100, 110, 60],
  ['ذهبي', 200, 170, 80],
  ['وردي', 230, 150, 170],
  ['أحمر', 180, 40, 50],
  ['نبيتي', 120, 20, 40],
  ['بني', 120, 80, 50],
  ['فضي', 190, 190, 200],
];

@Injectable()
export class GoogleVisionOutfitService {
  private readonly logger = new Logger(GoogleVisionOutfitService.name);

  constructor(private readonly config: ConfigService) {}

  async analyze(imageBuffer: Buffer): Promise<OutfitVisualProfileDto> {
    const apiKey = this.config.get<string>('GOOGLE_VISION_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('GOOGLE_VISION_API_KEY not configured');
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBuffer.toString('base64') },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 25 },
                { type: 'IMAGE_PROPERTIES' },
                { type: 'OBJECT_LOCALIZATION', maxResults: 20 },
                { type: 'WEB_DETECTION', maxResults: 12 },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google Vision HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      responses?: Array<Record<string, unknown>>;
    };
    const first = payload.responses?.[0];
    if (!first) throw new Error('Google Vision empty response');
    if (first.error) throw new Error(`Google Vision error: ${JSON.stringify(first.error)}`);

    return this.parse(first);
  }

  private parse(response: Record<string, unknown>): OutfitVisualProfileDto {
    const labelAnnotations =
      (response.labelAnnotations as Array<{ description?: string; score?: number }>) ?? [];
    const labels = labelAnnotations
      .map((l) => l.description ?? '')
      .filter(Boolean)
      .slice(0, 12);

    const dominantColors = this.extractColors(response);
    const objects =
      ((response.localizedObjectAnnotations as Array<{ name?: string }>) ?? [])
        .map((o) => o.name ?? '')
        .filter(Boolean);

    const clothingTypes: string[] = [];
    const accessoryTypes: string[] = [];
    const styleSignals: string[] = [];
    const textureHints: string[] = [];

    for (const label of labels) {
      const lower = label.toLowerCase();
      const ar = this.labelToArabic(label);
      if (this.isAccessory(lower)) accessoryTypes.push(ar);
      else if (this.isClothing(lower)) clothingTypes.push(ar);
      if (this.isStyle(lower)) styleSignals.push(ar);
      if (this.isTexture(lower)) textureHints.push(ar);
    }

    for (const obj of objects) {
      const ar = this.labelToArabic(obj);
      if (this.isAccessory(obj.toLowerCase())) accessoryTypes.push(ar);
      else clothingTypes.push(ar);
    }

    const formality = this.formality(styleSignals, labels);
    const contrast = dominantColors.length >= 3 ? 0.72 : 0.52;
    const avgScore =
      labelAnnotations.slice(0, 5).reduce((sum, l) => sum + (l.score ?? 0.5), 0) /
      Math.max(1, Math.min(5, labelAnnotations.length));

    return {
      labels,
      dominantColors,
      clothingTypes: [...new Set(clothingTypes)].slice(0, 6),
      accessoryTypes: [...new Set(accessoryTypes)].slice(0, 6),
      styleSignals: [...new Set(styleSignals)].slice(0, 6),
      textureHints: [...new Set(textureHints)].slice(0, 4),
      confidence: Math.round(Math.min(96, Math.max(55, avgScore * 100))),
      source: 'google_vision',
      garmentTypeAr: clothingTypes[0] ?? 'إطلالة',
      garmentTypeEn: objects[0] ?? 'Outfit',
      styleTypeAr: styleSignals[0] ?? (formality >= 0.6 ? 'كلاسيكي' : 'عصري'),
      styleTypeEn: styleSignals[0] ?? 'Style',
      contrastLevel: contrast,
      formalityLevel: formality,
    };
  }

  private extractColors(response: Record<string, unknown>): string[] {
    const props = response.imagePropertiesAnnotation as {
      dominantColors?: { colors?: Array<{ color?: { red?: number; green?: number; blue?: number } }> };
    };
    const colors = props?.dominantColors?.colors ?? [];
    return colors.slice(0, 4).map((c) => {
      const r = c.color?.red ?? 128;
      const g = c.color?.green ?? 128;
      const b = c.color?.blue ?? 128;
      return this.rgbName(r, g, b);
    });
  }

  private rgbName(r: number, g: number, b: number): string {
    let best = 'مختلط';
    let bestDist = Number.MAX_SAFE_INTEGER;
    for (const [name, cr, cg, cb] of COLOR_NAMES) {
      const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    return best;
  }

  private labelToArabic(label: string): string {
    const lower = label.toLowerCase();
    if (lower.includes('dress')) return 'فستان';
    if (lower.includes('abaya')) return 'عباءة';
    if (lower.includes('suit')) return 'بدلة';
    if (lower.includes('skirt')) return 'تنورة';
    if (lower.includes('bag')) return 'حقيبة';
    if (lower.includes('shoe')) return 'حذاء';
    if (lower.includes('formal')) return 'رسمي';
    if (lower.includes('casual')) return 'كاجوال';
    if (lower.includes('elegant')) return 'أنيق';
    return label;
  }

  private formality(styleSignals: string[], labels: string[]): number {
    const joined = [...styleSignals, ...labels].join(' ').toLowerCase();
    if (joined.includes('formal') || joined.includes('suit')) return 0.82;
    if (joined.includes('casual')) return 0.38;
    if (joined.includes('elegant') || joined.includes('classic')) return 0.68;
    return 0.55;
  }

  private isClothing(lower: string): boolean {
    return /dress|skirt|suit|clothing|fashion|abaya|shirt|pants/.test(lower);
  }

  private isAccessory(lower: string): boolean {
    return /bag|shoe|jewelry|scarf|watch/.test(lower);
  }

  private isStyle(lower: string): boolean {
    return /formal|casual|elegant|classic|modern|minimal/.test(lower);
  }

  private isTexture(lower: string): boolean {
    return /silk|denim|leather|cotton|linen/.test(lower);
  }
}
