/**
 * FK-4 — Safe production registry loader (fail closed).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FashionKnowledgeRegistry } from './contracts';
import { RegistryStatus } from './contracts';
import { validateFashionKnowledgeRegistry } from './validation';
import { emptyProductionRegistry } from './storage';
import { FashionKnowledgeRegistryCache } from './cache';
import { buildFashionKnowledgeRegistry } from './snapshot';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { FashionRuleRelation } from '../contracts/conflicts';
import type { FashionProvenance } from '../contracts/provenance';

export interface RegistryLoadResult {
  readonly ok: boolean;
  readonly registry?: FashionKnowledgeRegistry;
  readonly status: RegistryStatus;
  readonly issues: readonly { code: string; message: string }[];
}

const cache = new FashionKnowledgeRegistryCache();

/**
 * Load production registry from JSON path or return empty validated registry.
 * Never silently falls back to TEST_ONLY fixtures.
 */
export function loadProductionFashionKnowledgeRegistry(input?: {
  readonly filePath?: string;
  readonly clockNowIso?: string;
  readonly useCache?: boolean;
}): RegistryLoadResult {
  const clock = input?.clockNowIso ?? '1970-01-01T00:00:00.000Z';
  const path =
    input?.filePath ??
    join(
      __dirname,
      '..',
      'assets',
      'fashion-knowledge',
      'registry.json',
    );

  if (!existsSync(path)) {
    const empty = emptyProductionRegistry(clock);
    const v = validateFashionKnowledgeRegistry(empty, {
      productionMode: true,
      allowTestOnly: false,
    });
    return {
      ok: v.ok,
      registry: empty,
      status: RegistryStatus.EMPTY,
      issues: v.issues,
    };
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(path, 'utf8');
    if (raw.length > 5_000_000) {
      return {
        ok: false,
        status: RegistryStatus.INVALID,
        issues: [{ code: 'oversized_registry', message: 'registry JSON too large' }],
      };
    }
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      status: RegistryStatus.INVALID,
      issues: [
        {
          code: 'malformed_json',
          message: e instanceof Error ? e.message : 'parse error',
        },
      ],
    };
  }

  const body = parsed as {
    registryId?: string;
    registryVersion?: string;
    releaseId?: string;
    createdAt?: string;
    updatedAt?: string;
    rules?: FashionKnowledgeRule[];
    relations?: FashionRuleRelation[];
    provenanceCatalog?: FashionProvenance[];
    metadata?: { note?: string; allowTestOnly?: boolean };
  };

  // Reject test fixture leakage into production loader
  if (body.metadata?.allowTestOnly === true) {
    return {
      ok: false,
      status: RegistryStatus.INVALID,
      issues: [
        {
          code: 'test_only_leakage',
          message: 'Production loader rejects allowTestOnly registries',
        },
      ],
    };
  }
  if ((body.rules ?? []).some((r) => r.testOnly === true)) {
    return {
      ok: false,
      status: RegistryStatus.INVALID,
      issues: [
        {
          code: 'test_only_leakage',
          message: 'TEST_ONLY rules cannot load in production',
        },
      ],
    };
  }

  const registry = buildFashionKnowledgeRegistry({
    registryId: body.registryId ?? 'mira_fashion_knowledge_prod',
    registryVersion: body.registryVersion ?? '0.0.0-empty',
    releaseId: body.releaseId ?? 'fk4-empty',
    createdAt: body.createdAt ?? clock,
    updatedAt: body.updatedAt ?? clock,
    rules: body.rules ?? [],
    relations: body.relations ?? [],
    provenanceCatalog: body.provenanceCatalog ?? [],
    metadata: { ...(body.metadata ?? {}), allowTestOnly: false },
  });

  if (input?.useCache !== false) {
    const key = FashionKnowledgeRegistryCache.cacheKey(registry);
    const hit = cache.get(key);
    if (hit) {
      return {
        ok: true,
        registry: hit,
        status: hit.rules.length ? RegistryStatus.VALIDATED : RegistryStatus.EMPTY,
        issues: [],
      };
    }
  }

  const v = validateFashionKnowledgeRegistry(registry, {
    productionMode: true,
    allowTestOnly: false,
  });
  if (!v.ok) {
    return {
      ok: false,
      status: RegistryStatus.INVALID,
      issues: v.issues,
    };
  }

  cache.set(registry);
  return {
    ok: true,
    registry,
    status: registry.rules.length ? RegistryStatus.VALIDATED : RegistryStatus.EMPTY,
    issues: [],
  };
}

export function clearRegistryCache(): void {
  cache.clear();
}
