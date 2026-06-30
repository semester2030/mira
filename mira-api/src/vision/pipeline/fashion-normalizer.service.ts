import { Injectable } from '@nestjs/common';
import {
  FashionOntologyRegistry,
  isKnownArchetypeId,
  isKnownCategoryId,
  isKnownColorId,
  isKnownGarmentTypeId,
  loadFashionOntologyRegistry,
} from '../schema/fashion-ontology.registry';
import {
  SemanticAccessory,
  SemanticGarment,
  SemanticsPayload,
} from '../schema/fashion-vision-document.v1';

export interface NormalizationResult {
  semantics: SemanticsPayload;
  notes: string[];
  /** Multiplier applied to providerConfidence when ids were mapped (0..1). */
  confidenceMultiplier: number;
}

const CATEGORY_ALIASES: Record<string, string> = {
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
};

const TYPE_ALIASES: Record<string, string> = {
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

const COLOR_ALIASES: Record<string, string> = {
  black: 'black_pure',
  navy: 'navy_deep',
  beige: 'beige_linen',
  cream: 'cream_soft',
  ivory: 'ivory_warm',
  gray: 'gray_soft',
  grey: 'gray_soft',
  silver: 'silver_metal',
  white: 'ivory_warm',
};

const ARCHETYPE_ALIASES: Record<string, string> = {
  business_casual: 'business',
  formal: 'evening',
  casual: 'casual',
  minimalism: 'minimal',
  quiet: 'quiet_luxury',
};

function slug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

@Injectable()
export class FashionNormalizerService {
  normalizeSemantics(
    input: SemanticsPayload,
    registry: FashionOntologyRegistry = loadFashionOntologyRegistry(),
  ): NormalizationResult {
    const notes: string[] = [];
    let confidenceMultiplier = 1;

    const garments = input.garments.map((g, i) =>
      this.normalizeGarment(g, `semantics.garments[${i}]`, registry, notes, (penalty) => {
        confidenceMultiplier = Math.min(confidenceMultiplier, penalty);
      }),
    );

    const accessories = (input.accessories ?? []).map((a, i) =>
      this.normalizeAccessory(a, `semantics.accessories[${i}]`, registry, notes, (penalty) => {
        confidenceMultiplier = Math.min(confidenceMultiplier, penalty);
      }),
    );

    const dominantColorIds = this.normalizeColorList(
      input.dominantColorIds,
      'semantics.dominantColorIds',
      registry,
      notes,
      (penalty) => {
        confidenceMultiplier = Math.min(confidenceMultiplier, penalty);
      },
    );

    const secondaryColorIds = this.normalizeColorList(
      input.secondaryColorIds,
      'semantics.secondaryColorIds',
      registry,
      notes,
      (penalty) => {
        confidenceMultiplier = Math.min(confidenceMultiplier, penalty);
      },
    );

    let styleArchetypeId = input.styleArchetypeId;
    if (styleArchetypeId) {
      const normalized = this.normalizeArchetypeId(styleArchetypeId, registry);
      if (normalized !== styleArchetypeId) {
        notes.push(`Mapped styleArchetypeId ${styleArchetypeId} → ${normalized}`);
        confidenceMultiplier = Math.min(confidenceMultiplier, 0.85);
        styleArchetypeId = normalized;
      }
    }

    return {
      semantics: {
        garments,
        accessories,
        styleArchetypeId,
        layering: [...input.layering],
        dominantColorIds,
        secondaryColorIds,
      },
      notes,
      confidenceMultiplier,
    };
  }

  private normalizeGarment(
    garment: SemanticGarment,
    path: string,
    registry: FashionOntologyRegistry,
    notes: string[],
    onPenalty: (multiplier: number) => void,
  ): SemanticGarment {
    const categoryId = this.normalizeCategoryId(garment.categoryId, registry, path, notes, onPenalty);
    const typeId = this.normalizeTypeId(garment.typeId, registry, path, notes, onPenalty);
    const colors = this.normalizeColorList(
      garment.colors,
      `${path}.colors`,
      registry,
      notes,
      onPenalty,
    );

    const confidence = garment.providerConfidence * (colors.length < garment.colors.length ? 0.9 : 1);

    return { ...garment, categoryId, typeId, colors, providerConfidence: confidence };
  }

  private normalizeAccessory(
    accessory: SemanticAccessory,
    path: string,
    registry: FashionOntologyRegistry,
    notes: string[],
    onPenalty: (multiplier: number) => void,
  ): SemanticAccessory {
    const categoryId = this.normalizeCategoryId(
      accessory.categoryId,
      registry,
      path,
      notes,
      onPenalty,
    );
    const typeId = this.normalizeTypeId(accessory.typeId, registry, path, notes, onPenalty);
    const colors = accessory.colors
      ? this.normalizeColorList(
          accessory.colors,
          `${path}.colors`,
          registry,
          notes,
          onPenalty,
        )
      : accessory.colors;

    return { ...accessory, categoryId, typeId, colors };
  }

  private normalizeCategoryId(
    raw: string,
    registry: FashionOntologyRegistry,
    path: string,
    notes: string[],
    onPenalty: (multiplier: number) => void,
  ): string {
    const id = slug(raw);
    if (isKnownCategoryId(registry, id)) return id;

    const alias = CATEGORY_ALIASES[id];
    if (alias && isKnownCategoryId(registry, alias)) {
      notes.push(`${path}.categoryId mapped ${raw} → ${alias}`);
      onPenalty(0.85);
      return alias;
    }

    notes.push(`${path}.categoryId unknown "${raw}" → tops (fallback)`);
    onPenalty(0.6);
    return 'tops';
  }

  private normalizeTypeId(
    raw: string,
    registry: FashionOntologyRegistry,
    path: string,
    notes: string[],
    onPenalty: (multiplier: number) => void,
  ): string {
    const id = slug(raw);
    if (isKnownGarmentTypeId(registry, id)) return id;

    const alias = TYPE_ALIASES[id];
    if (alias && isKnownGarmentTypeId(registry, alias)) {
      notes.push(`${path}.typeId mapped ${raw} → ${alias}`);
      onPenalty(0.85);
      return alias;
    }

    notes.push(`${path}.typeId unknown "${raw}" → unknown (fallback)`);
    onPenalty(0.5);
    return 'unknown';
  }

  private normalizeColorList(
    colors: string[],
    path: string,
    registry: FashionOntologyRegistry,
    notes: string[],
    onPenalty: (multiplier: number) => void,
  ): string[] {
    const out: string[] = [];
    for (const raw of colors) {
      const id = slug(raw);
      if (isKnownColorId(registry, id)) {
        out.push(id);
        continue;
      }
      const alias = COLOR_ALIASES[id];
      if (alias && isKnownColorId(registry, alias)) {
        notes.push(`${path} color mapped ${raw} → ${alias}`);
        onPenalty(0.85);
        out.push(alias);
        continue;
      }
      notes.push(`${path} color unknown "${raw}" — dropped`);
      onPenalty(0.7);
    }
    return out.length > 0 ? out : ['black_pure'];
  }

  private normalizeArchetypeId(raw: string, registry: FashionOntologyRegistry): string {
    const id = slug(raw);
    if (isKnownArchetypeId(registry, id)) return id;
    const alias = ARCHETYPE_ALIASES[id];
    if (alias && isKnownArchetypeId(registry, alias)) return alias;
    return 'casual';
  }
}
