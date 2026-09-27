import { Controller, Get, Inject, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogMediaConnectionError, CatalogMediaPermissionError, CatalogMediaStorage } from './catalog-media.storage';

@Controller('marketplace')
export class CatalogMediaController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  @Get('media/:id')
  async published(@Param('id') id: string) {
    const row = await this.prisma.catalogMedia.findFirst({
      where: { id, active: true, publication: 'published' },
    });
    if (!row?.storageKey) throw new NotFoundException('الوسيط غير منشور');
    const ownerWhere = { id: row.ownerId, active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active' } };
    const owner = row.ownerKind === 'product'
      ? await this.prisma.product.findFirst({ where: ownerWhere })
      : row.ownerKind === 'service'
        ? await this.prisma.service.findFirst({ where: ownerWhere })
        : null;
    if (!owner) throw new NotFoundException('الوسيط غير منشور');
    let bytes: Buffer | null;
    try {
      bytes = await this.storage.get(row.storageKey);
    } catch (error) {
      if (error instanceof CatalogMediaPermissionError) console.error('catalog-media-permission');
      else if (error instanceof CatalogMediaConnectionError) console.error('catalog-media-connection-failed');
      else console.error('catalog-media-read-failed');
      throw new NotFoundException('الوسيط غير منشور');
    }
    if (!bytes) {
      console.error('catalog-media-missing');
      throw new NotFoundException('الوسيط غير منشور');
    }
    return new StreamableFile(bytes, { type: row.mimeType ?? 'application/octet-stream' });
  }
}
