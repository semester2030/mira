import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  EleganceTaxonomyDoc,
  LaneManifestEntry,
  LaneTaxonomyDoc,
  LanesManifest,
  TaxonomyNode,
} from './taxonomy.types';

export type TaxonomyIntegrityIssue = { code: string; detail: string };

const HERE = __dirname;

export function loadLanesManifest(filePath?: string): LanesManifest {
  const path = filePath ?? join(HERE, 'lanes.manifest.v1.json');
  const raw = readFileSync(path, 'utf8');
  const doc = JSON.parse(raw) as LanesManifest;
  if (!doc || !Array.isArray(doc.lanes)) {
    throw new Error('lanes.manifest.v1.json invalid');
  }
  return doc;
}

export function loadLaneTaxonomyDoc(
  laneOrFile: string,
  filePath?: string,
): { doc: LaneTaxonomyDoc; hash: string; path: string } {
  let path = filePath;
  if (!path) {
    const manifest = loadLanesManifest();
    const entry = manifest.lanes.find((l) => l.id === laneOrFile);
    if (!entry?.taxonomyFile) {
      throw new Error(`TAXONOMY_LANE_NO_FILE:${laneOrFile}`);
    }
    path = join(HERE, entry.taxonomyFile);
  }
  const raw = readFileSync(path, 'utf8');
  const doc = JSON.parse(raw) as LaneTaxonomyDoc;
  if (typeof laneOrFile === 'string' && !filePath && doc.lane && doc.lane !== laneOrFile) {
    throw new Error(`TAXONOMY_LANE_MISMATCH:${doc.lane}!=${laneOrFile}`);
  }
  const issues = validateTaxonomyIntegrity(doc);
  if (issues.length) {
    throw new Error(`taxonomy integrity failed (${doc.lane}): ${issues.map((i) => `${i.code}:${i.detail}`).join('; ')}`);
  }
  return { doc, hash: createHash('sha256').update(raw).digest('hex'), path };
}

/** Backward-compatible elegance loader used by E1 tests and scripts. */
export function loadEleganceTaxonomyDoc(filePath?: string): {
  doc: EleganceTaxonomyDoc;
  hash: string;
  path: string;
} {
  const path = filePath ?? join(HERE, 'elegance-taxonomy.v1.json');
  return loadLaneTaxonomyDoc('elegance', path) as {
    doc: EleganceTaxonomyDoc;
    hash: string;
    path: string;
  };
}

export function loadDescriptionPhrases(filePath?: string): {
  definitionsVersion: number;
  bySubcategory: Record<string, Array<{ id: string; textAr: string }>>;
  hash: string;
} {
  const path = filePath ?? join(HERE, 'description-phrases.v1.json');
  if (!existsSync(path)) {
    return { definitionsVersion: 0, bySubcategory: {}, hash: 'empty' };
  }
  const raw = readFileSync(path, 'utf8');
  const doc = JSON.parse(raw) as {
    definitionsVersion?: number;
    bySubcategory?: Record<string, Array<{ id: string; textAr: string }>>;
  };
  return {
    definitionsVersion: Number(doc.definitionsVersion || 0),
    bySubcategory: doc.bySubcategory || {},
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}

/** Structural checks: duplicates, missing parents/children, cycles, browseOnly suffix. */
export function validateTaxonomyIntegrity(doc: LaneTaxonomyDoc): TaxonomyIntegrityIssue[] {
  const issues: TaxonomyIntegrityIssue[] = [];
  if (!doc || typeof doc.lane !== 'string' || !doc.lane.trim()) {
    issues.push({ code: 'TAXONOMY_LANE', detail: 'lane must be a non-empty string' });
    return issues;
  }
  if (!Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) {
    issues.push({ code: 'TAXONOMY_SCHEMA_VERSION', detail: String(doc.schemaVersion) });
  }
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
  const byId = new Map<string, TaxonomyNode>();
  for (const n of nodes) {
    if (!n?.id || typeof n.id !== 'string') {
      issues.push({ code: 'TAXONOMY_NODE_ID', detail: 'missing id' });
      continue;
    }
    if (byId.has(n.id)) issues.push({ code: 'TAXONOMY_DUP_ID', detail: n.id });
    byId.set(n.id, n);
  }
  for (const n of byId.values()) {
    if (n.parentId != null && !byId.has(n.parentId)) {
      issues.push({ code: 'TAXONOMY_MISSING_PARENT', detail: `${n.id}->${n.parentId}` });
    }
    if (!Array.isArray(n.children)) {
      issues.push({ code: 'TAXONOMY_CHILDREN_TYPE', detail: n.id });
      continue;
    }
    for (const c of n.children) {
      if (!byId.has(c)) issues.push({ code: 'TAXONOMY_MISSING_CHILD', detail: `${n.id}->${c}` });
      else if (byId.get(c)!.parentId !== n.id) {
        issues.push({ code: 'TAXONOMY_PARENT_MISMATCH', detail: `${c} parentId!=${n.id}` });
      }
    }
    if ((n.id.endsWith('.all') || n.id.endsWith('_all')) && !n.browseOnly) {
      issues.push({ code: 'TAXONOMY_ALL_NOT_BROWSE_ONLY', detail: n.id });
    }
  }
  for (const n of byId.values()) {
    const seen = new Set<string>();
    let cur: string | null = n.id;
    while (cur) {
      if (seen.has(cur)) {
        issues.push({ code: 'TAXONOMY_CYCLE', detail: cur });
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)?.parentId ?? null;
    }
  }
  return issues;
}

export function validateTaxonomyProfilesExist(
  doc: LaneTaxonomyDoc,
  knownProfileIds: Set<string>,
): TaxonomyIntegrityIssue[] {
  const issues: TaxonomyIntegrityIssue[] = [];
  for (const n of doc.nodes) {
    if (!n.profileId) continue;
    if (n.writeEnabled === false) continue;
    if (!knownProfileIds.has(n.profileId)) {
      issues.push({ code: 'TAXONOMY_UNKNOWN_PROFILE', detail: `${n.id}:${n.profileId}` });
    }
  }
  return issues;
}

export function manifestEntry(laneId: string): LaneManifestEntry | undefined {
  return loadLanesManifest().lanes.find((l) => l.id === laneId);
}
