import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PartnerRequest, PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CreatorProfileService } from './creator-profile.service';

function record(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

@Controller('partners-portal')
export class CreatorProfilePartnerController {
  constructor(@Inject(CreatorProfileService) private readonly creators: CreatorProfileService) {}

  @Get('creator-profile')
  @UseGuards(PartnerTokenGuard)
  mine(@Req() request: PartnerRequest) {
    return this.creators.mine(request.partnerUser.partnerId);
  }

  @Put('creator-profile')
  @UseGuards(PartnerTokenGuard)
  upsert(@Req() request: PartnerRequest, @Body() body: unknown) {
    return this.creators.registerOrUpdate(request.partnerUser.partnerId, record(body));
  }

  @Post('creator-profile/avatar')
  @UseGuards(PartnerTokenGuard)
  avatar(@Req() request: PartnerRequest, @Body() body: unknown) {
    const data = record(body);
    return this.creators.setAvatar(request.partnerUser.partnerId, {
      mimeType: typeof data.mimeType === 'string' ? data.mimeType : '',
      dataBase64: typeof data.dataBase64 === 'string' ? data.dataBase64 : '',
    });
  }
}

@Controller('marketplace')
export class CreatorProfilePublicController {
  constructor(@Inject(CreatorProfileService) private readonly creators: CreatorProfileService) {}

  @Get('creators')
  directory(@Query('cursor') cursor?: string, @Query('limit') limitRaw?: string) {
    const limit = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;
    return this.creators.directory({
      cursor: typeof cursor === 'string' && cursor.trim() ? cursor.trim() : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get('creators/:id')
  profile(@Param('id') id: string) {
    return this.creators.publicProfile(id);
  }

  @Get('creators/:id/avatar')
  async avatar(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.creators.readAvatar(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return new StreamableFile(file.bytes);
  }
}
