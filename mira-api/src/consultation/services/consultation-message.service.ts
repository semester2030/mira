import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';
import { ConsultationMessageResponseDto } from '../dto/consultation-response.dto';
import { classifyClientTurn, requestFingerprint, STALE_TURN_MS } from './consultation-dialogue';

@Injectable()
export class ConsultationMessageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPage(sessionId: string, options?: { beforeId?: string; limit?: number }) {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const upper = options?.beforeId
      ? await this.prisma.consultationMessage.findFirst({
        where: { id: options.beforeId, sessionId },
        select: { id: true, createdAt: true },
      })
      : null;
    if (options?.beforeId && !upper) throw new NotFoundException('المؤشر غير موجود في هذه المحادثة.');
    const rows = await this.prisma.consultationMessage.findMany({
      where: {
        sessionId,
        ...(upper
          ? {
            OR: [
              { createdAt: { lt: upper.createdAt } },
              { createdAt: upper.createdAt, id: { lt: upper.id } },
            ],
          }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    return {
      messages: page.map((row) => this.toDto(row)),
      nextCursor: hasMore ? page[0]?.id ?? null : null,
    };
  }

  async list(sessionId: string, limit = 50): Promise<ConsultationMessageResponseDto[]> {
    const page = await this.listPage(sessionId, { limit });
    return page.messages;
  }

  async recentPairs(sessionId: string, limit = 8) {
    const rows = await this.prisma.consultationMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows
      .reverse()
      .map((row) => {
        const payload = row.payloadJson as { attachmentIds?: string[] } | null;
        return {
          role: row.role as 'user' | 'assistant',
          content: row.contentAr,
          attachmentIds: Array.isArray(payload?.attachmentIds) ? payload.attachmentIds : [],
        };
      });
  }

  async recoverStuck(sessionId: string, now = new Date(), staleMs = STALE_TURN_MS): Promise<number> {
    const cutoff = new Date(now.getTime() - staleMs);
    const pending = await this.prisma.consultationMessage.findMany({
      where: {
        sessionId,
        role: 'user',
        turnStatus: 'pending',
        OR: [
          { attemptExpiresAt: { lt: now } },
          { attemptExpiresAt: null, createdAt: { lt: cutoff } },
        ],
      },
    });
    let changed = 0;
    for (const user of pending) {
      if (await this.commitStuckRecovery(user) === 'recovered') changed += 1;
    }
    return changed;
  }

  async commitStuckRecovery(snapshot: {
    id: string;
    attemptToken: string | null;
    attemptExpiresAt: Date | null;
  }): Promise<'recovered' | 'skipped'> {
    const assistant = await this.assistantFor(snapshot.id);
    const updated = await this.prisma.consultationMessage.updateMany({
      where: {
        id: snapshot.id,
        turnStatus: 'pending',
        attemptToken: snapshot.attemptToken,
        attemptExpiresAt: snapshot.attemptExpiresAt,
      },
      data: { turnStatus: assistant ? 'complete' : 'failed' },
    });
    return updated.count === 1 ? 'recovered' : 'skipped';
  }

  async assistantFor(userMessageId: string) {
    return this.prisma.consultationMessage.findFirst({
      where: { role: 'assistant', replyToMessageId: userMessageId },
    });
  }

  async claimUser(input: {
    sessionId: string;
    contentAr: string;
    attachmentIds?: string[];
    clientMessageId?: string;
  }) {
    const requestHash = requestFingerprint(input.contentAr, input.attachmentIds ?? []);
    const attemptToken = input.clientMessageId ? randomUUID() : null;
    const attemptExpiresAt = input.clientMessageId ? new Date(Date.now() + STALE_TURN_MS) : null;
    const data = {
      sessionId: input.sessionId,
      role: 'user',
      contentAr: input.contentAr,
      clientMessageId: input.clientMessageId,
      requestHash,
      turnStatus: input.clientMessageId ? 'pending' : 'complete',
      attemptToken,
      attemptExpiresAt,
      payloadJson: { attachmentIds: input.attachmentIds ?? [], clientMessageId: input.clientMessageId },
    };
    try {
      const user = await this.prisma.consultationMessage.create({ data });
      return { status: 'created' as const, user, attemptToken };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || !input.clientMessageId) {
        throw error;
      }
    }
    const found = await this.loadClientTurn(input.sessionId, input.clientMessageId);
    const state = classifyClientTurn(found, { clientMessageId: input.clientMessageId, requestHash });
    if (state.status === 'resume') {
      const now = new Date();
      const attemptToken = randomUUID();
      const updated = await this.prisma.consultationMessage.updateMany({
        where: {
          id: state.user.id,
          OR: [
            { turnStatus: 'failed' },
            { turnStatus: 'pending', attemptExpiresAt: { lt: now } },
          ],
        },
        data: {
          turnStatus: 'pending',
          attemptToken,
          attemptExpiresAt: new Date(now.getTime() + STALE_TURN_MS),
        },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'MCE_TURN_IN_PROGRESS', message: 'الطلب نفسه ما زال قيد المعالجة.' });
      return { status: 'resume' as const, user: state.user, attemptToken };
    }
    if (state.status === 'complete') return { status: 'complete' as const, user: state.user, assistant: state.assistant };
    if (state.status === 'conflict') {
      throw new ConflictException({ code: 'MCE_CLIENT_MESSAGE_CONFLICT', message: 'معرّف الطلب مستخدم بمحتوى مختلف.' });
    }
    throw new ConflictException({ code: 'MCE_TURN_IN_PROGRESS', message: 'الطلب نفسه ما زال قيد المعالجة.' });
  }

  async holdsLease(messageId: string, attemptToken: string, now = new Date()): Promise<boolean> {
    const row = await this.prisma.consultationMessage.findUnique({ where: { id: messageId } });
    if (!row || row.attemptToken !== attemptToken || row.turnStatus !== 'pending' || !row.attemptExpiresAt) return false;
    return row.attemptExpiresAt.getTime() > now.getTime();
  }

  async markTurn(messageId: string, turnStatus: 'pending' | 'complete' | 'failed') {
    await this.prisma.consultationMessage.update({ where: { id: messageId }, data: { turnStatus } });
  }

  async markOwned(
    messageId: string,
    attemptToken: string,
    turnStatus: 'pending' | 'complete' | 'failed',
  ): Promise<boolean> {
    const updated = await this.prisma.consultationMessage.updateMany({
      where: { id: messageId, attemptToken, turnStatus: 'pending' },
      data: { turnStatus },
    });
    return updated.count === 1;
  }

  async persistAssistant(
    sessionId: string,
    contentAr: string,
    payload: MceAssistantPayloadV1,
    meta: { modelId?: string; tokenCountOut?: number; latencyMs: number; blocked: boolean; replyToMessageId: string; attemptToken?: string | null },
  ) {
    if (meta.attemptToken && !(await this.holdsLease(meta.replyToMessageId, meta.attemptToken))) {
      const existing = await this.assistantFor(meta.replyToMessageId);
      if (existing) return existing;
      throw new ConflictException({ code: 'MCE_TURN_LEASE_LOST', message: 'انتهت محاولة هذا الطلب بعد بدء محاولة أحدث.' });
    }
    try {
      return await this.prisma.consultationMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          contentAr,
          payloadJson: payload as object,
          modelId: meta.modelId,
          tokenCountOut: meta.tokenCountOut,
          latencyMs: meta.latencyMs,
          blocked: meta.blocked,
          replyToMessageId: meta.replyToMessageId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.assistantFor(meta.replyToMessageId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async loadClientTurn(sessionId: string, clientMessageId: string) {
    const user = await this.prisma.consultationMessage.findFirst({
      where: { sessionId, role: 'user', clientMessageId },
    });
    if (!user) return [];
    const assistants = await this.prisma.consultationMessage.findMany({
      where: { sessionId, role: 'assistant', replyToMessageId: user.id },
    });
    return [user, ...assistants];
  }

  toDto(row: {
    id: string;
    role: string;
    contentAr: string;
    payloadJson?: unknown;
    blocked: boolean;
    createdAt: Date;
  }): ConsultationMessageResponseDto {
    const payload = row.payloadJson as { attachmentIds?: string[]; clientMessageId?: string; suggestedQuestionsAr?: string[] } | null;
    return {
      id: row.id,
      role: row.role,
      contentAr: row.contentAr,
      payload: row.payloadJson as MceAssistantPayloadV1 | undefined,
      attachmentIds: Array.isArray(payload?.attachmentIds) ? payload.attachmentIds : [],
      clientMessageId: typeof payload?.clientMessageId === 'string' ? payload.clientMessageId : undefined,
      suggestedQuestionsAr: Array.isArray(payload?.suggestedQuestionsAr) ? payload.suggestedQuestionsAr : [],
      blocked: row.blocked,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
