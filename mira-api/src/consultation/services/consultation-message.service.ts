import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';
import { ConsultationMessageResponseDto } from '../dto/consultation-response.dto';

@Injectable()
export class ConsultationMessageService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sessionId: string, limit = 50): Promise<ConsultationMessageResponseDto[]> {
    const rows = await this.prisma.consultationMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => this.toDto(r));
  }

  async recentPairs(sessionId: string, limit = 8) {
    const rows = await this.prisma.consultationMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows
      .reverse()
      .map((r) => ({
        role: r.role as 'user' | 'assistant',
        content: r.contentAr,
      }));
  }

  async persistUser(sessionId: string, contentAr: string) {
    return this.prisma.consultationMessage.create({
      data: { sessionId, role: 'user', contentAr },
    });
  }

  async persistAssistant(
    sessionId: string,
    contentAr: string,
    payload: MceAssistantPayloadV1,
    meta: { modelId?: string; tokenCountOut?: number; latencyMs: number; blocked: boolean },
  ) {
    return this.prisma.consultationMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        contentAr,
        payloadJson: payload as object,
        modelId: meta.modelId,
        tokenCountOut: meta.tokenCountOut,
        latencyMs: meta.latencyMs,
        blocked: meta.blocked,
      },
    });
  }

  toDto(row: {
    id: string;
    role: string;
    contentAr: string;
    payloadJson?: unknown;
    blocked: boolean;
    createdAt: Date;
  }): ConsultationMessageResponseDto {
    return {
      id: row.id,
      role: row.role,
      contentAr: row.contentAr,
      payload: row.payloadJson as MceAssistantPayloadV1 | undefined,
      blocked: row.blocked,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
