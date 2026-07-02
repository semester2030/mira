import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AtelierRecolorAttemptService } from './atelier-recolor-attempt.service';

@Module({
  imports: [PrismaModule, UsersModule],
  providers: [AtelierRecolorAttemptService],
  exports: [AtelierRecolorAttemptService],
})
export class AtelierModule {}
