import { Injectable } from '@nestjs/common';

import { GarmentRecolorVisionContext } from '../qel/garment-recolor-context.types';

export type GarmentRecolorPromptInput = {
  targetColorAr: string;
  targetColorHex?: string;
  garmentLabelAr?: string;
  customPromptAr?: string;
  visionContext?: GarmentRecolorVisionContext;
  /** Appended on QEL auto-retry. */
  strictSuffixAr?: string;
};

export type GarmentRecolorPromptResult = {
  promptAr: string;
  userMessageAr: string;
  targetColorAr: string;
  targetColorHex: string;
  garmentLabelAr: string;
};

const COLOR_HEX: Record<string, string> = {
  أسود: '#1A1A1A',
  أبيض: '#F5F5F5',
  بيج: '#D2BEA0',
  كريمي: '#EBE0C8',
  رمادي: '#9E9E9E',
  كحلي: '#1A2848',
  أزرق: '#3F51B5',
  زيتوني: '#6B7040',
  ذهبي: '#C8A850',
  وردي: '#E699B0',
  أحمر: '#B42832',
  نبيتي: '#781828',
  بني: '#785032',
  فضي: '#BEBEC8',
  تركواز: '#3CAAA0',
  مرجاني: '#F07864',
  دنيم: '#5B7FA8',
};

const MATERIAL_AR: Record<string, string> = {
  silk: 'حرير',
  satin: 'ساتان',
  cotton: 'قطن',
  linen: 'كتان',
  wool: 'صوف',
  denim: 'دنيم',
  leather: 'جلد',
  chiffon: 'شيفون',
  velvet: 'مخمل',
};

@Injectable()
export class GarmentRecolorPromptService {
  build(input: GarmentRecolorPromptInput): GarmentRecolorPromptResult {
    const targetColorAr = input.targetColorAr.trim();
    if (!targetColorAr) {
      throw new Error('TARGET_COLOR_REQUIRED');
    }

    const garmentLabelAr = (input.garmentLabelAr?.trim() || 'القطعة العلوية').replace(/\s+/g, ' ');
    const targetColorHex =
      input.targetColorHex?.trim() ||
      COLOR_HEX[targetColorAr] ||
      '#888888';

    const customPrompt = input.customPromptAr?.trim();
    let promptAr =
      customPrompt && customPrompt.length > 0
        ? customPrompt
        : this.composePromptV2(garmentLabelAr, targetColorAr, targetColorHex, input.visionContext);

    if (input.strictSuffixAr?.trim()) {
      promptAr = `${promptAr}\n\n${input.strictSuffixAr.trim()}`;
    }

    const userMessageAr = `أعدنا تلوين ${garmentLabelAr} إلى ${targetColorAr} — بإطلالة طبيعية تحافظ على هويتك`;

    return {
      promptAr,
      userMessageAr,
      targetColorAr,
      targetColorHex,
      garmentLabelAr,
    };
  }

  composePromptV2(
    garmentLabelAr: string,
    targetColorAr: string,
    targetColorHex: string,
    ctx?: GarmentRecolorVisionContext,
  ): string {
    const geometryLine = this.geometryLine(ctx);
    const materialLine = this.materialLine(ctx);
    const role = ctx?.regionRole ?? 'upper';

    return [
      `أعدي تلوين ${garmentLabelAr} (${role}) في هذه الصورة إلى ${targetColorAr} (${targetColorHex}).`,
      '',
      materialLine,
      geometryLine,
      '• المطلوب: تغيير طبقة الصبغة فقط — لا تغيّري نسيج الألياف ولا سلوك القماش.',
      '• المحظور تماماً: الوجه، الشعر، البشرة، اليدين، الخلفية، الحذاء، الحقيبة، المجوهرات، وملامح الجسم.',
      '• الجودة: إخراج واقعي بأسلوب تصوير أزياء فاخر — بدون فلاتر أو تجميل للوجه.',
      `• الحواف: لون ${targetColorAr} موحّد على ${garmentLabelAr} مع حواف نظيفة عند خط الفصل مع الجلد — zero bleeding.`,
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  private geometryLine(ctx?: GarmentRecolorVisionContext): string {
    if (!ctx) return '• الهندسة: حافظي على ثنيات القماش الطبيعية وقصّة القطعة كما هي.';
    const parts: string[] = [];
    if (ctx.fit) parts.push(`قصة ${ctx.fit}`);
    if (ctx.foldDensity === 'high') {
      parts.push('كثافة ثنيات عالية في الكتف والصدر');
    } else if (ctx.foldDensity === 'medium') {
      parts.push('ثنيات طبيعية متوسطة');
    }
    if (ctx.silhouetteHint) parts.push(`silhouette: ${ctx.silhouetteHint}`);
    if (ctx.pieceCount != null && ctx.pieceCount > 0) {
      parts.push(`pieces: ${ctx.pieceCount}`);
    }
    if (!parts.length) return '• الهندسة: حافظي على ثنيات القماش الطبيعية وقصّة القطعة كما هي.';
    return `• الهندسة: حافظي على ${parts.join(' · ')} — لا تسطّحي الطيات.`;
  }

  private materialLine(ctx?: GarmentRecolorVisionContext): string {
    const conf = ctx?.materialConfidence ?? 0;
    const materialKey = ctx?.material?.trim().toLowerCase();
    const materialAr = materialKey ? (MATERIAL_AR[materialKey] ?? ctx?.material) : ctx?.textureHint;

    if (materialAr && conf >= 0.6) {
      const gloss = ctx?.glossLevel;
      if (gloss === 'glossy' || gloss === 'semi') {
        return `• الخامة: حافظي على خامة ${materialAr} اللامعة — انعكاسات الضوء الطبيعية دون مبالغة.`;
      }
      if (gloss === 'matte') {
        return `• الخامة: حافظي على خامة ${materialAr} المطفية — لا تحوّليها إلى لامع.`;
      }
      return `• الخامة: حافظي على خامة ${materialAr} ونسيجها — تغيير لون الصبغة فقط.`;
    }

    return '• الخامة: إن كان القماش لامعاً فحافظي على الانعكاسات الطبيعية؛ إن كان مطفياً فلا تزيدي اللمعان.';
  }

  /** Phase Q — stricter retry suffix. */
  static strictRetrySuffix(attempt: number): string {
    return [
      `⚠️ محاولة ${attempt} — تشديد QEL:`,
      '• لا تلمسي الوجه أو البشرة أو الشعر إطلاقاً.',
      '• لا تغيّري لمعان القماش أو خامته — تلوين الصبغة فقط.',
      '• حواف القطعة يجب أن تبقى مطابقة للأصل بدون انجراف.',
    ].join('\n');
  }
}
