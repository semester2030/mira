import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendConsultationMessageDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  contextSnapshotId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientMessageId?: string;
}
