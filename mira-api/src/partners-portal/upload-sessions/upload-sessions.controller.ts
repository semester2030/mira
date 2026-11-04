import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { UploadSessionsService } from './upload-sessions.service';
import { verifyDirectPartToken } from './multipart.store';

type PartnerRequest = { partnerUser: { partnerId: string } };

@Controller('partners-portal')
export class UploadSessionsController {
  constructor(@Inject(UploadSessionsService) private readonly uploads: UploadSessionsService) {}

  @Get('upload-sessions/policy')
  @UseGuards(PartnerTokenGuard)
  policy() {
    return this.uploads.policy();
  }

  @Post('upload-sessions')
  @UseGuards(PartnerTokenGuard)
  initiate(
    @Req() req: PartnerRequest,
    @Body()
    body: {
      ownerKind: 'product' | 'service';
      ownerId: string;
      clientMediaId: string;
      idempotencyKey: string;
      mimeType: string;
      byteSize: number;
      checksum?: string;
      placement?: string;
      clientDraftId?: string;
    },
  ) {
    return this.uploads.initiate(req.partnerUser.partnerId, body);
  }

  @Get('upload-sessions/:id')
  @UseGuards(PartnerTokenGuard)
  get(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.uploads.get(req.partnerUser.partnerId, id);
  }

  @Post('upload-sessions/:id/parts/:partNumber/sign')
  @UseGuards(PartnerTokenGuard)
  sign(@Req() req: PartnerRequest, @Param('id') id: string, @Param('partNumber') partNumber: string) {
    return this.uploads.signPart(req.partnerUser.partnerId, id, Number(partNumber));
  }

  @Post('upload-sessions/:id/complete')
  @UseGuards(PartnerTokenGuard)
  complete(
    @Req() req: PartnerRequest,
    @Param('id') id: string,
    @Body() body: { parts: Array<{ partNumber: number; etag: string; size: number }> },
  ) {
    return this.uploads.complete(req.partnerUser.partnerId, id, body || { parts: [] });
  }

  @Post('upload-sessions/:id/abort')
  @UseGuards(PartnerTokenGuard)
  abort(@Req() req: PartnerRequest, @Param('id') id: string) {
    return this.uploads.abort(req.partnerUser.partnerId, id);
  }

  /**
   * Memory/local adapter only: browser PUTs part bytes here using HMAC query signature.
   * Not used when MIRA_MEDIA_STORE=s3 (presigned R2 URLs).
   */
  @Put('upload-sessions/:id/direct-parts/:partNumber')
  @UseGuards(PartnerTokenGuard)
  async directPart(
    @Req() req: PartnerRequest & { body?: Buffer },
    @Param('id') id: string,
    @Param('partNumber') partNumber: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
  ) {
    const n = Number(partNumber);
    const expN = Number(exp);
    if (!verifyDirectPartToken(id, n, expN, String(sig || ''))) {
      throw new BadRequestException('توقيع الجزء غير صالح أو منتهٍ');
    }
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!bytes.length) throw new BadRequestException('جسم الجزء مفقود');
    return this.uploads.recordDirectPart(req.partnerUser.partnerId, id, n, bytes);
  }
}
