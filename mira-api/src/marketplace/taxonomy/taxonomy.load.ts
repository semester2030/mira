import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EleganceTaxonomyDoc, TaxonomyNode } from './taxonomy.types';

export type TaxonomyIntegrityIssue = { code: string; detail: string };

export function loadEleganceTaxonomyDoc(filePath?: string): { doc: EleganceTaxonomyDoc; hash: string; path: string } {
  const path = filePath ?? join(__dirname, 'elegance-taxonomy.v1.json');
  const raw = readFileSync(path, 'utf8');
  const doc = JSON.parse(raw) as EleganceTaxonomyDoc;
  const issues = validateTaxonomyIntegrity(doc);
  if (issues.length) {
    throw new Error(`elegance taxonomy integrity failed: ${issues.map((i) => `${i.code}:${i.detail}`).join('; ')}`);
  }
  return { doc, hash: createHash('sha256').update(raw).digest('hex'), path };
}

/** Structural checks: duplicates, missing parents/children, cycles, browseOnly suffix. */
export function validateTaxonomyIntegrity(doc: EleganceTaxonomyDoc): TaxonomyIntegrityIssue[] {
  const issues: TaxonomyIntegrityIssue[] = [];
  if (!doc || doc.lane !== 'elegance') {
    issues.push({ code: 'TAXONOMY_LANE', detail: 'lane must be elegance' });
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
    if ((n.id.endsWith('.all') || n.id === 'elegance.all') && !n.browseOnly) {
      issues.push({ code: 'TAXONOMY_ALL_NOT_BROWSE_ONLY', detail: n.id });
    }
  }
  // cycle detect via parent walk
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

/** Registry profile ids referenced by write-enabled (or any profileId) nodes must exist when provided. */
export function validateTaxonomyProfilesExist(
  doc: EleganceTaxonomyDoc,
  knownProfileIds: Set<string>,
): TaxonomyIntegrityIssue[] {
  const issues: TaxonomyIntegrityIssue[] = [];
  for (const n of doc.nodes) {
    if (!n.profileId) continue;
    // bags/shoes profiles may be absent until E4 — only require when writeEnabled
    if (n.writeEnabled === false) continue;
    if (!knownProfileIds.has(n.profileId)) {
      issues.push({ code: 'TAXONOMY_UNKNOWN_PROFILE', detail: `${n.id}:${n.profileId}` });
    }
  }
  return issues;
}
