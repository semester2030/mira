import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Validate variant.mediaIds on general product save (not only bindVariantMedia).
 * Rejects deleted / foreign / pendingRemoval / not-ready media references.
 */
export async function assertVariantMediaIdsEligible(
  tx: Prisma.TransactionClient,
  productId: string,
  variantsJson: unknown,
): Promise<void> {
  if (variantsJson == null) return;
  if (!Array.isArray(variantsJson)) {
    throw new BadRequestException('قائمة التركيبات غير صالحة');
  }
  const wanted = new Set<string>();
  for (const raw of variantsJson) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const mediaIds = (raw as { mediaIds?: unknown }).mediaIds;
    if (mediaIds == null) continue;
    if (!Array.isArray(mediaIds)) {
      throw new BadRequestException('روابط وسائط التركيبة يجب أن تكون قائمة');
    }
    for (const id of mediaIds) {
      if (typeof id !== 'string' || !id.trim()) {
        throw new BadRequestException('معرف وسيط غير صالح في التركيبة');
      }
      wanted.add(id.trim());
    }
  }
  if (!wanted.size) return;

  const rows = await tx.catalogMedia.findMany({
    where: { ownerKind: 'product', ownerId: productId, id: { in: [...wanted] } },
  });
  if (rows.length !== wanted.size) {
    throw new BadRequestException('وسائط التركيبة يجب أن تتبع نفس المنتج وتكون موجودة');
  }
  for (const row of rows) {
    if (row.pendingRemoval) {
      throw new BadRequestException('لا يمكن ربط وسيط معلّق للإزالة');
    }
    if (!row.storageKey && !(row.url && String(row.url).trim())) {
      throw new BadRequestException('لا يمكن ربط وسيط غير جاهز بتركيبة');
    }
  }
}
