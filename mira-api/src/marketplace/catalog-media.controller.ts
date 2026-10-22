import { Controller, Get, Headers, Inject, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { playbackContentType, sliceMediaRange } from './catalog-media.http';
import { CatalogMediaConnectionError, CatalogMediaPermissionError, CatalogMediaStorage } from './catalog-media.storage';

@Controller('marketplace')
export class CatalogMediaController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogMediaStorage) private readonly storage: CatalogMediaStorage,
  ) {}

  @Get('media/:id')
  async published(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
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
    const keyHint = row.storageKey.slice(0, 12);
    try {
      bytes = await this.storage.get(row.storageKey);
    } catch (error) {
      if (error instanceof CatalogMediaPermissionError) {
        console.error('catalog-media-permission', `id=${id} key=${keyHint}…`);
      } else if (error instanceof CatalogMediaConnectionError) {
        console.error('catalog-media-connection-failed', `id=${id} key=${keyHint}…`);
      } else {
        console.error('catalog-media-read-failed', `id=${id} key=${keyHint}…`);
      }
      throw new NotFoundException('الوسيط غير منشور');
    }
    if (!bytes) {
      // Object absent from durable store (NoSuchKey) — DB row + product remain published.
      console.error('catalog-media-missing', `id=${id} key=${keyHint}… bytes=${row.byteSize ?? 'n/a'}`);
      throw new NotFoundException('الوسيط غير منشور');
    }
    const type = playbackContentType(bytes, row.mimeType);
    const sliced = sliceMediaRange(bytes.length, range);
    res.setHeader('Accept-Ranges', 'bytes');
    if (sliced.status === 416) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${bytes.length}`);
      return new StreamableFile(Buffer.alloc(0), { type, length: 0 });
    }
    const body = sliced.status === 206 ? bytes.subarray(sliced.start, sliced.end + 1) : bytes;
    if (sliced.status === 206) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${sliced.start}-${sliced.end}/${bytes.length}`);
    }
    return new StreamableFile(body, { type, length: body.length });
  }
}
