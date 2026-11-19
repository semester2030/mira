import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type CatalogGuideProvider = {
  id: string;
  nameAr: string;
  domainAr?: string | null;
  accountTypeNoteAr?: string | null;
  groupLabelsAr?: string | null;
  welcomeCopyAr?: string | null;
  partnerTypes: string[];
};

export type CatalogGuideService = {
  id: string;
  nameAr: string;
  domain?: string | null;
  groupAr?: string | null;
  providerTypeIds: string[];
  bookingModeNoteAr?: string | null;
  groupFieldNotesAr?: string | null;
  serviceFieldNotesAr?: string | null;
  suggestedPhrasesAr: string[];
  taxonomyLeafId?: string | null;
  inScope: boolean;
  profileIdHint?: string | null;
};

export type CatalogGuideDoc = {
  schemaVersion: number;
  source: string;
  notesAr?: string;
  providerCount: number;
  serviceCount: number;
  inScopeServiceCount: number;
  providers: CatalogGuideProvider[];
  services: CatalogGuideService[];
  journey1?: {
    providerTypeId: string;
    serviceIds: string[];
    taxonomyLeaves: string[];
  };
};

/** Templates that must not be offered for new registration (medical / dental). */
export const BLOCKED_SERVICE_TEMPLATE_IDS = new Set([
  'clinic_teeth',
  'clinic_laser',
]);

@Injectable()
export class CatalogGuideService implements OnModuleInit {
  private doc: CatalogGuideDoc | null = null;
  private hash = '';

  onModuleInit() {
    this.reload();
  }

  reload() {
    const path = join(__dirname, 'catalog-guide.v1.json');
    const raw = readFileSync(path, 'utf8');
    this.hash = createHash('sha256').update(raw).digest('hex');
    this.doc = JSON.parse(raw) as CatalogGuideDoc;
  }

  getHash(): string {
    return this.hash;
  }

  getDoc(): CatalogGuideDoc {
    if (!this.doc) this.reload();
    return this.doc!;
  }

  listProviders(): CatalogGuideProvider[] {
    return this.getDoc().providers;
  }

  listServices(opts?: { inScopeOnly?: boolean; providerTypeId?: string }): CatalogGuideService[] {
    let rows = this.getDoc().services;
    if (opts?.inScopeOnly !== false) {
      rows = rows.filter((s) => s.inScope);
    }
    if (opts?.providerTypeId) {
      const id = opts.providerTypeId;
      rows = rows.filter((s) => s.providerTypeIds.includes(id));
    }
    return rows;
  }

  getService(id: string): CatalogGuideService | null {
    return this.getDoc().services.find((s) => s.id === id) ?? null;
  }

  getProvider(id: string): CatalogGuideProvider | null {
    return this.getDoc().providers.find((p) => p.id === id) ?? null;
  }

  /** Resolve kit service id → live taxonomy leaf for discovery. */
  taxonomyLeafForService(serviceId: string): string | null {
    return this.getService(serviceId)?.taxonomyLeafId ?? null;
  }

  phrasesForTaxonomyLeaf(leafId: string): string[] {
    const hit = this.getDoc().services.find((s) => s.taxonomyLeafId === leafId);
    return hit?.suggestedPhrasesAr ?? [];
  }

  journey1(): CatalogGuideDoc['journey1'] {
    return this.getDoc().journey1;
  }

  isTemplateBlocked(templateId: string): boolean {
    return BLOCKED_SERVICE_TEMPLATE_IDS.has(templateId);
  }

  summary() {
    const doc = this.getDoc();
    return {
      schemaVersion: doc.schemaVersion,
      source: doc.source,
      hash: this.hash,
      providerCount: doc.providerCount,
      serviceCount: doc.serviceCount,
      inScopeServiceCount: doc.inScopeServiceCount,
      journey1: doc.journey1,
      mappedTaxonomyLeaves: doc.services
        .filter((s) => s.taxonomyLeafId)
        .map((s) => ({ serviceId: s.id, leaf: s.taxonomyLeafId })),
    };
  }
}
