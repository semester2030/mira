import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import {
  SKIN_ANALYSIS_PROVIDER,
  SkinAnalysisProvider,
} from '../ai/providers/skin-analysis.provider';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { SkinAnalysisResponseDto } from './dto/skin-analysis-response.dto';

@Injectable()
export class SkinAnalysisService {
  constructor(
    @Inject(SKIN_ANALYSIS_PROVIDER)
    private readonly skinProvider: SkinAnalysisProvider,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async analyze(
    authUser: RequestUser,
    imageBuffer: Buffer,
  ): Promise<SkinAnalysisResponseDto> {
    if (!imageBuffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    await this.subscriptions.assertCanAnalyze(authUser, 'skin');
    await this.rateLimit.assertWithinLimit(user.id, 'skin-analysis');

    // Image buffer is held in memory only — never written to disk or object storage.
    const skin = await this.skinProvider.analyze(imageBuffer);
    imageBuffer.fill(0);

    const record = await this.prisma.skinAnalysis.create({
      data: {
        userId: user.id,
        resultJson: skin as unknown as Prisma.InputJsonValue,
      },
    });

    await this.usersService.writeAuditLog({
      userId: user.id,
      action: 'skin_analysis.completed',
      metadata: {
        analysisId: record.id,
        privacyPolicyVersion: '1.0',
        imageRetained: false,
      },
    });

    return SkinAnalysisResponseDto.from(record.id, record.createdAt, skin);
  }

  async history(authUser: RequestUser, limit = 20) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const rows = await this.prisma.skinAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      skin: row.resultJson as unknown as SkinAnalysisResult,
    }));
  }
}
