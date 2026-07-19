/**
 * Shared fashion alias tables — single SSOT for Vision normalizer + Garment Intelligence.
 * Remediation 6C.1 (Major: alias duplication). Not a taxonomy redesign.
 */
export const FASHION_CATEGORY_ALIASES: Record<string, string> = {
  top: 'tops',
  tops: 'tops',
  shirt: 'tops',
  blouse: 'tops',
  upper: 'tops',
  bottom: 'bottoms',
  bottoms: 'bottoms',
  pants: 'bottoms',
  skirt: 'bottoms',
  lower: 'bottoms',
  outer: 'outerwear',
  outerwear: 'outerwear',
  jacket: 'outerwear',
  blazer: 'outerwear',
  coat: 'outerwear',
  bag: 'bags',
  bags: 'bags',
  heel: 'heels',
  heels: 'heels',
  shoe: 'heels',
  shoes: 'heels',
  jewel: 'jewelry',
  jewelry: 'jewelry',
  scarf: 'scarves',
  scarves: 'scarves',
  dress: 'dresses',
  dresses: 'dresses',
  unknown: 'unknown',
};

export const FASHION_TYPE_ALIASES: Record<string, string> = {
  blazers: 'blazer',
  jackets: 'jacket',
  dresses: 'dress',
  skirts: 'skirt',
  pant: 'pants',
  trousers: 'pants',
  jeans: 'jeans',
  shirts: 'shirt',
  blouses: 'blouse',
  tops: 'top',
  coats: 'coat',
  abayas: 'abaya',
  suits: 'suit',
  heel: 'heels',
  heels: 'heels',
  bag: 'bag',
  bags: 'bag',
  earrings: 'jewelry',
  necklace: 'jewelry',
  scarf: 'scarf',
};

export const FASHION_COLOR_ALIASES: Record<string, string> = {
  black: 'black_pure',
  navy: 'navy_deep',
  beige: 'beige_linen',
  cream: 'cream_soft',
  ivory: 'ivory_warm',
  gray: 'gray_soft',
  grey: 'gray_soft',
  silver: 'silver_metal',
  white: 'ivory_warm',
  brown: 'brown_warm',
  red: 'red_classic',
  pink: 'pink_soft',
  green: 'green_olive',
  blue: 'blue_sky',
  gold: 'gold_soft',
};

export const FASHION_MATERIAL_ALIASES: Record<string, string> = {
  cotton: 'cotton',
  wool: 'wool',
  silk: 'silk',
  linen: 'linen',
  denim: 'denim',
  leather: 'leather',
  polyester: 'polyester',
  cashmere: 'cashmere',
  chiffon: 'chiffon',
  satin: 'satin',
  unknown: 'unknown',
};

export const FASHION_FIT_ALIASES: Record<string, string> = {
  slim: 'slim',
  regular: 'regular',
  relaxed: 'relaxed',
  oversized: 'oversized',
  tailored: 'tailored',
  loose: 'relaxed',
};

export const FASHION_ARCHETYPE_ALIASES: Record<string, string> = {
  business_casual: 'business',
  formal: 'evening',
  casual: 'casual',
  minimalism: 'minimal',
  quiet: 'quiet_luxury',
};

export function fashionAliasSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
