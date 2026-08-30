import { Controller, Post } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

/** Reserved public endpoint; fails closed until signed webhooks are implemented. */
@Controller('subscriptions')
export class SubscriptionsWebhookController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('webhook')
  webhook() {
    return this.subscriptionsService.handleStoreWebhook();
  }
}
