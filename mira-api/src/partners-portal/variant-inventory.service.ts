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

  /** Active catalog variants for this product (draft wins when draftVariantsSet). */
  knownVariantIds(product: {
    variantsJson: unknown;
    draftVariantsJson: unknown;
    draftVariantsSet: boolean;
  }): Set<string> {
    if (product.draftVariantsSet) {
      if (product.draftVariantsJson == null) return new Set(); // explicit clear
      return variantIdsFromJson(product.draftVariantsJson);
    }
    return variantIdsFromJson(product.variantsJson);
  }

  /**
   * Sum of tracked available qty for variants that belong to the active catalog context.
   * Orphan / deleted-from-catalog rows (not in knownVariantIds) are excluded from the total
   * even if their inventory rows still exist for reservation history.
   */
  async derivedProductStock(productId: string): Promise<{
    inventoryMode: string;
    derivedStockQty: number | null;
    rows: VariantInventoryRow[];
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
      return { inventoryMode: product.inventoryMode || 'product', derivedStockQty: product.stockQty, rows };
    }
    const known = this.knownVariantIds(product);
    let total = 0;
    let anyUnspecified = false;
    for (const row of rows) {
      if (row.archivedAt) continue;
      if (!known.has(row.variantId)) continue; // D4: deleted/orphan variants do not count
      if (row.stockMode === 'untracked') continue;
      if (row.stockQty == null) {
        anyUnspecified = true;
        continue;
      }
      total += Math.max(row.stockQty - row.reservedQty, 0);
    }
    return {
      inventoryMode: 'variant',
      derivedStockQty: anyUnspecified ? null : total,
      rows,
    };
  }

  async list(productId: string): Promise<VariantInventoryRow[]> {
    const rows = await this.prisma.productVariantInventory.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      variantId: r.variantId,
      variantKey: r.variantKey,
      stockMode: r.stockMode === 'untracked' ? 'untracked' : 'tracked',
      stockQty: r.stockQty,
      reservedQty: r.reservedQty,
      revision: r.revision,
      archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    }));
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

    const knownIds = this.knownVariantIds(product);
    const incoming = body.rows || [];

    // Validate entire request before any write — no partial commits of mixed good/bad rows.
    for (const row of incoming) {
      const variantId = String(row.variantId || '').trim();
      if (!variantId) throw new BadRequestException('variantId مطلوب');
      if (!knownIds.has(variantId)) {
        throw new BadRequestException({
          messageAr: 'تركيبة غير موجودة أو لا تتبع هذا المنتج',
          code: 'VARIANT_NOT_ON_PRODUCT',
          variantId,
        });
      }
      if (row.variantKey != null && String(row.variantKey).trim() && String(row.variantKey).trim() !== variantId) {
        // Server identity is variantId; refuse ambiguous client keys that could target another row.
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

      // Block mode switch while outstanding reservations exist on the source being abandoned.
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

      // Re-check known ids inside tx against latest product row.
      const knownInTx = this.knownVariantIds(locked);
      for (const row of incoming) {
        const variantId = String(row.variantId || '').trim();
        if (!knownInTx.has(variantId)) {
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
        const variantKey = variantId; // server-canonical; never trust a divergent client key

        const current = await tx.productVariantInventory.findUnique({
          where: { productId_variantId: { productId, variantId } },
        });

        // D3: updating an existing row requires the revision the editor loaded — never null overwrite.
        if (current) {
          if (row.expectedRevision == null) {
            throw new ConflictException({
              messageAr: 'تعديل مخزون موجود يتطلب رقم مراجعة — أكملي التحميل ثم أعيدي المحاولة',
              code: 'VARIANT_INVENTORY_REVISION_REQUIRED',
              variantId,
              currentRevision: current.revision,
            });
          }
          if (current.revision !== row.expectedRevision) {
            throw new ConflictException({
              messageAr: 'تعارض مراجعة مخزون التركيبة',
              code: 'VARIANT_INVENTORY_REVISION_CONFLICT',
              expectedRevision: row.expectedRevision,
              currentRevision: current.revision,
            });
          }
        }

        // D2: omit stockMode → keep existing; only create defaults to tracked.
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

        const data: Prisma.ProductVariantInventoryUncheckedCreateInput = {
          productId,
          variantId,
          variantKey,
          stockMode,
          stockQty: row.stockQty === undefined ? current?.stockQty ?? null : row.stockQty,
          reservedQty: current?.reservedQty ?? 0,
          revision: (current?.revision ?? 0) + 1,
          archivedAt: row.archive ? new Date() : current?.archivedAt ?? null,
        };

        const saved = current
          ? await tx.productVariantInventory.update({
              where: { id: current.id },
              data: {
                variantKey: data.variantKey,
                stockMode: data.stockMode,
                stockQty: data.stockQty,
                revision: data.revision,
                archivedAt: data.archivedAt,
              },
            })
          : await tx.productVariantInventory.create({ data });

        out.push({
          variantId: saved.variantId,
          variantKey: saved.variantKey,
          stockMode: saved.stockMode === 'untracked' ? 'untracked' : 'tracked',
          stockQty: saved.stockQty,
          reservedQty: saved.reservedQty,
          revision: saved.revision,
          archivedAt: saved.archivedAt ? saved.archivedAt.toISOString() : null,
        });
      }

      // D4: archive inventory rows for variants no longer in the active catalog (keep rows with holds).
      // Re-read product inside the tx so a prior variantsJson clear in this connection is visible.
      const freshCatalog = await tx.product.findUnique({
        where: { id: productId },
        select: { variantsJson: true, draftVariantsJson: true, draftVariantsSet: true },
      });
      const knownNow = this.knownVariantIds(
        freshCatalog || {
          draftVariantsSet: locked.draftVariantsSet,
          variantsJson: locked.variantsJson,
          draftVariantsJson: locked.draftVariantsJson,
        },
      );
      const orphanRows = await tx.productVariantInventory.findMany({
        where: { productId, archivedAt: null },
      });
      for (const orphan of orphanRows) {
        if (knownNow.has(orphan.variantId)) continue;
        if (orphan.reservedQty > 0) continue; // keep for release/consume
        await tx.productVariantInventory.update({
          where: { id: orphan.id },
          data: { archivedAt: new Date(), revision: orphan.revision + 1 },
        });
      }

      void targetMode;
      const derived = await this.derivedInTx(tx, productId);
      return { ok: true, ...derived, updated: out };
    });
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
    const rows = await tx.productVariantInventory.findMany({ where: { productId } });
    const mapped: VariantInventoryRow[] = rows.map((r) => ({
      variantId: r.variantId,
      variantKey: r.variantKey,
      stockMode: r.stockMode === 'untracked' ? 'untracked' : 'tracked',
      stockQty: r.stockQty,
      reservedQty: r.reservedQty,
      revision: r.revision,
      archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    }));
    if (!product || product.inventoryMode !== 'variant') {
      return {
        inventoryMode: product?.inventoryMode || 'product',
        derivedStockQty: product?.stockQty ?? null,
        rows: mapped,
      };
    }
    const known = this.knownVariantIds(product);
    let total = 0;
    let anyUnspecified = false;
    for (const row of mapped) {
      if (row.archivedAt || !known.has(row.variantId) || row.stockMode === 'untracked') continue;
      if (row.stockQty == null) {
        anyUnspecified = true;
        continue;
      }
      total += Math.max(row.stockQty - row.reservedQty, 0);
    }
    return {
      inventoryMode: 'variant',
      derivedStockQty: anyUnspecified ? null : total,
      rows: mapped,
    };
  }

  /** Available units for a variant when inventoryMode=variant; null = untracked. */
  async availableForVariant(productId: string, variantId: string): Promise<number | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { inventoryMode: true, stockQty: true, reservedQty: true },
    });
    if (!product) return null;
    if (product.inventoryMode !== 'variant') {
      if (product.stockQty == null) return null;
      return Math.max(product.stockQty - product.reservedQty, 0);
    }
    const row = await this.prisma.productVariantInventory.findUnique({
      where: { productId_variantId: { productId, variantId } },
    });
    if (!row || row.archivedAt) return 0;
    if (row.stockMode === 'untracked') return null;
    if (row.stockQty == null) return 0; // tracked unspecified → not sellable (distinct from untracked)
    return Math.max(row.stockQty - row.reservedQty, 0);
  }
}
