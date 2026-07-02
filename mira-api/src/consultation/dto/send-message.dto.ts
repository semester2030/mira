import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendConsultationMessageDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  contextSnapshotId?: string;
}
