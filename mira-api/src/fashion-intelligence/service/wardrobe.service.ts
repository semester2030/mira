import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newTraceId } from '../../ports/shared/result-meta';
import {
  FASHION_WARDROBE_SCHEMA_VERSION,
} from '../release';
import {
  CanonicalWardrobe,
  CanonicalWardrobeCollection,
  CanonicalWardrobeFavorite,
  CanonicalWardrobeItem,
  CanonicalWardrobeLook,
  CanonicalWardrobeStatistics,
  CanonicalWardrobeUsage,
  FavoriteTargetType,
  WardrobeItemStatus,
} from '../models/canonical-wardrobe';
import { fashionRuntime, toPublicFashionRuntime } from '../runtime/fashion-runtime-state';
import { assertNoFashionProviderLeakage } from '../runtime/fashion-runtime-state';
import { resolveFashionFeatureFlags } from '../feature-flags';
import { InMemoryWardrobeRepository } from '../repository/in-memory.repository';
import {
  assertValidWardrobe,
  validateWardrobe,
} from '../validation/fashion-validators';
import { fashionAuditLog, fashionTelemetry } from '../telemetry/fashion-telemetry';
import { getFashionCapability } from '../capability/fashion-capability-catalog';

function emptyStats(): CanonicalWardrobeStatistics {
  return {
    categoryCounts: {},
    gapHints: [],
    itemCount: 0,
    lookCount: 0,
    collectionCount: 0,
    favoriteCount: 0,
  };
}

function recomputeStats(w: CanonicalWardrobe): CanonicalWardrobeStatistics {
  const active = w.items.filter((i) => i.status === 'active');
  const categoryCounts: Record<string, number> = {};
  for (const item of active) {
    const key = item.entityClass ?? 'garment';
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
  }
  const gapHints: string[] = [];
  if (active.length === 0) {
    gapHints.push('wardrobe_empty');
  }
  if ((categoryCounts['garment'] ?? 0) > 0 && (categoryCounts['shoes'] ?? 0) === 0) {
    // skeleton hint only — not intelligence
    gapHints.push('no_shoes_refs');
  }
  return {
    categoryCounts,
    gapHints,
    coverageScore: active.length === 0 ? 0 : Math.min(1, active.length / 20),
    itemCount: active.length,
    lookCount: w.looks.length,
    collectionCount: w.collections.length,
    favoriteCount: w.favorites.length,
  };
}

@Injectable()
export class WardrobeService {
  constructor(
    private readonly repo: InMemoryWardrobeRepository,
    private readonly config: ConfigService,
  ) {}

  private flags() {
    return resolveFashionFeatureFlags((k, d) => this.config.get(k, d));
  }

  private ensureEnabled(): void {
    if (!this.flags().fashionWardrobeEnabled) {
      throw new Error('Fashion wardrobe capability disabled (FASHION_WARDROBE_ENABLED)');
    }
  }

  async createWardrobe(userId: string): Promise<CanonicalWardrobe> {
    this.ensureEnabled();
    const existing = await this.repo.findByUserId(userId);
    if (existing) return this.toPublic(existing);

    const now = new Date().toISOString();
    const wardrobe: CanonicalWardrobe = {
      wardrobeId: newTraceId('ward'),
      userId,
      version: FASHION_WARDROBE_SCHEMA_VERSION,
      items: [],
      collections: [],
      favorites: [],
      looks: [],
      usage: [],
      statistics: emptyStats(),
      lifecycle: 'active',
      runtime: fashionRuntime({
        status: 'AVAILABLE',
        stage: 'session_persist',
        reasonCode: 'wardrobe_created',
        reasonEn: 'Wardrobe foundation ready.',
        reasonAr: 'أساس الخزانة جاهز.',
        capabilityId: 'wardrobe',
        capabilityVersion: FASHION_WARDROBE_SCHEMA_VERSION,
        traceId: newTraceId('fw'),
      }),
      createdAt: now,
      updatedAt: now,
    };
    assertValidWardrobe(wardrobe);
    const saved = await this.repo.save(wardrobe);
    fashionTelemetry.track({
      name: 'fashion_wardrobe_created',
      traceId: saved.runtime.traceId ?? saved.wardrobeId,
      wardrobeId: saved.wardrobeId,
      capabilityId: 'wardrobe',
    });
    fashionAuditLog.append({
      action: 'wardrobe_created',
      wardrobeId: saved.wardrobeId,
      detail: { userId },
    });
    return this.toPublic(saved);
  }

  async getWardrobe(wardrobeId: string): Promise<CanonicalWardrobe> {
    this.ensureEnabled();
    const w = await this.repo.findById(wardrobeId);
    if (!w) throw new Error(`Wardrobe not found: ${wardrobeId}`);
    return this.toPublic(w);
  }

