import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadDescriptionPhrases,
  loadLaneTaxonomyDoc,
  loadLanesManifest,
  loadEleganceTaxonomyDoc,
  validateTaxonomyProfilesExist,
} from './taxonomy.load';
import type {
  EleganceTaxonomyDoc,
  LaneTaxonomyDoc,
  PublicLaneListItem,
  PublicTaxonomyResponse,
  TaxonomyNode,
} from './taxonomy.types';
import {
  resolveFromSubcategory,
  validateProductTaxonomyWrite,
  type ProductTaxonomyInput,
} from './product-taxonomy.validate';
import { resolveBeautyIcon } from './beauty-icon-assets';
import { resolveCatalogIcon } from './catalog-icon-assets';

type RegistrySnap = {
  fields: Record<string, { id?: string; filter?: string | null }>;
  profiles: Array<{ id: string; fields?: string[] }>;
};

@Injectable()
export class TaxonomyService implements OnModuleInit {
  private docs = new Map<string, LaneTaxonomyDoc>();
  private hashes = new Map<string, string>();
  private phrases: {
    definitionsVersion: number;
    bySubcategory: Record<string, Array<{ id: string; textAr: string }>>;
  } = { definitionsVersion: 0, bySubcategory: {} };
  private registrySnap: RegistrySnap = { fields: {}, profiles: [] };

  onModuleInit() {
    this.reload();
  }

  reload() {
    this.docs.clear();
    this.hashes.clear();
    const manifest = loadLanesManifest();
    for (const entry of manifest.lanes) {
      if (!entry.taxonomyFile) continue;
      const loaded = loadLaneTaxonomyDoc(entry.id);
      // Manifest publicBrowse wins for projection policy.
      loaded.doc.publicBrowse = entry.publicBrowse;
      this.docs.set(entry.id, loaded.doc);
      this.hashes.set(entry.id, loaded.hash);
    }
    // Always ensure elegance is present even if manifest omitted.
    if (!this.docs.has('elegance')) {
      const eleg = loadEleganceTaxonomyDoc();
      this.docs.set('elegance', eleg.doc);
      this.hashes.set('elegance', eleg.hash);
    }
    this.phrases = loadDescriptionPhrases();
    this.loadRegistrySnap();
  }

  /** Central field-registry is the only profile/field source for taxonomy enrichment. */
  private loadRegistrySnap() {
    try {
      const registryPath = join(__dirname, '../../partners-portal/registry/field-registry.v2.json');
      const raw = JSON.parse(readFileSync(registryPath, 'utf8')) as RegistrySnap;
      this.registrySnap = {
        fields: raw.fields || {},
        profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
      };
    } catch {
      this.registrySnap = { fields: {}, profiles: [] };
    }
  }

  private profileMeta(profileId: string | null | undefined): { fieldIds: string[]; filterKeys: string[] } {
    if (!profileId) return { fieldIds: [], filterKeys: [] };
    const profile = this.registrySnap.profiles.find((p) => p.id === profileId);
    const fieldIds = Array.isArray(profile?.fields) ? [...profile!.fields!] : [];
    const filterKeys: string[] = [];
    for (const fid of fieldIds) {
      const def = this.registrySnap.fields[fid];
      const fk = def?.filter;
      if (typeof fk === 'string' && fk.trim()) filterKeys.push(fk.trim());
    }
    return { fieldIds, filterKeys: [...new Set(filterKeys)] };
  }

