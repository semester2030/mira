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

@Injectable()
export class VariantInventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertProductOwner(partnerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, partnerId } });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    return product;
  }

  /** Sum of tracked available qty; null when any tracked row is unspecified or mode is product. */
  async derivedProductStock(productId: string): Promise<{
    inventoryMode: string;
    derivedStockQty: number | null;
    rows: VariantInventoryRow[];
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { inventoryMode: true, stockQty: true },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    const rows = await this.list(productId);
    if (product.inventoryMode !== 'variant') {
      return { inventoryMode: product.inventoryMode || 'product', derivedStockQty: product.stockQty, rows };
    }
    let total = 0;
    let anyUnspecified = false;
    for (const row of rows) {
      if (row.archivedAt) continue;
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

    // Switching product→variant without confirmed distribution is refused when product has stock.
    if (body.inventoryMode === 'variant' && product.inventoryMode !== 'variant') {
      if (product.stockQty != null && product.stockQty > 0) {
        const existing = await this.prisma.productVariantInventory.count({ where: { productId } });
        if (!existing && !(body.rows && body.rows.length)) {
          throw new BadRequestException(
            'لا يمكن تحويل المخزون الإجمالي إلى تركيبات دون توزيع يؤكده الشريك',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (body.inventoryMode) {
        await tx.product.update({
          where: { id: productId },
          data: { inventoryMode: body.inventoryMode },
        });
      }

      const out: VariantInventoryRow[] = [];
      for (const row of body.rows || []) {
        const variantId = String(row.variantId || '').trim();
        if (!variantId) throw new BadRequestException('variantId مطلوب');
        const variantKey = String(row.variantKey || variantId).trim() || variantId;
        const stockMode = row.stockMode === 'untracked' ? 'untracked' : 'tracked';
        if (row.stockQty != null && (!Number.isInteger(row.stockQty) || row.stockQty < 0)) {
          throw new BadRequestException('stockQty يجب أن يكون عددًا صحيحًا ≥ 0 أو فارغًا');
        }

        const current = await tx.productVariantInventory.findUnique({
          where: { productId_variantId: { productId, variantId } },
        });
        if (current && row.expectedRevision != null && current.revision !== row.expectedRevision) {
          throw new ConflictException({
            messageAr: 'تعارض مراجعة مخزون التركيبة',
            code: 'VARIANT_INVENTORY_REVISION_CONFLICT',
            expectedRevision: row.expectedRevision,
            currentRevision: current.revision,
          });
        }
        if (current && row.stockQty != null && row.stockQty < current.reservedQty) {
          throw new BadRequestException(
            `لا يمكن خفض الكمية دون المحجوز (${current.reservedQty})`,
          );
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

      const derived = await this.derivedInTx(tx, productId);
      return { ok: true, ...derived, updated: out };
    });
  }

  private async derivedInTx(tx: Prisma.TransactionClient, productId: string) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { inventoryMode: true, stockQty: true },
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
    let total = 0;
    let anyUnspecified = false;
    for (const row of mapped) {
      if (row.archivedAt || row.stockMode === 'untracked') continue;
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

  /** Available units for a variant when inventoryMode=variant; null = untracked/unspecified. */
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
    if (!row || row.archivedAt || row.stockMode === 'untracked') return null;
    if (row.stockQty == null) return null;
    return Math.max(row.stockQty - row.reservedQty, 0);
  }
}
