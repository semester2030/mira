import { Body, Controller, Get, Inject, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { CatalogContentService } from './catalog-content.service';

@Controller('admin')
@UseGuards(AdminApiKeyGuard)
export class CatalogReviewAdminController {
  constructor(@Inject(CatalogContentService) private readonly content: CatalogContentService) {}

  @Get('catalog-reviews')
  list() {
    return this.content.listReviews();
  }

  @Get('catalog-review-media/:id')
  async media(@Param('id') id: string) {
    const file = await this.content.readReviewMedia(id);
    return new StreamableFile(file.bytes, { type: file.mimeType });
  }

  @Get('catalog-reviews/:kind/:id')
  preview(@Param('kind') kind: 'product' | 'service', @Param('id') id: string) {
    return this.content.preview(null, kind, id);
  }

  @Post('catalog-reviews/:kind/:id/decision')
  decide(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: { decision?: string; note?: string; revision?: number },
  ) {
    return this.content.decide('admin-key', kind, id, body?.decision, body?.note, body?.revision);
  }
}
