import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from '../users/users.service';
import { IntelligenceService } from './intelligence.service';

@Controller('intelligence')
@UseGuards(FirebaseAuthGuard)
export class IntelligenceController {
  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly usersService: UsersService,
  ) {}

  @Get('progress')
  async progress(@CurrentUser() authUser: RequestUser) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    return this.intelligence.getProgress(user.id);
  }
}
