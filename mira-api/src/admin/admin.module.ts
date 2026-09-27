import { Module } from '@nestjs/common';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { PartnersPortalModule } from '../partners-portal/partners-portal.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [UsersModule, PartnersPortalModule, MarketplaceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
