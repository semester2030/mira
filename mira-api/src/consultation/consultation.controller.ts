import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from '../users/users.service';
import { CreateConsultationSessionDto } from './dto/create-session.dto';
import { SendConsultationMessageDto } from './dto/send-message.dto';
import { UpdateConsultationContextDto } from './dto/update-session-context.dto';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { ConsultationMessageService } from './services/consultation-message.service';
import { ConsultationSessionService } from './services/consultation-session.service';

@Controller('consultation')
@UseGuards(FirebaseAuthGuard)
export class ConsultationController {
  constructor(
    private readonly orchestrator: ConsultationOrchestratorService,
    private readonly sessions: ConsultationSessionService,
    private readonly messages: ConsultationMessageService,
    private readonly users: UsersService,
  ) {}

  @Post('sessions')
  createSession(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConsultationSessionDto,
  ) {
    return this.orchestrator.createSession(user, dto);
  }

  @Get('sessions')
  async listSessions(@CurrentUser() user: RequestUser) {
    const dbUser = await this.users.findOrCreateFromFirebase(user);
    const rows = await this.sessions.list(dbUser.id);
    return rows.map((r) => this.sessions.toDto(r));
  }

  @Get('sessions/:id/messages')
  async listMessages(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
  ) {
    const dbUser = await this.users.findOrCreateFromFirebase(user);
    await this.sessions.getForUser(dbUser.id, sessionId);
    return this.messages.list(sessionId);
  }

  @Post('sessions/:id/messages')
  sendMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @Body() dto: SendConsultationMessageDto,
  ) {
    return this.orchestrator.sendMessage(user, sessionId, dto);
  }

  @Post('sessions/:id/messages/stream')
  streamMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @Body() dto: SendConsultationMessageDto,
    @Res() res: Response,
  ) {
    return this.orchestrator.sendMessageStream(user, sessionId, dto, res);
  }

  @Patch('sessions/:id/context')
  bindContext(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @Body() dto: UpdateConsultationContextDto,
  ) {
    return this.orchestrator.bindContext(user, sessionId, dto);
  }

  @Delete('sessions/:id')
  deleteSession(@CurrentUser() user: RequestUser, @Param('id') sessionId: string) {
    return this.orchestrator.deleteSession(user, sessionId);
  }
}
