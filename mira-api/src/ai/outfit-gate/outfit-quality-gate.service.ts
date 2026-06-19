import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const MIN_EDGE_PX = 480;
const MAX_EDGE_PX = 8000;
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_ASPECT_RATIO = 2.8;

const MESSAGES = {
  empty: 'لم نستلم صورة — أعيدي رفع الإطلالة.',
  invalidImage: 'تعذر قراءة الصورة — جرّبي JPG أو PNG واضح.',
  tooSmall:
    'الصورة صغيرة جداً — التقطي إطلالة كاملة بإضاءة جيدة (480px على الأقل).',
  tooLarge: 'حجم الصورة كبير — استخدمي صورة أخف.',
  extremeAspect:
    'نسبة الصورة غير مناسبة — التقطي الإطلالة بشكل أوضح في الإطار.',
};

@Injectable()
export class OutfitQualityGateService {
  async assertAnalyzableOutfit(imageBuffer: Buffer): Promise<{
    lightingQuality: number;
    framingQuality: number;
    blurAmount: number;
  }> {
    if (!imageBuffer?.length) {
      throw new BadRequestException(MESSAGES.empty);
    }

    if (imageBuffer.length > MAX_BYTES) {
      throw new BadRequestException(MESSAGES.tooLarge);
    }

    let meta: sharp.Metadata;
    let stats: sharp.Stats | undefined;
    try {
      const pipeline = sharp(imageBuffer, { failOn: 'none' }).rotate();
      meta = await pipeline.metadata();
      stats = await pipeline.stats();
    } catch {
      throw new BadRequestException(MESSAGES.invalidImage);
    }

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < MIN_EDGE_PX || height < MIN_EDGE_PX) {
      throw new BadRequestException(MESSAGES.tooSmall);
    }

    if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
      throw new BadRequestException(MESSAGES.tooLarge);
    }

    const shortEdge = Math.min(width, height);
    const longEdge = Math.max(width, height);
    if (longEdge / shortEdge > MAX_ASPECT_RATIO) {
      throw new BadRequestException(MESSAGES.extremeAspect);
    }

    const lightingQuality = this.estimateLighting(stats);
    const framingQuality = this.estimateFraming(width, height);
    const blurAmount = this.estimateBlur(stats);

    return { lightingQuality, framingQuality, blurAmount };
  }

  private estimateLighting(stats?: sharp.Stats): number {
    if (!stats?.channels?.length) return 0.72;
    const avg =
      stats.channels.reduce((sum, ch) => sum + (ch.mean ?? 128), 0) /
      stats.channels.length;
    if (avg < 55) return 0.42;
    if (avg < 75) return 0.58;
    if (avg > 215) return 0.55;
    if (avg > 190) return 0.68;
    return 0.82;
  }

  private estimateFraming(width: number, height: number): number {
    const ratio = height / width;
    if (ratio >= 1.15 && ratio <= 2.1) return 0.86;
    if (ratio >= 0.95 && ratio <= 2.4) return 0.72;
    return 0.52;
  }

  private estimateBlur(stats?: sharp.Stats): number {
    if (!stats?.channels?.length) return 0.14;
    const stdev =
      stats.channels.reduce((sum, ch) => sum + (ch.stdev ?? 40), 0) /
      stats.channels.length;
    if (stdev < 18) return 0.42;
    if (stdev < 28) return 0.28;
    if (stdev < 38) return 0.16;
    return 0.08;
  }
}
