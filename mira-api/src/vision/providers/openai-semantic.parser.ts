import {
  SemanticAccessory,
  SemanticGarment,
  SemanticsPayload,
} from '../schema/fashion-vision-document.v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function parseGarment(raw: unknown, index: number): SemanticGarment | null {
  if (!isRecord(raw)) return null;

  const categoryId = String(raw.categoryId ?? raw.category ?? '').trim();
  const typeId = String(raw.typeId ?? raw.type ?? '').trim();
  if (!categoryId || !typeId) return null;

  const colorsRaw = raw.colors ?? raw.colorIds;
  const colors = Array.isArray(colorsRaw)
    ? colorsRaw.map(String).filter(Boolean)
    : [];
  if (colors.length === 0) return null;

  const garment: SemanticGarment = {
    categoryId,
    typeId,
    colors,
    providerConfidence: clamp01(asNumber(raw.providerConfidence ?? raw.confidence, 0)),
  };

  if (typeof raw.sleeve === 'string') garment.sleeve = raw.sleeve;
  if (typeof raw.neckline === 'string') garment.neckline = raw.neckline;
  if (typeof raw.fit === 'string') garment.fit = raw.fit;
  if (typeof raw.material === 'string') garment.material = raw.material;

  return garment;
}

function parseAccessory(raw: unknown): SemanticAccessory | null {
  if (!isRecord(raw)) return null;

  const categoryId = String(raw.categoryId ?? raw.category ?? '').trim();
  const typeId = String(raw.typeId ?? raw.type ?? '').trim();
  if (!categoryId || !typeId) return null;

  const accessory: SemanticAccessory = {
    categoryId,
    typeId,
    providerConfidence: clamp01(asNumber(raw.providerConfidence ?? raw.confidence, 0)),
  };

  const colorsRaw = raw.colors ?? raw.colorIds;
  if (Array.isArray(colorsRaw)) {
    accessory.colors = colorsRaw.map(String).filter(Boolean);
  }

  return accessory;
}

/** Parse OpenAI JSON into SemanticsPayload — attributes only. */
export function parseOpenAiSemanticResponse(payload: unknown): SemanticsPayload {
  if (!isRecord(payload)) {
    throw new Error('OpenAI semantic response must be a JSON object');
  }

  const garmentsRaw = payload.garments;
  if (!Array.isArray(garmentsRaw) || garmentsRaw.length === 0) {
    throw new Error('OpenAI semantic response must include garments[]');
  }

  const garments = garmentsRaw
    .map((g, i) => parseGarment(g, i))
    .filter((g): g is SemanticGarment => g != null);

  if (garments.length === 0) {
    throw new Error('OpenAI semantic response contains no valid garments');
  }

  const accessoriesRaw = payload.accessories;
  const accessories = Array.isArray(accessoriesRaw)
    ? accessoriesRaw
        .map(parseAccessory)
        .filter((a): a is SemanticAccessory => a != null)
    : [];

  const layering = Array.isArray(payload.layering)
    ? payload.layering.map(String).filter(Boolean)
    : [];

  const dominantColorIds = Array.isArray(payload.dominantColorIds)
    ? payload.dominantColorIds.map(String).filter(Boolean)
    : [];

  const secondaryColorIds = Array.isArray(payload.secondaryColorIds)
    ? payload.secondaryColorIds.map(String).filter(Boolean)
    : [];

  if (layering.length === 0) {
    throw new Error('OpenAI semantic response must include layering[]');
  }
  if (dominantColorIds.length === 0) {
    throw new Error('OpenAI semantic response must include dominantColorIds[]');
  }

  const semantics: SemanticsPayload = {
    garments,
    accessories,
    layering,
    dominantColorIds,
    secondaryColorIds,
  };

  const archetype = payload.styleArchetypeId ?? payload.styleArchetype;
  if (archetype != null && String(archetype).trim()) {
    semantics.styleArchetypeId = String(archetype).trim();
  }

  return semantics;
}

/** Deterministic semantics for unit tests (no HTTP). */
export function buildMockOpenAiSemanticResponse(): Record<string, unknown> {
  return {
    garments: [
      {
        categoryId: 'outerwear',
        typeId: 'blazer',
        colors: ['black_pure'],
        fit: 'structured',
        providerConfidence: 0.82,
      },
    ],
    accessories: [
      {
        categoryId: 'jewelry',
        typeId: 'jewelry',
        colors: ['silver_metal'],
        providerConfidence: 0.71,
      },
    ],
    styleArchetypeId: 'business',
    layering: ['base', 'outerwear'],
    dominantColorIds: ['black_pure'],
    secondaryColorIds: ['gray_soft'],
  };
}
