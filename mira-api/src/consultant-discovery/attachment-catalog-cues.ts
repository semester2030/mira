/**
 * Extract catalog search cues from the *current* attachment bytes.
 * Prefer vision/LLM when configured; never invent a product id.
 * Brand-alone is insufficient for «نفس المنتج».
 */
import { createHash } from 'crypto';
import type { ImageKind } from './intent';

export type AttachmentCatalogCues = {
  source: 'vision' | 'embedded_text' | 'none';
  imageSha256: string;
  imageKind?: ImageKind;
  productNameAr?: string | null;
  brandAr?: string | null;
  sizeAr?: string | null;
  hairstyleAr?: string | null;
  /** True when we could not read identity — caller should ask one useful question. */
  needsClarify: boolean;
  askAr?: string | null;
};

export type VisionCompleteFn = (args: {
  system: string;
  userText: string;
  imageDataUrl: string;
}) => Promise<string>;

const SYSTEM_AR = `استخرج من صورة المنتج أو التسريحة حقول JSON فقط:
{"imageKind":"product"|"outfit"|"face"|"unknown","productNameAr":string|null,"brandAr":string|null,"sizeAr":string|null,"hairstyleAr":string|null}
لا تختلق اسمًا غير ظاهر. إذا لم تقرأ النص بوضوح اترك الحقول null.`;

/** Pull readable ASCII/Arabic runs from JPEG COM / raw bytes (test fixtures may embed labels). */
export function extractEmbeddedLabelText(bytes: Buffer): string | null {
  const text = bytes.toString('latin1');
  const markers: string[] = [];
  // JPEG COM segment: FF FE <len> <text>
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xfe) {
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len >= 2 && i + 2 + len <= bytes.length) {
        const com = bytes.subarray(i + 4, i + 2 + len).toString('utf8').trim();
        if (com.length >= 2) markers.push(com);
      }
    }
  }
  // Also scan for UTF-8-ish Mira test markers: MIRA_CUE:...
  const cue = text.match(/MIRA_CUE:([^\x00]{2,80})/);
  if (cue?.[1]) markers.push(cue[1].replace(/[^\S\n]+$/g, '').trim());
  const joined = markers.join(' ').trim();
  return joined.length >= 2 ? joined : null;
}

export function parseCueBlob(raw: string): Omit<AttachmentCatalogCues, 'source' | 'imageSha256' | 'needsClarify'> {
  const n = raw.trim();
  let imageKind: ImageKind | undefined;
  if (/تسريح|شعر|هايلايت|صبغه/.test(n)) imageKind = 'outfit';
  else if (/وجه|بشر/.test(n)) imageKind = 'face';
  else if (/مرطب|كريم|واقي|شامبو|منتج|عبوه|سيروم/.test(n) || /[A-Za-z]{2,}/.test(n)) {
    imageKind = 'unknown';
  }
  const brand =
    n.match(/(?:براند|ماركة|ماركه|علامه|علامة)\s*[:=]?\s*([^\n|]{2,40})/i)?.[1]?.trim() ||
    n.match(/\b([A-Z][A-Za-z0-9]{1,}(?:\s+[A-Z][A-Za-z0-9]+)?)\b/)?.[1] ||
    null;
  const size =
    n.match(/(\d+(?:[.,]\d+)?\s*(?:مل|ml|جرام|g|oz))/i)?.[1] ||
    n.match(/(?:حجم|size)\s*[:=]?\s*([^\n|]{1,20})/i)?.[1] ||
    null;
  const productName =
    n.match(/(?:منتج|اسم)\s*[:=]?\s*([^\n|]{2,60})/i)?.[1]?.trim() ||
    (imageKind === 'outfit' ? null : n.split(/[|,\n]/)[0]?.trim() || null);
  const hairstyle =
    imageKind === 'outfit'
      ? n.match(/(?:تسريحة|تسريح)\s*[:=]?\s*([^\n|]{2,40})/i)?.[1]?.trim() || n.trim()
      : null;
  return {
    imageKind,
    productNameAr: productName,
    brandAr: brand,
    sizeAr: size,
    hairstyleAr: hairstyle,
  };
}

export async function extractAttachmentCatalogCues(opts: {
  bytes: Buffer;
  dataUrl?: string;
  visionComplete?: VisionCompleteFn | null;
  /**
   * Test-only: allow JPEG COM / MIRA_CUE markers.
   * Production / staging paths must leave this false and use vision.
   */
  allowEmbeddedTestCues?: boolean;
}): Promise<AttachmentCatalogCues> {
  const imageSha256 = createHash('sha256').update(opts.bytes).digest('hex');
  // Never treat embedded JPEG comments as commercial identity in production.
  if (opts.allowEmbeddedTestCues) {
    const embedded = extractEmbeddedLabelText(opts.bytes);
    if (embedded) {
      const parsed = parseCueBlob(embedded);
      const hasIdentity = !!(parsed.productNameAr || parsed.hairstyleAr || parsed.brandAr);
      return {
        source: 'embedded_text',
        imageSha256,
        ...parsed,
        needsClarify: !hasIdentity,
        askAr: hasIdentity ? null : 'ما الاسم الظاهر على العبوة؟',
      };
    }
  }

  if (opts.visionComplete && opts.dataUrl) {
    try {
      const raw = await opts.visionComplete({
        system: SYSTEM_AR,
        userText: 'اقرأ النص الظاهر على الصورة إن وُجد.',
        imageDataUrl: opts.dataUrl,
      });
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) json = JSON.parse(m[0]) as Record<string, unknown>;
      }
      const productNameAr = (json.productNameAr as string) || null;
      const brandAr = (json.brandAr as string) || null;
      const sizeAr = (json.sizeAr as string) || null;
      const hairstyleAr = (json.hairstyleAr as string) || null;
      const imageKind = (json.imageKind as ImageKind) || 'unknown';
      const hasIdentity = !!(productNameAr || hairstyleAr || (brandAr && sizeAr));
      return {
        source: 'vision',
        imageSha256,
        imageKind,
        productNameAr,
        brandAr,
        sizeAr,
        hairstyleAr,
        needsClarify: !hasIdentity,
        askAr: hasIdentity
          ? null
          : imageKind === 'outfit'
            ? 'ما نوع التسريحة أو طول الشعر المطلوب؟'
            : 'ما اسم المنتج أو الحجم المكتوب على العبوة؟',
      };
    } catch {
      /* fall through */
    }
  }

  return {
    source: 'none',
    imageSha256,
    needsClarify: true,
    askAr: 'لم أقرأ هوية واضحة من الصورة — ما الاسم أو العلامة الظاهرة عليها؟',
  };
}

/** Build a JPEG with a COM segment for unit/integration fixtures (not for production uploads). */
export function jpegWithCueMarker(cueText: string): Buffer {
  // Minimal 1x1 JPEG + COM
  const base = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
    'base64',
  );
  const payload = Buffer.from(`MIRA_CUE:${cueText}`, 'utf8');
  const len = payload.length + 2;
  const com = Buffer.from([0xff, 0xfe, (len >> 8) & 0xff, len & 0xff, ...payload]);
  // Insert COM after SOI (FF D8)
  return Buffer.concat([base.subarray(0, 2), com, base.subarray(2)]);
}
