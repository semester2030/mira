import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(FirebaseAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.subscriptionsService.getStatus(user);
  }

  /** Dev/staging: activate premium without App Store. */
  @Post('dev/activate-premium')
  activatePremiumDev(@CurrentUser() user: RequestUser) {
    return this.subscriptionsService.activatePremiumDev(user);
  }
}
