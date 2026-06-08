import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdvisorChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  analysisId?: string;
}
