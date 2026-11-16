import { Module } from '@nestjs/common';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { ConsultantDiscoveryController } from './consultant-discovery.controller';
import { ConsultantDiscoveryService } from './consultant-discovery.service';

@Module({
  imports: [MarketplaceModule],
  controllers: [ConsultantDiscoveryController],
  providers: [ConsultantDiscoveryService],
  exports: [ConsultantDiscoveryService],
})
export class ConsultantDiscoveryModule {}
