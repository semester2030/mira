import {
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { playbackContentType } from './catalog-media.http';
import {
  CatalogMediaConnectionError,
  CatalogMediaPermissionError,
  CatalogMediaReadError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
} from './catalog-media.storage';

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
    @Req() _req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.prisma.catalogMedia.findFirst({
      where: { id, active: true, publication: 'published' },
    });
    if (!row?.storageKey) throw new NotFoundException('الوسيط غير منشور');
    const ownerWhere = {
      id: row.ownerId,
      active: true,
      contentStatus: 'published',
      catalogSource: 'catalog',
      partner: { status: 'active' },
    };
    const owner =
      row.ownerKind === 'product'
        ? await this.prisma.product.findFirst({ where: ownerWhere })
        : row.ownerKind === 'service'
          ? await this.prisma.service.findFirst({ where: ownerWhere })
          : null;
    if (!owner) throw new NotFoundException('الوسيط غير منشور');

    const keyHint = row.storageKey.slice(0, 12);
    // Abort only when the response connection drops before completion.
    // req 'close' can fire when the request body/headers are done while the
    // response stream is still transferring — that must not cancel playback.
    const ac = new AbortController();
    let responseCompleted = false;
    const onResponseClose = () => {
      if (!responseCompleted) ac.abort();
    };

    let opened;
    try {
      opened = await this.storage.open(row.storageKey, {
        rangeHeader: range,
        signal: ac.signal,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        console.error('catalog-media-client-aborted', `id=${id} key=${keyHint}…`);
        return;
      }
      if (error instanceof CatalogMediaPermissionError) {
        console.error('catalog-media-permission', `id=${id} key=${keyHint}…`);
        throw new ServiceUnavailableException('تعذر الوصول إلى تخزين الوسائط');
      }
      if (error instanceof CatalogMediaConnectionError) {
        console.error('catalog-media-connection-failed', `id=${id} key=${keyHint}…`);
        throw new ServiceUnavailableException('تعذر الاتصال بتخزين الوسائط');
      }
      if (error instanceof CatalogMediaUnavailable) {
        console.error('catalog-media-durable-unconfigured', `id=${id} key=${keyHint}…`);
        throw new ServiceUnavailableException('تخزين الوسائط الدائم غير مهيأ');
      }
      if (error instanceof CatalogMediaReadError) {
        console.error('catalog-media-read-failed', `id=${id} key=${keyHint}…`);
        throw new ServiceUnavailableException('تعذر قراءة ملف الوسائط');
      }
      console.error('catalog-media-read-failed', `id=${id} key=${keyHint}…`);
      throw new ServiceUnavailableException('تعذر قراءة ملف الوسائط');
    }

    if (!opened) {
      console.error(
        'catalog-media-missing',
        `id=${id} key=${keyHint}… bytes=${row.byteSize ?? 'n/a'}`,
      );
      throw new NotFoundException('الوسيط غير منشور');
    }

    res.setHeader('Accept-Ranges', 'bytes');
    if (opened.status === 416) {
      res.status(416);
      res.setHeader('Content-Range', opened.contentRange);
      return new StreamableFile(Buffer.alloc(0), {
        type: row.mimeType || 'application/octet-stream',
        length: 0,
      });
    }

    const type =
      opened.contentType ||
      (Buffer.isBuffer(opened.body)
        ? playbackContentType(opened.body, row.mimeType)
        : row.mimeType || 'application/octet-stream');

    if (opened.status === 206) {
      res.status(206);
      if (opened.contentRange) res.setHeader('Content-Range', opened.contentRange);
    }

    const release = () => {
      res.off('close', onResponseClose);
      res.off('finish', onResponseFinish);
      opened.abort?.();
    };
    const onResponseFinish = () => {
      responseCompleted = true;
      release();
    };
    res.on('close', onResponseClose);
    res.on('finish', onResponseFinish);

    return new StreamableFile(opened.body as never, {
      type,
      length: opened.contentLength,
    });
  }
}
