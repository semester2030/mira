import { IsIn, IsOptional, IsString } from 'class-validator';

export class TrackPartnerEventDto {
  @IsString()
  partnerId!: string;

  @IsIn(['impression', 'click', 'booking_request'])
  eventType!: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsIn(['product', 'service'])
  targetType?: string;
}
