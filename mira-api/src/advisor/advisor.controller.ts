import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AdvisorService } from './advisor.service';
import { AdvisorChatDto } from './dto/advisor-chat.dto';

@Controller('advisor')
@UseGuards(FirebaseAuthGuard)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Post('chat')
  chat(@CurrentUser() user: RequestUser, @Body() dto: AdvisorChatDto) {
    return this.advisorService.chat(user, dto);
  }
}
