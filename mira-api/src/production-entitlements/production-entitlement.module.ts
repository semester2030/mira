import { Module } from '@nestjs/common';
import { ProductionEntitlementController } from './production-entitlement.controller';
import { ProductionEntitlementService } from './production-entitlement.service';

@Module({
  controllers: [ProductionEntitlementController],
  providers: [ProductionEntitlementService],
  exports: [ProductionEntitlementService],
})
export class ProductionEntitlementModule {}
