import { Injectable, OnModuleInit } from '@nestjs/common';
import { loadEleganceTaxonomyDoc, validateTaxonomyProfilesExist } from './taxonomy.load';
import type { EleganceTaxonomyDoc, PublicTaxonomyResponse, TaxonomyNode } from './taxonomy.types';
import {
  resolveFromSubcategory,
  validateProductTaxonomyWrite,
  type ProductTaxonomyInput,
} from './product-taxonomy.validate';

@Injectable()
export class TaxonomyService implements OnModuleInit {
  private doc!: EleganceTaxonomyDoc;
  private hash = '';

  onModuleInit() {
    this.reload();
  }

  reload() {
    const loaded = loadEleganceTaxonomyDoc();
    this.doc = loaded.doc;
    this.hash = loaded.hash;
  }

  /**
   * LOCAL/TEST ONLY — bump definitionsVersion (and optional node label) so clients
   * must refresh cache. Refuses outside NODE_ENV=test.
   */
  bumpDefinitionsForTest(opts?: {
    nodeId?: string;
    labelAr?: string;
    active?: boolean;
    deactivateNodeId?: string;
  }) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('bumpDefinitionsForTest is test-only');
    }
    const nodes = this.doc.nodes.map((n) => {
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
    this.doc = {
      ...this.doc,
      definitionsVersion: Number(this.doc.definitionsVersion || 0) + 1,
      nodes,
    };
    this.hash = `test-bump-${this.doc.definitionsVersion}-${Date.now()}`;
    return this.doc.definitionsVersion;
  }

  /** Optional: call after RegistryService load to ensure write-enabled profiles exist. */
  assertProfilesKnown(knownProfileIds: Set<string>) {
    const issues = validateTaxonomyProfilesExist(this.doc, knownProfileIds);
    if (issues.length) {
      throw new Error(`taxonomy profiles missing: ${issues.map((i) => i.detail).join(', ')}`);
    }
  }

  getHash() {
    return this.hash;
  }

  getDoc(): EleganceTaxonomyDoc {
    return this.doc;
  }

  publicProjection(opts?: { includeInactive?: boolean }): PublicTaxonomyResponse {
    const includeInactive = opts?.includeInactive === true;
    const nodes = this.doc.nodes
      .filter((n) => includeInactive || n.active)
      .map((n) => this.toPublic(n))
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    return {
      schemaVersion: this.doc.schemaVersion,
      lane: 'elegance',
      definitionsVersion: this.doc.definitionsVersion,
      compatMinAppBuild: this.doc.compatMinAppBuild,
      nodes,
    };
  }

  private toPublic(n: TaxonomyNode) {
    const writeEnabled = n.browseOnly ? false : n.writeEnabled !== false;
    return {
      id: n.id,
      parentId: n.parentId,
      labelAr: n.labelAr,
      sort: n.sort,
      active: n.active,
      browseOnly: !!n.browseOnly,
      writeEnabled: n.browseOnly ? false : writeEnabled,
      imageKey: n.imageKey ?? null,
      profileId: n.profileId ?? null,
      children: [...(n.children || [])],
    };
  }

  validateWrite(input: ProductTaxonomyInput) {
    return validateProductTaxonomyWrite(this.doc, input);
  }

  resolveFromSubcategory(subcategory: string) {
    return resolveFromSubcategory(this.doc, subcategory);
  }
}