  async getWardrobeByUser(userId: string): Promise<CanonicalWardrobe | null> {
    this.ensureEnabled();
    const w = await this.repo.findByUserId(userId);
    return w ? this.toPublic(w) : null;
  }

  async addItem(
    wardrobeId: string,
    input: {
      garmentId: string;
      entityClass?: CanonicalWardrobeItem['entityClass'];
      status?: WardrobeItemStatus;
      notes?: string;
      acquiredAt?: string;
    },
  ): Promise<CanonicalWardrobe> {
    this.ensureEnabled();
    const w = await this.require(wardrobeId);
    this.assertLifecycleWritable(w);
    const item: CanonicalWardrobeItem = {
      itemId: newTraceId('witem'),
      garmentId: input.garmentId,
      entityClass: input.entityClass ?? 'garment',
      status: input.status ?? 'active',
      notes: input.notes,
      acquiredAt: input.acquiredAt,
    };
    w.items.push(item);
    w.statistics = recomputeStats(w);
    w.updatedAt = new Date().toISOString();
    w.runtime = fashionRuntime({
      status: 'AVAILABLE',
      stage: 'session_persist',
      reasonCode: 'item_added',
      reasonEn: 'Item reference stored.',
      reasonAr: 'تم تخزين مرجع القطعة.',
      capabilityId: 'wardrobe',
      capabilityVersion: FASHION_WARDROBE_SCHEMA_VERSION,
      traceId: newTraceId('fw'),
    });
    const validation = validateWardrobe(w);
    if (!validation.valid) {
      fashionTelemetry.track({
        name: 'fashion_validation_failed',
        traceId: w.runtime.traceId ?? wardrobeId,
        wardrobeId,
        props: { codes: validation.issues.map((i) => i.code).join(',') },
      });
      throw new Error(
        `Wardrobe validation failed: ${validation.issues.map((i) => i.code).join(',')}`,
      );
    }
    const saved = await this.repo.save(w);
    fashionTelemetry.track({
      name: 'fashion_wardrobe_item_added',
      traceId: saved.runtime.traceId ?? wardrobeId,
      wardrobeId,
      props: { garmentId: item.garmentId },
    });
    fashionAuditLog.append({
      action: 'item_added',
      wardrobeId,
      detail: { garmentId: item.garmentId, itemId: item.itemId },
    });
    return this.toPublic(saved);
  }

  async createCollection(
    wardrobeId: string,
    titleEn: string,
    titleAr: string,
    garmentIds: string[] = [],
    outfitIds: string[] = [],
  ): Promise<{ wardrobe: CanonicalWardrobe; collection: CanonicalWardrobeCollection }> {
    this.ensureEnabled();
    const w = await this.require(wardrobeId);
    this.assertLifecycleWritable(w);
    const now = new Date().toISOString();
    const collection: CanonicalWardrobeCollection = {
      collectionId: newTraceId('wcol'),
      titleEn,
      titleAr,
      garmentIds: [...garmentIds],
      outfitIds: [...outfitIds],
      createdAt: now,
      updatedAt: now,
    };
    w.collections.push(collection);
    w.statistics = recomputeStats(w);
    w.updatedAt = now;
    assertValidWardrobe(w);
    const saved = await this.repo.save(w);
    fashionTelemetry.track({
      name: 'fashion_wardrobe_collection_created',
      traceId: newTraceId('fw'),
      wardrobeId,
      props: { collectionId: collection.collectionId },
    });
    return {
      wardrobe: this.toPublic(saved),
      collection: { ...collection },
    };
  }

