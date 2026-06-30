import { loadFashionOntologyRegistry } from '../schema/fashion-ontology.registry';

function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

/** Strict JSON Schema for OpenAI response_format (attributes only — no scores). */
export function buildOpenAiSemanticsJsonSchema() {
  const registry = loadFashionOntologyRegistry();
  const categories = sorted(registry.categoryIds);
  const types = sorted(registry.garmentTypeIds);
  const colors = sorted(registry.colorIds);
  const archetypes = sorted(registry.archetypeIds);

  const garmentProperties = {
    categoryId: { type: 'string', enum: categories },
    typeId: { type: 'string', enum: types },
    sleeve: { type: 'string' },
    neckline: { type: 'string' },
    fit: { type: 'string' },
    colors: {
      type: 'array',
      items: { type: 'string', enum: colors },
      minItems: 1,
    },
    material: { type: 'string' },
    providerConfidence: { type: 'number', minimum: 0, maximum: 1 },
  };

  const accessoryProperties = {
    categoryId: { type: 'string', enum: categories },
    typeId: { type: 'string', enum: types },
    colors: {
      type: 'array',
      items: { type: 'string', enum: colors },
    },
    providerConfidence: { type: 'number', minimum: 0, maximum: 1 },
  };

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
            required: ['categoryId', 'typeId', 'colors', 'providerConfidence'],
            additionalProperties: false,
          },
        },
        accessories: {
          type: 'array',
          items: {
            type: 'object',
            properties: accessoryProperties,
            required: ['categoryId', 'typeId', 'providerConfidence'],
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
          items: { type: 'string', enum: colors },
          minItems: 1,
        },
        secondaryColorIds: {
          type: 'array',
          items: { type: 'string', enum: colors },
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
