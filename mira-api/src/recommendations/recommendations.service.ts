import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MiraOccasion } from '../ai/contracts/mira-occasion';
import { MiraRecommendation } from '../ai/contracts/mira-recommendation.interface';
import { OutfitAnalysisResult } from '../ai/contracts/outfit-analysis-result.interface';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import { MiraRecommendationEngine } from '../ai/engine/mira-recommendation.engine';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly engine: MiraRecommendationEngine,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async build(
    authUser: RequestUser,
    skin: SkinAnalysisResult,
    outfit?: OutfitAnalysisResult,
    occasion?: MiraOccasion,
  ): Promise<MiraRecommendation> {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);

    const recommendation = this.engine.build({ skin, outfit, occasion });

    await this.prisma.recommendation.create({
      data: {
        userId: user.id,
        occasionId: recommendation.occasion ?? null,
        resultJson: recommendation as unknown as Prisma.InputJsonValue,
      },
    });

    await this.usersService.writeAuditLog({
      userId: user.id,
      action: 'recommendation.generated',
    });

    return recommendation;
  }

  async history(authUser: RequestUser, limit = 20) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const rows = await this.prisma.recommendation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      occasionId: row.occasionId,
      data: row.resultJson as unknown as MiraRecommendation,
    }));
  }
}
