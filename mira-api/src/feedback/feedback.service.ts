import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async submit(authUser: RequestUser, dto: SubmitFeedbackDto) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    return this.prisma.feedback.create({
      data: {
        userId: user.id,
        target: dto.target,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }
}
