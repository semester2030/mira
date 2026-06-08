import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
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

  @Get('me/preferences')
  async preferences(@CurrentUser() authUser: RequestUser) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const prefs = await this.usersService.getPreferences(user.id);
    return {
      locale: prefs?.locale ?? 'ar',
      birthYear: prefs?.birthYear ?? null,
    };
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() authUser: RequestUser,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const prefs = await this.usersService.updatePreferences(user.id, {
      birthYear: dto.birthYear,
      locale: dto.locale,
    });

    await this.usersService.writeAuditLog({
      userId: user.id,
      action: 'user.preferences_updated',
      metadata: {
        birthYear: prefs.birthYear,
        locale: prefs.locale,
      },
    });

    return {
      locale: prefs.locale,
      birthYear: prefs.birthYear,
    };
  }

  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() authUser: RequestUser) {
    await this.usersService.deleteAccount(authUser);
  }
}
