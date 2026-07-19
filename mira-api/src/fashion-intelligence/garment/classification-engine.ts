import { FashionEntityClass } from '../models/canonical-wardrobe';
import {
  FashionOntologyRegistry,
  isKnownCategoryId,
  isKnownGarmentTypeId,
  loadFashionOntologyRegistry,
} from '../../vision/schema/fashion-ontology.registry';
import { normalizeCategoryId, normalizeTypeId } from './normalization-engine';
import { catalogOwnedCategoryIds } from './catalog-resolution-engine';

export interface ClassificationResult {
  categoryId: string;
  typeId: string;
  subcategoryId?: string;
  entityClass: FashionEntityClass;
  knownCategory: boolean;
  knownType: boolean;
  notes: string[];
}

const TYPE_TO_ENTITY: Record<string, FashionEntityClass> = {
  heels: 'shoes',
  bag: 'bag',
  jewelry: 'jewelry',
  scarf: 'accessory',
  blazer: 'garment',
  jacket: 'garment',
  dress: 'garment',
  skirt: 'garment',
  pants: 'garment',
  jeans: 'garment',
  shirt: 'garment',
  blouse: 'garment',
  top: 'garment',
  coat: 'garment',
  abaya: 'garment',
  suit: 'garment',
};

const CATEGORY_TO_ENTITY: Record<string, FashionEntityClass> = {
  tops: 'garment',
  bottoms: 'garment',
  dresses: 'garment',
  outerwear: 'garment',
  bags: 'bag',
  heels: 'shoes',
  jewelry: 'jewelry',
  scarves: 'accessory',
  watches: 'watch',
  sunglasses: 'accessory',
};

/**
 * Classification Engine — ontology-validated category/type/entityClass.
 */
export class ClassificationEngine {
  constructor(private readonly ontology: FashionOntologyRegistry = loadFashionOntologyRegistry()) {}

  classify(input: {
    categoryId?: string;
    typeId?: string;
    subcategoryId?: string;
  }): ClassificationResult {
    const notes: string[] = [];
    let categoryId = normalizeCategoryId(input.categoryId);
    let typeId = normalizeTypeId(input.typeId);
    const subcategoryId = input.subcategoryId
      ? normalizeTypeId(input.subcategoryId)
      : undefined;

    let knownCategory = isKnownCategoryId(this.ontology, categoryId);
    if (!knownCategory && categoryId !== 'unknown') {
      // Catalog-owned categories (from catalog index SSOT — not a hardcoded allowlist)
      if (catalogOwnedCategoryIds().has(categoryId)) {
        knownCategory = true;
      } else {
        notes.push(`category_unmapped:${categoryId}`);
        categoryId = 'unknown';
        knownCategory = false;
      }
    } else if (categoryId === 'unknown') {
      notes.push('category_unknown');
    }

    let knownType = isKnownGarmentTypeId(this.ontology, typeId);
    if (!knownType && typeId !== 'unknown') {
      notes.push(`type_unmapped:${typeId}`);
      typeId = 'unknown';
      knownType = false;
    } else if (typeId === 'unknown') {
      notes.push('type_unknown');
    } else {
      knownType = true;
    }

    const entityClass =
      TYPE_TO_ENTITY[typeId] ??
      CATEGORY_TO_ENTITY[categoryId] ??
      'garment';

    return {
      categoryId,
      typeId,
      subcategoryId: subcategoryId && subcategoryId !== 'unknown' ? subcategoryId : typeId !== 'unknown' ? typeId : undefined,
      entityClass,
      knownCategory,
      knownType,
      notes,
    };
  }
}
