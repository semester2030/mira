import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type VariantInventoryRow = {
  variantId: string;
  variantKey: string;
  stockMode: 'tracked' | 'untracked';
  /** null = unspecified (never coerced to 0) */
  stockQty: number | null;
  reservedQty: number;
  revision: number;
  archivedAt: string | null;
};

/** Catalog identity context for validation / derived / archival. */
export type VariantCatalogContext = 'published' | 'draft' | 'writable';

type ProductCatalogSlice = {
  variantsJson: unknown;
  draftVariantsJson: unknown;
  draftVariantsSet: boolean;
};

function variantIdsFromJson(json: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(json)) return ids;
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as { id?: unknown }).id || '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

@Injectable()
export class VariantInventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertProductOwner(partnerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, partnerId } });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    return product;
  }

  /**
   * D4 — explicit catalog contexts:
   * - published: live customer-facing variantsJson only
   * - draft: draftVariantsJson when draftVariantsSet (else published)
   * - writable: union of published + draft so new draft variants can receive stock before approve;
   *   draft clear (null) does not remove published ids from writable set
   */
  knownVariantIds(product: ProductCatalogSlice, context: VariantCatalogContext = 'published'): Set<string> {
    const published = variantIdsFromJson(product.variantsJson);
    if (context === 'published') return published;

    if (context === 'draft') {
      if (!product.draftVariantsSet) return published;
      if (product.draftVariantsJson == null) return new Set();
      return variantIdsFromJson(product.draftVariantsJson);
    }

    // writable
    if (!product.draftVariantsSet) return published;
    if (product.draftVariantsJson == null) return published; // draft clears → still write published until approve
    const draft = variantIdsFromJson(product.draftVariantsJson);
    return new Set([...published, ...draft]);
  }

  /**
   * Customer / sell-side derived total — always published catalog.
   * Orphan rows and draft-only deletions do not shrink published availability.
   */
  async derivedProductStock(productId: string): Promise<{
    inventoryMode: string;
    derivedStockQty: number | null;
    rows: VariantInventoryRow[];
    catalogContext: 'published';
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        inventoryMode: true,
        stockQty: true,
        variantsJson: true,
        draftVariantsJson: true,
        draftVariantsSet: true,
      },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    const rows = await this.list(productId);
    if (product.inventoryMode !== 'variant') {
      return {
        inventoryMode: product.inventoryMode || 'product',
        derivedStockQty: product.stockQty,
        rows,
        catalogContext: 'published',
      };
    }
    const known = this.knownVariantIds(product, 'published');
    return {
      ...this.sumDerived(rows, known, product.inventoryMode || 'variant'),
      catalogContext: 'published',
    };
  }

  async list(productId: string): Promise<VariantInventoryRow[]> {
    const rows = await this.prisma.productVariantInventory.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async upsertMany(
    partnerId: string,
    productId: string,
    body: {
      inventoryMode?: 'product' | 'variant';
      rows?: Array<{
        variantId: string;
        variantKey?: string;
        stockMode?: 'tracked' | 'untracked';
        stockQty?: number | null;
        expectedRevision?: number | null;
        archive?: boolean;
      }>;
    },
  ) {
    const product = await this.assertProductOwner(partnerId, productId);
    if (body.inventoryMode && body.inventoryMode !== 'product' && body.inventoryMode !== 'variant') {
      throw new BadRequestException('inventoryMode غير صالح');
    }

    const writableIds = this.knownVariantIds(product, 'writable');
    const incoming = body.rows || [];

    for (const row of incoming) {
      const variantId = String(row.variantId || '').trim();
      if (!variantId) throw new BadRequestException('variantId مطلوب');
      if (!writableIds.has(variantId)) {
        throw new BadRequestException({
          messageAr: 'تركيبة غير موجودة أو لا تتبع هذا المنتج',
          code: 'VARIANT_NOT_ON_PRODUCT',
          variantId,
        });
      }
      if (row.variantKey != null && String(row.variantKey).trim() && String(row.variantKey).trim() !== variantId) {
        throw new BadRequestException({
          messageAr: 'variantKey يجب أن يطابق معرّف التركيبة',
          code: 'VARIANT_KEY_MISMATCH',
          variantId,
          variantKey: row.variantKey,
        });
      }
      if (row.stockQty != null && (!Number.isInteger(row.stockQty) || row.stockQty < 0)) {
        throw new BadRequestException('stockQty يجب أن يكون عددًا صحيحًا ≥ 0 أو فارغًا');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.product.findUnique({
        where: { id: productId },
        select: {
          inventoryMode: true,
          stockQty: true,
          reservedQty: true,
          variantsJson: true,
          draftVariantsJson: true,
          draftVariantsSet: true,
        },
      });
      if (!locked) throw new NotFoundException('المنتج غير موجود');

      const targetMode = body.inventoryMode || locked.inventoryMode || 'product';

      if (body.inventoryMode && body.inventoryMode !== locked.inventoryMode) {
        if (locked.inventoryMode === 'product' && body.inventoryMode === 'variant') {
          if ((locked.reservedQty || 0) > 0) {
            throw new ConflictException({
              messageAr: 'لا يمكن تحويل نمط المخزون أثناء وجود حجوزات على المخزون الإجمالي',
              code: 'INVENTORY_MODE_SWITCH_BLOCKED_RESERVATIONS',
              reservedQty: locked.reservedQty,
            });
          }
          if (locked.stockQty != null && locked.stockQty > 0) {
            const existing = await tx.productVariantInventory.count({ where: { productId } });
            if (!existing && !incoming.length) {
              throw new BadRequestException(
                'لا يمكن تحويل المخزون الإجمالي إلى تركيبات دون توزيع يؤكده الشريك',
              );
            }
          }
        }
        if (locked.inventoryMode === 'variant' && body.inventoryMode === 'product') {
          const held = await tx.productVariantInventory.aggregate({
            where: { productId, archivedAt: null, reservedQty: { gt: 0 } },
            _sum: { reservedQty: true },
          });
          if ((held._sum.reservedQty || 0) > 0) {
            throw new ConflictException({
              messageAr: 'لا يمكن تحويل نمط المخزون أثناء وجود حجوزات على مخزون التركيبات',
              code: 'INVENTORY_MODE_SWITCH_BLOCKED_RESERVATIONS',
              reservedQty: held._sum.reservedQty,
            });
          }
        }
      }

      const writableInTx = this.knownVariantIds(locked, 'writable');
      for (const row of incoming) {
        const variantId = String(row.variantId || '').trim();
        if (!writableInTx.has(variantId)) {
          throw new BadRequestException({
            messageAr: 'تركيبة غير موجودة أو لا تتبع هذا المنتج',
            code: 'VARIANT_NOT_ON_PRODUCT',
            variantId,
          });
        }
      }

      if (body.inventoryMode) {
        await tx.product.update({
          where: { id: productId },
          data: { inventoryMode: body.inventoryMode },
        });
      }

      const out: VariantInventoryRow[] = [];
      for (const row of incoming) {
        const variantId = String(row.variantId || '').trim();
        const variantKey = variantId;

        const current = await tx.productVariantInventory.findUnique({
          where: { productId_variantId: { productId, variantId } },
        });

        const stockMode =
          row.stockMode === 'untracked'
            ? 'untracked'
            : row.stockMode === 'tracked'
              ? 'tracked'
              : current
                ? current.stockMode === 'untracked'
                  ? 'untracked'
                  : 'tracked'
                : 'tracked';

        if (current && row.stockQty != null && row.stockQty < current.reservedQty) {
          throw new BadRequestException(
            `لا يمكن خفض الكمية دون المحجوز (${current.reservedQty})`,
          );
        }
        if (row.archive && current && current.reservedQty > 0) {
          throw new ConflictException({
            messageAr: 'لا يمكن أرشفة تركيبة لها حجوزات قائمة',
            code: 'VARIANT_ARCHIVE_BLOCKED_RESERVATIONS',
            reservedQty: current.reservedQty,
          });
        }

        const stockQty = row.stockQty === undefined ? current?.stockQty ?? null : row.stockQty;
        // Writing a live catalog variant clears prior archive (prevents old row resurrecting as active incorrectly).
        const archivedAt = row.archive ? new Date() : null;

        if (!current) {
          const saved = await tx.productVariantInventory.create({
            data: {
              productId,
              variantId,
              variantKey,
              stockMode,
              stockQty,
              reservedQty: 0,
              revision: 1,
              archivedAt,
            },
          });
          out.push(this.mapRow(saved));
          continue;
        }

        // D3: existing row requires expectedRevision; write is atomic WHERE revision matches.
        if (row.expectedRevision == null) {
          throw new ConflictException({
            messageAr: 'تعديل مخزون موجود يتطلب رقم مراجعة — أكملي التحميل ثم أعيدي المحاولة',
            code: 'VARIANT_INVENTORY_REVISION_REQUIRED',
            variantId,
            currentRevision: current.revision,
          });
        }

        const updated = await tx.productVariantInventory.updateMany({
          where: { id: current.id, revision: row.expectedRevision },
          data: {
            variantKey,
            stockMode,
            stockQty,
            revision: { increment: 1 },
            archivedAt,
          },
        });
        if (updated.count !== 1) {
          const fresh = await tx.productVariantInventory.findUnique({ where: { id: current.id } });
          throw new ConflictException({
            messageAr: 'تعارض مراجعة مخزون التركيبة',
            code: 'VARIANT_INVENTORY_REVISION_CONFLICT',
            expectedRevision: row.expectedRevision,
            currentRevision: fresh?.revision ?? null,
            variantId,
          });
        }
        const saved = await tx.productVariantInventory.findUniqueOrThrow({ where: { id: current.id } });
        out.push(this.mapRow(saved));
      }

      // D4: archive true orphans only — never archive draft-new or still-published rows on draft save.
      await this.archiveOrphansAgainstCatalog(tx, productId);

      void targetMode;
      // Response must reflect final revision after archival side-effects in the same transaction.
      const finalUpdated: VariantInventoryRow[] = [];
      for (const row of out) {
        const freshRow = await tx.productVariantInventory.findUnique({
          where: { productId_variantId: { productId, variantId: row.variantId } },
        });
        if (freshRow) finalUpdated.push(this.mapRow(freshRow));
      }
      const derived = await this.derivedInTx(tx, productId);
      return { ok: true, ...derived, updated: finalUpdated };
    });
  }

  /**
   * After draft approve publishes a smaller variantsJson, archive inventory for removed published variants
   * (keep rows with outstanding reservations) and reactivate rows that are now published.
   */
  async archiveOrphansAfterPublish(productId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.reactivatePublishedInventory(tx, productId);
      await this.archiveOrphansAgainstCatalog(tx, productId);
    });
  }

  /**
   * Protect published ∪ current draft identities. A draft-only new variant is not an orphan.
   * True orphans = inventory rows outside that protect set (and without held reservations).
   */
  private async archiveOrphansAgainstCatalog(tx: Prisma.TransactionClient, productId: string) {
    const fresh = await tx.product.findUnique({
      where: { id: productId },
      select: { variantsJson: true, draftVariantsJson: true, draftVariantsSet: true },
    });
    if (!fresh) return;
    const protect = this.knownVariantIds(fresh, 'writable');
    const orphanRows = await tx.productVariantInventory.findMany({
      where: { productId, archivedAt: null },
    });
    for (const orphan of orphanRows) {
      if (protect.has(orphan.variantId)) continue;
      if (orphan.reservedQty > 0) continue;
      await tx.productVariantInventory.update({
        where: { id: orphan.id },
        data: { archivedAt: new Date(), revision: orphan.revision + 1 },
      });
    }
  }

  /** Clear archive on rows that belong to the live published catalog (e.g. after approve). */
  private async reactivatePublishedInventory(tx: Prisma.TransactionClient, productId: string) {
    const fresh = await tx.product.findUnique({
      where: { id: productId },
      select: { variantsJson: true, draftVariantsJson: true, draftVariantsSet: true },
    });
    if (!fresh) return;
    const published = this.knownVariantIds(fresh, 'published');
    if (!published.size) return;
    const rows = await tx.productVariantInventory.findMany({
      where: { productId, archivedAt: { not: null } },
    });
    for (const row of rows) {
      if (!published.has(row.variantId)) continue;
      await tx.productVariantInventory.update({
        where: { id: row.id },
        data: { archivedAt: null, revision: row.revision + 1 },
      });
    }
  }

  private async derivedInTx(tx: Prisma.TransactionClient, productId: string) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        inventoryMode: true,
        stockQty: true,
        variantsJson: true,
        draftVariantsJson: true,
        draftVariantsSet: true,
      },
    });
    const rows = (await tx.productVariantInventory.findMany({ where: { productId } })).map((r) => this.mapRow(r));
    if (!product || product.inventoryMode !== 'variant') {
      return {
        inventoryMode: product?.inventoryMode || 'product',
        derivedStockQty: product?.stockQty ?? null,
        rows,
        catalogContext: 'published' as const,
      };
    }
    const known = this.knownVariantIds(product, 'published');
    return { ...this.sumDerived(rows, known, 'variant'), catalogContext: 'published' as const };
  }

  private sumDerived(rows: VariantInventoryRow[], known: Set<string>, inventoryMode: string) {
    let total = 0;
    let anyUnspecified = false;
    for (const row of rows) {
      if (row.archivedAt) continue;
      if (!known.has(row.variantId)) continue;
      if (row.stockMode === 'untracked') continue;
      if (row.stockQty == null) {
        anyUnspecified = true;
        continue;
      }
      total += Math.max(row.stockQty - row.reservedQty, 0);
    }
    return {
      inventoryMode,
      derivedStockQty: anyUnspecified ? null : total,
      rows,
    };
  }

  private mapRow(r: {
    variantId: string;
    variantKey: string;
    stockMode: string;
    stockQty: number | null;
    reservedQty: number;
    revision: number;
    archivedAt: Date | null;
  }): VariantInventoryRow {
    return {
      variantId: r.variantId,
      variantKey: r.variantKey,
      stockMode: r.stockMode === 'untracked' ? 'untracked' : 'tracked',
      stockQty: r.stockQty,
      reservedQty: r.reservedQty,
      revision: r.revision,
      archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    };
  }

  /**
   * Available units for a published variant when inventoryMode=variant; null = untracked.
   * Draft-only variants (not in published catalog) are not sellable here.
   */
  async availableForVariant(productId: string, variantId: string): Promise<number | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        inventoryMode: true,
        stockQty: true,
        reservedQty: true,
        variantsJson: true,
        draftVariantsJson: true,
        draftVariantsSet: true,
      },
    });
    if (!product) return null;
    if (product.inventoryMode !== 'variant') {
      if (product.stockQty == null) return null;
      return Math.max(product.stockQty - product.reservedQty, 0);
    }
    const published = this.knownVariantIds(product, 'published');
    if (!published.has(variantId)) return 0;
    const row = await this.prisma.productVariantInventory.findUnique({
      where: { productId_variantId: { productId, variantId } },
    });
    if (!row || row.archivedAt) return 0;
    if (row.stockMode === 'untracked') return null;
    if (row.stockQty == null) return 0;
    return Math.max(row.stockQty - row.reservedQty, 0);
  }
}
