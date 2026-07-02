import { OutfitSegmentZone } from '../contracts/outfit-segment-map.interface';

const CLOTHING = [
  'dress',
  'shirt',
  't-shirt',
  'blouse',
  'top',
  'blazer',
  'jacket',
  'coat',
  'suit',
  'pants',
  'trouser',
  'jean',
  'skirt',
  'sweater',
  'hoodie',
  'outerwear',
];

const FOOTWEAR = ['shoe', 'heel', 'boot', 'sneaker', 'footwear'];
const BAG = ['bag', 'handbag', 'purse', 'backpack', 'clutch'];
const ACCESSORY = [
  'watch',
  'sunglass',
  'glasses',
  'belt',
  'scarf',
  'hat',
  'jewelry',
  'necklace',
  'earring',
  'bracelet',
];

export const MIN_VISION_SCORE = 0.42;
export const MIN_DISPLAY_CONFIDENCE = 0.4;

export function isFashionObject(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('person') || lower.includes('human') || lower.includes('face')) {
    return false;
  }
  return (
    isClothing(lower) ||
    isFootwear(lower) ||
    isBag(lower) ||
    isAccessory(lower)
  );
}

export function isClothing(lower: string): boolean {
  return CLOTHING.some((k) => lower.includes(k));
}

export function isFootwear(lower: string): boolean {
  return FOOTWEAR.some((k) => lower.includes(k));
}

export function isBag(lower: string): boolean {
  return BAG.some((k) => lower.includes(k)) || lower.includes('حقيب');
}

export function isAccessory(lower: string): boolean {
  return (
    ACCESSORY.some((k) => lower.includes(k)) ||
    lower.includes('إكسسوار') ||
    lower.includes('ساع') ||
    lower.includes('نظار')
  );
}

export function zoneForObject(name: string, centerY: number): OutfitSegmentZone {
  const lower = name.toLowerCase();
  if (lower.includes('dress') || lower.includes('gown')) return 'upperBody';
  if (isFootwear(lower)) return 'feet';
  if (isBag(lower) || isAccessory(lower)) return 'accessories';
  if (isClothing(lower)) {
    if (centerY >= 0.52) return 'lowerBody';
    if (centerY >= 0.38) return 'waist';
    return 'upperBody';
  }
  if (centerY >= 0.78) return 'feet';
  if (centerY >= 0.48) return 'lowerBody';
  if (centerY >= 0.38) return 'waist';
  return 'upperBody';
}

export function labelToArabic(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('dress')) return 'فستان';
  if (lower.includes('abaya')) return 'عباءة';
  if (lower.includes('suit')) return 'بدلة';
  if (lower.includes('skirt')) return 'تنورة';
  if (lower.includes('t-shirt') || lower.includes('tee')) return 'تيشيرت';
  if (lower.includes('blouse')) return 'بلوزة';
  if (lower.includes('blazer')) return 'بلوزر';
  if (lower.includes('shirt')) return 'قميص';
  if (lower.includes('pants') || lower.includes('trouser') || lower.includes('jean')) {
    return 'بنطلون';
  }
  if (lower.includes('jacket') || lower.includes('coat')) return 'جاكيت';
  if (lower.includes('bag') || lower.includes('handbag')) return 'حقيبة';
  if (lower.includes('shoe') || lower.includes('heel') || lower.includes('boot')) {
    return 'حذاء';
  }
  if (lower.includes('watch')) return 'ساعة';
  if (lower.includes('sunglass') || lower.includes('glasses')) return 'نظارة';
  return label;
}

export function shouldShowRegion(region: {
  zone: OutfitSegmentZone;
  labelEn: string;
  labelAr: string;
  confidence: number;
}): boolean {
  if (region.zone === 'head' || region.zone === 'waist') return false;
  if (region.zone === 'accessories') {
    const lower = region.labelEn.toLowerCase();
    const ok =
      isBag(lower) ||
      isAccessory(lower) ||
      region.labelAr.includes('حقيب') ||
      region.labelAr.includes('ساع') ||
      region.labelAr.includes('نظارة');
    return ok && region.confidence >= MIN_DISPLAY_CONFIDENCE;
  }
  if (region.zone === 'feet') {
    return region.confidence >= MIN_DISPLAY_CONFIDENCE || isFootwear(region.labelEn);
  }
  return region.confidence >= 0.35;
}
