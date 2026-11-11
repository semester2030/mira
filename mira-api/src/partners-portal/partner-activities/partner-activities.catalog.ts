import { Injectable } from '@nestjs/common';
import { TaxonomyService } from '../../marketplace/taxonomy/taxonomy.service';
import { RegistryService } from '../registry/registry.service';
import type { ActivityDef } from './partner-activities.types';

/** Build selectable partner activities from Mira taxonomy + service registry profiles. */
@Injectable()
export class PartnerActivitiesCatalog {
  constructor(
    private readonly taxonomy: TaxonomyService,
    private readonly registry: RegistryService,
  ) {}

  /** Map of activity id → def (leaves only; never roots / *.all / browseOnly). */
  asMap(): Map<string, ActivityDef> {
    const out = new Map<string, ActivityDef>();

    for (const lane of this.taxonomy.listPublicLanes({ audience: 'partner' })) {
      if (!lane.partnerWrite || !lane.hasTaxonomy) continue;
      let doc;
      try {
        doc = this.taxonomy.getDoc(lane.id);
      } catch {
        continue;
      }
      if (!doc?.nodes?.length) continue;
      const byId = new Map(doc.nodes.map((n) => [n.id, n]));
      for (const node of doc.nodes) {
        if (!node.active) continue;
        if (node.browseOnly) continue;
        if (String(node.id).endsWith('.all')) continue;
        if (String(node.id).endsWith('_lane.all')) continue;
        // Parent group nodes have children — not selectable grants.
        if (Array.isArray(node.children) && node.children.length > 0) continue;
        if (node.writeEnabled === false) continue;

        const parent = node.parentId ? byId.get(node.parentId) : null;
        const group =
          (parent && !String(parent.id).endsWith('.all') ? parent.labelAr : null) ||
          lane.labelAr ||
          lane.id;
        const kind: 'product' | 'service' =
          node.offerKind === 'service'
            ? 'service'
            : node.offerKind === 'product'
              ? 'product'
              : lane.offerKind === 'service'
                ? 'service'
                : 'product';

        out.set(node.id, {
          id: node.id,
          label: node.labelAr,
          group,
          kind,
          selectable: true,
          imageKey: node.imageKey ?? null,
          profileId: node.profileId ?? parent?.profileId ?? null,
        });
      }
    }

    // Salon/clinic service profiles not present as taxonomy leaves.
    const profiles = this.registry.metaPayload()?.registry?.profiles || [];
    for (const profile of profiles) {
      if (!profile?.id || profile.kind !== 'service') continue;
      if (profile.enabledByDefault === false || profile.phase === 'FUTURE_EXTENSION') continue;
      if (out.has(profile.id)) continue;
      // Occasions already covered by taxonomy leaves.
      if (profile.id === 'service.occasions') continue;
      const group =
        String(profile.id).includes('clinic') ? 'خدمات العيادة' : 'خدمات الصالون والمستقلات';
      out.set(profile.id, {
        id: profile.id,
        label: (profile as { labelAr?: string }).labelAr || profile.id,
        group,
        kind: 'service',
        selectable: true,
        imageKey: null,
        profileId: profile.id,
      });
    }

    return out;
  }

  list(): ActivityDef[] {
    return [...this.asMap().values()].sort((a, b) =>
      a.group === b.group ? a.label.localeCompare(b.label, 'ar') : a.group.localeCompare(b.group, 'ar'),
    );
  }

  /** Resolve write activity from final product/service taxonomy fields. */
  resolveWriteActivity(input: {
    kind: 'product' | 'service';
    subcategory?: string | null;
    category?: string | null;
    profileId?: string | null;
  }): string | null {
    const map = this.asMap();
    const sub = typeof input.subcategory === 'string' ? input.subcategory.trim() : '';
    if (sub && map.has(sub)) return sub;
    const profile = typeof input.profileId === 'string' ? input.profileId.trim() : '';
    if (profile && map.has(profile)) return profile;
    // Fallback: any leaf under category parent that matches profile — prefer explicit subcategory.
    if (sub) return sub;
    if (profile) return profile;
    const cat = typeof input.category === 'string' ? input.category.trim() : '';
    return cat || null;
  }
}
