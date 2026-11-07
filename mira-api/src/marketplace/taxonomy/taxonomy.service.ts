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
    const writeEnabled =
      n.writeEnabled === false ? false : n.browseOnly ? false : n.writeEnabled !== false;
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
