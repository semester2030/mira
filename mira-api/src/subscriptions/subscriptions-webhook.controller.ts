import { Body, Controller, Post } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

/** Public endpoint for App Store / RevenueCat webhooks (verify signature before production). */
@Controller('subscriptions')
export class SubscriptionsWebhookController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('webhook')
  webhook(@Body() body: Record<string, unknown>) {
    return this.subscriptionsService.handleStoreWebhook(body);
  }
}
