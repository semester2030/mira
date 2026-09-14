import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ProductionEntitlementService } from './production-entitlement.service';

/**
 * Authenticated runtime capability contract.
 * Does not expose allowlist, other UIDs, or provider internals.
 */
@Controller('entitlements')
@UseGuards(FirebaseAuthGuard)
export class ProductionEntitlementController {
  constructor(private readonly entitlements: ProductionEntitlementService) {}

  @Get('runtime')
  runtime(@CurrentUser() authUser: RequestUser) {
    const snap = this.entitlements.resolveForFirebaseUid(authUser.firebaseUid);
    return {
      faceExperienceV1: snap.faceExperienceV1,
      fashionAdvisorModeB: snap.fashionAdvisorModeB,
      version: snap.version,
    };
  }
}
