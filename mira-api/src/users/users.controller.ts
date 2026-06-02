import { Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() authUser: RequestUser) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() authUser: RequestUser) {
    await this.usersService.deleteAccount(authUser);
  }
}
