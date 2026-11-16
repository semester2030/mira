import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { ConsultantDiscoveryService } from './consultant-discovery.service';

class ConsultantTurnDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsBoolean()
  hasFaceImage?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  limit?: number;
}

@Controller('consultant-discovery')
@UseGuards(FirebaseAuthGuard)
export class ConsultantDiscoveryController {
  constructor(private readonly discovery: ConsultantDiscoveryService) {}

  @Get('status')
  status() {
    return {
      enabled: this.discovery.enabled(),
      version: this.discovery.version(),
    };
  }

  @Post('turn')
  turn(@Body() dto: ConsultantTurnDto) {
    return this.discovery.turn({
      message: dto.message,
      hasFaceImage: dto.hasFaceImage,
      limit: dto.limit,
    });
  }
}
