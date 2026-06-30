import * as fs from 'fs';
import * as path from 'path';

/** Taxonomy + color ids loaded from repo assets/fashion/*.json */
export interface FashionOntologyRegistry {
  categoryIds: ReadonlySet<string>;
  archetypeIds: ReadonlySet<string>;
  occasionIds: ReadonlySet<string>;
  colorIds: ReadonlySet<string>;
  garmentTypeIds: ReadonlySet<string>;
}

type OntologyJson = {
  taxonomy?: {
    category?: Record<string, unknown>;
    archetype?: Record<string, unknown>;
    occasion?: Record<string, unknown>;
  };
};

type ColorsJson = {
  colors?: Record<string, unknown>;
};

/** Garment type ids aligned with catalog / vision normalization (extensible). */
const GARMENT_TYPE_IDS = [
  'blazer',
  'jacket',
  'dress',
  'skirt',
  'pants',
  'jeans',
  'shirt',
  'blouse',
  'top',
  'coat',
  'abaya',
  'suit',
  'heels',
  'bag',
  'jewelry',
  'scarf',
  'unknown',
] as const;

function repoRootFromHere(): string {
  // mira-api/src/vision/schema (or dist/vision/schema) → repo root (mira/)
  return path.resolve(__dirname, '../../../..');
}

function loadJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

let cached: FashionOntologyRegistry | null = null;

export function loadFashionOntologyRegistry(
  rootDir = repoRootFromHere(),
): FashionOntologyRegistry {
  if (cached) return cached;

  const ontologyPath = path.join(rootDir, 'assets/fashion/ontology.json');
  const colorsPath = path.join(rootDir, 'assets/fashion/colors.json');

  const ontology = loadJson<OntologyJson>(ontologyPath);
  const colors = loadJson<ColorsJson>(colorsPath);

  cached = {
    categoryIds: new Set(Object.keys(ontology.taxonomy?.category ?? {})),
    archetypeIds: new Set(Object.keys(ontology.taxonomy?.archetype ?? {})),
    occasionIds: new Set(Object.keys(ontology.taxonomy?.occasion ?? {})),
    colorIds: new Set(Object.keys(colors.colors ?? {})),
    garmentTypeIds: new Set<string>(GARMENT_TYPE_IDS),
  };

  return cached;
}

/** Reset cache — for tests only. */
export function resetFashionOntologyRegistryCache(): void {
  cached = null;
}

export function isKnownCategoryId(
  registry: FashionOntologyRegistry,
  id: string,
): boolean {
  return registry.categoryIds.has(id);
}

export function isKnownColorId(
  registry: FashionOntologyRegistry,
  id: string,
): boolean {
  return registry.colorIds.has(id);
}

export function isKnownGarmentTypeId(
  registry: FashionOntologyRegistry,
  id: string,
): boolean {
  return registry.garmentTypeIds.has(id);
}

export function isKnownArchetypeId(
  registry: FashionOntologyRegistry,
  id: string,
): boolean {
  return registry.archetypeIds.has(id);
}
