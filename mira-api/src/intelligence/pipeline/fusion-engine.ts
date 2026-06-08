import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { StyleFusionPayload } from '../contracts/mira-style-report.interface';
import { ingestOutfit } from './ingest-outfit';

const WARM_PALETTE = ['بيج', 'زيتوني', 'ذهبي', 'كaramel', 'مرجاني دافئ'];
const COOL_PALETTE = ['وردي بارداً', 'فضي', 'كحلي', 'lavender', 'رمادي-pearl'];
const NEUTRAL_PALETTE = ['بيج', 'كريمي', 'تركواز', 'نبيتي', 'أسود ناعم'];

const WARM_AVOID = ['رمادي-barde', 'أبيض ثلجي', 'فuchsia باردة'];
const COOL_AVOID = ['برتقالي قوي', 'ذهبي heavy', 'mustard'];
const NEUTRAL_AVOID = ['ألوان نيون متضاربة'];

export function buildStyleFusion(
  skin: SkinAnalysisResult,
  outfit: OutfitAnalysisResult,
): StyleFusionPayload {
  const ingested = ingestOutfit(outfit);
  const undertone = skin.undertoneEn.toLowerCase();

  const { recommended, avoid } = paletteForUndertone(undertone);
  const outfitColors = ingested.dominantColorsAr.map((c) => c.toLowerCase());
  const clash = detectClash(undertone, outfitColors);

  const makeupHintAr = makeupForUndertone(undertone);
  const accessoryHintAr = accessoryForUndertone(undertone);

  const headlineAr = clash
    ? 'إطلالتك جميلة — لكن الألوان قد تتعارض مع undertone بشرتك'
    : `إطلالة متناسقة مع undertone ${skin.undertoneAr} بشرتك`;

  const summaryAr = clash
    ? `undertone ${skin.undertoneAr} يفضّل ${recommended.slice(0, 3).join(' · ')} — تجنّبي ${avoid.slice(0, 2).join(' · ')} مع بشرة ${skin.skinTypeAr}.`
    : `ألوان إطلالتك (${ingested.dominantColorsAr.join(' · ')}) تتماشى مع undertone ${skin.undertoneAr} — ${ingested.occasionSuitabilityAr}.`;

  return {
    enabled: true,
    undertoneAr: skin.undertoneAr,
    undertoneEn: skin.undertoneEn,
    headlineAr,
    summaryAr,
    recommendedColorsAr: mergeUnique(recommended, ingested.alternativeColorsAr).slice(0, 6),
    avoidColorsAr: avoid.slice(0, 4),
    makeupHintAr,
    accessoryHintAr,
  };
}

function paletteForUndertone(undertone: string): {
  recommended: string[];
  avoid: string[];
} {
  if (undertone === 'warm') {
    return { recommended: WARM_PALETTE, avoid: WARM_AVOID };
  }
  if (undertone === 'cool') {
    return { recommended: COOL_PALETTE, avoid: COOL_AVOID };
  }
  return { recommended: NEUTRAL_PALETTE, avoid: NEUTRAL_AVOID };
}

function detectClash(undertone: string, outfitColors: string[]): boolean {
  if (undertone === 'warm') {
    return outfitColors.some(
      (c) => c.includes('رمادي') || c.includes('فض') && c.includes('بارد'),
    );
  }
  if (undertone === 'cool') {
    return outfitColors.some((c) => c.includes('برتق') || c.includes('mustard'));
  }
  return false;
}

function makeupForUndertone(undertone: string): string {
  if (undertone === 'warm') return 'أحمر مرجاني · bronzer خفيف · highlighter ذهبي';
  if (undertone === 'cool') return 'وردي-barde · highlighter pearl · avoid orange blush';
  return 'nude rose · soft mauve · balanced glow';
}

function accessoryForUndertone(undertone: string): string {
  if (undertone === 'warm') return 'ذهبي · rose gold · beige leather';
  if (undertone === 'cool') return 'فضي · white gold · pearl';
  return 'gold أو silver حسب الإطلالة';
}

function mergeUnique(primary: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...primary, ...extra]) {
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
