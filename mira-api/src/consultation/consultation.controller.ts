import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Query,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { ConsultationDialogueService } from './services/consultation-attachment.service';
import { attachmentTokenSecret, verifyReadToken } from './services/consultation-dialogue';
import { ConfigService } from '@nestjs/config';

@Controller('consultation')
@UseGuards(FirebaseAuthGuard)
export class ConsultationController {
  constructor(
    @Inject(ConsultationOrchestratorService) private readonly orchestrator: ConsultationOrchestratorService,
    @Inject(ConsultationSessionService) private readonly sessions: ConsultationSessionService,
    @Inject(ConsultationMessageService) private readonly messages: ConsultationMessageService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsultationDialogueService) private readonly dialogue: ConsultationDialogueService,
    @Inject(ConfigService) private readonly config: ConfigService,
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

  @Get('limits')
  limits() {
    return this.dialogue.limits;
  }

  @Get('sessions/:id/messages')
  async listMessages(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const dbUser = await this.users.findOrCreateFromFirebase(user);
    await this.sessions.getForUser(dbUser.id, sessionId);
    const parsed = Number(limit);
    return this.messages.listPage(sessionId, {
      beforeId: before,
      limit: Number.isFinite(parsed) ? parsed : undefined,
    });
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

  @Post('sessions/:id/attachments')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 8_000_000 } }))
  async upload(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dbUser = await this.users.findOrCreateFromFirebase(user);
    await this.sessions.getForUser(dbUser.id, sessionId);
    if (!file?.buffer?.length) {
      return { status: 'failed', messageAr: 'لم نستلم صورة.' };
    }
    const saved = await this.dialogue.save({ userId: dbUser.id, sessionId, bytes: file.buffer });
    return {
      id: saved.id,
      status: saved.status,
      mimeType: saved.mimeType,
      byteSize: saved.byteSize,
      width: saved.width,
      height: saved.height,
      readToken: this.dialogue.readToken(dbUser.id, saved.id) ?? undefined,
    };
  }

  @Get('attachments/:id')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const dbUser = await this.users.findOrCreateFromFirebase(user);
    const row = await this.dialogue.readOwned(dbUser.id, attachmentId);
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(row.bytes ?? Buffer.alloc(0));
  }

  @Get('attachments/:id/token/:token')
  async downloadWithToken(
    @Param('id') attachmentId: string,
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const secret = attachmentTokenSecret({
      attachmentSecret: this.config.get<string>('MCE_ATTACHMENT_TOKEN_SECRET'),
      jwtSecret: this.config.get<string>('JWT_SECRET'),
    });
    if (!secret) return { status: 'failed', messageAr: 'روابط الصور المؤقتة غير مفعّلة. استخدمي القراءة بعد تسجيل الدخول.' };
    const parsed = verifyReadToken(token, secret, Math.floor(Date.now() / 1000));
    if (!parsed || parsed.attachmentId !== attachmentId) {
      return { status: 'failed', messageAr: 'انتهت صلاحية رابط الصورة.' };
    }
    const row = await this.dialogue.readOwned(parsed.userId, attachmentId);
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(row.bytes ?? Buffer.alloc(0));
  }

  @Delete('attachments/:id')
  async removeAttachment(@CurrentUser() user: RequestUser, @Param('id') attachmentId: string) {
    const dbUser = await this.users.findOrCreateFromFirebase(user);
    await this.dialogue.removeUnsent(dbUser.id, attachmentId);
    return { deleted: true };
  }
}