  /**
   * LOCAL/TEST ONLY — bump definitionsVersion (and optional node label) so clients
   * must refresh cache. Refuses outside NODE_ENV=test.
   */
  bumpDefinitionsForTest(
    opts?: {
      lane?: string;
      nodeId?: string;
      labelAr?: string;
      active?: boolean;
      deactivateNodeId?: string;
    },
  ) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('bumpDefinitionsForTest is test-only');
    }
    const lane = opts?.lane || 'elegance';
    const doc = this.requireDoc(lane);
    const nodes = doc.nodes.map((n) => {
      if (opts?.deactivateNodeId && n.id === opts.deactivateNodeId) {
        return { ...n, active: false };
      }
      if (opts?.nodeId && n.id === opts.nodeId) {
        return {
          ...n,
          ...(opts.labelAr ? { labelAr: opts.labelAr } : {}),
          ...(typeof opts.active === 'boolean' ? { active: opts.active } : {}),
        };
      }
      return n;
    });
    const next: LaneTaxonomyDoc = {
      ...doc,
      definitionsVersion: Number(doc.definitionsVersion || 0) + 1,
      nodes,
    };
    this.docs.set(lane, next);
    this.hashes.set(lane, `test-bump-${lane}-${next.definitionsVersion}-${Date.now()}`);
    return next.definitionsVersion;
  }

  /**
   * TEST ONLY — append a write-enabled leaf under an existing parent without client code changes.
   * Used by Phase1 critical automation: portal + Flutter must discover the branch from API alone.
   */
  injectTestBranch(opts: {
    lane: string;
    parentId: string;
    id: string;
    labelAr: string;
    profileId?: string;
  }) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('injectTestBranch is test-only');
    }
    const doc = this.requireDoc(opts.lane);
    if (doc.nodes.some((n) => n.id === opts.id)) {
      throw new Error(`test branch already exists: ${opts.id}`);
    }
    const parent = doc.nodes.find((n) => n.id === opts.parentId);
    if (!parent) throw new Error(`parent missing: ${opts.parentId}`);
    if (parent.browseOnly) throw new Error(`parent is browseOnly: ${opts.parentId}`);
    const leaf: TaxonomyNode = {
      id: opts.id,
      parentId: opts.parentId,
      labelAr: opts.labelAr,
      sort: 9000 + doc.nodes.length,
      active: true,
      writeEnabled: true,
      imageKey: opts.id,
      profileId: opts.profileId ?? parent.profileId,
      children: [],
    };
    const nodes = doc.nodes.map((n) =>
      n.id === opts.parentId ? { ...n, children: [...n.children, opts.id] } : n,
    );
    nodes.push(leaf);
    const next: LaneTaxonomyDoc = {
      ...doc,
      definitionsVersion: Number(doc.definitionsVersion || 0) + 1,
      nodes,
    };
    this.docs.set(opts.lane, next);
    this.hashes.set(opts.lane, `test-inject-${opts.id}-${next.definitionsVersion}`);
    return { definitionsVersion: next.definitionsVersion, node: leaf };
  }

  assertProfilesKnown(knownProfileIds: Set<string>) {
    for (const doc of this.docs.values()) {
      const issues = validateTaxonomyProfilesExist(doc, knownProfileIds);
      if (issues.length) {
        throw new Error(`taxonomy profiles missing: ${issues.map((i) => i.detail).join(', ')}`);
      }
    }
  }

  getHash(lane = 'elegance') {
    return this.hashes.get(lane) || '';
  }

  getDoc(lane = 'elegance'): EleganceTaxonomyDoc {
    return this.requireDoc(lane);
  }

  listLaneIds(): string[] {
    return [...this.docs.keys()];
  }

  listPublicLanes(opts?: { audience?: 'public' | 'partner' }): PublicLaneListItem[] {
    const audience = opts?.audience || 'public';
    const manifest = loadLanesManifest();
    return manifest.lanes
      .filter((l) => (audience === 'partner' ? true : l.publicBrowse))
      .map((l) => {
        const doc = this.docs.get(l.id);
        return {
          id: l.id,
          labelAr: l.labelAr,
          offerKind: l.offerKind,
          publicBrowse: l.publicBrowse,
          partnerWrite: l.partnerWrite,
          definitionsVersion: doc ? doc.definitionsVersion : null,
          hasTaxonomy: !!l.taxonomyFile && !!doc,
        };
      });
  }

  publicProjection(opts?: {
    lane?: string;
    includeInactive?: boolean;
    audience?: 'public' | 'partner';
  }): PublicTaxonomyResponse {
    const lane = (opts?.lane || 'elegance').trim();
    const audience = opts?.audience || 'public';
    const doc = this.requireDoc(lane);
    const manifest = loadLanesManifest().lanes.find((l) => l.id === lane);
    const publicBrowse = manifest?.publicBrowse ?? doc.publicBrowse !== false;
    if (audience === 'public' && publicBrowse === false) {
      // Incomplete / preview lanes are not exposed to the public catalog surface.
      const err: any = new Error('TAXONOMY_LANE_NOT_PUBLIC');
      err.code = 'TAXONOMY_LANE_NOT_PUBLIC';
      throw err;
    }
    const includeInactive = opts?.includeInactive === true;
    const nodes = doc.nodes
      .filter((n) => includeInactive || n.active)
      .map((n) => this.toPublic(n))
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    const phraseBag: Record<string, Array<{ id: string; textAr: string }>> = {};
    for (const n of nodes) {
      const bag = this.phrases.bySubcategory[n.id];
      if (bag?.length) phraseBag[n.id] = bag.map((p) => ({ id: p.id, textAr: p.textAr }));
    }
    return {
      schemaVersion: doc.schemaVersion,
      lane: doc.lane,
      definitionsVersion: doc.definitionsVersion,
      compatMinAppBuild: doc.compatMinAppBuild,
      publicBrowse,
      descriptionPhrasesVersion: this.phrases.definitionsVersion,
      nodes,
      descriptionPhrases: phraseBag,
    };
  }

  private requireDoc(lane: string): LaneTaxonomyDoc {
    const doc = this.docs.get(lane);
    if (!doc) {
      const err: any = new Error(`TAXONOMY_LANE_UNSUPPORTED:${lane}`);
      err.code = 'TAXONOMY_LANE_UNSUPPORTED';
      throw err;
    }
    return doc;
  }

  private toPublic(n: TaxonomyNode) {
    const writeEnabled = n.browseOnly ? false : n.writeEnabled !== false;
    const meta =
      n.browseOnly || !writeEnabled
        ? { fieldIds: [] as string[], filterKeys: [] as string[] }
        : this.profileMeta(n.profileId);
    const imageKey = n.imageKey ?? null;
    const icon = resolveCatalogIcon(imageKey) || resolveBeautyIcon(imageKey);
    const placeModesAllowed = Array.isArray((n as { placeModesAllowed?: string[] }).placeModesAllowed)
      ? [...((n as { placeModesAllowed?: string[] }).placeModesAllowed || [])]
      : undefined;
    const partnerKindsAllowed = Array.isArray((n as { partnerKindsAllowed?: string[] }).partnerKindsAllowed)
      ? [...((n as { partnerKindsAllowed?: string[] }).partnerKindsAllowed || [])]
      : undefined;
    const medicalOnly = !!(n as { medicalOnly?: boolean }).medicalOnly;
    return {
      id: n.id,
      parentId: n.parentId,
      labelAr: n.labelAr,
      sort: n.sort,
      active: n.active,
      browseOnly: !!n.browseOnly,
      writeEnabled: n.browseOnly ? false : writeEnabled,
      imageKey,
      icon: icon ?? null,
      profileId: n.profileId ?? null,
      offerKind: n.offerKind ?? null,
      ...(placeModesAllowed ? { placeModesAllowed } : {}),
      ...(partnerKindsAllowed ? { partnerKindsAllowed } : {}),
      ...(medicalOnly ? { medicalOnly: true } : {}),
      children: [...(n.children || [])],
      fieldIds: meta.fieldIds,
      filterKeys: meta.filterKeys,
    };
  }

  /** Resolve which lane owns a subcategory/category id. */
  findLaneForNodeId(nodeId: string): string | null {
    for (const [lane, doc] of this.docs) {
      if (doc.nodes.some((n) => n.id === nodeId)) return lane;
    }
    return null;
  }

  validateWrite(input: ProductTaxonomyInput, laneHint?: string) {
    const lane =
      laneHint ||
      (input.subcategory && this.findLaneForNodeId(input.subcategory)) ||
      (input.category && this.findLaneForNodeId(input.category)) ||
      'elegance';
    return validateProductTaxonomyWrite(this.requireDoc(lane), input);
  }

  resolveFromSubcategory(subcategory: string) {
    const lane = this.findLaneForNodeId(subcategory) || 'elegance';
    return resolveFromSubcategory(this.requireDoc(lane), subcategory);
  }

  /**
   * Catalog browse helper: resolve a subcategory id to offerKind + profile + parent category.
   * Used so service leaves (e.g. occasions.styling) are not mistaken for Product.subcategory.
   */
  resolveCatalogSubcategory(subcategory: string): {
    id: string;
    lane: string;
    category: string;
    profileId: string | null;
    offerKind: 'product' | 'service' | null;
  } | null {
    const lane = this.findLaneForNodeId(subcategory);
    if (!lane) return null;
    const doc = this.requireDoc(lane);
    const node = doc.nodes.find((n) => n.id === subcategory);
    if (!node || node.browseOnly || !node.parentId) return null;
    if ((node as { grantOnly?: boolean }).grantOnly) return null;
    return {
      id: node.id,
      lane,
      category: node.parentId,
      profileId: node.profileId ?? null,
      offerKind: node.offerKind ?? null,
    };
  }

  /**
   * Browse-only jewelry facets (metal/stone/trait) → attribute filter rewrite.
   * Same product id appears under piece + metal + stone without duplication.
   */
  resolveBrowseFacet(subcategory: string): {
    lane: string;
    clearSubcategory: boolean;
    category?: string;
    attributeSelections?: Record<string, string[]>;
    metalColor?: string;
    metal?: string;
  } | null {
    const lane = this.findLaneForNodeId(subcategory);
    if (!lane) return null;
    const doc = this.requireDoc(lane);
    const node = doc.nodes.find((n) => n.id === subcategory);
    if (!node?.browseOnly) return null;
    const filterAttr = (node as { filterAttribute?: string }).filterAttribute;
    if (!filterAttr) return null;

    if (subcategory.startsWith('jewelry.metal.')) {
      const key = subcategory.slice('jewelry.metal.'.length);
      if (key === 'gold' || key === 'white_gold' || key === 'rose_gold') {
        const color = key === 'gold' ? 'yellow' : key === 'white_gold' ? 'white' : 'rose';
        return {
          lane,
          clearSubcategory: true,
          category: 'jewelry',
          attributeSelections: { metal: ['gold'] },
          metalColor: color === 'yellow' ? undefined : color,
          metal: 'gold',
        };
      }
      if (key === 'silver') {
        return {
          lane,
          clearSubcategory: true,
          category: 'jewelry',
          attributeSelections: { metal: ['silver'] },
          metal: 'silver',
        };
      }
      if (key === 'silver_gold_plated') {
        return {
          lane,
          clearSubcategory: true,
          category: 'jewelry',
          attributeSelections: { metal: ['silver_gold_plated'] },
          metal: 'silver_gold_plated',
        };
      }
    }
    if (subcategory.startsWith('jewelry.stone.')) {
      const stone = subcategory.slice('jewelry.stone.'.length);
      // Colored gems discovery filter — not a product leaf.
      if (stone === 'gemstones') {
        return {
          lane,
          clearSubcategory: true,
          category: 'jewelry',
          attributeSelections: {
            [filterAttr]: ['emerald', 'ruby', 'sapphire', 'other'],
          },
        };
      }
      return {
        lane,
        clearSubcategory: true,
        category: 'jewelry',
        attributeSelections: { [filterAttr]: [stone] },
      };
    }
    if (subcategory.startsWith('jewelry.trait.')) {
      const trait = subcategory.slice('jewelry.trait.'.length);
      return {
        lane,
        clearSubcategory: true,
        category: 'jewelry',
        attributeSelections: { [filterAttr]: [trait] },
      };
    }
    return null;
  }

  phrasesFor(subcategoryId: string) {
    return this.phrases.bySubcategory[subcategoryId] || [];
  }
}