  async addFavorite(
    wardrobeId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<{ wardrobe: CanonicalWardrobe; favorite: CanonicalWardrobeFavorite }> {
    this.ensureEnabled();
    const w = await this.require(wardrobeId);
    this.assertLifecycleWritable(w);
    const favorite: CanonicalWardrobeFavorite = {
      favoriteId: newTraceId('wfav'),
      targetType,
      targetId,
      createdAt: new Date().toISOString(),
    };
    w.favorites.push(favorite);
    w.statistics = recomputeStats(w);
    w.updatedAt = favorite.createdAt;
    assertValidWardrobe(w);
    const saved = await this.repo.save(w);
    fashionTelemetry.track({
      name: 'fashion_wardrobe_favorite_added',
      traceId: newTraceId('fw'),
      wardrobeId,
      props: { targetType, targetId },
    });
    return { wardrobe: this.toPublic(saved), favorite: { ...favorite } };
  }

  async createLook(
    wardrobeId: string,
    input: {
      titleEn?: string;
      titleAr?: string;
      outfitId?: string;
      garmentIds: string[];
    },
  ): Promise<{ wardrobe: CanonicalWardrobe; look: CanonicalWardrobeLook }> {
    this.ensureEnabled();
    const w = await this.require(wardrobeId);
    this.assertLifecycleWritable(w);
    const now = new Date().toISOString();
    const look: CanonicalWardrobeLook = {
      lookId: newTraceId('wlook'),
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      outfitId: input.outfitId,
      garmentIds: [...input.garmentIds],
      createdAt: now,
      updatedAt: now,
    };
    w.looks.push(look);
    w.statistics = recomputeStats(w);
    w.updatedAt = now;
    assertValidWardrobe(w);
    const saved = await this.repo.save(w);
    fashionTelemetry.track({
      name: 'fashion_wardrobe_look_created',
      traceId: newTraceId('fw'),
      wardrobeId,
      props: { lookId: look.lookId },
    });
    return { wardrobe: this.toPublic(saved), look: { ...look, garmentIds: [...look.garmentIds] } };
  }

  async recordUsage(
    wardrobeId: string,
    targetId: string,
    targetType: 'garment' | 'outfit',
  ): Promise<CanonicalWardrobe> {
    this.ensureEnabled();
    const w = await this.require(wardrobeId);
    this.assertLifecycleWritable(w);
    const existing = w.usage.find(
      (u) => u.targetId === targetId && u.targetType === targetType,
    );
    const now = new Date().toISOString();
    if (existing) {
      existing.wearCount += 1;
      existing.lastWornAt = now;
    } else {
      const usage: CanonicalWardrobeUsage = {
        targetId,
        targetType,
        wearCount: 1,
        lastWornAt: now,
      };
      w.usage.push(usage);
    }
    w.updatedAt = now;
    assertValidWardrobe(w);
    return this.toPublic(await this.repo.save(w));
  }

  async setLifecycle(
    wardrobeId: string,
    lifecycle: CanonicalWardrobe['lifecycle'],
  ): Promise<CanonicalWardrobe> {
    this.ensureEnabled();
    const w = await this.require(wardrobeId);
    w.lifecycle = lifecycle;
    w.updatedAt = new Date().toISOString();
    assertValidWardrobe(w);
    fashionAuditLog.append({
      action: 'lifecycle_changed',
      wardrobeId,
      detail: { lifecycle },
    });
    return this.toPublic(await this.repo.save(w));
  }

  async insights(wardrobeId: string): Promise<{
    statistics: CanonicalWardrobeStatistics;
    runtime: ReturnType<typeof toPublicFashionRuntime>;
    capabilityId: string;
  }> {
    this.ensureEnabled();
    const cap = getFashionCapability('wardrobe_insights');
    if (!cap?.executionEnabled) {
      throw new Error('wardrobe_insights not enabled');
    }
    const w = await this.require(wardrobeId);
    return {
      statistics: { ...w.statistics, categoryCounts: { ...w.statistics.categoryCounts } },
      runtime: toPublicFashionRuntime(
        fashionRuntime({
          status: 'AVAILABLE',
          stage: 'terminal',
          reasonCode: 'insights_skeleton',
          reasonEn: 'Statistics from refs only — no intelligence engine.',
          reasonAr: 'إحصاءات من المراجع فقط — بدون محرك ذكاء.',
          capabilityId: 'wardrobe_insights',
          capabilityVersion: FASHION_WARDROBE_SCHEMA_VERSION,
        }),
      ),
      capabilityId: 'wardrobe_insights',
    };
  }

  private async require(wardrobeId: string): Promise<CanonicalWardrobe> {
    const w = await this.repo.findById(wardrobeId);
    if (!w) throw new Error(`Wardrobe not found: ${wardrobeId}`);
    return w;
  }

  private assertLifecycleWritable(w: CanonicalWardrobe): void {
    if (w.lifecycle === 'archived') {
      throw new Error('Wardrobe is archived — invalid lifecycle for write');
    }
  }

  private toPublic(w: CanonicalWardrobe): CanonicalWardrobe {
    const dto: CanonicalWardrobe = {
      ...w,
      items: w.items.map((i) => ({ ...i })),
      collections: w.collections.map((c) => ({
        ...c,
        garmentIds: [...c.garmentIds],
        outfitIds: [...c.outfitIds],
      })),
      favorites: w.favorites.map((f) => ({ ...f })),
      looks: w.looks.map((l) => ({ ...l, garmentIds: [...l.garmentIds] })),
      usage: w.usage.map((u) => ({ ...u })),
      statistics: {
        ...w.statistics,
        categoryCounts: { ...w.statistics.categoryCounts },
        gapHints: [...w.statistics.gapHints],
      },
      runtime: toPublicFashionRuntime(w.runtime),
    };
    assertNoFashionProviderLeakage(dto);
    return dto;
  }
}
