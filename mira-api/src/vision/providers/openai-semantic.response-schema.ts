import { loadFashionOntologyRegistry } from '../schema/fashion-ontology.registry';

function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

/** OpenAI structured outputs cap — total enum values across the whole schema. */
export const OPENAI_SCHEMA_MAX_ENUM_VALUES = 500;

/**
 * Color ids are validated post-parse in FashionNormalizerService (247+ colors).
 * Inlining color enums in the schema exceeded OpenAI's 500 enum limit (HTTP 400).
 */
const colorIdString = {
  type: 'string',
  description: 'Fashion ontology color id, e.g. navy_deep or black_pure',
} as const;

/** Count enum values in a JSON-schema-like tree (for tests). */
export function countJsonSchemaEnumValues(node: unknown): number {
  if (node == null || typeof node !== 'object') return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, item) => sum + countJsonSchemaEnumValues(item), 0);
  }
  const record = node as Record<string, unknown>;
  let count = 0;
  if (Array.isArray(record.enum)) {
    count += record.enum.length;
  }
  for (const value of Object.values(record)) {
    count += countJsonSchemaEnumValues(value);
  }
  return count;
}

/** Strict JSON Schema for OpenAI response_format (attributes only — no scores). */
export function buildOpenAiSemanticsJsonSchema() {
  const registry = loadFashionOntologyRegistry();
  const categories = sorted(registry.categoryIds);
  const types = sorted(registry.garmentTypeIds);
  const archetypes = sorted(registry.archetypeIds);

  // OpenAI strict json_schema: every key in properties must appear in required (use null for optional).
  const garmentProperties = {
    categoryId: { type: 'string', enum: categories },
    typeId: { type: 'string', enum: types },
    sleeve: { type: ['string', 'null'] },
    neckline: { type: ['string', 'null'] },
    fit: { type: ['string', 'null'] },
    colors: {
      type: 'array',
      items: colorIdString,
      minItems: 1,
    },
    material: { type: ['string', 'null'] },
    providerConfidence: { type: 'number', minimum: 0, maximum: 1 },
  };

  const garmentRequired = [
    'categoryId',
    'typeId',
    'sleeve',
    'neckline',
    'fit',
    'colors',
    'material',
    'providerConfidence',
  ];

  const accessoryProperties = {
    categoryId: { type: 'string', enum: categories },
    typeId: { type: 'string', enum: types },
    colors: {
      type: 'array',
      items: colorIdString,
    },
    providerConfidence: { type: 'number', minimum: 0, maximum: 1 },
  };

  const accessoryRequired = ['categoryId', 'typeId', 'colors', 'providerConfidence'];

  return {
    name: 'fashion_semantics_v1',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        garments: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: garmentProperties,
            required: garmentRequired,
            additionalProperties: false,
          },
        },
        accessories: {
          type: 'array',
          items: {
            type: 'object',
            properties: accessoryProperties,
            required: accessoryRequired,
            additionalProperties: false,
          },
        },
        styleArchetypeId: { type: 'string', enum: archetypes },
        layering: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        },
        dominantColorIds: {
          type: 'array',
          items: colorIdString,
          minItems: 1,
        },
        secondaryColorIds: {
          type: 'array',
          items: colorIdString,
        },
      },
      required: [
        'garments',
        'accessories',
        'styleArchetypeId',
        'layering',
        'dominantColorIds',
        'secondaryColorIds',
      ],
      additionalProperties: false,
    },
  };
}
